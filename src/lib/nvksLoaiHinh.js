/**
 * Loại hình khảo sát NVKS — mapping dropdown, lọc DM_CONG_VIEC, fallback mẫu Word.
 *
 * Trục: coDuongDay + cheDoTram (KHONG | XAY_MOI | CAI_TAO | NCS)
 * DM_CONG_VIEC phan_loai_hang_muc (mới): HT_DZ | DUONG_DAY | CAP_QUANG | CHUNG |
 *   TRAM_HT | TRAM_DH_XM | TRAM_DH_BOTH | TRAM_DH | TRAM_DC
 */

export const CHE_DO_TRAM = {
  KHONG: 'KHONG',
  XAY_MOI: 'XAY_MOI',
  CAI_TAO: 'CAI_TAO',
  NCS: 'NCS',
};

export const LOAI_HINH_NVKS_OPTIONS = [
  {
    slug: 'dz_tba_xdm',
    label: 'Đường dây & TBA xây mới',
    coDuongDay: true,
    cheDoTram: CHE_DO_TRAM.XAY_MOI,
  },
  {
    slug: 'dz_xdm',
    label: 'Đường dây xây mới; Xuất tuyến; Đường dây cải tạo...',
    coDuongDay: true,
    cheDoTram: CHE_DO_TRAM.KHONG,
  },
  {
    slug: 'tba_xdm',
    label: 'Xây dựng TBA mới',
    coDuongDay: false,
    cheDoTram: CHE_DO_TRAM.XAY_MOI,
  },
  {
    slug: 'tba_ctmr',
    label: 'Cải tạo, mở rộng TBA ...',
    coDuongDay: false,
    cheDoTram: CHE_DO_TRAM.CAI_TAO,
  },
  {
    slug: 'tba_ncs',
    label: 'NCS trạm; BESS; Lắp đặt tụ, MBA...',
    coDuongDay: false,
    cheDoTram: CHE_DO_TRAM.NCS,
  },
  {
    slug: 'dz_xdm_tba_ct',
    label: 'Đường dây xây mới + TBA cải tạo',
    coDuongDay: true,
    cheDoTram: CHE_DO_TRAM.CAI_TAO,
  },
  {
    slug: 'dz_ct_tba_xm',
    label: 'Đường dây cải tạo + TBA xây mới',
    coDuongDay: true,
    cheDoTram: CHE_DO_TRAM.XAY_MOI,
  },
];

/** Hàng CHUNG chỉ hiện khi có phần đường dây (thỏa thuận đấu nối…) */
export const CHUNG_DUONG_DAY_ONLY_IDS = new Set([
  'CV_084',
  'CV_085',
]);

export const HT_DZ_IDS = new Set(['CV_020a']);
export const TRAM_DH_XM_IDS = new Set(['CV_022', 'CV_026']);
export const TRAM_DH_BOTH_IDS = new Set(['CV_023', 'CV_024', 'CV_025', 'CV_027']);
export const TRAM_HT_IDS = new Set(['CV_020b']);
/** Đã xóa khỏi DM — trùng mục 3 (CV_005) */
export const REMOVED_DM_IDS = new Set(['CV_016b']);

const REMOVED_DM_TEN_MARKERS = [
  'Công tác đo vẽ tuyến đường dây 110kV phương án chọn (bao gồm đo vẽ cắt dọc',
];

export function isRemovedDmRow(item) {
  const id = item?.id_cong_viec || '';
  if (REMOVED_DM_IDS.has(id)) return true;
  const ten = (item?.ten_cong_viec || '').trim();
  return REMOVED_DM_TEN_MARKERS.some((m) => ten.includes(m));
}

/** Gỡ cấp điện áp bị lặp trong tiêu đề mục (vd. "110kV 110kV") */
export function normalizeSectionTitle(text) {
  if (!text) return text;
  let t = text.trim();
  t = t.replace(/\b(\d+\s*k?v)\s+\1\b/gi, '$1');
  return t.replace(/\s{2,}/g, ' ').trim();
}

/** Dòng bổ sung khi DB chưa migrate (npm run migrate:dm-cong-viec -- --apply) */
export const CV_020B_TEMPLATE = {
  id_cong_viec: 'CV_020b',
  tt: '7',
  ten_cong_viec: 'Khảo sát hiện trạng (phần trạm biến áp)',
  loai_dong: 'Cong_Viec',
  cap_dh: ' ',
  don_vi: 'Công',
  apdung_bcktkt: 1,
  apdung_bcnckt: 1,
  apdung_tkbvtc: 1,
  loai_nhap_lieu: 'mac_dinh',
  cong_thuc: '5',
  phan_loai_hang_muc: 'TRAM_HT',
};

