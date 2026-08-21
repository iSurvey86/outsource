/**
 * Lưu dự án từ module Nhập DA (ksnpsc) vào OUTSRC `du_an` + moc/ks.
 * TMĐT từ ScanAI/ksnpsc là Tr.đ (triệu) → lưu VND (* 1e6).
 * Giai đoạn FS → BCNCKT (khớp UI OUTSRC).
 */

import {
  buildDefaultKsList,
  buildDefaultMocList,
  buildDuAnRecord,
} from "./duAnMeta";
import { formatGiaoAShort, normalizeVietnameseGiaoADate } from "./formatGiaoA";
import { normalizeGiaiDoanChuan } from "./giaiDoanOrder";
import {
  createDuAnBundle,
  deleteDuAnCascade,
  fetchDb,
  insertRow,
  logActivity,
  uid,
  updateRow,
} from "./store";

function mapGiaiDoan(gd) {
  const chuan = normalizeGiaiDoanChuan(gd) || String(gd || "").trim().toUpperCase();
  if (chuan === "FS") return "BCNCKT";
  return chuan || "BCNCKT";
}

/** Chuẩn hóa số QĐ ngắn: luôn dạng «406/QĐ-… ngày 24/7/2026». */
function normalizeQdGiaoAShort(qdShort, qdDayDu) {
  const short = formatGiaoAShort(qdShort, qdDayDu);
  if (short && short !== "-") return short.replace(/\n/g, " ").trim();
  return normalizeVietnameseGiaoADate(String(qdShort || "").trim());
}

