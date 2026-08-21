/** Cấu trúc folder hồ sơ trên workspace dự án */

export const HOSO_FOLDERS_KHAO_SAT = [
  { key: "nvks", label: "NVKS", order: 1 },
  { key: "paktks", label: "PAKTKS", order: 2 },
  { key: "nkks", label: "NKKS", order: 3 },
  { key: "bcks", label: "BCKS", order: 4 },
  { key: "nghiem_thu", label: "N.THU", order: 5 },
  { key: "chua_phan_loai", label: "Chưa phân loại", order: 99 },
];

export const HOSO_FOLDERS_THIET_KE = [
  { key: "thuyet_minh", label: "Thuyết minh", order: 1 },
  { key: "ban_ve", label: "Bản vẽ", order: 2 },
  { key: "du_toan", label: "Dự toán", order: 3 },
  { key: "chua_phan_loai", label: "Chưa phân loại", order: 99 },
];

const KS_KEYS = new Set(
  HOSO_FOLDERS_KHAO_SAT.map((f) => f.key).filter((k) => k !== "chua_phan_loai")
);
const TK_KEYS = new Set(
  HOSO_FOLDERS_THIET_KE.map((f) => f.key).filter((k) => k !== "chua_phan_loai")
);

export function parseHosoFolders(duAn) {
  let raw = duAn?.hoso_folders;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }
  return {
    khao_sat: Array.isArray(raw?.khao_sat) ? raw.khao_sat : [],
    thiet_ke: Array.isArray(raw?.thiet_ke) ? raw.thiet_ke : [],
  };
}

/** Tạo key folder tùy chọn: c_ten_folder */
export function slugCustomFolderKey(label) {
  const base = String(label || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  const stamp = Date.now().toString(36).slice(-4);
  return `c_${base || "folder"}_${stamp}`;
}

export function isReservedFolderKey(key, loaiKho) {
  const k = String(key || "").toLowerCase();
  if (k === "chua_phan_loai") return true;
  if (loaiKho === "thiet_ke") return TK_KEYS.has(k);
  return KS_KEYS.has(k);
}

/**
 * Chuẩn hóa module_loai → key folder.
 * customKeys: danh sách key folder tùy chọn đã đăng ký trên DA.
 */
export function normalizeFolderKey(moduleLoai, loaiKho, customKeys = []) {
  const raw = String(moduleLoai || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (!raw) return "chua_phan_loai";

  const customSet = new Set((customKeys || []).map((k) => String(k).toLowerCase()));
  if (customSet.has(raw) || raw.startsWith("c_")) return raw;

  if (loaiKho === "khao_sat") {
    if (raw === "nt" || raw === "n_thu" || raw === "n.thu") return "nghiem_thu";
    if (KS_KEYS.has(raw)) return raw;
    return "chua_phan_loai";
  }
  if (loaiKho === "thiet_ke") {
    if (raw === "thuyetminh") return "thuyet_minh";
    if (raw === "banve") return "ban_ve";
    if (raw === "dutoan") return "du_toan";
    if (TK_KEYS.has(raw)) return raw;
    return "chua_phan_loai";
  }
  return "chua_phan_loai";
}

export function itemsInFolder(items, folderKey, loaiKho, customKeys = []) {
  return (items || []).filter(
    (t) => normalizeFolderKey(t.module_loai, loaiKho, customKeys) === folderKey
  );
}

/** Ghép folder chuẩn + tùy chọn (+ Chưa phân loại nếu có file) */
export function listFoldersForKho(loaiKho, customFolders, items) {
  const base = loaiKho === "thiet_ke" ? HOSO_FOLDERS_THIET_KE : HOSO_FOLDERS_KHAO_SAT;
  const standard = base.filter((f) => f.key !== "chua_phan_loai");
  const customKeys = (customFolders || []).map((f) => f.key);
  const custom = (customFolders || []).map((f, i) => ({
    key: f.key,
    label: f.label || f.key,
    order: 40 + i,
    custom: true,
  }));

  // File có module_loai c_* chưa nằm trong danh sách DA → vẫn hiện
  const known = new Set([...standard.map((f) => f.key), ...customKeys, "chua_phan_loai"]);
  const orphanCustoms = [];
  for (const t of items || []) {
    const k = String(t.module_loai || "").trim().toLowerCase();
    if (k.startsWith("c_") && !known.has(k)) {
      known.add(k);
      orphanCustoms.push({
        key: k,
        label: k.replace(/^c_/, "").replace(/_/g, " "),
        order: 60,
        custom: true,
      });
    }
  }

  const miscCount = itemsInFolder(items, "chua_phan_loai", loaiKho, customKeys).length;
  const misc =
    miscCount > 0
      ? [{ key: "chua_phan_loai", label: "Chưa phân loại", order: 99 }]
      : [];

  return [...standard, ...custom, ...orphanCustoms, ...misc].sort(
    (a, b) => (a.order || 0) - (b.order || 0)
  );
}

/** Chuẩn hóa nhãn → key gần đúng để so với folder chuẩn */
export function approxFolderKeyFromLabel(label) {
  return String(label || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * @returns {string|null} thông báo lỗi, hoặc null nếu OK
 */
export function validateCustomFolderLabel(label, loaiKho, existingFolders = [], excludeKey = null) {
  const name = String(label || "").trim();
  if (!name) return "Nhập tên thư mục.";
  const approx = approxFolderKeyFromLabel(name);
  if (
    isReservedFolderKey(approx, loaiKho) ||
    normalizeFolderKey(approx, loaiKho, []) !== "chua_phan_loai"
  ) {
    return "Tên trùng thư mục chuẩn — chọn tên khác.";
  }
  const dup = (existingFolders || []).some(
    (f) =>
      f.key !== excludeKey &&
      String(f.label || "").trim().toLowerCase() === name.toLowerCase()
  );
  if (dup) return "Thư mục này đã có.";
  return null;
}