export const CV_016A_TEMPLATE = {
  id_cong_viec: 'CV_016a',
  tt: '11.1',
  ten_cong_viec:
    'Đo vẽ bình đồ địa hình tỷ lệ 1/1000 với khoảng cao đều đường đồng mức 1,0m bằng phương pháp toàn đạc kết hợp đo RTK hoặc sử dụng công nghệ mới như: LiDAR, thiết bị scan...\n' +
    '(Tại các vị trí phức tạp: Điểm đấu nối, cột góc, đoạn vượt quốc lộ, đường sắt, khoảng vượt lớn, giao chéo tuyến Đz có cấp điện áp 110kV trở lên...\n' +
    'Phạm vi đo vẽ: Chiều rộng về mỗi bên 30m tính từ tim tuyến Đz, chiều dài tuyến cần đo theo thực tế)',
  loai_dong: 'Cong_Viec',
  cap_dh: '=CV_005',
  don_vi: 'ha',
  apdung_bcktkt: 1,
  apdung_bcnckt: 1,
  apdung_tkbvtc: 0,
  loai_nhap_lieu: 'do_ve_bd_tuyen',
  cong_thuc: '',
  phan_loai_hang_muc: 'DUONG_DAY',
};

export const CV_016C_TEMPLATE = {
  id_cong_viec: 'CV_016c',
  tt: '11.3',
  ten_cong_viec: 'Thu thập mặt bằng địa chính, quy hoạch của địa phương',
  loai_dong: 'Cong_Viec',
  cap_dh: ' ',
  don_vi: 'Công',
  apdung_bcktkt: 1,
  apdung_bcnckt: 1,
  apdung_tkbvtc: 0,
  loai_nhap_lieu: 'nhap_tay',
  cong_thuc: '',
  phan_loai_hang_muc: 'DUONG_DAY',
};

export const CV_016D_TEMPLATE = {
  id_cong_viec: 'CV_016d',
  tt: '11.4',
  ten_cong_viec:
    'Khảo sát, điều tra, thống kê nhà cửa, công trình xây dựng, cây cối hoa màu, các loại rừng tuyến đường dây đi qua trong hành lang an toàn lưới điện',
  loai_dong: 'Cong_Viec',
  cap_dh: ' ',
  don_vi: 'Công',
  apdung_bcktkt: 1,
  apdung_bcnckt: 1,
  apdung_tkbvtc: 0,
  loai_nhap_lieu: 'nhap_tay',
  cong_thuc: '',
  phan_loai_hang_muc: 'DUONG_DAY',
};

/** TKBVTC — khung mục 2 / 3 phần đường dây (cha không nhập KL; con nhập tay + dropdown cấp ĐH) */
export const CV_017T_TEMPLATE = {
  id_cong_viec: 'CV_017t',
  tt: '2',
  ten_cong_viec: 'Đo đạc, phân trụ trung gian tại thực địa',
  loai_dong: 'Cong_Viec',
  cap_dh: '',
  don_vi: '',
  apdung_bcktkt: 0,
  apdung_bcnckt: 0,
  apdung_tkbvtc: 1,
  loai_nhap_lieu: 'khong_nhap',
  cong_thuc: '',
  phan_loai_hang_muc: 'DUONG_DAY',
};

export const CV_017A_TEMPLATE = {
  id_cong_viec: 'CV_017a',
  tt: '2.1',
  ten_cong_viec: '- Chia cột trung gian, địa hình trên cạn',
  loai_dong: 'Cong_Viec_Con',
  cap_dh: 'III',
  don_vi: 'km',
  apdung_bcktkt: 0,
  apdung_bcnckt: 0,
  apdung_tkbvtc: 1,
  loai_nhap_lieu: 'nhap_tay',
  cong_thuc: '',
  phan_loai_hang_muc: 'DUONG_DAY',
};

export const CV_017B_TEMPLATE = {
  id_cong_viec: 'CV_017b',
  tt: '2.2',
  ten_cong_viec: '- Chia cột trung gian, địa hình trên biển/dưới nước',
  loai_dong: 'Cong_Viec_Con',
  cap_dh: 'III',
  don_vi: 'km',
  apdung_bcktkt: 0,
  apdung_bcnckt: 0,
  apdung_tkbvtc: 1,
  loai_nhap_lieu: 'nhap_tay',
  cong_thuc: '',
  phan_loai_hang_muc: 'DUONG_DAY',
};

