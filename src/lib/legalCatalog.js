/**
 * Danh mục căn cứ pháp lý & tiêu chuẩn — fetch, sort, sinh mã, validate, xuất Word.
 */

export const CSPL_LOAI_OPTIONS = [
  { value: "luat", label: "Luật", order: 1 },
  { value: "nghi_dinh", label: "Nghị định", order: 2 },
  { value: "quyet_dinh", label: "Quyết định", order: 3 },
  { value: "thong_tu", label: "Thông tư", order: 4 },
  { value: "khac", label: "Khác", order: 6 },
];

export const TC_LOAI_OPTIONS = [
  { value: "qcvn", label: "QCVN", order: 1 },
  { value: "tcvn", label: "TCVN", order: 2 },
  { value: "khac", label: "Khác", order: 3 },
];

const CSPL_LOAI_ORDER = Object.fromEntries(CSPL_LOAI_OPTIONS.map((o) => [o.value, o.order]));
const TC_LOAI_ORDER = Object.fromEntries(TC_LOAI_OPTIONS.map((o) => [o.value, o.order]));

export const TRANG_THAI_HIEU_LUC = "hieu_luc";
export const TRANG_THAI_HET_HL = "het_hieu_luc";

/** Mã phạm vi — chung = wildcard (mọi module xuất) */
export const PHAM_VI_CHUNG = "chung";
export const PHAM_VI_KHAO_SAT = "khao_sat";
export const PHAM_VI_THIET_KE = "thiet_ke";
export const PHAM_VI_DU_TOAN = "du_toan";
export const PHAM_VI_XAY_DUNG = "xay_dung";
export const PHAM_VI_KE_TOAN = "ke_toan";
export const PHAM_VI_THAM_KHAO = "tham_khao";
/** Tham khảo: không gây xuất file — chỉ khi kèm chung hoặc mã nghiệp vụ (khao_sat, thiet_ke…) */

/** Mã hệ thống — dùng trong export / logic (không đổi) */
export const PHAM_VI_SYSTEM_CODES = new Set([
  PHAM_VI_CHUNG,
  PHAM_VI_KHAO_SAT,
  PHAM_VI_THIET_KE,
  PHAM_VI_DU_TOAN,
  PHAM_VI_XAY_DUNG,
  PHAM_VI_KE_TOAN,
  PHAM_VI_THAM_KHAO,
]);

/** Fallback khi chưa có bảng DM_PHAM_VI hoặc lỗi tải */
export const PHAM_VI_FALLBACK_ROWS = [
  { ma: PHAM_VI_CHUNG, ten_hien_thi: "Chung (toàn xí nghiệp)", short_label: "Chung", thu_tu: 0, trang_thai: 1, is_system: 1, loai: "he_thong" },
  { ma: PHAM_VI_KHAO_SAT, ten_hien_thi: "Khảo sát", short_label: "KS", thu_tu: 1, trang_thai: 1, is_system: 1, loai: "nghiep_vu" },
  { ma: PHAM_VI_THIET_KE, ten_hien_thi: "Thiết kế", short_label: "TK", thu_tu: 2, trang_thai: 1, is_system: 1, loai: "nghiep_vu" },
  { ma: PHAM_VI_DU_TOAN, ten_hien_thi: "Dự toán", short_label: "DT", thu_tu: 3, trang_thai: 1, is_system: 1, loai: "nghiep_vu" },
  { ma: PHAM_VI_XAY_DUNG, ten_hien_thi: "Xây dựng", short_label: "XD", thu_tu: 4, trang_thai: 1, is_system: 1, loai: "nghiep_vu" },
  { ma: PHAM_VI_KE_TOAN, ten_hien_thi: "Kế toán", short_label: "KT", thu_tu: 5, trang_thai: 1, is_system: 1, loai: "nghiep_vu" },
  { ma: PHAM_VI_THAM_KHAO, ten_hien_thi: "Tham khảo", short_label: "Tham khảo", thu_tu: 6, trang_thai: 1, is_system: 1, loai: "tham_khao" },
];

export function rowToPhamViOption(r) {
  const short =
    r.ma === PHAM_VI_THAM_KHAO ? "Tham khảo" : r.short_label;
  return {
    value: r.ma,
    label: r.ten_hien_thi,
    short,
    order: r.thu_tu ?? 100,
    isSystem: Number(r.is_system) === 1,
    loai: r.loai || "phong",
  };
}

/** @deprecated dùng buildPhamViOptions(phamViRows) */
export const PHAM_VI_OPTIONS = PHAM_VI_FALLBACK_ROWS.map(rowToPhamViOption);

export const DM_PHAM_VI_SELECT =
  "ma, ten_hien_thi, short_label, thu_tu, trang_thai, is_system, loai";

export async function fetchAllPhamVi(supabase) {
  const { data, error } = await supabase
    .from("DM_PHAM_VI")
    .select(DM_PHAM_VI_SELECT)
    .order("thu_tu", { ascending: true });
  if (error) throw error;
  return data || [];
}

/** @deprecated alias — dùng fetchAllPhamVi */
export const fetchAllPhamViPhong = fetchAllPhamVi;

export function resolvePhamViRows(phamViRows) {
  return phamViRows?.length ? phamViRows : PHAM_VI_FALLBACK_ROWS;
}

export function getActivePhamViRows(rows) {
  return resolvePhamViRows(rows).filter((r) => Number(r.trang_thai) !== 0);
}

/** Checkbox form + toolbar — chỉ dòng đang hoạt động */
export function buildPhamViOptions(phamViRows = []) {
  return getActivePhamViRows(phamViRows).map(rowToPhamViOption);
}

export function buildPhamViOrderMap(phamViRows = []) {
  const map = {};
  for (const r of resolvePhamViRows(phamViRows)) {
    map[r.ma] = r.thu_tu ?? 100;
  }
  return map;
}

export function sortPhamViCodes(codes, phamViRows = []) {
  const orderMap = buildPhamViOrderMap(phamViRows);
  return [...(codes || [])].sort((a, b) => (orderMap[a] ?? 999) - (orderMap[b] ?? 999));
}

export function findPhamViRow(code, phamViRows = []) {
  return resolvePhamViRows(phamViRows).find((r) => r.ma === code);
}

export function isValidPhamViCode(code, phamViRows = []) {
  const row = findPhamViRow(code, phamViRows);
  if (!row) return false;
  return Number(row.trang_thai) !== 0;
}

export function slugifyPhamViMa(tenHienThi) {
  const base = normalizePlain(tenHienThi)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return base || "phong_moi";
}

/** Admin thêm phòng / mảng mới — is_system = 0 */
export async function createCustomPhamVi(supabase, form, existingRows = []) {
  const ten = String(form?.tenHienThi ?? form?.ten_hien_thi ?? "").trim();
  const short = String(form?.shortLabel ?? form?.short_label ?? "").trim().slice(0, 12);
  if (ten.length < 2) {
    return { ok: false, message: "Vui lòng nhập tên phạm vi / phòng ban (ít nhất 2 ký tự)." };
  }
  if (!short) {
    return { ok: false, message: "Vui lòng nhập nhãn ngắn (hiển thị badge)." };
  }

  const used = new Set(resolvePhamViRows(existingRows).map((r) => r.ma));
  let ma = slugifyPhamViMa(ten);
  if (PHAM_VI_SYSTEM_CODES.has(ma)) {
    return { ok: false, message: "Tên trùng mã hệ thống. Vui lòng đặt tên khác." };
  }
  let suffix = 1;
  let candidate = ma;
  while (used.has(candidate)) {
    suffix += 1;
    candidate = `${ma}_${suffix}`;
  }
  ma = candidate;

  const thuTuValues = resolvePhamViRows(existingRows).map((r) => Number(r.thu_tu) || 0);
  const thu_tu = (thuTuValues.length ? Math.max(...thuTuValues) : 0) + 1;

  const payload = {
    ma,
    ten_hien_thi: ten,
    short_label: short,
    thu_tu,
    trang_thai: 1,
    is_system: 0,
    loai: "phong",
  };

  const { error } = await supabase.from("DM_PHAM_VI").insert([payload]);
  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true, ma, payload };
}

