/**
 * Hàng công việc tùy chỉnh (+) — helper UI / insert DM.
 */
import {
  CHE_DO_TRAM,
  resolvePhanLoaiNhom,
  getLoaiHinhConfigByLabel,
  isRemovedDmRow,
} from './nvksLoaiHinh';

export const DM_NGUON_HE_THONG = 'HE_THONG';
export const DM_NGUON_NVKS_USER = 'NVKS_USER';
export const DM_TRANG_THAI_MAC_DINH = 'MAC_DINH';
export const DM_TRANG_THAI_CHO_KIEM = 'CHO_KIEM';
export const DM_TRANG_THAI_CHUAN = 'CHUAN';

/** cap_dh đặc biệt: hiện dropdown I–V, mặc định trống */
export const CAP_DH_USER_OPTIONAL = '__optional__';

export const DVT_PRESET_OPTIONS = ['Công', 'ngày', 'km', 'ha', 'lần', 'hố', 'điểm', 'm', 'm2', 'm3'];

const DUONG_DAY_NHOMS = new Set(['HT_DZ', 'DUONG_DAY', 'CAP_QUANG']);
const TRAM_NHOMS = new Set(['TRAM_HT', 'TRAM_DH_XM', 'TRAM_DH_BOTH', 'TRAM_DH', 'TRAM_DC']);
const THOA_THUAN_NHOMS = new Set(['THOA_THUAN']);

export function isThoaThuanSectionTitle(item) {
  const loai = (item?.loai_dong || '').trim().toLowerCase();
  if (loai !== 'tieu_de') return false;
  const ten = (item?.ten_cong_viec || '').toLowerCase();
  return ten.includes('thỏa thuận') || ten.includes('thoa thuan');
}

export function isThoaThuanBlockNhom(nhom) {
  return THOA_THUAN_NHOMS.has(nhom);
}

export function isDuongDayBlockNhom(nhom) {
  return DUONG_DAY_NHOMS.has(nhom);
}

export function isTramBlockNhom(nhom) {
  return TRAM_NHOMS.has(nhom);
}

export function isWorkRow(item) {
  const loai = (item?.loai_dong || '').trim().toLowerCase();
  return loai !== 'tieu_de';
}

/** Phân loại DM khi user bấm + ở khối Trạm */
export function resolveTramPhanLoaiForUserAdd(cheDoTram) {
  if (cheDoTram === CHE_DO_TRAM.XAY_MOI) return 'TRAM_DH_XM';
  if (cheDoTram === CHE_DO_TRAM.CAI_TAO) return 'TRAM_DH_BOTH';
  if (cheDoTram === CHE_DO_TRAM.NCS) return 'TRAM_HT';
  return 'TRAM_DC';
}

export function allocateNextCvId(rows) {
  let maxNum = 199;
  for (const row of rows || []) {
    const id = row?.id_cong_viec || '';
    const m = id.match(/^CV_(\d+)/i);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }
  return `CV_${String(maxNum + 1).padStart(3, '0')}`;
}

export function buildUserCongViecRow({
  id,
  tenCongViec,
  phanLoaiHangMuc,
  donVi = 'Công',
  taoBoiEmail = '',
}) {
  return {
    id_cong_viec: id,
    tt: '99',
    ten_cong_viec: tenCongViec.trim(),
    loai_dong: 'Cong_Viec',
    cap_dh: CAP_DH_USER_OPTIONAL,
    don_vi: donVi.trim() || 'Công',
    apdung_bcktkt: 1,
    apdung_bcnckt: 1,
    apdung_tkbvtc: 1,
    loai_nhap_lieu: 'nhap_tay_plus',
    cong_thuc: '',
    phan_loai_hang_muc: phanLoaiHangMuc,
    nguon: DM_NGUON_NVKS_USER,
    trang_thai_dm: DM_TRANG_THAI_CHO_KIEM,
    tao_boi_email: taoBoiEmail || null,
    tao_luc: new Date().toISOString(),
  };
}

export function isUserAddedDmRow(item) {
  if ((item?.nguon || '').trim() === DM_NGUON_NVKS_USER) return true;
  return (item?.loai_nhap_lieu || '').trim().toLowerCase() === 'nhap_tay_plus';
}

function sortUserRowsByCreated(a, b) {
  const ta = a?.tao_luc || '';
  const tb = b?.tao_luc || '';
  if (ta && tb && ta !== tb) return ta.localeCompare(tb);
  return (a?.id_cong_viec || '').localeCompare(b?.id_cong_viec || '', undefined, {
    numeric: true,
  });
}

