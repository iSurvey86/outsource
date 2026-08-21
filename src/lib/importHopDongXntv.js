/**
 * Import số liệu từ Excel Tổng hợp doanh thu (hopdongxntv.xlsx).
 * Map: Công trình + Giai đoạn → du_an; Số HĐ → HOP_DONG.
 */

import * as XLSX from "xlsx";
import { bgdGroupKeyForProject, normalizeTenDuAn } from "./giaoViecInbox";
import { formatGiaiDoanBadge, normalizeGiaiDoanChuan } from "./giaiDoanOrder";
import {
  HOP_DONG_LOAI,
  HOP_DONG_TRANG_THAI,
  HOP_DONG_COLUMNS,
  HOP_DONG_EXTENDED_COLUMNS,
} from "./hopDong";
import { emptyKhoiLuongRow, thucHienPayloadFromRow } from "./hopDongKhoiLuong";
import {
  clearXuatHdForPair,
  insertXuatHd,
  numOrNull,
  upsertThucHien,
  HOP_DONG_XUAT_LOAI,
} from "./hopDongThucHien";

/** Chỉ số cột sheet «Tong hop doanh thu» (0-based, hàng tiêu đề = row 2). */
export const COL = {
  CONG_TRINH: 5,
  GIAI_DOAN: 6,
  SO_HD: 15,
  NGAY_KY: 16,
  THOI_HAN: 17,
  PL_GIA_HAN: 18,
  NGAY_KY_PL: 19,
  THOI_GIAN_GIA_HAN: 20,
  DICH_VU: 23,
  HIEN_TRANG: 24,
  THANG_PD_DK: 26,
  THANG_PD_TT: 27,
  THANG_NT_DK: 28,
  THANG_NT_TT: 29,
  NAM_NT: 30,
  SAN_LUONG: 31,
  GIA_TRI_HD: 32,
  GIA_TRI_KS: 33,
  GIA_TRI_LAP_HS: 34,
  GIA_TRI_CTDT: 35,
  GIA_TRI_TONG: 36,
  YEAR_START: 37, // 2019…2026 = 37..45
  YEAR_END: 45,
  DA_XUAT: 46,
  CON_LAI: 47,
  NAM_XUAT: 48,
  NGAY_XUAT: 49,
  SO_HOA_DON: 50,
  TINH_HINH_XUAT: 51,
  HSNT: 52,
  TON_TAI_NT: 53,
  TON_TAI_KT: 54,
  BB_KS_HT: 58,
  BB_NT: 59,
};

const YEAR_LABELS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];

export const DEFAULT_IMPORT_TEMPLATE_PATH = "/templates/templates_hd/hopdongxntv.xlsx";

function softKey(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cắt phần « ngày dd/mm/yyyy» khỏi số HĐ Excel. */
export function normalizeSoHopDongImport(raw) {
  let s = String(raw || "").trim();
  if (!s) return "";
  s = s.replace(/\s+/g, " ");
  const m = s.match(/^(.+?)\s+ngày\s+/i);
  if (m) s = m[1].trim();
  return s;
}

function excelSerialToIso(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
      const iso = t.slice(0, 10);
      const y = Number(iso.slice(0, 4));
      return y >= 1990 && y <= 2100 ? iso : null;
    }
    const m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      const dd = m[1].padStart(2, "0");
      const mm = m[2].padStart(2, "0");
      let year = m[3];
      if (year.length === 2) {
        const n = Number(year);
        year = String(n >= 70 ? 1900 + n : 2000 + n);
      }
      const y = Number(year);
      if (y < 1990 || y > 2100) return null;
      return `${year}-${mm}-${dd}`;
    }
    const n = Number(t.replace(",", "."));
    if (Number.isFinite(n) && n > 20000) raw = n;
    else return null;
  }
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  try {
    const d = XLSX.SSF.parse_date_code(raw);
    if (!d) return null;
    if (d.y < 1990 || d.y > 2100) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  } catch {
    return null;
  }
}

function intOrNull(raw) {
  const n = numOrNull(raw);
  if (n === null) return null;
  return Math.round(n);
}