/** @deprecated alias */
export const createPhamViPhong = createCustomPhamVi;

/** @deprecated */
export const PHAM_VI_PHONG_PREFIX = "phong_";

export const CSPL_SELECT_CORE =
  "id_cspl, ten_cspl, loai_van_ban, ngay_ban_hanh, ngay_hieu_luc, co_quan_ban_hanh, link_pdf_van_ban, duong_dan_file, trang_thai, ngay_het_hieu_luc, id_cspl_thay_the, identity_key_thay_the, ghi_chu_het_hl, pham_vi_ap_dung";
export const TC_SELECT_CORE =
  "id_tc, ky_hieu, ten_tai_lieu, loai_van_ban, ngay_ban_hanh, ngay_hieu_luc, co_quan_ban_hanh, link_pdf_van_ban, duong_dan_file, trang_thai, ngay_het_hieu_luc, id_tc_thay_the, identity_key_thay_the, ghi_chu_het_hl, pham_vi_ap_dung";
/** Fallback khi DB chưa chạy migration identity_key_thay_the */
const CSPL_SELECT_CORE_LEGACY =
  "id_cspl, ten_cspl, loai_van_ban, ngay_ban_hanh, ngay_hieu_luc, co_quan_ban_hanh, link_pdf_van_ban, duong_dan_file, trang_thai, ngay_het_hieu_luc, id_cspl_thay_the, ghi_chu_het_hl, pham_vi_ap_dung";
const TC_SELECT_CORE_LEGACY =
  "id_tc, ky_hieu, ten_tai_lieu, loai_van_ban, ngay_ban_hanh, ngay_hieu_luc, co_quan_ban_hanh, link_pdf_van_ban, duong_dan_file, trang_thai, ngay_het_hieu_luc, id_tc_thay_the, ghi_chu_het_hl, pham_vi_ap_dung";
export const CSPL_SELECT_HASH = `${CSPL_SELECT_CORE}, file_hash_sha256, file_ten_goc`;
export const TC_SELECT_HASH = `${TC_SELECT_CORE}, file_hash_sha256, file_ten_goc`;
export const CSPL_SELECT = `${CSPL_SELECT_HASH}, phu_luc_files`;
export const TC_SELECT = `${TC_SELECT_HASH}, phu_luc_files`;

function isMissingCatalogColumnError(error) {
  const msg = String(error?.message || "").toLowerCase();
  return (
    (msg.includes("column") && (msg.includes("does not exist") || msg.includes("could not find"))) ||
    msg.includes("schema cache")
  );
}

let catalogSupportsFileHash = true;
let catalogSupportsPhuLuc = true;

export function catalogHasFileHashColumns() {
  return catalogSupportsFileHash;
}

export function catalogHasPhuLucColumn() {
  return catalogSupportsPhuLuc;
}

/** SELECT có fallback khi DB chưa chạy migration */
export async function selectCatalogRows(supabase, table) {
  const selects =
    table === "DM_CSPL"
      ? [CSPL_SELECT, CSPL_SELECT_HASH, CSPL_SELECT_CORE, CSPL_SELECT_CORE_LEGACY]
      : [TC_SELECT, TC_SELECT_HASH, TC_SELECT_CORE, TC_SELECT_CORE_LEGACY];

  let lastError = null;
  for (let i = 0; i < selects.length; i++) {
    const { data, error } = await supabase.from(table).select(selects[i]);
    if (!error) {
      catalogSupportsFileHash = i < 2;
      catalogSupportsPhuLuc = i === 0;
      return data || [];
    }
    lastError = error;
    if (!isMissingCatalogColumnError(error)) break;
  }
  throw lastError;
}

export function omitCatalogFileHashFields(payload) {
  if (!payload) return payload;
  const { file_hash_sha256, file_ten_goc, ...rest } = payload;
  return rest;
}

export function omitCatalogPhuLucField(payload) {
  if (!payload) return payload;
  const { phu_luc_files, ...rest } = payload;
  return rest;
}

export function omitCatalogExtendedFields(payload) {
  return omitCatalogPhuLucField(omitCatalogFileHashFields(payload));
}

