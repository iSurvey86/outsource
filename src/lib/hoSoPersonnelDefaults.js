/** Danh sách mặc định dropdown II. Nhân sự — NVKS / PAKTKS. */

export const DEFAULT_CNKS_NAME = "Đỗ Minh Phương";
export const DEFAULT_LANH_DAO_NAME = "Trần Văn Ngọc";

export const DEFAULT_CNKS_OPTIONS = [DEFAULT_CNKS_NAME, "Đinh Đức Đoàn"];

export const DEFAULT_LANH_DAO_OPTIONS = [
  "Phạm Tuấn Nam",
  DEFAULT_LANH_DAO_NAME,
  "Nguyễn Văn Tân",
  "Phạm Thanh Tùng",
  "Nguyễn Văn Hào",
];

export function normalizePersonnelName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Gộp danh sách mặc định + tên đã lưu / thêm tay (không trùng). */
export function mergePersonnelOptions(defaults, ...extraNames) {
  const out = [...(defaults || [])];
  const seen = new Set(out.map(normalizePersonnelName));
  for (const raw of extraNames.flat()) {
    const name = String(raw || "").trim();
    if (!name) continue;
    const key = normalizePersonnelName(name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/** Tra ma_nv từ danh mục NHAN_SU (trình ký) — không đổi dropdown. */
export function resolveMaNvByHoTen(catalog, hoTen) {
  const key = normalizePersonnelName(hoTen);
  if (!key) return "";
  const row = (catalog || []).find((n) => normalizePersonnelName(n.ho_ten) === key);
  return row?.ma_nv || "";
}