/**
 * Đọc sheet Tổng hợp → mảng dòng chuẩn hoá.
 * @param {ArrayBuffer|Buffer|Uint8Array} buffer
 */
export function parseTongHopDoanhThuBuffer(buffer) {
  const wb = XLSX.read(buffer, { type: "array", cellDates: false });
  const name =
    wb.SheetNames.find((n) => softKey(n).includes("tong hop doanh thu")) ||
    wb.SheetNames.find((n) => softKey(n).includes("tong hop")) ||
    wb.SheetNames[0];
  const sh = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: "" });

  const out = [];
  for (let i = 4; i < rows.length; i++) {
    const r = rows[i] || [];
    const congTrinh = String(r[COL.CONG_TRINH] || "").trim();
    const soHdRaw = String(r[COL.SO_HD] || "").trim();
    if (!congTrinh && !soHdRaw) continue;

    const yearAmts = [];
    for (let c = COL.YEAR_START; c <= COL.YEAR_END; c++) {
      const amt = numOrNull(r[c]);
      if (amt != null && amt !== 0) {
        yearAmts.push({ nam: YEAR_LABELS[c - COL.YEAR_START], so_tien: amt });
      }
    }

    out.push({
      excelRow: i + 1,
      cong_trinh: congTrinh,
      giai_doan: String(r[COL.GIAI_DOAN] || "").trim(),
      giai_doan_chuan: normalizeGiaiDoanChuan(r[COL.GIAI_DOAN]),
      so_hop_dong_raw: soHdRaw,
      so_hop_dong: normalizeSoHopDongImport(soHdRaw),
      ngay_ky: excelSerialToIso(r[COL.NGAY_KY]),
      thoi_han_ngay: intOrNull(r[COL.THOI_HAN]),
      pl_gia_han: String(r[COL.PL_GIA_HAN] || "").trim() || null,
      ngay_ky_pl: excelSerialToIso(r[COL.NGAY_KY_PL]),
      thoi_gian_gia_han: intOrNull(r[COL.THOI_GIAN_GIA_HAN]),
      dich_vu_tu_van: String(r[COL.DICH_VU] || "").trim() || null,
      hien_trang: String(r[COL.HIEN_TRANG] || "").trim() || null,
      thang_pd_du_kien: intOrNull(r[COL.THANG_PD_DK]),
      thang_pd_thuc_te: intOrNull(r[COL.THANG_PD_TT]),
      thang_nt_du_kien: intOrNull(r[COL.THANG_NT_DK]),
      thang_nt_thuc_te: intOrNull(r[COL.THANG_NT_TT]),
      nam_nt: intOrNull(r[COL.NAM_NT]),
      san_luong_du_kien: numOrNull(r[COL.SAN_LUONG]),
      gia_tri_hd: numOrNull(r[COL.GIA_TRI_HD]),
      gia_tri_ks: numOrNull(r[COL.GIA_TRI_KS]),
      gia_tri_lap_hs: numOrNull(r[COL.GIA_TRI_LAP_HS]),
      gia_tri_ctdt: numOrNull(r[COL.GIA_TRI_CTDT]),
      gia_tri_tong_phan_ra: numOrNull(r[COL.GIA_TRI_TONG]),
      yearAmts,
      da_xuat_hd: numOrNull(r[COL.DA_XUAT]),
      con_lai: numOrNull(r[COL.CON_LAI]),
      nam_xuat: intOrNull(r[COL.NAM_XUAT]),
      ngay_xuat: excelSerialToIso(r[COL.NGAY_XUAT]),
      so_hoa_don: String(r[COL.SO_HOA_DON] || "").trim() || null,
      tinh_hinh_xuat_hd: String(r[COL.TINH_HINH_XUAT] || "").trim() || null,
      hsnt_trang_thai: String(r[COL.HSNT] || "").trim() || null,
      ton_tai_nt: String(r[COL.TON_TAI_NT] || "").trim() || null,
      ton_tai_kt: String(r[COL.TON_TAI_KT] || "").trim() || null,
      bb_ks_ht: String(r[COL.BB_KS_HT] || "").trim() || null,
      bb_nt: String(r[COL.BB_NT] || "").trim() || null,
    });
  }
  return { sheetName: name, rows: out };
}