/** Lấy yyyy-mm-dd từ chuỗi «… ngày d/m/yyyy», «ngày … tháng … năm …» hoặc ISO. */
function extractNgayGiaoAIso(qdDayDu, qdShort, ngayHint) {
  const hint = String(ngayHint || "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(hint)) return hint.slice(0, 10);

  const text = normalizeVietnameseGiaoADate([qdDayDu, qdShort].filter(Boolean).join(" "));
  const m = text.match(/ngày\s+(\d{1,2})[\/.\-](\d{1,2})[\/.\-]((\d{4})|(\d{2}))/i);
  if (!m) return "";
  const d = String(m[1]).padStart(2, "0");
  const mo = String(m[2]).padStart(2, "0");
  let y = m[3];
  if (y.length === 2) y = `20${y}`;
  return `${y}-${mo}-${d}`;
}

/** Tr.đ → VND */
export function tmdtTrieuToVnd(trieu) {
  const n = Number(trieu) || 0;
  if (n <= 0) return 0;
  // Nếu đã là VND lớn (> 1 tỷ và không phải kiểu triệu phụ lục), giữ nguyên
  if (n >= 1_000_000_000) return Math.round(n);
  return Math.round(n * 1_000_000);
}

export function mapExistingProjectsForDupCheck(duAnList = []) {
  return duAnList.map((d) => ({
    ...d,
    ten_du_an: d.ten_du_an || d.ten,
    dia_diem_ks: d.dia_diem_ks || d.dia_diem,
  }));
}

/**
 * @param {object} opts
 * @param {Array} opts.payload - rows kiểu ksnpsc upsert (ten_du_an, dia_diem_ks, tmdt Tr.đ, …)
 * @param {Array} opts.projectsToReplaceOldCode - rows có replaceOldMaDuAn
 * @param {object} opts.user
 * @param {string} opts.entryMode
 * @param {string} [opts.pdfFileName]
 */
export async function saveNhapDuAnPayload({
  payload,
  projectsToReplaceOldCode = [],
  user,
  entryMode = "scan",
  pdfFileName = "",
}) {
  if (!payload?.length) {
    throw new Error("Không có dòng hợp lệ để lưu (thiếu mã dự án).");
  }

  try {
    const db = await fetchDb();
    const byMa = new Map(db.duAn.map((d) => [String(d.ma_du_an).toUpperCase(), d]));

    // Đổi mã cũ → mã mới (chỉ bảng du_an + giữ id)
    for (const p of projectsToReplaceOldCode) {
      const oldMa = p.replaceOldMaDuAn || p.duplicateCandidate?.ma_du_an;
      const newMa = p.ma_du_an;
      if (!oldMa || !newMa || oldMa === newMa) continue;
      const old = byMa.get(String(oldMa).toUpperCase());
      if (old) {
        await updateRow("du_an", old.id, { ma_du_an: newMa });
        byMa.delete(String(oldMa).toUpperCase());
        byMa.set(String(newMa).toUpperCase(), { ...old, ma_du_an: newMa });
      }
    }

    let created = 0;
    let updated = 0;

    for (const row of payload) {
      const ma = String(row.ma_du_an || "").trim();
      if (!ma) continue;

      const giaiDoan = mapGiaiDoan(row.giai_doan);
      const tmdtVnd = tmdtTrieuToVnd(row.tmdt);
      const qdShort = normalizeQdGiaoAShort(row.qd_giao_a, row.qd_giao_a_day_du);
      const qdDayDu = normalizeVietnameseGiaoADate(String(row.qd_giao_a_day_du || "").trim());
      const form = {
        ma_du_an: ma,
        ten: row.ten_du_an,
        chu_dau_tu: row.chu_dau_tu || "",
        quy_mo: row.quy_mo || "",
        dia_diem: row.dia_diem_ks || "",
        giai_doan: giaiDoan,
        cap_dien_ap: row.cap_dien_ap || "",
        qd_giao_a: qdShort,
        qd_giao_a_day_du: qdDayDu,
        nam_giao_a: row.nam_giao_a || "",
        ngay_giao_a: extractNgayGiaoAIso(qdDayDu, qdShort, row.ngay_giao_a),
        hop_dong: "",
        hop_dong_day_du: "",
        link_pdf_giao_a_goc: row.link_pdf_giao_a_goc || "",
        tmdt: tmdtVnd,
        gia_tri_tu_van: 0,
        nguon_gia_tri: "padt_tam_tinh",
        ben_a_user_id: "",
      };

      const existing = byMa.get(ma.toUpperCase());
      if (existing) {
        const patch = {
          ten: form.ten,
          chu_dau_tu: form.chu_dau_tu,
          quy_mo: form.quy_mo,
          dia_diem: form.dia_diem,
          giai_doan: form.giai_doan,
          cap_dien_ap: form.cap_dien_ap,
          qd_giao_a: form.qd_giao_a,
          qd_giao_a_day_du: form.qd_giao_a_day_du,
          nam_giao_a: form.nam_giao_a,
          ngay_giao_a: form.ngay_giao_a || null,
          tmdt: form.tmdt,
        };
        if (form.link_pdf_giao_a_goc) {
          patch.link_pdf_giao_a_goc = form.link_pdf_giao_a_goc;
        }
        await updateRow("du_an", existing.id, patch);
        if (pdfFileName) {
          await insertRow("tai_lieu", {
            id: uid("tl"),
            du_an_id: existing.id,
            loai_kho: "khao_sat",
            nguon: "upload",
            ten_file: pdfFileName,
            ghi_chu: "PDF Giao A gốc (nhập DA)",
            nguoi_up_id: user?.id || null,
            thoi_gian: new Date().toISOString(),
            module_loai: null,
            storage_path: row.link_pdf_giao_a_goc || null,
          });
        }
        updated += 1;
      } else {
        const id = uid("da");
        const duAn = buildDuAnRecord(form, { id, userId: user?.id });
        await createDuAnBundle({
          duAn,
          mocList: buildDefaultMocList(id),
          ksList: buildDefaultKsList(id),
        });
        if (pdfFileName) {
          await insertRow("tai_lieu", {
            id: uid("tl"),
            du_an_id: id,
            loai_kho: "khao_sat",
            nguon: "upload",
            ten_file: pdfFileName,
            ghi_chu: "PDF Giao A gốc (nhập DA)",
            nguoi_up_id: user?.id || null,
            thoi_gian: new Date().toISOString(),
            module_loai: null,
            storage_path: row.link_pdf_giao_a_goc || null,
          });
        }
        byMa.set(ma.toUpperCase(), { ...duAn });
        created += 1;
      }
    }

    await logActivity({
      username: user?.username,
      ho_ten: user?.ho_ten,
      phan_he: "du_an",
      hanh_dong: "NHAP_DA",
      chi_tiet: `${entryMode}: +${created} / cập nhật ${updated}${
        payload[0]?.qd_giao_a ? ` · QĐ ${payload[0].qd_giao_a}` : ""
      }`,
    });

    return { created, updated };
  } catch (err) {
    const msg = String(err?.message || err || "");
    if (/cap_dien_ap|qd_giao_a|nam_giao_a|hop_dong|tmdt|schema cache/i.test(msg)) {
      throw new Error(
        `${msg}\n\n→ Supabase thiếu cột mới. Mở SQL Editor, chạy scripts/sql/002_du_an_giao_a.sql rồi thử lưu lại.`
      );
    }
    throw err instanceof Error ? err : new Error(msg);
  }
}

/** Xóa DA theo mã (khi cần) — không dùng trong save mặc định */
export async function deleteDuAnByMa(maDuAn) {
  const db = await fetchDb();
  const row = db.duAn.find((d) => d.ma_du_an === maDuAn);
  if (row) await deleteDuAnCascade(row.id);
}