function uniquePayloadAttempts(payload) {
  const attempts = [
    payload,
    omitCatalogPhuLucField(payload),
    omitCatalogExtendedFields(payload),
  ];
  const seen = new Set();
  return attempts.filter((p) => {
    const key = JSON.stringify(p);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function insertCatalogRow(supabase, table, payload) {
  let lastError = null;
  for (const attempt of uniquePayloadAttempts(payload)) {
    const { error } = await supabase.from(table).insert([attempt]);
    if (!error) {
      catalogSupportsPhuLuc = "phu_luc_files" in attempt;
      catalogSupportsFileHash = "file_hash_sha256" in attempt;
      return;
    }
    lastError = error;
    if (!isMissingCatalogColumnError(error)) break;
  }
  throw lastError;
}

export async function updateCatalogRow(supabase, table, idCol, id, payload) {
  let lastError = null;
  for (const attempt of uniquePayloadAttempts(payload)) {
    const { error } = await supabase.from(table).update(attempt).eq(idCol, id);
    if (!error) {
      catalogSupportsPhuLuc = "phu_luc_files" in attempt;
      catalogSupportsFileHash = "file_hash_sha256" in attempt;
      return;
    }
    lastError = error;
    if (!isMissingCatalogColumnError(error)) break;
  }
  throw lastError;
}

/** Chuẩn hóa mảng phụ lục từ DB */
export function parsePhuLucFiles(raw) {
  if (raw == null) return [];
  let arr = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((item, i) => ({
      id: String(item?.id || `pl_${i + 1}`),
      ten: String(item?.ten || item?.file_ten_goc || "Phụ lục").trim(),
      link: String(item?.link || "").trim(),
      path: String(item?.path || item?.duong_dan_file || "").trim(),
      file_ten_goc: String(item?.file_ten_goc || "").trim(),
      thu_tu: Number(item?.thu_tu) || i + 1,
    }))
    .filter((item) => item.link || item.path)
    .sort((a, b) => a.thu_tu - b.thu_tu);
}

export function countPhuLucFiles(row) {
  return parsePhuLucFiles(row?.phu_luc_files).length;
}

export function defaultPhuLucTenFromFileName(fileName) {
  return String(fileName || "")
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim() || "Phụ lục";
}

export function newPhuLucClientId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `tmp_${crypto.randomUUID()}`;
  }
  return `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const CSPL_ID_PREFIX = "CS";
const TC_ID_PREFIX = "TC";

/** Gợi ý loại từ nội dung (khi DB chưa điền) */
export function inferCsplLoaiFromText(tenCspl) {
  const t = normalizePlain(tenCspl);
  if (/\bluat\b/.test(t) || t.startsWith("luat ")) return "luat";
  if (t.includes("nghi dinh")) return "nghi_dinh";
  if (t.includes("thong tu")) return "thong_tu";
  if (t.includes("quyet dinh")) return "quyet_dinh";
  return "khac";
}

export function inferTcLoaiFromRow(row) {
  if (row?.loai_van_ban && TC_LOAI_ORDER[row.loai_van_ban]) return row.loai_van_ban;
  const k = String(row?.ky_hieu || "").toUpperCase().trim();
  if (k.startsWith("QCVN")) return "qcvn";
  if (k.startsWith("TCVN")) return "tcvn";
  const ten = String(row?.ten_tai_lieu || "").toUpperCase();
  if (ten.includes("QCVN")) return "qcvn";
  if (ten.includes("TCVN")) return "tcvn";
  return "khac";
}

function effectiveCsplLoai(row) {
  if (row?.loai_van_ban && CSPL_LOAI_ORDER[row.loai_van_ban]) return row.loai_van_ban;
  return inferCsplLoaiFromText(row?.ten_cspl);
}

/** QĐ Thủ tướng / Chính phủ (tách khỏi QĐ UBND, Bộ, ngành…) */
export function isQuyetDinhThuTuongChinhPhu(row) {
  const blob = normalizePlain(`${row?.ten_cspl || ""} ${row?.co_quan_ban_hanh || ""}`);
  if (/thu tuong chinh phu/.test(blob)) return true;
  if (/\bthu tuong\b/.test(blob) && !/ubnd|uy ban nhan dan|hoi dong nhan dan/.test(blob)) return true;
  if (/\bchinh phu\b/.test(blob) && !/uy ban nhan dan/.test(blob)) return true;
  if (/\bttg\b/.test(blob)) return true;
  return false;
}

/**
 * Thứ tự xuất danh mục CSPL:
 * Luật → Nghị định → QĐ (Thủ tướng CP) → Thông tư → QĐ (UBND/Bộ/ngành…) → Khác
 */
export function getCsplSortTier(row) {
  const loai = effectiveCsplLoai(row);
  if (loai === "luat") return 1;
  if (loai === "nghi_dinh") return 2;
  if (loai === "quyet_dinh") return isQuyetDinhThuTuongChinhPhu(row) ? 3 : 5;
  if (loai === "thong_tu") return 4;
  if (loai === "khac") return 6;
  return 99;
}

function compareCsplRowsWithinTier(a, b) {
  const da = a.ngay_ban_hanh || a.ngay_hieu_luc || "";
  const db = b.ngay_ban_hanh || b.ngay_hieu_luc || "";
  if (da !== db) return da.localeCompare(db);
  return String(a.ten_cspl || "").localeCompare(String(b.ten_cspl || ""), "vi", { sensitivity: "base" });
}

export function sortCsplRows(rows) {
  return [...(rows || [])].sort((a, b) => {
    const ta = getCsplSortTier(a);
    const tb = getCsplSortTier(b);
    if (ta !== tb) return ta - tb;
    return compareCsplRowsWithinTier(a, b);
  });
}

export function sortTcRows(rows) {
  return [...(rows || [])].sort((a, b) => {
    const la = TC_LOAI_ORDER[inferTcLoaiFromRow(a)] ?? 99;
    const lb = TC_LOAI_ORDER[inferTcLoaiFromRow(b)] ?? 99;
    if (la !== lb) return la - lb;
    return compareCatalogIds(a.id_tc, b.id_tc, TC_ID_PREFIX);
  });
}

export async function fetchSortedCspl(supabase, { activeOnly = true, phamVi = null } = {}) {
  const data = await selectCatalogRows(supabase, "DM_CSPL");
  let rows = data || [];
  if (activeOnly) rows = rows.filter(isCatalogRowActive);
  if (phamVi) rows = filterCatalogByPhamVi(rows, phamVi);
  return sortCsplRows(rows);
}

export async function fetchSortedTieuChuan(supabase, { activeOnly = true, phamVi = null } = {}) {
  const data = await selectCatalogRows(supabase, "DM_TIEU_CHUAN");
  let rows = data || [];
  if (activeOnly) rows = rows.filter(isCatalogRowActive);
  if (phamVi) rows = filterCatalogByPhamVi(rows, phamVi);
  return sortTcRows(rows);
}

export async function fetchAllCspl(supabase) {
  return fetchSortedCspl(supabase, { activeOnly: false });
}

export async function fetchAllTieuChuan(supabase) {
  return fetchSortedTieuChuan(supabase, { activeOnly: false });
}

export function isCatalogRowActive(row) {
  const st = String(row?.trang_thai ?? TRANG_THAI_HIEU_LUC).trim();
  if (!st || st === TRANG_THAI_HIEU_LUC) return true;
  return st !== TRANG_THAI_HET_HL;
}

export function getTrangThaiLabel(trangThai) {
  return trangThai === TRANG_THAI_HET_HL ? "Hết hiệu lực" : "Còn hiệu lực";
}

/** Placeholder khi thiếu dữ liệu thuộc tính văn bản (học hỏi UI tra cứu pháp lý). */
export const CATALOG_FIELD_UPDATING = "Đang cập nhật";

export function displayCatalogText(value) {
  const s = String(value ?? "").trim();
  return s || CATALOG_FIELD_UPDATING;
}

/** Ngày hiển thị; trống → «Đang cập nhật» (không dùng dấu «-»). */
export function displayCatalogDate(isoDate) {
  if (!isoDate) return CATALOG_FIELD_UPDATING;
  const formatted = formatDateVi(isoDate);
  if (!formatted || formatted === "-") return CATALOG_FIELD_UPDATING;
  return formatted;
}

/**
 * Tình trạng hiệu lực chi tiết (màn xem văn bản):
 * - Hết hiệu lực (đã đánh dấu)
 * - Chưa có hiệu lực (chưa tới ngày HL / thiếu ngày HL)
 * - Còn hiệu lực
 */
export function getChiTietTrangThaiHieuLuc(row, fromDate = new Date()) {
  const st = String(row?.trang_thai ?? "").trim();
  if (st === TRANG_THAI_HET_HL) {
    return { label: "Hết hiệu lực", tone: "het" };
  }
  const hl = catalogDateOnly(row?.ngay_hieu_luc);
  const today = catalogTodayIso(fromDate);
  if (!hl || hl > today) {
    return { label: "Chưa có hiệu lực", tone: "chua" };
  }
  const het = catalogDateOnly(row?.ngay_het_hieu_luc);
  if (het && het < today) {
    return { label: "Hết hiệu lực", tone: "het" };
  }
  return { label: "Còn hiệu lực", tone: "con" };
}

/** Số hiệu / ký hiệu rút gọn để hiện lưới thuộc tính. */
export function getCatalogSoHieuDisplay(row, kind) {
  if (kind === "tc") return displayCatalogText(row?.ky_hieu);
  if (!row) return CATALOG_FIELD_UPDATING;
  const identity = extractLegalDocumentIdentityKey(row.ten_cspl);
  if (!identity) return CATALOG_FIELD_UPDATING;
  return displayCatalogText(formatReplacementShortLabel(row, "cspl"));
}

/** YYYY-MM-DD theo lịch địa phương (không lệch UTC). */
export function catalogTodayIso(fromDate = new Date()) {
  const d = fromDate instanceof Date ? fromDate : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function catalogAddDaysIso(isoDate, days) {
  const m = String(isoDate || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() + Number(days || 0));
  return catalogTodayIso(d);
}

function catalogDateOnly(isoDate) {
  const m = String(isoDate || "").match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

/**
 * Sắp có hiệu lực trong N ngày: có ngày HL và ngày đó nằm trong (hôm nay, hôm nay+N]
 * (chưa tới ngày HL nhưng sẽ có trong cửa sổ N ngày).
 */
export function isSapCoHieuLucTrongNgay(row, days = 30, fromDate = new Date()) {
  const hl = catalogDateOnly(row?.ngay_hieu_luc);
  if (!hl) return false;
  const today = catalogTodayIso(fromDate);
  const end = catalogAddDaysIso(today, days);
  return hl > today && hl <= end;
}

/** Có hiệu lực hôm nay: ngày hiệu lực đúng ngày hiện tại. */
export function isCoHieuLucHomNay(row, fromDate = new Date()) {
  const hl = catalogDateOnly(row?.ngay_hieu_luc);
  if (!hl) return false;
  return hl === catalogTodayIso(fromDate);
}

/**
 * Sắp hết hiệu lực trong N ngày: có ngày hết HL nằm trong [hôm nay, hôm nay+N].
 */
export function isSapHetHieuLucTrongNgay(row, days = 30, fromDate = new Date()) {
  const het = catalogDateOnly(row?.ngay_het_hieu_luc);
  if (!het) return false;
  const today = catalogTodayIso(fromDate);
  const end = catalogAddDaysIso(today, days);
  return het >= today && het <= end;
}

/** Bộ lọc hiệu lực — dùng cho <select> toolbar. */
export const CATALOG_STATUS_FILTERS = [
  { id: "all", label: "Tất cả" },
  { id: "hieu_luc", label: "Còn hiệu lực" },
  { id: "het_hl", label: "Hết hiệu lực" },
  { id: "co_hl_hom_nay", label: "Có hiệu lực hôm nay" },
  { id: "sap_co_hl_30", label: "Sắp có HL trong 30 ngày" },
  { id: "sap_het_hl_30", label: "Sắp hết HL trong 30 ngày" },
];

export function filterCatalogByStatus(rows, statusFilter) {
  const list = rows || [];
  if (statusFilter === "all") return list;
  if (statusFilter === "het_hl") return list.filter((r) => !isCatalogRowActive(r));
  if (statusFilter === "co_hl_hom_nay") {
    return list.filter((r) => isCoHieuLucHomNay(r));
  }
  if (statusFilter === "sap_co_hl_30") {
    return list
      .filter((r) => isSapCoHieuLucTrongNgay(r, 30))
      .sort((a, b) => String(a.ngay_hieu_luc || "").localeCompare(String(b.ngay_hieu_luc || "")));
  }
  if (statusFilter === "sap_het_hl_30") {
    return list
      .filter((r) => isSapHetHieuLucTrongNgay(r, 30))
      .sort((a, b) =>
        String(a.ngay_het_hieu_luc || "").localeCompare(String(b.ngay_het_hieu_luc || ""))
      );
  }
  return list.filter(isCatalogRowActive);
}

/** Chuẩn hóa mảng phạm vi từ DB (text[] hoặc legacy) */
export function normalizePhamViArray(raw) {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      /* fall through */
    }
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [PHAM_VI_CHUNG];
}

/** Wildcard: chung → mọi module; ngược lại cần đúng mã phạm vi */
export function rowMatchesPhamVi(row, phamViCode) {
  if (!phamViCode || phamViCode === "all") return true;
  const scopes = normalizePhamViArray(row?.pham_vi_ap_dung);
  if (scopes.includes(PHAM_VI_CHUNG)) return true;
  return scopes.includes(phamViCode);
}

export function filterCatalogByPhamVi(rows, phamViFilter) {
  if (!phamViFilter || phamViFilter === "all") return rows || [];
  return (rows || []).filter((r) => rowMatchesPhamVi(r, phamViFilter));
}

/** Loại hiệu lực trên dòng (DB hoặc suy từ tên / ký hiệu). */
export function resolveCatalogLoai(row, kind = "cspl") {
  if (kind === "tc") return inferTcLoaiFromRow(row);
  return effectiveCsplLoai(row);
}

/** Lọc theo loại văn bản (luat / nghi_dinh / qcvn / tcvn…). */
export function filterCatalogByLoai(rows, loaiFilter, kind = "cspl") {
  if (!loaiFilter || loaiFilter === "all") return rows || [];
  return (rows || []).filter((r) => resolveCatalogLoai(r, kind) === loaiFilter);
}

export function getPhamViLabel(code, phamViRows = []) {
  const row = findPhamViRow(code, phamViRows);
  if (row) return row.ten_hien_thi;
  return code;
}

export function getPhamViShortLabel(code, phamViRows = []) {
  if (code === PHAM_VI_THAM_KHAO) return "Tham khảo";
  const row = findPhamViRow(code, phamViRows);
  if (row) return row.ma === PHAM_VI_THAM_KHAO ? "Tham khảo" : row.short_label;
  return code;
}

export function formatPhamViBadges(row, phamViRows = []) {
  const scopes = normalizePhamViArray(row?.pham_vi_ap_dung);
  return sortPhamViCodes(scopes, phamViRows);
}

export function validatePhamViSelection(selected, phamViRows = []) {
  const arr = normalizePhamViArray(selected);
  if (!arr.length) {
    return { ok: false, message: "Vui lòng chọn ít nhất một phạm vi áp dụng." };
  }
  const invalid = arr.filter((c) => !isValidPhamViCode(c, phamViRows));
  if (invalid.length) {
    return { ok: false, message: `Phạm vi không hợp lệ: ${invalid.join(", ")}` };
  }
  return { ok: true, value: sortPhamViCodes(arr, phamViRows) };
}

export function togglePhamViInForm(current, code, phamViRows = []) {
  const set = new Set(normalizePhamViArray(current));
  if (set.has(code)) set.delete(code);
  else set.add(code);
  return sortPhamViCodes([...set], phamViRows);
}

export function validateExpireForm(form, kind, selfRow = null) {
  if (!form.ngay_het_hieu_luc) {
    return { ok: false, message: "Vui lòng nhập ngày hết hiệu lực (bắt buộc)." };
  }
  const identityKey = form.identity_key_thay_the?.trim();
  if (identityKey && selfRow) {
    const selfIdentity = getCatalogRowPrimaryIdentityKey(selfRow, kind);
    if (selfIdentity && identityKey === selfIdentity) {
      return { ok: false, message: "Văn bản thay thế không thể trùng văn bản đang hết hiệu lực." };
    }
  }
  return { ok: true };
}

export function getLoaiLabel(loai, kind = "cspl") {
  const opts = kind === "tc" ? TC_LOAI_OPTIONS : CSPL_LOAI_OPTIONS;
  return opts.find((o) => o.value === loai)?.label ?? loai ?? "-";
}

const CSPL_LOAI_TEXT_CLASS = {
  luat: "text-blue-700",
  nghi_dinh: "text-amber-700",
  thong_tu: "text-teal-700",
  quyet_dinh: "text-rose-700",
  khac: "text-slate-600",
};

const TC_LOAI_TEXT_CLASS = {
  qcvn: "text-blue-700",
  tcvn: "text-emerald-700",
  khac: "text-slate-600",
};

/** Màu chữ Loại — không nền, chữ thường (Luật, Nghị định…) */
export function getLoaiTextClass(loai, kind = "cspl") {
  const map = kind === "tc" ? TC_LOAI_TEXT_CLASS : CSPL_LOAI_TEXT_CLASS;
  return map[loai] || "text-slate-600";
}

const PHAM_VI_TEXT_CLASS = {
  chung: "text-indigo-700",
  khao_sat: "text-violet-700",
  thiet_ke: "text-purple-700",
  du_toan: "text-cyan-700",
  xay_dung: "text-orange-700",
  ke_toan: "text-lime-700",
  tham_khao: "text-slate-500",
};

const PHAM_VI_CUSTOM_TEXT_CLASS = [
  "text-fuchsia-700",
  "text-sky-700",
  "text-pink-700",
  "text-emerald-700",
  "text-amber-700",
];

/** Màu chữ Phạm vi — không nền */
export function getPhamViTextClass(code, phamViRows = []) {
  if (PHAM_VI_TEXT_CLASS[code]) return PHAM_VI_TEXT_CLASS[code];
  const row = findPhamViRow(code, phamViRows);
  if (row?.loai === "tham_khao") return "text-slate-500";
  let hash = 0;
  for (let i = 0; i < code.length; i++) hash = (hash + code.charCodeAt(i) * (i + 1)) % 997;
  return PHAM_VI_CUSTOM_TEXT_CLASS[hash % PHAM_VI_CUSTOM_TEXT_CLASS.length];
}

function normalizePlain(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Chuẩn hóa để so khớp mẫu — gom đ/Đ → d, bỏ dấu tiếng Việt */
function normalizeCsplValidate(text) {
  return normalizePlain(text).replace(/\u0111/g, "d");
}

function formatWarn(message) {
  return { ok: false, formatWarning: true, message };
}

export function parseCatalogIdNumber(id, prefix) {
  const m = String(id || "").match(new RegExp(`^${prefix}(\\d+)$`, "i"));
  return m ? parseInt(m[1], 10) : 0;
}

/** Mã tạm khi đánh số lại — dùng gạch ngắn (CS-T0012), không dùng __ */
export function catalogRenumberTempId(prefix, index) {
  return `${prefix}-T${String(index).padStart(4, "0")}`;
}

export function isCatalogRenumberTempId(id, prefix) {
  return new RegExp(`^${prefix}(?:-T\\d{4}|__T\\d{4}__)$`, "i").test(String(id || ""));
}

function catalogIdSortKey(id, prefix) {
  const s = String(id || "");
  const mTemp = s.match(new RegExp(`^${prefix}(?:-T|__T)(\\d+)(?:__)?$`, "i"));
  if (mTemp) return parseInt(mTemp[1], 10) + 0.5;
  const n = parseCatalogIdNumber(id, prefix);
  return n > 0 ? n : 999999;
}

function padCatalogNum(num, totalCount = num) {
  const width = Math.max(2, String(Math.max(num, totalCount)).length);
  return String(num).padStart(width, "0");
}

export function formatCatalogId(prefix, num, totalCount = num) {
  return `${prefix}${padCatalogNum(num, totalCount)}`;
}

export function compareCatalogIds(idA, idB, prefix) {
  const na = catalogIdSortKey(idA, prefix);
  const nb = catalogIdSortKey(idB, prefix);
  if (na !== nb) return na - nb;
  return String(idA ?? "").localeCompare(String(idB ?? ""), "vi", { numeric: true });
}

/** Mã tiếp theo khi thêm mới (tự tăng, không đánh số lại toàn bộ) */
export function computeNextCatalogId(rows, prefix, idField) {
  const nums = (rows || [])
    .map((r) => parseCatalogIdNumber(r[idField], prefix))
    .filter((n) => n > 0);
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return formatCatalogId(prefix, next, next);
}

/** Kiểm tra mã CS/TC có khớp thứ tự sắp xếp CS01…CSnn không */
export function catalogIdsNeedRenumber(rows, kind) {
  const sorted = kind === "cspl" ? sortCsplRows(rows) : sortTcRows(rows);
  if (!sorted.length) return false;
  const prefix = kind === "cspl" ? "CS" : "TC";
  const idField = kind === "cspl" ? "id_cspl" : "id_tc";
  const total = sorted.length;
  return sorted.some((row, index) => row[idField] !== formatCatalogId(prefix, index + 1, total));
}

/** Đánh số lại CS01… / TC01… theo thứ tự sắp xếp hiện tại (nếu lệch) */
export async function ensureCatalogIdsSequential(supabase, table, idCol, prefix, kind) {
  const rows = await selectCatalogRows(supabase, table);
  if (!catalogIdsNeedRenumber(rows, kind)) return false;
  await renumberCatalogIds(supabase, table, idCol, prefix, rows);
  return true;
}

/**
 * Sau khi xóa: đánh số lại CS01..CSnn / TC01..TCnn theo thứ tự xuất (loại → ngày → tên).
 * Đổi loại văn bản KHÔNG gọi hàm này.
 */
export async function renumberCatalogIds(supabase, table, idCol, prefix, rows) {
  const sorted = table === "DM_CSPL" ? sortCsplRows(rows) : sortTcRows(rows);
  if (!sorted.length) return;

  const total = sorted.length;
  const originalIds = sorted.map((r) => r[idCol]);
  const finalIds = sorted.map((_, i) => formatCatalogId(prefix, i + 1, total));

  for (let i = 0; i < sorted.length; i++) {
    const tmpId = catalogRenumberTempId(prefix, i);
    const { error } = await supabase.from(table).update({ [idCol]: tmpId }).eq(idCol, originalIds[i]);
    if (error) throw error;
  }

  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i];
    const newId = finalIds[i];
    const patch = { [idCol]: newId };
    const tmpId = catalogRenumberTempId(prefix, i);
    const { error } = await supabase.from(table).update(patch).eq(idCol, tmpId);
    if (error) throw error;
  }

  const kind = table === "DM_CSPL" ? "cspl" : "tc";
  const refreshed = await selectCatalogRows(supabase, table);
  await refreshCatalogReplacementIdCaches(supabase, table, kind, refreshed);
}

/** Sửa mã tạm CS__T…__ / CS-T… còn sót sau khi đánh số lại bị gián đoạn */
export async function repairCatalogIdsIfNeeded(supabase, table, idCol, prefix) {
  const rows = await selectCatalogRows(supabase, table);
  const hasTemp = (rows || []).some((r) => isCatalogRenumberTempId(r[idCol], prefix));
  if (!hasTemp) return false;
  await renumberCatalogIds(supabase, table, idCol, prefix, rows);
  return true;
}

export function formatDateVi(isoDate) {
  if (!isoDate) return "-";
  const m = String(isoDate).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return isoDate;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function isoFromViDate(text) {
  const s = String(text || "").trim();
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) {
    return `${m1[3]}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return "";
}

const CSPL_FORMAT_HINTS = {
  luat: "Luật [tên luật] số ..../năm/QH... ngày dd/mm/yyyy",
  nghi_dinh:
    "Nghị định số .../năm/NĐ-CP ngày dd/mm/yyyy của Chính phủ: [trích yếu]",
  thong_tu: "Thông tư số .../TT-... ngày dd/mm/yyyy của [cơ quan]: [trích yếu]",
  quyet_dinh:
    "Quyết định số .../... ngày dd/mm/yyyy của [cơ quan] về việc [trích yếu]",
  khac: "Nội dung căn cứ pháp lý đầy đủ",
};

export function getCsplFormatHint(loai) {
  return CSPL_FORMAT_HINTS[loai] || CSPL_FORMAT_HINTS.khac;
}

export function validateCsplContent(tenCspl, loaiVanBan) {
  const text = String(tenCspl || "").trim();
  if (!text) return { ok: false, message: "Vui lòng nhập nội dung căn cứ pháp lý." };

  const loai = loaiVanBan || inferCsplLoaiFromText(text);
  const v = normalizeCsplValidate(text);

  if (loai === "luat") {
    if (!v.startsWith("luat ") || !/\bso\s+\d+\/\d{4}\/qh\d+/.test(v)) {
      return formatWarn(`Nội dung Luật chưa đúng mẫu.\nGợi ý: ${CSPL_FORMAT_HINTS.luat}`);
    }
    if (!/\d{1,2}\/\d{1,2}\/\d{4}/.test(text)) {
      return { ok: false, message: "Thiếu ngày ban hành (dd/mm/yyyy) trong nội dung Luật." };
    }
    return { ok: true };
  }

  if (loai === "nghi_dinh") {
    // Chấp nhận NĐ-CP / NĐ CP / nd-cp (sau chuẩn hóa đ→d)
    if (!v.includes("nghi dinh") || !/\d+\/\d{4}\/nd-?cp/.test(v)) {
      return formatWarn(`Nội dung Nghị định chưa đúng mẫu.\nGợi ý: ${CSPL_FORMAT_HINTS.nghi_dinh}`);
    }
    return { ok: true };
  }

  if (loai === "thong_tu") {
    if (!v.includes("thong tu") || !/\/tt-/.test(v)) {
      return formatWarn(`Nội dung Thông tư chưa đúng mẫu.\nGợi ý: ${CSPL_FORMAT_HINTS.thong_tu}`);
    }
    return { ok: true };
  }

  if (loai === "quyet_dinh") {
    if (!v.includes("quyet dinh") || !/\d+\//.test(v)) {
      return formatWarn(`Nội dung Quyết định chưa đúng mẫu.\nGợi ý: ${CSPL_FORMAT_HINTS.quyet_dinh}`);
    }
    return { ok: true };
  }

  if (text.length < 10) {
    return { ok: false, message: "Nội dung quá ngắn. Vui lòng nhập đầy đủ căn cứ pháp lý." };
  }
  return { ok: true };
}

export function validateTcContent(tenTaiLieu, kyHieu, loaiVanBan) {
  const ten = String(tenTaiLieu || "").trim();
  const kh = String(kyHieu || "").trim();
  if (!ten) return { ok: false, message: "Vui lòng nhập nội dung tiêu chuẩn." };
  if (!kh) return { ok: false, message: "Vui lòng nhập ký hiệu (QCVN / TCVN)." };

  const loai = loaiVanBan || inferTcLoaiFromRow({ ky_hieu: kh, ten_tai_lieu: ten });
  const upper = `${kh} ${ten}`.toUpperCase();

  if (loai === "qcvn" && !upper.includes("QCVN")) {
    return {
      ok: false,
      formatWarning: true,
      message: "Tiêu chuẩn loại QCVN cần có ký hiệu QCVN trong nội dung hoặc ký hiệu.",
    };
  }
  if (loai === "tcvn" && !upper.includes("TCVN")) {
    return {
      ok: false,
      formatWarning: true,
      message: "Tiêu chuẩn loại TCVN cần có ký hiệu TCVN trong nội dung hoặc ký hiệu.",
    };
  }
  return { ok: true };
}

export function buildCsplPayload(form, id) {
  return {
    id_cspl: id,
    ten_cspl: form.ten_cspl?.trim(),
    loai_van_ban: form.loai_van_ban,
    ngay_ban_hanh: form.ngay_ban_hanh || null,
    ngay_hieu_luc: form.ngay_hieu_luc || null,
    co_quan_ban_hanh: form.co_quan_ban_hanh?.trim() || null,
    link_pdf_van_ban: form.link_pdf_van_ban || null,
    duong_dan_file: form.duong_dan_file || null,
    file_hash_sha256: form.file_hash_sha256 || null,
    file_ten_goc: form.file_ten_goc || null,
    phu_luc_files: parsePhuLucFiles(form.phu_luc_files),
    trang_thai: form.trang_thai || TRANG_THAI_HIEU_LUC,
    ngay_het_hieu_luc: form.ngay_het_hieu_luc || null,
    id_cspl_thay_the: form.id_cspl_thay_the?.trim() || null,
    ghi_chu_het_hl: form.ghi_chu_het_hl?.trim() || null,
    pham_vi_ap_dung: normalizePhamViArray(form.pham_vi_ap_dung),
  };
}

export function buildTcPayload(form, id) {
  return {
    id_tc: id,
    ky_hieu: form.ky_hieu?.trim(),
    ten_tai_lieu: form.ten_tai_lieu?.trim(),
    loai_van_ban: form.loai_van_ban,
    ngay_ban_hanh: form.ngay_ban_hanh || null,
    ngay_hieu_luc: form.ngay_hieu_luc || null,
    co_quan_ban_hanh: form.co_quan_ban_hanh?.trim() || null,
    link_pdf_van_ban: form.link_pdf_van_ban || null,
    duong_dan_file: form.duong_dan_file || null,
    file_hash_sha256: form.file_hash_sha256 || null,
    file_ten_goc: form.file_ten_goc || null,
    phu_luc_files: parsePhuLucFiles(form.phu_luc_files),
    trang_thai: form.trang_thai || TRANG_THAI_HIEU_LUC,
    ngay_het_hieu_luc: form.ngay_het_hieu_luc || null,
    id_tc_thay_the: form.id_tc_thay_the?.trim() || null,
    ghi_chu_het_hl: form.ghi_chu_het_hl?.trim() || null,
    pham_vi_ap_dung: normalizePhamViArray(form.pham_vi_ap_dung),
  };
}

/** Chuẩn hóa nội dung để so trùng (bỏ dấu, gom khoảng trắng, chuẩn ngày) */
function normalizeDatesInCatalogText(text) {
  return String(text || "").replace(
    /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g,
    (_, d, mo, y) => `${String(d).padStart(2, "0")}/${String(mo).padStart(2, "0")}/${y}`
  );
}

export function normalizeCatalogContentKey(text) {
  let v = normalizeCsplValidate(text).replace(/\s+/g, " ").trim();
  v = normalizeDatesInCatalogText(v);
  v = v.replace(/[;:,.\s]+$/g, "").trim();
  return v;
}

/** Khóa định danh văn bản (số/NĐ-CP, Luật, TT, QĐ…) — bắt trùng dù khác cách gõ ngày */
export function extractLegalDocumentIdentityKey(text) {
  const v = normalizeCsplValidate(text).replace(/\s+/g, " ");

  let m = v.match(/nghi\s*dinh\s*so\s*(\d+)\s*\/\s*(\d{4})\s*\/\s*nd-?\s*cp\b/);
  if (m) return `nghi_dinh:${m[1]}/${m[2]}/nd-cp`;

  m = v.match(/luat\b[^0-9]{0,40}so\s*(\d+)\s*\/\s*(\d{4})\s*\/\s*qh\s*(\d+)/);
  if (m) return `luat:${m[1]}/${m[2]}/qh${m[3]}`;

  m = v.match(/thong\s*tu\s*so\s*(\d+)\s*\/\s*(\d{4})\s*\/\s*tt-?\s*([a-z0-9-]+)/);
  if (m) return `thong_tu:${m[1]}/${m[2]}/tt-${m[3].replace(/\s+/g, "")}`;

  m = v.match(/quyet\s*dinh\s*so\s*(\d+)\s*\/\s*([a-z0-9][a-z0-9-]*)/);
  if (m) return `quyet_dinh:${m[1]}/${m[2]}`;

  return null;
}

export function normalizeTcKyHieuKey(kyHieu) {
  return normalizeCsplValidate(kyHieu).replace(/[\s-]+/g, "");
}

function getCatalogContentDuplicateKeys(contentText, kind, kyHieu) {
  const keys = new Set();
  const text = contentText || "";
  if (kind === "tc") {
    const kh = normalizeTcKyHieuKey(kyHieu || "");
    if (kh.length >= 3) keys.add(`tc_kh:${kh}`);
  }
  const identity = extractLegalDocumentIdentityKey(text);
  if (identity) keys.add(identity);
  const contentKey = normalizeCatalogContentKey(text);
  if (contentKey.length >= 8) keys.add(contentKey);
  return keys;
}

export function getCatalogDuplicateKey(row, kind) {
  const textField = kind === "cspl" ? "ten_cspl" : "ten_tai_lieu";
  const keys = getCatalogContentDuplicateKeys(row?.[textField], kind, row?.ky_hieu);
  return keys.values().next().value || "";
}

const IDENTITY_KEY_PRIORITY = ["nghi_dinh:", "luat:", "thong_tu:", "quyet_dinh:", "tc_kh:"];

/** Khóa định danh chính của một dòng danh mục — dùng lưu tham chiếu thay thế */
export function getCatalogRowPrimaryIdentityKey(row, kind) {
  if (!row) return "";
  const textField = kind === "cspl" ? "ten_cspl" : "ten_tai_lieu";
  const keys = [...getCatalogContentDuplicateKeys(row[textField], kind, row.ky_hieu)];
  for (const prefix of IDENTITY_KEY_PRIORITY) {
    const found = keys.find((k) => k.startsWith(prefix));
    if (found) return found;
  }
  return keys[0] || "";
}

export function findRowByIdentityKey(rows, kind, identityKey) {
  const key = String(identityKey || "").trim();
  if (!key) return null;
  for (const row of rows || []) {
    const textField = kind === "cspl" ? "ten_cspl" : "ten_tai_lieu";
    if (getCatalogContentDuplicateKeys(row[textField], kind, row.ky_hieu).has(key)) {
      return row;
    }
  }
  return null;
}

export function formatReplacementShortLabel(targetRow, kind) {
  if (!targetRow) return "";
  if (kind === "tc") {
    return targetRow.ky_hieu || String(targetRow.ten_tai_lieu || "").slice(0, 72);
  }
  const identity = extractLegalDocumentIdentityKey(targetRow.ten_cspl);
  if (identity?.startsWith("nghi_dinh:")) {
    const body = identity.slice("nghi_dinh:".length).replace("/nd-cp", "");
    return `NĐ ${body}/NĐ-CP`;
  }
  if (identity?.startsWith("luat:")) {
    const rest = identity.slice("luat:".length);
    const m = rest.match(/^(\d+)\/(\d+)\/qh(\d+)$/i);
    if (m) return `Luật số ${m[1]}/${m[2]}/QH${m[3]}`;
    return `Luật số ${rest.replace(/\/qh(\d+)$/i, "/QH$1")}`;
  }
  if (identity?.startsWith("thong_tu:")) {
    const body = identity.slice("thong_tu:".length);
    return `TT ${body}`.replace(/tt-/i, "TT-");
  }
  if (identity?.startsWith("quyet_dinh:")) {
    return `QĐ số ${identity.slice("quyet_dinh:".length)}`;
  }
  return String(targetRow.ten_cspl || "").slice(0, 72);
}

/** Resolve tham chiếu thay thế: ưu tiên identity_key, fallback mã CS/TC cũ */
export function resolveCatalogReplacement(row, allRows, kind) {
  if (!row) return null;
  const idField = kind === "cspl" ? "id_cspl" : "id_tc";
  const legacyCol = kind === "cspl" ? "id_cspl_thay_the" : "id_tc_thay_the";
  const identityKey = String(row.identity_key_thay_the || "").trim();

  if (identityKey) {
    const target = findRowByIdentityKey(allRows, kind, identityKey);
    return {
      identityKey,
      id: target?.[idField] || null,
      label: target ? formatReplacementShortLabel(target, kind) : identityKey,
      orphan: !target,
    };
  }

  const legacyId = String(row[legacyCol] || "").trim();
  if (!legacyId) return null;
  const target = (allRows || []).find((r) => r[idField] === legacyId);
  return {
    identityKey: target ? getCatalogRowPrimaryIdentityKey(target, kind) : "",
    id: legacyId,
    label: target ? formatReplacementShortLabel(target, kind) : legacyId,
    orphan: !target,
  };
}

function resolveReplacementCacheId(identityKey, allRows, kind) {
  if (!identityKey) return null;
  const target = findRowByIdentityKey(allRows, kind, identityKey);
  if (!target) return null;
  return kind === "cspl" ? target.id_cspl : target.id_tc;
}

/** Sửa tham chiếu đã biết sai + migrate id cũ → identity_key */
export async function migrateCatalogReplacementReferences(supabase, table, kind, rows) {
  if (!rows?.length) return 0;
  const idCol = kind === "cspl" ? "id_cspl" : "id_tc";
  const legacyCol = kind === "cspl" ? "id_cspl_thay_the" : "id_tc_thay_the";
  const hasIdentityColumn = Object.prototype.hasOwnProperty.call(rows[0], "identity_key_thay_the");
  const idIndex = Object.fromEntries(rows.map((r) => [r[idCol], r]));
  const updates = new Map();

  const queueUpdate = (rowId, patch) => {
    const prev = updates.get(rowId) || { [idCol]: rowId };
    updates.set(rowId, { ...prev, ...patch });
  };

  const findNd217Row = () =>
    findRowByIdentityKey(rows, kind, "nghi_dinh:217/2026/nd-cp") ||
    rows.find((r) => /217\s*\/\s*2026\s*\/\s*nd-?\s*cp/i.test(r.ten_cspl || ""));

  if (!hasIdentityColumn) {
    if (kind === "cspl") {
      const nd217 = findNd217Row();
      const cs06 = rows.find((r) => r.id_cspl === "CS06" && r.trang_thai === TRANG_THAI_HET_HL);
      if (nd217 && cs06 && cs06.id_cspl_thay_the !== nd217.id_cspl) {
        queueUpdate("CS06", { id_cspl_thay_the: nd217.id_cspl });
      }
    }
    let count = 0;
    for (const patch of updates.values()) {
      await updateCatalogRow(supabase, table, idCol, patch[idCol], patch);
      count++;
    }
    return count;
  }

  for (const row of rows) {
    if (row.trang_thai !== TRANG_THAI_HET_HL) continue;

    let identityKey = String(row.identity_key_thay_the || "").trim();
    const legacyId = String(row[legacyCol] || "").trim();

    // CS06 (NĐ 175/2024) → NĐ 217/2026 — sửa tham chiếu sai CS05
    if (kind === "cspl" && row.id_cspl === "CS06") {
      const nd217 = findNd217Row();
      if (nd217) {
        const correctKey = getCatalogRowPrimaryIdentityKey(nd217, kind) || "nghi_dinh:217/2026/nd-cp";
        identityKey = correctKey;
      }
    }

    if (!identityKey && legacyId) {
      const target = idIndex[legacyId];
      if (target) identityKey = getCatalogRowPrimaryIdentityKey(target, kind);
    }

    if (!identityKey && !legacyId) continue;

    const cachedId = identityKey ? resolveReplacementCacheId(identityKey, rows, kind) : legacyId || null;
    const nextIdentity = identityKey || null;
    const changed =
      (row.identity_key_thay_the || null) !== nextIdentity ||
      (row[legacyCol] || null) !== (cachedId || null);
    if (changed) {
      queueUpdate(row[idCol], {
        identity_key_thay_the: nextIdentity,
        [legacyCol]: cachedId,
      });
    }
  }

  let count = 0;
  for (const patch of updates.values()) {
    const id = patch[idCol];
    await updateCatalogRow(supabase, table, idCol, id, patch);
    count++;
  }
  return count;
}

/** Cập nhật cache mã CS/TC sau khi đánh số lại — từ identity_key */
export async function refreshCatalogReplacementIdCaches(supabase, table, kind, rows) {
  const idCol = kind === "cspl" ? "id_cspl" : "id_tc";
  const legacyCol = kind === "cspl" ? "id_cspl_thay_the" : "id_tc_thay_the";
  if (!rows?.length || !Object.prototype.hasOwnProperty.call(rows[0], "identity_key_thay_the")) return;

  for (const row of rows) {
    const identityKey = String(row.identity_key_thay_the || "").trim();
    if (!identityKey) continue;
    const cachedId = resolveReplacementCacheId(identityKey, rows, kind);
    if ((row[legacyCol] || null) !== (cachedId || null)) {
      await updateCatalogRow(supabase, table, idCol, row[idCol], { [legacyCol]: cachedId });
    }
  }
}

/** Loại bỏ bản trùng khi xuất Word — giữ bản đầu theo thứ tự danh mục */
export function dedupeCatalogRowsByContent(rows, kind) {
  const seen = new Set();
  const result = [];
  for (const row of rows || []) {
    const keys = getCatalogContentDuplicateKeys(
      row[kind === "cspl" ? "ten_cspl" : "ten_tai_lieu"],
      kind,
      row.ky_hieu
    );
    if (!keys.size) {
      result.push(row);
      continue;
    }
    const primaryKey = [...keys][0];
    if (seen.has(primaryKey)) continue;
    seen.add(primaryKey);
    for (const k of keys) seen.add(k);
    result.push(row);
  }
  return result;
}

export async function computeFileSha256(file) {
  if (!file || typeof crypto?.subtle?.digest !== "function") return null;
  const buf = await file.arrayBuffer();
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function findDuplicateCatalogContent(rows, kind, contentText, excludeId, kyHieu) {
  const newKeys = getCatalogContentDuplicateKeys(contentText, kind, kyHieu);
  if (!newKeys.size) return null;
  const idField = kind === "cspl" ? "id_cspl" : "id_tc";
  const textField = kind === "cspl" ? "ten_cspl" : "ten_tai_lieu";
  for (const row of rows || []) {
    if (excludeId && row[idField] === excludeId) continue;
    const rowKeys = getCatalogContentDuplicateKeys(row[textField], kind, row.ky_hieu);
    for (const nk of newKeys) {
      if (rowKeys.has(nk)) return row;
    }
  }
  return null;
}

function catalogRowHasStoredFile(row) {
  return !!(row?.duong_dan_file || row?.link_pdf_van_ban);
}

export function findDuplicateCatalogFile(rows, kind, { hash, fileName }, excludeId) {
  const idField = kind === "cspl" ? "id_cspl" : "id_tc";
  const normName = String(fileName || "").trim().toLowerCase();
  let byHash = null;
  let byName = null;
  for (const row of rows || []) {
    const rowId = row[idField];
    if (excludeId && rowId === excludeId) continue;
    if (!catalogRowHasStoredFile(row)) continue;
    if (hash && row.file_hash_sha256 && row.file_hash_sha256 === hash) byHash = row;
    const rowName = String(row.file_ten_goc || "").trim().toLowerCase();
    if (normName && rowName && rowName === normName) byName = row;
  }
  return { byHash, byName };
}

/**
 * Gom cảnh báo trùng lặp 3 mức: nội dung, file (hash/tên), ghi đè file cùng mã.
 * @returns {{ warnings: string[], fileHash: string|null }}
 */
export async function collectCatalogDuplicateWarnings({
  kind,
  mode,
  form,
  rows,
  attachFile,
  excludeId,
  newStoragePath,
}) {
  const warnings = [];
  const idField = kind === "cspl" ? "id_cspl" : "id_tc";
  const textField = kind === "cspl" ? "ten_cspl" : "ten_tai_lieu";
  const contentText = form[textField];
  const kyHieu = kind === "tc" ? form.ky_hieu : null;

  const dupContent = findDuplicateCatalogContent(rows, kind, contentText, excludeId, kyHieu);
  if (dupContent) {
    const dupId = dupContent[idField];
    const khDup =
      kind === "tc" &&
      kyHieu &&
      normalizeTcKyHieuKey(kyHieu) === normalizeTcKyHieuKey(dupContent.ky_hieu);
    if (khDup) {
      warnings.push(`Trùng ký hiệu «${String(kyHieu).trim()}» với mã ${dupId}`);
    } else {
      const snippet = String(dupContent[textField] || "").slice(0, 90);
      warnings.push(`Trùng nội dung với mã ${dupId}: «${snippet}${snippet.length >= 90 ? "…" : ""}»`);
    }
  }

  let fileHash = null;
  if (attachFile) {
    fileHash = await computeFileSha256(attachFile);
    const { byHash, byName } = findDuplicateCatalogFile(rows, kind, {
      hash: fileHash,
      fileName: attachFile.name,
    }, excludeId);

    if (byHash) {
      const dupId = byHash[idField];
      const fn = byHash.file_ten_goc || attachFile.name;
      warnings.push(`Trùng nội dung file (SHA-256) với mã ${dupId} - «${fn}»`);
    }
    if (byName && byName !== byHash) {
      const dupId = byName[idField];
      warnings.push(`Trùng tên file «${attachFile.name}» với mã ${dupId}`);
    }

    const hasExistingFile = !!(form.duong_dan_file || form.link_pdf_van_ban);
    const pathChanges = form.duong_dan_file && newStoragePath && form.duong_dan_file !== newStoragePath;
    if (mode === "edit" && hasExistingFile) {
      warnings.push(
        `Ghi đè file PDF/ảnh đã lưu của mã ${excludeId}${pathChanges ? ` (đường dẫn mới: ${newStoragePath})` : ""}`
      );
    }
  }

  return { warnings, fileHash };
}

export function buildExpireCsplPayload(form, allRows = []) {
  const identityKey = form.identity_key_thay_the?.trim() || null;
  return {
    trang_thai: TRANG_THAI_HET_HL,
    ngay_het_hieu_luc: form.ngay_het_hieu_luc,
    identity_key_thay_the: identityKey,
    id_cspl_thay_the: identityKey ? resolveReplacementCacheId(identityKey, allRows, "cspl") : null,
    ghi_chu_het_hl: form.ghi_chu_het_hl?.trim() || null,
  };
}

export function buildExpireTcPayload(form, allRows = []) {
  const identityKey = form.identity_key_thay_the?.trim() || null;
  return {
    trang_thai: TRANG_THAI_HET_HL,
    ngay_het_hieu_luc: form.ngay_het_hieu_luc,
    identity_key_thay_the: identityKey,
    id_tc_thay_the: identityKey ? resolveReplacementCacheId(identityKey, allRows, "tc") : null,
    ghi_chu_het_hl: form.ghi_chu_het_hl?.trim() || null,
  };
}