function projectGd(p) {
  return normalizeGiaiDoanChuan(p.giai_doan_chuan || p.giai_doan);
}

/**
 * Ghép dòng Excel → ma_du_an trong danh mục.
 */
export function matchExcelRowToProject(row, projects) {
  const list = projects || [];
  const gd = row.giai_doan_chuan || normalizeGiaiDoanChuan(row.giai_doan);
  const keyExact = normalizeTenDuAn(row.cong_trinh);
  const soft = softKey(row.cong_trinh);

  let candidates = list.filter((p) => normalizeTenDuAn(p.ten) === keyExact);
  if (!candidates.length && soft) {
    candidates = list.filter((p) => softKey(p.ten) === soft);
  }
  if (!candidates.length && soft) {
    candidates = list.filter((p) => {
      const t = softKey(p.ten);
      return t.includes(soft) || soft.includes(t);
    });
  }

  if (!candidates.length) return { status: "unmatched", reason: "Không tìm thấy công trình" };

  if (gd) {
    const byGd = candidates.filter((p) => projectGd(p) === gd);
    if (byGd.length === 1) return { status: "matched", project: byGd[0] };
    if (byGd.length > 1) {
      return {
        status: "ambiguous",
        reason: `Nhiều mã DA cùng giai đoạn ${gd}`,
        candidates: byGd,
      };
    }
    return {
      status: "unmatched",
      reason: `Có công trình nhưng không khớp giai đoạn «${row.giai_doan || gd}»`,
      candidates,
    };
  }

  if (candidates.length === 1) return { status: "matched", project: candidates[0] };
  return { status: "ambiguous", reason: "Thiếu giai đoạn — nhiều mã DA", candidates };
}

/**
 * Chuẩn bị bản nháp import (không ghi DB) — trả drafts có thể sửa trên UI.
 * @param {{ scopeNhomKey?: string|null }} options
 */
