/**
 * Seed nội dung BCKS từ catalog pháp lý/TC + KL NVKS + hồ sơ liên quan.
 */
import {
  dedupeCatalogRowsByContent,
  fetchSortedCspl,
  fetchSortedTieuChuan,
  PHAM_VI_KHAO_SAT,
} from "./legalCatalog";
import { NKKS_DEFAULT_MAY_MOC } from "./nkksAutoFillFromKl";
import { resolveNvksKlSourceForNkks } from "./nkksKlSource";
import { parseKlNumber } from "./klTableUtils";
import {
  BCKS_RTK_SAMPLE_BODY,
  createEmptyBcksReport,
  emptyBcksKlRow,
  formatBcksTcRowsForWord,
  isMuc22ViTriPlaceholder,
  joinMuc22ViTri,
  normalizeBcksReport,
  normalizeBcksTcRow,
  recomputeBcksKlRow,
} from "./bcksReportSchema";
import { supplementDmCongViec } from "./nvksLoaiHinh";

/** seed_version tăng khi đổi logic seed — form cũ seed_version < này sẽ được seed lại các ô trống */
export const BCKS_REPORT_SEED_VERSION = 7;

function pickText(...vals) {
  for (const v of vals) {
    const s = String(v ?? "").trim();
    if (s) return s;
  }
  return "";
}

/** Mẫu khung mục 2.1 — còn placeholder / nhãn cũ / format quy mô chưa dùng «+» */
export function isMuc21DacDiemPlaceholder(text) {
  const s = String(text || "").trim();
  if (!s) return true;
  if (/Cấp công trình:/i.test(s)) return true;
  if (/Tên công trình:\s*([.…]+|\.{3})\s*$/im.test(s)) return true;
  // Format cũ: nội dung quy mô cùng dòng với «- Quy mô:»
  if (/^- Quy mô:\s*\S/im.test(s)) return true;
  // Có khối quy mô nhưng dòng con vẫn dùng «-» thay vì «+»
  if (/^- Quy mô:\s*$/im.test(s)) {
    const after = s.split(/^- Quy mô:\s*$/im)[1] || "";
    const block = after.split(/^- Tính chất công trình:/im)[0] || "";
    if (/^-\s+\S/m.test(block)) return true;
  }
  const sample = String(BCKS_RTK_SAMPLE_BODY.muc2_1_dac_diem || "").trim();
  if (s === sample) return true;
  return false;
}

function formatQuyMoPlusBullets(quyMoRaw) {
  const raw = String(quyMoRaw || "").trim();
  if (!raw || raw === "…") return ["+ …"];
  return raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const stripped = line.replace(/^[-+•*]\s*/, "").trim();
      return stripped ? `+ ${stripped}` : null;
    })
    .filter(Boolean);
}

export function buildMuc21DacDiem({ project, nvksRecord } = {}) {
  const ten = pickText(project?.ten_du_an, nvksRecord?.ten_du_an) || "…";
  const quyMoRaw =
    pickText(project?.quy_mo_dieu_chinh, project?.quy_mo, nvksRecord?.quy_mo) || "…";
  const quyMoLines = formatQuyMoPlusBullets(quyMoRaw);
  return [
    `- Tên công trình: ${ten}`,
    `- Quy mô:`,
    ...quyMoLines,
    "- Tính chất công trình: Công trình công nghiệp năng lượng",
  ].join("\n");
}

function buildCanCuFromCatalog(csplRows, { nvksRecord, paktksRecord } = {}) {
  const unique = dedupeCatalogRowsByContent(csplRows || [], "cspl");
  const lines = ["Báo cáo khảo sát xây dựng được lập dựa trên các căn cứ pháp lý và tài liệu sau:"];
  for (const item of unique) {
    const ten = String(item?.ten_cspl || "").trim();
    if (ten) lines.push(`- ${ten.endsWith(";") ? ten : `${ten};`}`);
  }

  lines.push(
    "- Hợp đồng tư vấn khảo sát số …/HĐ-KS ngày …/…/…. ký giữa Chủ đầu tư và Công ty Dịch vụ Điện lực Miền Bắc."
  );

  const nv =
    pickText(
      nvksRecord?.quyet_dinh_phe_duyet_nvks_day_du,
      nvksRecord?.quyet_dinh_phe_duyet_nvks
    ) || "…/QĐ-CĐT ngày …/…/….";
  lines.push(`- Nhiệm vụ khảo sát được phê duyệt theo ${nv.startsWith("Quyết định") || nv.includes("Quyết định") ? nv : `Quyết định số ${nv}`}.`);

  const pa = pickText(
    paktksRecord?.quyet_dinh_phe_duyet_paktks_day_du,
    paktksRecord?.quyet_dinh_phe_duyet_paktks,
    "Phương án kỹ thuật khảo sát đã được Chủ đầu tư chấp thuận."
  );
  lines.push(pa.startsWith("-") ? pa : `- ${pa}`);

  return lines.join("\n");
}

function buildTieuChuanRowsFromCatalog(tcRows) {
  const unique = dedupeCatalogRowsByContent(tcRows || [], "tc");
  return unique
    .map((tc, idx) =>
      normalizeBcksTcRow(
        {
          ky_hieu: String(tc?.ky_hieu || "").trim(),
          ten_tai_lieu: String(tc?.ten_tai_lieu || "").trim(),
        },
        idx
      )
    )
    .filter((r) => r.ky_hieu || r.ten_tai_lieu);
}

