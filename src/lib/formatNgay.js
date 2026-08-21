/**
 * Ngày hiển thị cho user: luôn dd/mm/yyyy (kiểu Việt Nam).
 * Lưu DB / input type="date" vẫn dùng yyyy-mm-dd.
 */

/** Chuẩn hoá về yyyy-mm-dd hoặc "". */
export function toNgayIso(raw) {
  if (!raw) return "";
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, "0");
    const d = String(raw.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(raw).trim();
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }
  const vi = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (vi) {
    return `${vi[3]}-${vi[2].padStart(2, "0")}-${vi[1].padStart(2, "0")}`;
  }
  return "";
}

/** Hiển thị: 21/08/2026 */
export function formatNgayVi(raw) {
  const iso = toNgayIso(raw);
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Hiển thị dài: 21 tháng 8 năm 2026 */
export function formatNgayViLong(raw) {
  const iso = toNgayIso(raw);
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${Number(d)} tháng ${Number(m)} năm ${y}`;
}