export const CV_019T_TEMPLATE = {
  id_cong_viec: 'CV_019t',
  tt: '3',
  ten_cong_viec: 'Phục hồi, bàn giao tuyến',
  loai_dong: 'Cong_Viec',
  cap_dh: '',
  don_vi: '',
  apdung_bcktkt: 0,
  apdung_bcnckt: 0,
  apdung_tkbvtc: 1,
  loai_nhap_lieu: 'khong_nhap',
  cong_thuc: '',
  phan_loai_hang_muc: 'DUONG_DAY',
};

/** 3.1 — trên cạn (ghi đè CV_019 hiện có) */
export const CV_019_PATCH = {
  tt: '3.1',
  ten_cong_viec: '- Phục hồi, bàn giao tuyến - địa hình trên cạn',
  loai_dong: 'Cong_Viec_Con',
  cap_dh: 'III',
  don_vi: 'km',
  apdung_bcktkt: 0,
  apdung_bcnckt: 0,
  apdung_tkbvtc: 1,
  loai_nhap_lieu: 'nhap_tay',
  cong_thuc: '',
  phan_loai_hang_muc: 'DUONG_DAY',
};

/** 3.2 — trên biển/dưới nước */
export const CV_019A_TEMPLATE = {
  id_cong_viec: 'CV_019a',
  tt: '3.2',
  ten_cong_viec: '- Phục hồi, bàn giao tuyến - địa hình trên biển/dưới nước',
  loai_dong: 'Cong_Viec_Con',
  cap_dh: 'III',
  don_vi: 'km',
  apdung_bcktkt: 0,
  apdung_bcnckt: 0,
  apdung_tkbvtc: 1,
  loai_nhap_lieu: 'nhap_tay',
  cong_thuc: '',
  phan_loai_hang_muc: 'DUONG_DAY',
};

/** @deprecated dùng CV_019_PATCH.ten_cong_viec */
export const CV_019_TEN_TREN_CAN = CV_019_PATCH.ten_cong_viec;

export const EXTRA_DUONG_DAY_TEMPLATES = [
  CV_016C_TEMPLATE,
  CV_016D_TEMPLATE,
  CV_017T_TEMPLATE,
  CV_017A_TEMPLATE,
  CV_017B_TEMPLATE,
  CV_019T_TEMPLATE,
  CV_019A_TEMPLATE,
];

/** Cha: số mẫu nước CV_043 — con chỉ tiêu bám công thức =CV_043 */
export const MAU_NUOC_PARENT_ID = 'CV_043';
export const MAU_NUOC_CHI_TIEU_IDS = [
  'CV_044',
  'CV_045',
  'CV_046',
  'CV_047',
  'CV_048',
  'CV_049',
  'CV_050',
];

export function normalizeCvId(id) {
  return String(id || '').trim().toUpperCase();
}

export function isMauNuocParentId(id) {
  return normalizeCvId(id) === MAU_NUOC_PARENT_ID;
}

export function isMauNuocChiTieuId(id) {
  return MAU_NUOC_CHI_TIEU_IDS.includes(normalizeCvId(id));
}

/** KL chỉ tiêu theo số mẫu — trống/không hợp lệ → "0" */
export function mauNuocChildKlFromParent(parentRaw) {
  if (parentRaw === undefined || parentRaw === null || String(parentRaw).trim() === '') return '0';
  const val = parseFloat(String(parentRaw).replace(',', '.'));
  if (Number.isNaN(val)) return '0';
  return Number.isInteger(val) ? String(val) : String(val);
}

/**
 * Đọc KL số mẫu nước từ state (ưu tiên CV_043; fallback key khác nếu id lệch).
 */
export function resolveMauNuocParentTong(quantities = {}, items = []) {
  const parentKey = `${MAU_NUOC_PARENT_ID}_tong`;
  if (Object.prototype.hasOwnProperty.call(quantities, parentKey)) {
    return quantities[parentKey];
  }
  const parentItem = (items || []).find((it) => isMauNuocParentItem(it));
  if (parentItem?.id_cong_viec) {
    const altKey = `${parentItem.id_cong_viec}_tong`;
    if (Object.prototype.hasOwnProperty.call(quantities, altKey)) {
      return quantities[altKey];
    }
  }
  return quantities[parentKey];
}

