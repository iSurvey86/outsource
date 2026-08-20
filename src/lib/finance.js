/** Công thức tiền A ↔ B và chia nội bộ */

export const DEFAULT_TY_LE_BEN_B = 0.25;
export const DEFAULT_TY_LE_TAM_UNG = 0.3;

export function giaTriBenB(duAn) {
  const gt = Number(duAn?.gia_tri_tu_van) || 0;
  const tyLe = Number(duAn?.ty_le_ben_b ?? DEFAULT_TY_LE_BEN_B);
  return gt * tyLe;
}

export function tamUngKyVong(duAn) {
  const tyLeTu = Number(duAn?.ty_le_tam_ung ?? DEFAULT_TY_LE_TAM_UNG);
  return giaTriBenB(duAn) * tyLeTu;
}

export function tongThu(giaoDichList = []) {
  return giaoDichList
    .filter((g) => g.loai === "tam_ung" || g.loai === "thanh_toan")
    .reduce((s, g) => s + (Number(g.so_tien) || 0), 0);
}

export function tongChi(giaoDichList = []) {
  return giaoDichList
    .filter((g) => g.loai === "chi_phi")
    .reduce((s, g) => s + (Number(g.so_tien) || 0), 0);
}

export function conLai(duAn, giaoDichList) {
  return giaTriBenB(duAn) - tongThu(giaoDichList);
}

export function formatVnd(n) {
  const v = Math.round(Number(n) || 0);
  return new Intl.NumberFormat("vi-VN").format(v) + " ₫";
}

export function formatPct(ratio) {
  return `${Math.round((Number(ratio) || 0) * 1000) / 10}%`;
}

export const PIPELINE_LABELS = {
  moi: "Mới",
  da_tam_ung: "Đã tạm ứng",
  dang_lam: "Đang làm",
  da_giao_tuyen: "Đã giao tuyến",
  da_thanh_toan: "Đã thanh toán",
  dong: "Đóng",
};

export const KS_MODULE_DEFS = [
  { key: "nvks", ten: "NVKS" },
  { key: "paktks", ten: "PAKTKS" },
  { key: "bcks", ten: "BCKS" },
  { key: "nghiem_thu", ten: "Nghiệm thu" },
  { key: "nhat_ky", ten: "Nhật ký" },
];

export const KS_STATUS_LABELS = {
  chua_lam: "Chưa làm",
  dang_lam: "Đang làm",
  da_xuat_ban: "Đã xuất bản",
};
