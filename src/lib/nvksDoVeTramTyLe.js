/**
 * CV_026 — đo vẽ địa hình trạm: tỷ lệ / đồng mức tùy chọn (BCNCKT, BCKTKT).
 */
export const CV_026_ID = 'CV_026';
export const LOAI_NHAP_DO_VE_TRAM_TY_LE = 'do_ve_tram_ty_le';

export const TY_LE_PRESET_OPTIONS = ['1/200', '1/500', '1/1000', '1/2000'];
export const DONG_MUC_PRESET_OPTIONS = ['0,5m', '1,0m'];

export const DEFAULT_TY_LE = '1/2000';
export const DEFAULT_DONG_MUC = '1,0m';
export const DEFAULT_KL_HA = '12';
export const DEFAULT_CAP_DH = 'III';

export function isDoVeTramTyLeItem(item) {
  const loai = (item?.loai_nhap_lieu || '').trim().toLowerCase();
  return loai === LOAI_NHAP_DO_VE_TRAM_TY_LE || item?.id_cong_viec === CV_026_ID;
}

export function getDoVeTramTyLeValue(quantities, itemId = CV_026_ID) {
  const raw = quantities?.[`${itemId}_tyLe`];
  if (raw !== undefined && String(raw).trim() !== '') return String(raw).trim();
  return DEFAULT_TY_LE;
}

export function getDoVeTramDongMucValue(quantities, itemId = CV_026_ID) {
  const raw = quantities?.[`${itemId}_dongMuc`];
  if (raw !== undefined && String(raw).trim() !== '') return String(raw).trim();
  return DEFAULT_DONG_MUC;
}

/** Ghép dòng chính (Word — cột noi_dung, không xuống dòng) */
export function buildDoVeTramTyLeDongChinh(item, quantities) {
  const id = item?.id_cong_viec || CV_026_ID;
  const tyLe = getDoVeTramTyLeValue(quantities, id);
  const dongMuc = getDoVeTramDongMucValue(quantities, id);
  return `Đo vẽ bản đồ địa hình tỷ lệ ${tyLe}, đường đồng mức ${dongMuc}`;
}

/** @deprecated Word export dùng dongChinh + getDoVeTramPhamViText (ghi_chu in nghiêng) */
export function buildDoVeTramTyLeNoiDung(item, quantities) {
  return `${buildDoVeTramTyLeDongChinh(item, quantities)}\n${getDoVeTramPhamViText(item)}`;
}

/** Phần mô tả phạm vi (dòng 2 trở đi) — hiển thị UI */
export function getDoVeTramPhamViText(item) {
  const raw = (item?.ten_cong_viec || '').trim();
  const nl = raw.indexOf('\n');
  if (nl >= 0) return raw.slice(nl).trim();
  return '(Phạm vi đo vẽ: Bao trùm toàn bộ diện tích xây dựng TBA bao gồm cả đoạn đấu nối vào TBA, đường giao thông vào trạm và mở rộng ra xung quanh đủ để nghiên cứu, phân tích so sánh các phương án)';
}

export function initDoVeTramTyLeQuantities(item, target = {}) {
  const id = item?.id_cong_viec || CV_026_ID;
  const klDefault =
    item?.cong_thuc?.toString().replace(/^'?=?/, '').trim() || DEFAULT_KL_HA;
  if (target[`${id}_tong`] === undefined) target[`${id}_tong`] = klDefault;
  if (target[`${id}_tyLe`] === undefined) target[`${id}_tyLe`] = DEFAULT_TY_LE;
  if (target[`${id}_dongMuc`] === undefined) target[`${id}_dongMuc`] = DEFAULT_DONG_MUC;
  return target;
}