/**
 * Đồng bộ KL chỉ tiêu mẫu nước theo số mẫu (hồ sơ cũ còn mac_dinh=3 cứng).
 * Cha trống → ép "0". Nếu thiếu key cha nhưng đã có key chỉ tiêu → vẫn ép theo 0.
 */
export function syncMauNuocQuantities(quantities = {}, items = []) {
  const next = { ...quantities };
  const parentKey = `${MAU_NUOC_PARENT_ID}_tong`;
  const hasParentKey = Object.prototype.hasOwnProperty.call(next, parentKey);
  const hasChildKey = MAU_NUOC_CHI_TIEU_IDS.some((id) =>
    Object.prototype.hasOwnProperty.call(next, `${id}_tong`)
  );
  if (!hasParentKey && !hasChildKey && !(items || []).some((it) => isMauNuocParentItem(it))) {
    return next;
  }

  let parentRaw = resolveMauNuocParentTong(next, items);
  if (parentRaw === undefined || parentRaw === null || String(parentRaw).trim() === '') {
    next[parentKey] = '0';
    parentRaw = '0';
  } else {
    next[parentKey] = mauNuocChildKlFromParent(parentRaw);
    parentRaw = next[parentKey];
  }
  const childVal = mauNuocChildKlFromParent(parentRaw);
  for (const id of MAU_NUOC_CHI_TIEU_IDS) {
    next[`${id}_tong`] = childVal;
  }
  return next;
}

/**
 * Thùng rác / Del KL → đặt khối lượng = 0 (không ẩn hàng).
 * Mẫu nước: con bám số mẫu. Hàng tự tính: xóa luôn ô thành phần.
 */
export function zeroCongViecKlInQuantities(quantities = {}, idCongViec) {
  const id = normalizeCvId(idCongViec);
  if (!id) return quantities;

  if (isMauNuocChiTieuId(id)) {
    return syncMauNuocQuantities(quantities);
  }
  if (isMauNuocParentId(id)) {
    return syncMauNuocQuantities({ ...quantities, [`${MAU_NUOC_PARENT_ID}_tong`]: '0' });
  }

  const next = { ...quantities, [`${id}_tong`]: '0' };
  for (const suffix of ['sl', 'ho', 'sau', 'br', 'ds', 'cd', 'tram', 'duong']) {
    const key = `${id}_${suffix}`;
    if (key in quantities) next[key] = '0';
  }
  return next;
}

/** Nhận diện dòng «Thí nghiệm mẫu nước» theo tên (phòng id lệch) */
export function isMauNuocParentItem(item) {
  if (isMauNuocParentId(item?.id_cong_viec)) return true;
  const ten = (item?.ten_cong_viec || '').trim();
  if (/^\s*-/.test(ten)) return false;
  return /thí nghiệm mẫu nước/i.test(ten);
}

/** Nhận diện chỉ tiêu con mẫu nước theo id hoặc tên */
export function isMauNuocChiTieuItem(item) {
  if (isMauNuocChiTieuId(item?.id_cong_viec)) return true;
  const ten = (item?.ten_cong_viec || item?.noi_dung || '').toLowerCase();
  return (
    /chỉ tiêu độ ph|hàm lượng so4|hàm lượng ion cl|co2 xâm thực|hàm lượng nh4|hàm lượng mg2|muối hòa tan/i.test(
      ten
    )
  );
}

/**
 * Bỏ chỉ tiêu mẫu nước khi số mẫu cha ≤ 0 / không còn trong danh sách.
 * (Tránh NKKS hiện 4.1–4.7 = 3 trong khi cha đã về 0.)
 */
export function filterMauNuocChiTieuWhenParentZero(rows = [], quantities = null) {
  const list = Array.isArray(rows) ? rows : [];
  let parentKl = null;
  if (quantities && Object.prototype.hasOwnProperty.call(quantities, `${MAU_NUOC_PARENT_ID}_tong`)) {
    const raw = quantities[`${MAU_NUOC_PARENT_ID}_tong`];
    parentKl = parseFloat(String(raw ?? '').replace(',', '.'));
    if (Number.isNaN(parentKl)) parentKl = 0;
  } else {
    const parentRow = list.find((r) =>
      isMauNuocParentItem({ id_cong_viec: r?.id_cong_viec, ten_cong_viec: r?.noi_dung || r?.ten_cong_viec })
    );
    if (parentRow) {
      parentKl = parseFloat(String(parentRow.khoi_luong ?? '').replace(',', '.'));
      if (Number.isNaN(parentKl)) parentKl = 0;
    } else {
      // Không còn dòng cha trong bảng → coi như 0 (đã bị lọc vì KL≤0)
      parentKl = 0;
    }
  }
  if (parentKl > 0) return list;
  return list.filter(
    (r) =>
      !isMauNuocChiTieuItem({
        id_cong_viec: r?.id_cong_viec,
        ten_cong_viec: r?.noi_dung || r?.ten_cong_viec,
      })
  );
}