export async function prepareImportDraft(supabase, buffer, options = {}) {
  const scopeNhomKey = options.scopeNhomKey ? String(options.scopeNhomKey) : null;
  const parsed = parseTongHopDoanhThuBuffer(buffer);

  const { data: projects, error: pErr } = await supabase
    .from("du_an")
    .select("ma_du_an, ten, giai_doan, hop_dong, hop_dong_day_du");
  if (pErr) throw pErr;

  let existingHd;
  {
    const first = await supabase.from("HOP_DONG").select(HOP_DONG_EXTENDED_COLUMNS);
    if (first.error) {
      const fallback = await supabase.from("HOP_DONG").select(HOP_DONG_COLUMNS);
      if (fallback.error) throw first.error;
      existingHd = fallback.data;
    } else {
      existingHd = first.data;
    }
  }

  const hdByNhomSoDate = new Map();
  const hdCandidatesByNhomSo = new Map();
  for (const h of existingHd || []) {
    if (h.loai === HOP_DONG_LOAI.THAU_PHU) continue;
    const so = normalizeSoHopDongImport(h.so_hop_dong);
    if (!so) continue;
    const baseKey = `${h.nhom_cong_trinh_key}||${softKey(so)}`;
    if (!hdCandidatesByNhomSo.has(baseKey)) hdCandidatesByNhomSo.set(baseKey, []);
    hdCandidatesByNhomSo.get(baseKey).push(h);
    if (h.ngay_ky) hdByNhomSoDate.set(`${baseKey}||${h.ngay_ky}`, h);
  }

  const summary = {
    sheetName: parsed.sheetName,
    totalRows: parsed.rows.length,
    matched: 0,
    unmatched: 0,
    ambiguous: 0,
    ambiguousContract: 0,
    skippedScope: 0,
    wouldCreateHd: 0,
    wouldUpdateHd: 0,
    wouldUpsertTh: 0,
    applied: {
      createdHd: 0,
      updatedHd: 0,
      upsertTh: 0,
      xuatEvents: 0,
      errors: [],
    },
    unmatchedSamples: [],
    ambiguousSamples: [],
    ambiguousContractSamples: [],
  };

  const drafts = [];

  for (const row of parsed.rows) {
    const match = matchExcelRowToProject(row, projects);
    if (match.status === "unmatched") {
      summary.unmatched += 1;
      if (summary.unmatchedSamples.length < 40) {
        summary.unmatchedSamples.push({
          excelRow: row.excelRow,
          cong_trinh: row.cong_trinh,
          giai_doan: row.giai_doan,
          so_hop_dong: row.so_hop_dong,
          reason: match.reason,
        });
      }
      drafts.push(
        emptyKhoiLuongRow({
          key: `excel-${row.excelRow}`,
          include: false,
          canSave: false,
          status: "unmatched",
          reason: match.reason,
          excelRow: row.excelRow,
          cong_trinh: row.cong_trinh,
          giai_doan: row.giai_doan,
          phaseLabel: formatGiaiDoanBadge(row.giai_doan_chuan || row.giai_doan),
          so_hop_dong: row.so_hop_dong,
          so_hop_dong_raw: row.so_hop_dong_raw,
          ngay_ky: row.ngay_ky,
          gia_tri_hd: row.gia_tri_hd ?? "",
          gia_tri_ks: row.gia_tri_ks ?? "",
          gia_tri_lap_hs: row.gia_tri_lap_hs ?? "",
          gia_tri_ctdt: row.gia_tri_ctdt ?? "",
          gia_tri_tong_phan_ra: row.gia_tri_tong_phan_ra ?? "",
          da_xuat_hd: row.da_xuat_hd ?? "",
          con_lai: row.con_lai ?? "",
          hien_trang: row.hien_trang || "",
        })
      );
      continue;
    }
    if (match.status === "ambiguous") {
      summary.ambiguous += 1;
      if (summary.ambiguousSamples.length < 20) {
        summary.ambiguousSamples.push({
          excelRow: row.excelRow,
          cong_trinh: row.cong_trinh,
          giai_doan: row.giai_doan,
          reason: match.reason,
          ma_du_ans: (match.candidates || []).map((p) => p.ma_du_an),
        });
      }
      drafts.push(
        emptyKhoiLuongRow({
          key: `excel-${row.excelRow}`,
          include: false,
          canSave: false,
          status: "ambiguous",
          reason: match.reason,
          excelRow: row.excelRow,
          cong_trinh: row.cong_trinh,
          giai_doan: row.giai_doan,
          phaseLabel: formatGiaiDoanBadge(row.giai_doan_chuan || row.giai_doan),
          so_hop_dong: row.so_hop_dong,
          gia_tri_hd: row.gia_tri_hd ?? "",
          gia_tri_ks: row.gia_tri_ks ?? "",
          gia_tri_lap_hs: row.gia_tri_lap_hs ?? "",
          gia_tri_ctdt: row.gia_tri_ctdt ?? "",
          gia_tri_tong_phan_ra: row.gia_tri_tong_phan_ra ?? "",
          da_xuat_hd: row.da_xuat_hd ?? "",
          con_lai: row.con_lai ?? "",
          hien_trang: row.hien_trang || "",
        })
      );
      continue;
    }

    const project = match.project;
    if (scopeNhomKey && bgdGroupKeyForProject(project) !== scopeNhomKey) {
      summary.skippedScope += 1;
      continue;
    }

    const nhom = bgdGroupKeyForProject(project);
    const so = row.so_hop_dong;
    const baseKey = `${nhom}||${softKey(so)}`;
    const candidates = hdCandidatesByNhomSo.get(baseKey) || [];
    let hd = row.ngay_ky
      ? hdByNhomSoDate.get(`${baseKey}||${row.ngay_ky}`) || null
      : candidates.length === 1
        ? candidates[0]
        : null;

    if (!row.ngay_ky && candidates.length > 1) {
      summary.ambiguousContract += 1;
      if (summary.ambiguousContractSamples.length < 30) {
        summary.ambiguousContractSamples.push({
          excelRow: row.excelRow,
          ma_du_an: project.ma_du_an,
          so_hop_dong: so,
          reason: "Nhiều HĐ cùng số; Excel thiếu ngày ký để phân biệt",
          hop_dong_ids: candidates.map((h) => h.id),
        });
      }
      drafts.push(
        emptyKhoiLuongRow({
          key: `excel-${row.excelRow}`,
          include: false,
          canSave: false,
          status: "ambiguous_contract",
          reason: "Nhiều HĐ cùng số; Excel thiếu ngày ký",
          excelRow: row.excelRow,
          cong_trinh: row.cong_trinh,
          ma_du_an: project.ma_du_an,
          giai_doan: project.giai_doan || row.giai_doan,
          phaseLabel: formatGiaiDoanBadge(project.giai_doan || row.giai_doan),
          nhom_cong_trinh_key: nhom,
          so_hop_dong: so,
          so_hop_dong_raw: row.so_hop_dong_raw,
          ngay_ky: row.ngay_ky,
          gia_tri_hd: row.gia_tri_hd ?? "",
          gia_tri_ks: row.gia_tri_ks ?? "",
          gia_tri_lap_hs: row.gia_tri_lap_hs ?? "",
          gia_tri_ctdt: row.gia_tri_ctdt ?? "",
          gia_tri_tong_phan_ra: row.gia_tri_tong_phan_ra ?? "",
          da_xuat_hd: row.da_xuat_hd ?? "",
          con_lai: row.con_lai ?? "",
          hien_trang: row.hien_trang || "",
        })
      );
      continue;
    }

    summary.matched += 1;
    summary.wouldUpsertTh += 1;
    if (hd) summary.wouldUpdateHd += 1;
    else if (so) summary.wouldCreateHd += 1;

    drafts.push(
      emptyKhoiLuongRow({
        key: `excel-${row.excelRow}-${project.ma_du_an}`,
        include: true,
        canSave: true,
        status: "matched",
        excelRow: row.excelRow,
        cong_trinh: row.cong_trinh || project.ten,
        ma_du_an: project.ma_du_an,
        ten: project.ten,
        giai_doan: project.giai_doan || row.giai_doan,
        phaseLabel: formatGiaiDoanBadge(project.giai_doan || row.giai_doan_chuan || row.giai_doan),
        nhom_cong_trinh_key: nhom,
        so_hop_dong: so,
        so_hop_dong_raw: row.so_hop_dong_raw,
        ngay_ky: row.ngay_ky,
        hop_dong_id: hd?.id || null,
        thoi_han_ngay: row.thoi_han_ngay,
        dich_vu_tu_van: row.dich_vu_tu_van,
        pl_gia_han: row.pl_gia_han,
        ngay_ky_pl: row.ngay_ky_pl,
        thoi_gian_gia_han: row.thoi_gian_gia_han,
        yearAmts: row.yearAmts || [],
        nam_xuat: row.nam_xuat,
        ngay_xuat: row.ngay_xuat,
        so_hoa_don: row.so_hoa_don,
        thang_pd_du_kien: row.thang_pd_du_kien,
        thang_pd_thuc_te: row.thang_pd_thuc_te,
        thang_nt_du_kien: row.thang_nt_du_kien,
        thang_nt_thuc_te: row.thang_nt_thuc_te,
        nam_nt: row.nam_nt,
        san_luong_du_kien: row.san_luong_du_kien,
        tinh_hinh_xuat_hd: row.tinh_hinh_xuat_hd,
        hsnt_trang_thai: row.hsnt_trang_thai,
        bb_ks_ht: row.bb_ks_ht,
        bb_nt: row.bb_nt,
        ton_tai_nt: row.ton_tai_nt,
        ton_tai_kt: row.ton_tai_kt,
        gia_tri_hd: row.gia_tri_hd ?? "",
        gia_tri_ks: row.gia_tri_ks ?? "",
        gia_tri_lap_hs: row.gia_tri_lap_hs ?? "",
        gia_tri_ctdt: row.gia_tri_ctdt ?? "",
        gia_tri_tong_phan_ra: row.gia_tri_tong_phan_ra ?? "",
        da_xuat_hd: row.da_xuat_hd ?? "",
        con_lai: row.con_lai ?? "",
        hien_trang: row.hien_trang || "",
        ghi_chu: `[import Excel dòng ${row.excelRow}]`,
      })
    );
  }

  // Sắp xếp FS → BCKTKT → TKBVTC trong từng nhóm HĐ
  drafts.sort((a, b) => {
    const ka = `${a.nhom_cong_trinh_key || ""}||${softKey(a.so_hop_dong)}||${a.ngay_ky || ""}`;
    const kb = `${b.nhom_cong_trinh_key || ""}||${softKey(b.so_hop_dong)}||${b.ngay_ky || ""}`;
    if (ka !== kb) return ka.localeCompare(kb, "vi");
    return (a.phaseWeight || 99) - (b.phaseWeight || 99);
  });

  return { summary, drafts };
}

