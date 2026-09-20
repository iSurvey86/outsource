import { VAI_TRO } from "./constants";

/**
 * Sinh danh sách bước ký (quy tắc A: gộp người lập = CNKS).
 * @param {{ nguoiLapMaNv: string, cnksMaNv: string, lanhDaoMaNv: string }} p
 * @returns {{ stt: number, vai_tro: string, ma_nv: string }[]}
 */
export function buildTrinhKySteps({ nguoiLapMaNv, cnksMaNv, lanhDaoMaNv }) {
  const lap = String(nguoiLapMaNv || "").trim();
  const cnks = String(cnksMaNv || "").trim();
  const ld = String(lanhDaoMaNv || "").trim();
  if (!lap || !cnks || !ld) {
    throw new Error("Thiếu mã NV người lập / CNKS / lãnh đạo.");
  }

  const steps = [];
  if (lap === cnks) {
    steps.push({ stt: 1, vai_tro: VAI_TRO.NGUOI_LAP_CNKS, ma_nv: lap });
    steps.push({ stt: 2, vai_tro: VAI_TRO.LANH_DAO, ma_nv: ld });
  } else {
    steps.push({ stt: 1, vai_tro: VAI_TRO.NGUOI_LAP, ma_nv: lap });
    steps.push({ stt: 2, vai_tro: VAI_TRO.CNKS, ma_nv: cnks });
    steps.push({ stt: 3, vai_tro: VAI_TRO.LANH_DAO, ma_nv: ld });
  }
  return steps;
}

/** Chuẩn hóa SĐT VN → dạng 0xxxxxxxxx */
export function normalizeVnPhone(raw) {
  let s = String(raw || "").replace(/[\s.\-()]/g, "");
  if (s.startsWith("+84")) s = `0${s.slice(3)}`;
  else if (s.startsWith("84") && s.length >= 10) s = `0${s.slice(2)}`;
  if (!/^0\d{9,10}$/.test(s)) return null;
  return s;
}

/** NV (NL/CNKS): chỉ cần ký nháy. LĐ/BGĐ: ký chính + ký dấu (slot 2). */
export function isLanhDaoVaiTro(vaiTro) {
  return vaiTro === VAI_TRO.LANH_DAO;
}

/**
 * @param {object} row NHAN_SU
 * @param {{ vaiTro?: string, asLanhDao?: boolean }} [opts]
 */
export function hasChuKyImages(row, opts = {}) {
  if (!row) return false;
  const asLd = opts.asLanhDao === true || isLanhDaoVaiTro(opts.vaiTro);
  const hasChinh = Boolean(String(row.chu_ky_path || "").trim());
  const hasSlot2 = Boolean(String(row.chu_ky_nhay_path || "").trim());
  if (asLd) return hasChinh && hasSlot2;
  return hasSlot2;
}

/** Nhãn slot 2 theo vai trò bước trình ký */
export function labelSlot2ForVaiTro(vaiTro) {
  return isLanhDaoVaiTro(vaiTro) ? "ký dấu" : "ký nháy";
}

/** Mô tả ảnh còn thiếu (tiếng Việt) theo vai trò bước */
export function describeSignerKyRequirement(vaiTro) {
  if (isLanhDaoVaiTro(vaiTro)) return "ảnh ký chính và ảnh ký dấu";
  return "ảnh ký nháy";
}

/**
 * @param {object} row NHAN_SU
 * @param {{ requirePhone?: boolean, vaiTro?: string, asLanhDao?: boolean }} [opts]
 */
export function isSignerReady(row, opts = {}) {
  if (!hasChuKyImages(row, opts)) return false;
  if (opts.requirePhone === false) return true;
  return Boolean(normalizeVnPhone(row.sdt));
}