/**
 * Bỏ tiêu đề phụ không còn dòng KL con (vd. II.1 sau khi xóa chỉ tiêu mẫu nước).
 */
export function pruneEmptyNkksKlSectionHeaders(rows = []) {
  const list = Array.isArray(rows) ? [...rows] : [];
  const keep = new Array(list.length).fill(true);

  for (let i = 0; i < list.length; i++) {
    const row = list[i];
    if (!row?.is_header) continue;
    const stt = String(row.stt || '').trim();
    // Chỉ prune tiêu đề phụ (II.1), giữ chương I / II / III…
    if (!/^[IVXLC]+\.\d+/i.test(stt)) continue;

    let hasChild = false;
    for (let j = i + 1; j < list.length; j++) {
      if (list[j]?.is_header) break;
      hasChild = true;
      break;
    }
    if (!hasChild) keep[i] = false;
  }

  return list.filter((_, idx) => keep[idx]);
}

/** Thứ tự bắt buộc ngay sau CV_016 (không phụ thuộc chữ cái a/t) */
const TKBVTC_DZ_BLOCK_ORDER = [
  'CV_017t',
  'CV_017a',
  'CV_017b',
  'CV_019t',
  'CV_019',
  'CV_019a',
];

/** Thứ tự bắt buộc: CV_016 → 017t → 017a → 017b → 019t → 019 → 019a */
const DM_CONG_VIEC_SORT_OVERRIDES = {
  CV_016: 1600,
  CV_016a: 1550,
  CV_016c: 1570,
  CV_016d: 1580,
  CV_017t: 1610,
  CV_017a: 1611,
  CV_017b: 1612,
  CV_019t: 1620,
  CV_019: 1621,
  CV_019a: 1622,
  CV_020b: 2750,
};

export function getDmCongViecSortKey(item) {
  const id = item?.id_cong_viec || '';
  if (Object.prototype.hasOwnProperty.call(DM_CONG_VIEC_SORT_OVERRIDES, id)) {
    return DM_CONG_VIEC_SORT_OVERRIDES[id];
  }
  const m = id.match(/^CV_(\d+)([a-z])?$/i);
  if (!m) return 999999;
  const num = parseInt(m[1], 10);
  const letter = m[2];
  if (letter) return num * 100 + (letter.charCodeAt(0) - 96);
  return num * 100;
}

export function sortDmCongViecRows(rows) {
  const list = [...(rows || [])];
  const forcedIds = new Set(TKBVTC_DZ_BLOCK_ORDER);
  const forced = TKBVTC_DZ_BLOCK_ORDER.map((id) => list.find((r) => r.id_cong_viec === id)).filter(
    Boolean
  );
  const rest = list
    .filter((r) => !forcedIds.has(r.id_cong_viec))
    .sort((a, b) => getDmCongViecSortKey(a) - getDmCongViecSortKey(b));

  const idx016 = rest.findIndex((r) => r.id_cong_viec === 'CV_016');
  if (idx016 >= 0 && forced.length) {
    return [...rest.slice(0, idx016 + 1), ...forced, ...rest.slice(idx016 + 1)];
  }
  if (forced.length) return [...rest, ...forced];
  return rest;
}

/** Điền cấp ĐH mặc định (vd. III) khi hồ sơ chưa có giá trị chọn */
export function seedDefaultCapDhValues(capDhValues, templateRows) {
  const next = { ...(capDhValues || {}) };
  for (const item of templateRows || []) {
    const id = item?.id_cong_viec;
    if (!id) continue;
    if (next[id] != null && String(next[id]).trim() !== '') continue;
    const raw = (item.cap_dh ?? '').toString().trim();
    if (!raw || raw.startsWith('=') || raw.startsWith("'=") || raw === '__optional__') continue;
    if (/^(I|II|III|IV|V)$/i.test(raw)) {
      next[id] = raw.toUpperCase();
      continue;
    }
  }
  // Khối ĐZ TKBVTC: nếu vẫn trống sau khi đọc DM → III
  for (const id of ['CV_016', 'CV_017a', 'CV_017b', 'CV_019', 'CV_019a']) {
    if (next[id] == null || String(next[id]).trim() === '') next[id] = 'III';
  }
  return next;
}