/**
 * Ghi DB từ bản nháp đã rà soát (không đọc lại Excel).
 * @param {{ replaceXuat?: boolean }} options
 */
export async function applyImportDrafts(supabase, drafts, options = {}) {
  const replaceXuat = options.replaceXuat !== false;
  const summary = {
    applied: {
      createdHd: 0,
      updatedHd: 0,
      upsertTh: 0,
      xuatEvents: 0,
      errors: [],
      skipped: 0,
    },
  };

  const hdByNhomSoDate = new Map();
  const hdCandidatesByNhomSo = new Map();

  {
    const first = await supabase.from("HOP_DONG").select(HOP_DONG_EXTENDED_COLUMNS);
    const existingHd = first.error
      ? (await supabase.from("HOP_DONG").select(HOP_DONG_COLUMNS)).data
      : first.data;
    for (const h of existingHd || []) {
      if (h.loai === HOP_DONG_LOAI.THAU_PHU) continue;
      const so = normalizeSoHopDongImport(h.so_hop_dong);
      if (!so) continue;
      const baseKey = `${h.nhom_cong_trinh_key}||${softKey(so)}`;
      if (!hdCandidatesByNhomSo.has(baseKey)) hdCandidatesByNhomSo.set(baseKey, []);
      hdCandidatesByNhomSo.get(baseKey).push(h);
      if (h.ngay_ky) hdByNhomSoDate.set(`${baseKey}||${h.ngay_ky}`, h);
    }
  }

  // Tổng giá trị pháp lý theo nhóm HĐ (các giai đoạn được include)
  const legalByContract = new Map();
  for (const d of drafts || []) {
    if (d.include === false || d.canSave === false || !d.ma_du_an) continue;
    const ck = `${d.nhom_cong_trinh_key}||${softKey(d.so_hop_dong)}||${d.ngay_ky || ""}`;
    const g = numOrNull(d.gia_tri_hd) || 0;
    legalByContract.set(ck, (legalByContract.get(ck) || 0) + g);
  }

  async function findOrCreateHd(draft) {
    const nhom = draft.nhom_cong_trinh_key;
    const so = draft.so_hop_dong;
    const baseKey = `${nhom}||${softKey(so)}`;
    const candidates = hdCandidatesByNhomSo.get(baseKey) || [];
    let hd =
      draft.hop_dong_id
        ? candidates.find((h) => h.id === draft.hop_dong_id) || null
        : draft.ngay_ky
          ? hdByNhomSoDate.get(`${baseKey}||${draft.ngay_ky}`) || null
          : candidates.length === 1
            ? candidates[0]
            : null;

    const ck = `${nhom}||${softKey(so)}||${draft.ngay_ky || ""}`;
    const legalTotal = legalByContract.get(ck) ?? numOrNull(draft.gia_tri_hd);

    const patchCore = {
      ten_cong_trinh: draft.ten || draft.cong_trinh,
      nhom_cong_trinh_key: nhom,
      so_hop_dong: so || null,
      hop_dong_day_du: so ? draft.so_hop_dong_raw || so : null,
      ngay_ky: draft.ngay_ky,
      gia_tri: legalTotal,
      updated_at: new Date().toISOString(),
    };
    const patch = {
      ...patchCore,
      thoi_han_ngay: draft.thoi_han_ngay,
      dich_vu_tu_van: draft.dich_vu_tu_van,
      pl_gia_han: draft.pl_gia_han,
      ngay_ky_pl: draft.ngay_ky_pl,
      thoi_gian_gia_han: draft.thoi_gian_gia_han,
    };

    async function writeHd(isUpdate) {
      if (isUpdate) {
        let res = await supabase
          .from("HOP_DONG")
          .update(patch)
          .eq("id", hd.id)
          .select(HOP_DONG_EXTENDED_COLUMNS)
          .single();
        if (res.error) {
          res = await supabase
            .from("HOP_DONG")
            .update(patchCore)
            .eq("id", hd.id)
            .select(HOP_DONG_COLUMNS)
            .single();
        }
        if (res.error) throw res.error;
        return res.data;
      }
      const insert = {
        ...patch,
        loai: HOP_DONG_LOAI.CHINH,
        trang_thai: HOP_DONG_TRANG_THAI.HIEU_LUC,
      };
      let res = await supabase.from("HOP_DONG").insert(insert).select(HOP_DONG_EXTENDED_COLUMNS).single();
      if (res.error) {
        res = await supabase
          .from("HOP_DONG")
          .insert({
            ...patchCore,
            loai: HOP_DONG_LOAI.CHINH,
            trang_thai: HOP_DONG_TRANG_THAI.HIEU_LUC,
          })
          .select(HOP_DONG_COLUMNS)
          .single();
      }
      if (res.error) throw res.error;
      return res.data;
    }

    if (hd) {
      hd = await writeHd(true);
      summary.applied.updatedHd += 1;
    } else if (so) {
      hd = await writeHd(false);
      summary.applied.createdHd += 1;
    } else {
      return null;
    }

    if (!hdCandidatesByNhomSo.has(baseKey)) hdCandidatesByNhomSo.set(baseKey, []);
    const arr = hdCandidatesByNhomSo.get(baseKey);
    const ix = arr.findIndex((h) => h.id === hd.id);
    if (ix >= 0) arr[ix] = hd;
    else arr.push(hd);
    if (hd.ngay_ky || draft.ngay_ky) {
      hdByNhomSoDate.set(`${baseKey}||${hd.ngay_ky || draft.ngay_ky}`, hd);
    }

    const { data: link } = await supabase
      .from("HOP_DONG_GIAI_DOAN")
      .select("id")
      .eq("hop_dong_id", hd.id)
      .eq("ma_du_an", draft.ma_du_an)
      .maybeSingle();
    if (!link) {
      const { error: linkErr } = await supabase.from("HOP_DONG_GIAI_DOAN").insert({
        hop_dong_id: hd.id,
        ma_du_an: draft.ma_du_an,
      });
      if (linkErr) throw linkErr;
    }

    await supabase
      .from("du_an")
      .update({
        hop_dong: hd.so_hop_dong,
        hop_dong_day_du: hd.hop_dong_day_du,
      })
      .eq("ma_du_an", draft.ma_du_an);

    return hd;
  }

  for (const draft of drafts || []) {
    if (draft.include === false || draft.canSave === false) {
      summary.applied.skipped += 1;
      continue;
    }
    if (!draft.ma_du_an) {
      summary.applied.errors.push({
        excelRow: draft.excelRow,
        message: "Thiếu mã dự án",
      });
      continue;
    }
    try {
      const hd = await findOrCreateHd(draft);
      if (!hd) {
        summary.applied.errors.push({
          excelRow: draft.excelRow,
          message: "Không tạo được HĐ (thiếu số HĐ)",
        });
        continue;
      }

      await upsertThucHien(supabase, {
        ...thucHienPayloadFromRow(draft, hd.id),
        ghi_chu: draft.ghi_chu || `[import Excel dòng ${draft.excelRow}]`,
      });
      summary.applied.upsertTh += 1;

      if (replaceXuat) {
        await clearXuatHdForPair(supabase, hd.id, draft.ma_du_an);
      }

      const events =
        draft.yearAmts?.length > 0
          ? draft.yearAmts.map((y) => ({
              so_tien: y.so_tien,
              nam_xuat: y.nam,
              loai: y.so_tien < 0 ? HOP_DONG_XUAT_LOAI.DIEU_CHINH : HOP_DONG_XUAT_LOAI.THUONG,
              ghi_chu: `[import năm ${y.nam}]`,
            }))
          : draft.da_xuat_hd != null && draft.da_xuat_hd !== "" && Number(draft.da_xuat_hd) !== 0
            ? [
                {
                  so_tien: draft.da_xuat_hd,
                  nam_xuat: draft.nam_xuat,
                  ngay_xuat: draft.ngay_xuat,
                  so_hoa_don: draft.so_hoa_don,
                  loai:
                    Number(draft.da_xuat_hd) < 0
                      ? HOP_DONG_XUAT_LOAI.DIEU_CHINH
                      : HOP_DONG_XUAT_LOAI.THUONG,
                  ghi_chu: "[import tổng đã xuất]",
                },
              ]
            : [];

      for (const ev of events) {
        await insertXuatHd(supabase, {
          hop_dong_id: hd.id,
          ma_du_an: draft.ma_du_an,
          ...ev,
        });
        summary.applied.xuatEvents += 1;
      }

      if (events.length) {
        await upsertThucHien(supabase, {
          hop_dong_id: hd.id,
          ma_du_an: draft.ma_du_an,
          gia_tri_hd: draft.gia_tri_hd,
          resyncFromXuat: true,
        });
      }
    } catch (err) {
      summary.applied.errors.push({
        excelRow: draft.excelRow,
        cong_trinh: draft.cong_trinh,
        message: err?.message || String(err),
      });
    }
  }

  return summary;
}