/** Map hàng KL NVKS → bảng BCKS (PD từ NVKS; TH mặc định = PD) */
export function mapNvksKlRowsToBcks(nvksRows) {
  const out = [];
  for (const r of nvksRows || []) {
    if (r?.is_header) {
      out.push(
        emptyBcksKlRow({
          stt: String(r.stt || ""),
          noi_dung: String(r.noi_dung || ""),
          is_header: true,
        })
      );
      continue;
    }
    const pd = String(r.khoi_luong ?? r.kl_01 ?? "").trim();
    // Bỏ hàng không có KL số / «Trọn bộ» vẫn giữ
    if (!pd && parseKlNumber(pd) === 0 && pd !== "0") {
      // still allow "Trọn bộ"
    }
    out.push(
      recomputeBcksKlRow({
        id_cong_viec: r.id_cong_viec || "",
        stt: String(r.stt || ""),
        noi_dung: String(r.noi_dung || ""),
        don_vi: String(r.don_vi || ""),
        kl_phe_duyet: pd,
        kl_thuc_hien: pd,
        ghi_chu: String(r.ghi_chu || ""),
        is_header: false,
      })
    );
  }
  return out;
}

/**
 * Seed / bổ sung report khi mở form.
 * - Không ghi đè ô user đã sửa (có seed_version đủ và field đã có nội dung).
 * - Lần đầu (seed_version < BCKS_REPORT_SEED_VERSION): seed căn cứ/TC/máy móc/KL nếu trống hoặc còn mẫu khung.
 */
export async function seedBcksReportFromSources(report, {
  supabase,
  project,
  nvksRecord,
  paktksRecord,
  forceKl = false,
} = {}) {
  let next = normalizeBcksReport(report);
  const needsSeed = next.seed_version < BCKS_REPORT_SEED_VERSION;

  // Nhân sự bìa từ NVKS nếu trống
  if (!next.nguoi_lap) next.nguoi_lap = pickText(nvksRecord?.nguoi_lap);
  if (!next.chu_nhiem_ks) next.chu_nhiem_ks = pickText(nvksRecord?.chu_nhiem_ks);
  if (!next.lanh_dao_duyet) next.lanh_dao_duyet = pickText(nvksRecord?.lanh_dao_duyet);
  if (!next.thoi_diem_lap) next.thoi_diem_lap = pickText(nvksRecord?.thoi_diem_lap);

  if (supabase && needsSeed) {
    try {
      const [cspl, tc] = await Promise.all([
        fetchSortedCspl(supabase, { activeOnly: true, phamVi: PHAM_VI_KHAO_SAT }),
        fetchSortedTieuChuan(supabase, { activeOnly: true, phamVi: PHAM_VI_KHAO_SAT }),
      ]);
      const canCu = buildCanCuFromCatalog(cspl, { nvksRecord, paktksRecord });
      if (canCu) next.muc1_can_cu = canCu;
      const tcRows = buildTieuChuanRowsFromCatalog(tc);
      if (tcRows.length) {
        next.muc3_1_rows = tcRows;
        next.muc3_1_tieu_chuan = formatBcksTcRowsForWord(tcRows);
      }
    } catch (err) {
      console.warn("BCKS seed catalog:", err);
    }

    if (!String(next.muc3_2_may_moc || "").trim()) {
      next.muc3_2_may_moc = NKKS_DEFAULT_MAY_MOC;
    }
  } else if (!String(next.muc3_2_may_moc || "").trim()) {
    next.muc3_2_may_moc = NKKS_DEFAULT_MAY_MOC;
  }

  // v7+: mục 2.1 — tên DA + quy mô + tính chất (chỉ khi còn placeholder / nhãn cũ)
  if (isMuc21DacDiemPlaceholder(next.muc2_1_dac_diem)) {
    next.muc2_1_dac_diem = buildMuc21DacDiem({ project, nvksRecord });
  }

  // mục 2.2 — khung trống + gợi ý đỏ trên UI (không nhét chữ đỏ vào nội dung xuất)
  if (isMuc22ViTriPlaceholder(next.muc2_2_vi_tri)) {
    next.muc2_2_vi_tri = joinMuc22ViTri("", "");
  }

  // v6+: nội dung 3.3.1 / 3.3.2 từ mẫu Quy_trinh_va_Phuong_phap_Khao_sat
  if (needsSeed) {
    next.muc3_3a_dia_hinh = BCKS_RTK_SAMPLE_BODY.muc3_3a_dia_hinh;
    next.muc3_3b_dia_chat = BCKS_RTK_SAMPLE_BODY.muc3_3b_dia_chat;
  }

  const shouldSeedKl =
    forceKl ||
    (needsSeed && (!Array.isArray(next.muc4_1_rows) || next.muc4_1_rows.length === 0));

  if (supabase && shouldSeedKl) {
    try {
      const maDuAn = project?.ma_du_an || nvksRecord?.ma_du_an;
      const { data: cvRows } = await supabase
        .from("DM_CONG_VIEC")
        .select("*")
        .order("id_cong_viec", { ascending: true });
      const templateData = supplementDmCongViec(cvRows || []);
      const resolved = await resolveNvksKlSourceForNkks(supabase, maDuAn, {
        templateData,
        project,
      });
      const mapped = mapNvksKlRowsToBcks(resolved.rows || []);
      if (mapped.length) next.muc4_1_rows = mapped;
    } catch (err) {
      console.warn("BCKS seed KL NVKS:", err);
    }
  }

  next.seed_version = Math.max(next.seed_version, BCKS_REPORT_SEED_VERSION);
  return next;
}

export function createSeededEmptyBcksReport() {
  const base = createEmptyBcksReport();
  base.muc3_2_may_moc = NKKS_DEFAULT_MAY_MOC;
  return base;
}