/**
 * Ghép/bổ sung DM_CONG_VIEC sau khi fetch — đảm bảo CV_020b, CV_016a, CV_019/019a và nhãn CV_020a đúng.
 */
export function supplementDmCongViec(rows) {
  if (!rows?.length) return rows || [];

  const byId = new Map(rows.map((r) => [r.id_cong_viec, { ...r }]));

  const cv020a = byId.get('CV_020a');
  if (cv020a) {
    byId.set('CV_020a', {
      ...cv020a,
      ten_cong_viec: cv020a.ten_cong_viec?.includes('đường dây')
        ? cv020a.ten_cong_viec
        : 'Khảo sát hiện trạng (phần đường dây)',
      phan_loai_hang_muc:
        cv020a.phan_loai_hang_muc === 'CHUNG' ? 'DUONG_DAY' : cv020a.phan_loai_hang_muc,
    });
  }

  if (!byId.has('CV_020b')) {
    byId.set('CV_020b', { ...CV_020B_TEMPLATE });
  } else {
    const cv020b = byId.get('CV_020b');
    byId.set('CV_020b', {
      ...cv020b,
      tt: '7',
      ten_cong_viec: cv020b.ten_cong_viec?.includes('trạm')
        ? cv020b.ten_cong_viec
        : CV_020B_TEMPLATE.ten_cong_viec,
      phan_loai_hang_muc: cv020b.phan_loai_hang_muc || 'TRAM_HT',
    });
  }

  if (!byId.has('CV_016a')) {
    byId.set('CV_016a', { ...CV_016A_TEMPLATE });
  }

  const cv016 = byId.get('CV_016');
  if (cv016) {
    byId.set('CV_016', {
      ...cv016,
      // Dropdown cấp ĐH chọn được; mặc định luôn III (không còn =CV_005 / không giữ I cũ từ DB)
      cap_dh: 'III',
    });
  }

  // CV_019 / CV_019a — mục 3.1 / 3.2 dưới tiêu đề «Phục hồi, bàn giao tuyến»
  const cv019 = byId.get('CV_019');
  if (cv019) {
    byId.set('CV_019', { ...cv019, ...CV_019_PATCH });
  }

  for (const tpl of EXTRA_DUONG_DAY_TEMPLATES) {
    if (!byId.has(tpl.id_cong_viec)) {
      byId.set(tpl.id_cong_viec, { ...tpl });
    } else if (
      tpl.id_cong_viec === 'CV_019a' ||
      tpl.id_cong_viec === 'CV_017t' ||
      tpl.id_cong_viec === 'CV_017a' ||
      tpl.id_cong_viec === 'CV_017b' ||
      tpl.id_cong_viec === 'CV_019t'
    ) {
      const cur = byId.get(tpl.id_cong_viec);
      byId.set(tpl.id_cong_viec, { ...cur, ...tpl });
    }
  }

  byId.delete('CV_016b');

  // Chỉ tiêu TN mẫu nước (CV_044–050) bám theo số mẫu CV_043 — xóa/sửa cha thì con theo (không để cứng mac_dinh=3)
  for (const id of MAU_NUOC_CHI_TIEU_IDS) {
    const row = byId.get(id);
    if (!row) continue;
    byId.set(id, {
      ...row,
      loai_nhap_lieu: 'cong_thuc',
      cong_thuc: '=CV_043',
    });
  }

  // Cha mẫu nước: nhập tay (không mac_dinh=3 cứng)
  const cv043 = byId.get(MAU_NUOC_PARENT_ID);
  if (cv043) {
    byId.set(MAU_NUOC_PARENT_ID, {
      ...cv043,
      loai_nhap_lieu: 'nhap_tay',
      cong_thuc: '',
    });
  }

  const cv026 = byId.get('CV_026');
  if (cv026) {
    byId.set('CV_026', {
      ...cv026,
      loai_nhap_lieu: 'do_ve_tram_ty_le',
      cap_dh:
        cv026.cap_dh === 'III' || cv026.cap_dh === ' ' || !cv026.cap_dh?.trim()
          ? '__optional__'
          : cv026.cap_dh,
      apdung_bcnckt: Number(cv026.apdung_bcnckt) === 1 ? cv026.apdung_bcnckt : 1,
    });
  }

  for (const [id, row] of byId) {
    const loai = (row.loai_dong || '').trim().toLowerCase();
    if (loai === 'tieu_de') {
      byId.set(id, { ...row, ten_cong_viec: normalizeSectionTitle(row.ten_cong_viec) });
    }
  }

  return sortDmCongViecRows([...byId.values()].filter((r) => !isRemovedDmRow(r)));
}