/**
 * Dry-run / thực thi import.
 * @param {{ apply?: boolean, replaceXuat?: boolean, scopeNhomKey?: string|null, drafts?: array }} options
 *   Nếu truyền drafts + apply → ghi từ bản nháp đã sửa (bỏ qua buffer matching).
 */
export async function importTongHopDoanhThu(supabase, buffer, options = {}) {
  if (options.apply && options.drafts) {
    return applyImportDrafts(supabase, options.drafts, options);
  }
  const prepared = await prepareImportDraft(supabase, buffer, options);
  if (!options.apply) {
    return { ...prepared.summary, drafts: prepared.drafts };
  }
  const applied = await applyImportDrafts(supabase, prepared.drafts, options);
  return {
    ...prepared.summary,
    drafts: prepared.drafts,
    applied: applied.applied,
  };
}

export function formatImportSummaryText(summary) {
  if (!summary) return "";
  const lines = [
    `Sheet: ${summary.sheetName}`,
    `Tổng dòng Excel: ${summary.totalRows}`,
    `Khớp danh mục: ${summary.matched}`,
    `Không khớp: ${summary.unmatched}`,
    `Mơ hồ: ${summary.ambiguous}`,
  ];
  if (summary.ambiguousContract) {
    lines.push(`Mơ hồ HĐ cùng số / thiếu ngày ký: ${summary.ambiguousContract}`);
  }
  if (summary.skippedScope) lines.push(`Bỏ qua ngoài nhóm sổ: ${summary.skippedScope}`);
  if (summary.applied?.upsertTh) {
    lines.push(
      `Đã ghi: HĐ mới ${summary.applied.createdHd}, cập nhật HĐ ${summary.applied.updatedHd}, số liệu ${summary.applied.upsertTh}, sự kiện xuất ${summary.applied.xuatEvents}`
    );
  }
  if (summary.applied?.errors?.length) {
    lines.push(`Lỗi: ${summary.applied.errors.length}`);
  }
  return lines.join("\n");
}

/** Nhóm drafts theo HĐ để hiện bảng nhiều giai đoạn. */
export function groupImportDraftsByContract(drafts) {
  const map = new Map();
  for (const d of drafts || []) {
    const key = `${d.nhom_cong_trinh_key || ""}||${softKey(d.so_hop_dong)}||${d.ngay_ky || ""}||${d.cong_trinh || ""}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        so_hop_dong: d.so_hop_dong,
        ngay_ky: d.ngay_ky,
        cong_trinh: d.cong_trinh,
        rows: [],
      });
    }
    map.get(key).rows.push(d);
  }
  return [...map.values()];
}