/** Chèn hàng NVKS_USER vào cuối I.1 / I.2 (trước tiêu đề kế tiếp), không theo sort CV_200+ */
export function mergeUserRowsIntoSubsections(items) {
  const input = (items || []).filter((item) => !isRemovedDmRow(item));
  if (!input.length) return input;

  const dzUser = [];
  const tramUser = [];
  const thoaUser = [];
  const rest = [];

  for (const item of input) {
    if (!isUserAddedDmRow(item)) {
      rest.push(item);
      continue;
    }
    const nhom = resolvePhanLoaiNhom(item);
    const pl = (item?.phan_loai_hang_muc || '').trim().toUpperCase();
    if (pl === 'DUONG_DAY' || nhom === 'DUONG_DAY') {
      dzUser.push(item);
    } else if (isTramBlockNhom(nhom)) {
      tramUser.push(item);
    } else if (pl === 'THOA_THUAN' || isThoaThuanBlockNhom(nhom)) {
      thoaUser.push(item);
    } else {
      rest.push(item);
    }
  }

  dzUser.sort(sortUserRowsByCreated);
  tramUser.sort(sortUserRowsByCreated);
  thoaUser.sort(sortUserRowsByCreated);

  if (dzUser.length === 0 && tramUser.length === 0 && thoaUser.length === 0) return input;

  const insertBeforeAnchor = (list, userRows, anchorId, blockKind) => {
    if (!userRows.length) return list;
    const anchorIdx = list.findIndex((i) => i.id_cong_viec === anchorId);
    if (anchorIdx >= 0) {
      return [...list.slice(0, anchorIdx), ...userRows, ...list.slice(anchorIdx)];
    }
    let lastWorkIdx = -1;
    let currentBlock = null;
    list.forEach((item, index) => {
      const loai = (item?.loai_dong || '').trim().toLowerCase();
      if (loai === 'tieu_de') {
        if (item.id_cong_viec === SUBSECTION_DZ_TITLE_ID) currentBlock = 'dz';
        else if (item.id_cong_viec === SUBSECTION_TRAM_TITLE_ID) currentBlock = 'tram';
        else if (isThoaThuanSectionTitle(item)) currentBlock = 'thoa';
        else currentBlock = null;
        return;
      }
      if (!isWorkRow(item) || currentBlock !== blockKind) return;
      const nhom = resolvePhanLoaiNhom(item);
      if (blockKind === 'dz' && isDuongDayBlockNhom(nhom)) lastWorkIdx = index;
      if (blockKind === 'tram' && isTramBlockNhom(nhom)) lastWorkIdx = index;
      if (blockKind === 'thoa') lastWorkIdx = index;
    });
    if (lastWorkIdx < 0) return [...list, ...userRows];
    return [...list.slice(0, lastWorkIdx + 1), ...userRows, ...list.slice(lastWorkIdx + 1)];
  };

  let merged = insertBeforeAnchor(rest, dzUser, SUBSECTION_DZ_ANCHOR_ID, 'dz');
  merged = insertBeforeAnchor(merged, tramUser, SUBSECTION_TRAM_ANCHOR_ID, 'tram');
  merged = insertBeforeAnchor(merged, thoaUser, null, 'thoa');
  return merged;
}

/** Tiêu đề / mốc chèn hàng user */
const SUBSECTION_DZ_TITLE_ID = 'CV_002';
const SUBSECTION_TRAM_TITLE_ID = 'CV_021';
export const SUBSECTION_DZ_ANCHOR_ID = 'CV_021';
export const SUBSECTION_TRAM_ANCHOR_ID = 'CV_028';