const TRAM_DC_ID_PATTERN = /^CV_0(5[2-9]|[6-7][0-9]|8[0-7])$/;

export const LOAI_HINH_LEGACY_LABELS = {
  'Đường dây và Trạm biến áp': 'Đường dây & TBA xây mới',
  'Đường dây': 'Đường dây xây mới; Xuất tuyến; Đường dây cải tạo...',
  'Trạm biến áp': 'Xây dựng TBA mới',
  'TBA xây mới': 'Xây dựng TBA mới',
  'TBA xây dựng mới; Cải tạo, mở rộng TBA ...': 'Xây dựng TBA mới',
  'TBA xây dựng mới': 'Xây dựng TBA mới',
  'Cải tạo mở rộng TBA': 'Cải tạo, mở rộng TBA ...',
  'Cải tạo, mở rộng TBA': 'Cải tạo, mở rộng TBA ...',
  'Nâng công suất': 'NCS trạm; BESS; Lắp đặt tụ, MBA...',
  'Lắp MBA': 'NCS trạm; BESS; Lắp đặt tụ, MBA...',
  'Đường dây xây mới, Xuất tuyến': 'Đường dây xây mới; Xuất tuyến; Đường dây cải tạo...',
  'Cải tạo mở rộng TBA, NCS trạm, Lắp MBA': 'NCS trạm; BESS; Lắp đặt tụ, MBA...',
  'Đường dây mới, trạm cải tạo': 'Đường dây xây mới + TBA cải tạo',
  'Đường dây xây mới, trạm cải tạo': 'Đường dây xây mới + TBA cải tạo',
};

export function normalizeLoaiHinhLabel(raw) {
  if (!raw) return '';
  return LOAI_HINH_LEGACY_LABELS[raw] || raw;
}

export function getLoaiHinhConfigByLabel(label) {
  return LOAI_HINH_NVKS_OPTIONS.find((o) => o.label === label) || null;
}

export function getLoaiHinhConfigBySlug(slug) {
  return LOAI_HINH_NVKS_OPTIONS.find((o) => o.slug === slug) || null;
}

/** Chuẩn hóa phân loại (tương thích DB cũ TRAM/CHUNG) */
export function resolvePhanLoaiNhom(item) {
  const id = item?.id_cong_viec || '';
  const pl = (item?.phan_loai_hang_muc || '').trim().toUpperCase();

  if (HT_DZ_IDS.has(id) || pl === 'HT_DZ') return 'HT_DZ';
  if (TRAM_HT_IDS.has(id) || pl === 'TRAM_HT') return 'TRAM_HT';
  if (TRAM_DH_XM_IDS.has(id) || pl === 'TRAM_DH_XM') return 'TRAM_DH_XM';
  if (TRAM_DH_BOTH_IDS.has(id) || pl === 'TRAM_DH_BOTH') return 'TRAM_DH_BOTH';
  if (TRAM_DC_ID_PATTERN.test(id) || pl === 'TRAM_DC') return 'TRAM_DC';
  if (id === 'CV_021' || pl === 'TRAM_DH') return 'TRAM_DH';

  if (pl === 'DUONG_DAY' || pl === 'CAP_QUANG' || pl === 'CHUNG') return pl;
  if (pl === 'THOA_THUAN') return 'THOA_THUAN';

  // Legacy: CV_020a từng là CHUNG
  if (id === 'CV_020a') return 'HT_DZ';

  // Legacy TRAM chưa migrate
  if (pl === 'TRAM') {
    if (TRAM_DH_XM_IDS.has(id)) return 'TRAM_DH_XM';
    if (TRAM_DH_BOTH_IDS.has(id)) return 'TRAM_DH_BOTH';
    if (TRAM_DC_ID_PATTERN.test(id)) return 'TRAM_DC';
    if (id === 'CV_021') return 'TRAM_DH';
    return 'TRAM_DH_BOTH';
  }

  return pl || 'CHUNG';
}

function passesGiaiDoan(item, giaiDoan, cheDoTram, nhom) {
  const forceTkTramDh =
    cheDoTram === CHE_DO_TRAM.CAI_TAO &&
    (nhom === 'TRAM_DH_BOTH' || nhom === 'TRAM_DH');

  if (forceTkTramDh) {
    return Number(item.apdung_tkbvtc) === 1;
  }

  if (giaiDoan === 'BCKTKT') return Number(item.apdung_bcktkt) === 1;
  if (giaiDoan === 'BCNCKT') return Number(item.apdung_bcnckt) === 1;
  if (giaiDoan === 'TKBVTC' || giaiDoan === 'TKKT-TKBVTC') {
    return Number(item.apdung_tkbvtc) === 1;
  }
  return false;
}

/**
 * Lọc một dòng DM_CONG_VIEC theo giai đoạn + loại hình khảo sát.
 */
export function isWorkItemApplicable(item, giaiDoan, loaiHinhLabel) {
  const config = getLoaiHinhConfigByLabel(loaiHinhLabel);
  if (!config || !giaiDoan) return false;

  const nhom = resolvePhanLoaiNhom(item);
  if (!passesGiaiDoan(item, giaiDoan, config.cheDoTram, nhom)) return false;

  const { coDuongDay, cheDoTram } = config;

  if (nhom === 'HT_DZ') return coDuongDay;
  if (nhom === 'DUONG_DAY' || nhom === 'CAP_QUANG') return coDuongDay;

  if (nhom === 'TRAM_HT') {
    return cheDoTram === CHE_DO_TRAM.CAI_TAO || cheDoTram === CHE_DO_TRAM.NCS;
  }

  if (nhom === 'TRAM_DH_XM') {
    return cheDoTram === CHE_DO_TRAM.XAY_MOI;
  }

  if (nhom === 'TRAM_DH_BOTH' || nhom === 'TRAM_DH') {
    if (nhom === 'TRAM_DH' && item.loai_dong?.trim().toLowerCase() === 'tieu_de') {
      return (
        cheDoTram === CHE_DO_TRAM.XAY_MOI ||
        cheDoTram === CHE_DO_TRAM.CAI_TAO
      );
    }
    if (nhom === 'TRAM_DH_BOTH') {
      return cheDoTram === CHE_DO_TRAM.XAY_MOI || cheDoTram === CHE_DO_TRAM.CAI_TAO;
    }
    return cheDoTram === CHE_DO_TRAM.XAY_MOI || cheDoTram === CHE_DO_TRAM.CAI_TAO;
  }

  if (nhom === 'TRAM_DC') {
    return cheDoTram !== CHE_DO_TRAM.KHONG;
  }

  if (nhom === 'CHUNG') {
    if (CHUNG_DUONG_DAY_ONLY_IDS.has(item.id_cong_viec)) return coDuongDay;
    return true;
  }

  if (nhom === 'THOA_THUAN') return true;

  return true;
}

/** Ẩn tiêu đề I.2 nếu không còn dòng con địa hình trạm */
export function pruneOrphanSectionTitles(items) {
  const ids = new Set(items.map((i) => i.id_cong_viec));
  const tramDhChildIds = [...TRAM_DH_XM_IDS, ...TRAM_DH_BOTH_IDS];
  const hasTramDhChild = tramDhChildIds.some((id) => ids.has(id));

  if (hasTramDhChild) return items;

  return items.filter((i) => i.id_cong_viec !== 'CV_021');
}

/** Fallback mẫu Word: slug → danh sách thử lần lượt */
export const WORD_TEMPLATE_FALLBACKS = {
  dz_tba_xdm: ['dz_tba_xdm'],
  dz_xdm: ['dz_xdm'],
  tba_xdm: ['tba_xdm'],
  tba_ctmr: ['tba_ctmr', 'tba_xdm'],
  tba_ncs: ['tba_ncs', 'tba_ctmr', 'tba_xdm'],
  dz_xdm_tba_ct: ['dz_xdm_tba_ct', 'dz_xdm', 'tba_ctmr', 'tba_xdm', 'dz_tba_xdm'],
  dz_ct_tba_xm: ['dz_ct_tba_xm', 'dz_tba_xdm', 'dz_xdm', 'tba_xdm'],
};

export function getWordTemplateSlugChain(loaiHinhSlug) {
  return WORD_TEMPLATE_FALLBACKS[loaiHinhSlug] || [loaiHinhSlug];
}