/** Chèn nút + ngay sau dòng cuối của I.1 (ĐZ) và I.2 (TBA), không gom cuối bảng */
export function buildTableRenderPlan(items, { showDzAdd, showTramAdd, showThoaAdd }) {
  if (!items?.length) return [];

  const insertsAfter = new Map();
  let currentBlock = null;
  let lastWorkIdx = -1;

  const closeBlock = () => {
    if (lastWorkIdx < 0 || !currentBlock) return;
    if (currentBlock === 'dz' && showDzAdd) insertsAfter.set(lastWorkIdx, 'add_dz');
    if (currentBlock === 'tram' && showTramAdd) insertsAfter.set(lastWorkIdx, 'add_tram');
    if (currentBlock === 'thoa' && showThoaAdd) insertsAfter.set(lastWorkIdx, 'add_thoa');
    lastWorkIdx = -1;
  };

  items.forEach((item, index) => {
    const id = item?.id_cong_viec;
    const loai = (item?.loai_dong || '').trim().toLowerCase();

    if (loai === 'tieu_de') {
      closeBlock();
      if (id === SUBSECTION_DZ_TITLE_ID) currentBlock = 'dz';
      else if (id === SUBSECTION_TRAM_TITLE_ID) currentBlock = 'tram';
      else if (isThoaThuanSectionTitle(item)) currentBlock = 'thoa';
      else currentBlock = null;
      return;
    }

    if (!isWorkRow(item) || !currentBlock) return;

    const nhom = resolvePhanLoaiNhom(item);
    if (currentBlock === 'dz' && isDuongDayBlockNhom(nhom)) lastWorkIdx = index;
    if (currentBlock === 'tram' && isTramBlockNhom(nhom)) lastWorkIdx = index;
    if (currentBlock === 'thoa') lastWorkIdx = index;
  });
  closeBlock();

  const plan = [];
  items.forEach((item, index) => {
    plan.push({ type: 'row', item, index });
    const addType = insertsAfter.get(index);
    if (addType) plan.push({ type: addType });
  });
  return plan;
}

export function shouldShowDuongDayAddButton(loaiHinhLabel) {
  const cfg = getLoaiHinhConfigByLabel(loaiHinhLabel);
  return Boolean(cfg?.coDuongDay);
}

export function shouldShowTramAddButton(loaiHinhLabel) {
  const cfg = getLoaiHinhConfigByLabel(loaiHinhLabel);
  return Boolean(cfg && cfg.cheDoTram !== CHE_DO_TRAM.KHONG);
}

export function shouldShowThoaThuanAddButton(items) {
  return (items || []).some(isThoaThuanSectionTitle);
}

export function getEffectiveDonVi(item, donViOverrides) {
  if (isDieuTraCongFixedItem(item)) return 'Công';
  const id = item?.id_cong_viec;
  if (id && donViOverrides?.[id]) return donViOverrides[id];
  return item?.don_vi || '';
}

export function isOptionalCapDhItem(item) {
  return (
    item?.cap_dh === CAP_DH_USER_OPTIONAL ||
    (item?.loai_nhap_lieu || '').trim().toLowerCase() === 'nhap_tay_plus'
  );
}

/** Hạng mục điều tra — không có cấp ĐH; ĐVT luôn là Công. */
const DIEU_TRA_CONG_FIXED_KEYWORDS = [
  'điều tra vị trí đổ thải',
  'điều tra mực nước lũ',
];

/** Các hạng mục không bao giờ có cấp địa hình — ẩn cột/dropdown trên form + xuất KL. */
const FORCE_HIDE_CAP_DH_KEYWORDS = [
  'thí nghiệm mẫu đá',
  'thí nghiệm mẫu nước',
  'điện trở suất',
  'khí tượng thủy văn',
  'công tác thỏa thuận',
  ...DIEU_TRA_CONG_FIXED_KEYWORDS,
];

function normalizeTenCongViec(item) {
  return String(item?.ten_cong_viec || '')
    .toLowerCase()
    .normalize('NFC');
}

export function isDieuTraCongFixedItem(item) {
  const ten = normalizeTenCongViec(item);
  return DIEU_TRA_CONG_FIXED_KEYWORDS.some((keyword) => ten.includes(keyword));
}

export function isForceHideCapDhItem(item) {
  const ten = normalizeTenCongViec(item);
  return FORCE_HIDE_CAP_DH_KEYWORDS.some((keyword) => ten.includes(keyword));
}

export function shouldShowCapDhCell(item, isTitle, isKhongNhap) {
  if (isTitle || isKhongNhap) return false;
  if (isForceHideCapDhItem(item)) return false;
  if (isOptionalCapDhItem(item)) return true;
  const cap = (item?.cap_dh ?? '').toString().trim();
  return cap !== '';
}

/** Metadata cột có thể chưa có trên Supabase — strip nếu insert lỗi */
export function stripDmMetadata(row) {
  const { nguon, trang_thai_dm, tao_boi_email, tao_luc, ...rest } = row;
  return rest;
}

export async function insertDmCongViecRow(supabase, row) {
  let payload = { ...row };
  let { error } = await supabase.from('DM_CONG_VIEC').insert(payload);
  if (error && /column|schema|nguon|trang_thai|tao_/i.test(error.message)) {
    payload = stripDmMetadata(payload);
    ({ error } = await supabase.from('DM_CONG_VIEC').insert(payload));
  }
  return { error, inserted: payload };
}
