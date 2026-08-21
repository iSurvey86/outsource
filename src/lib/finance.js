/** Công thức tiền A ↔ B và chia nội bộ */

export const DEFAULT_TY_LE_BEN_B = 0.25;
export const DEFAULT_TY_LE_TAM_UNG = 0.3;

/** PAĐT / PADDT (tạm tính) — ưu tiên cột riêng, fallback gia_tri_tu_van cũ */
export function giaTriPadt(duAn) {
  const padt = Number(duAn?.gia_tri_padt);
  if (Number.isFinite(padt) && padt > 0) return padt;
  if (duAn?.nguon_gia_tri === "hop_dong") return 0;
  return Number(duAn?.gia_tri_tu_van) || 0;
}

/** Giá trị tư vấn theo hợp đồng */
export function giaTriHopDongTv(duAn) {
  const hd = Number(duAn?.gia_tri_hop_dong);
  if (Number.isFinite(hd) && hd > 0) return hd;
  if (duAn?.nguon_gia_tri === "hop_dong") return Number(duAn?.gia_tri_tu_van) || 0;
  return 0;
}

/**
 * Căn cứ tính tạm ứng / phần B:
 * có HĐ → ưu tiên HĐ; chưa có → PADT.
 */
export function giaTriTuVanHieuLuc(duAn) {
  const hd = giaTriHopDongTv(duAn);
  if (hd > 0) return hd;
  return giaTriPadt(duAn);
}

export function nguonGiaTriHieuLuc(duAn) {
  return giaTriHopDongTv(duAn) > 0 ? "hop_dong" : "padt_tam_tinh";
}

export function giaTriBenB(duAn) {
  const gt = giaTriTuVanHieuLuc(duAn);
  const tyLe = Number(duAn?.ty_le_ben_b ?? DEFAULT_TY_LE_BEN_B);
  return gt * tyLe;
}

/** Kỳ vọng tạm ứng lần 1 = 30% × phần B (theo căn cứ HĐ > PADT) */
export function tamUngLan1KyVong(duAn) {
  const tyLeTu = Number(duAn?.ty_le_tam_ung ?? DEFAULT_TY_LE_TAM_UNG);
  return giaTriBenB(duAn) * tyLeTu;
}

/** @deprecated alias — dùng tamUngLan1KyVong */
export function tamUngKyVong(duAn) {
  return tamUngLan1KyVong(duAn);
}

function matchDot(g, dot) {
  const d = String(g?.dot || "").trim().toLowerCase();
  if (d) return d === dot;
  // Giao dịch cũ không có `dot`: tạm ứng → lần 1; thanh toán → thanh_toan
  if (dot === "lan1") return g?.loai === "tam_ung";
  if (dot === "thanh_toan") return g?.loai === "thanh_toan";
  return false;
}

export function tongTheoDot(giaoDichList = [], dot) {
  return giaoDichList
    .filter((g) => matchDot(g, dot))
    .reduce((s, g) => s + (Number(g.so_tien) || 0), 0);
}

export function findGiaoDichByDot(giaoDichList = [], dot) {
  return giaoDichList.find((g) => matchDot(g, dot)) || null;
}

export const DOT_META = {
  lan1: {
    key: "lan1",
    title: "Nhận tạm ứng lần 1",
    btn: "Nhận tạm ứng",
    loai: "tam_ung",
    amountFixed: true,
  },
  lan2: {
    key: "lan2",
    title: "Nhận tạm ứng lần 2",
    btn: "Nhận tạm ứng",
    loai: "tam_ung",
    amountFixed: false,
  },
  lan3: {
    key: "lan3",
    title: "Nhận tạm ứng lần 3",
    btn: "Nhận tạm ứng",
    loai: "tam_ung",
    amountFixed: false,
  },
  thanh_toan: {
    key: "thanh_toan",
    title: "Nhận thanh toán",
    btn: "Nhận thanh toán",
    loai: "thanh_toan",
    amountFixed: false,
  },
};

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

/**
 * Hiển thị cột Tạm ứng lần 1 (30%):
 * - Đã khóa (`tam_ung_lan1_khoa`) → giữ số đã ghi sổ
 * - Chưa khóa → luôn theo công thức HĐ > PADT
 */
/** Lần 2/3/TT: đã có giao dịch xác nhận → khóa; kèm gd để hiện ngày/bill */
export function tamUngLan1HienThi(duAn, giaoDichList = []) {
  const daChi = tongTheoDot(giaoDichList, "lan1");
  const gd = findGiaoDichByDot(giaoDichList, "lan1");
  if (duAn?.tam_ung_lan1_khoa && daChi > 0) {
    return {
      soTien: daChi,
      locked: true,
      label: "đã khóa",
      nguon: "da_tam_ung",
      gd,
    };
  }
  const hd = giaTriHopDongTv(duAn);
  const soTien = tamUngLan1KyVong(duAn);
  return {
    soTien,
    locked: false,
    label: hd > 0 ? "theo HĐ" : "theo PADT",
    nguon: hd > 0 ? "hop_dong" : "padt",
    gd: null,
  };
}

/** Lần 2/3/TT: đã có giao dịch xác nhận → khóa */
export function dotHienThi(duAn, giaoDichList, dot) {
  if (dot === "lan1") return tamUngLan1HienThi(duAn, giaoDichList);
  const gd = findGiaoDichByDot(giaoDichList, dot);
  const so = Math.round(Number(gd?.so_tien) || 0);
  if (gd && so > 0) {
    return { soTien: so, locked: true, gd };
  }
  let goiY = 0;
  if (dot === "thanh_toan") {
    goiY = Math.max(0, Math.round(conLai(duAn, giaoDichList)));
  }
  return { soTien: goiY, locked: false, gd: null };
}

/** Đồng bộ gia_tri_tu_van + nguon khi sửa PADT / HĐ */
export function syncGiaTriTuVanFields(patch) {
  const next = { ...patch };
  const hd = Number(next.gia_tri_hop_dong);
  const padt = Number(next.gia_tri_padt);
  if (Number.isFinite(hd) && hd > 0) {
    next.gia_tri_tu_van = hd;
    next.nguon_gia_tri = "hop_dong";
  } else if (Number.isFinite(padt) && padt > 0) {
    next.gia_tri_tu_van = padt;
    next.nguon_gia_tri = "padt_tam_tinh";
  } else if ("gia_tri_hop_dong" in next || "gia_tri_padt" in next) {
    next.gia_tri_tu_van = 0;
    next.nguon_gia_tri = "padt_tam_tinh";
  }
  return next;
}

export function formatVnd(n) {
  const v = Math.round(Number(n) || 0);
  return new Intl.NumberFormat("vi-VN").format(v) + " ₫";
}

export function formatVndShort(n) {
  const v = Math.round(Number(n) || 0);
  if (!v) return "—";
  return new Intl.NumberFormat("vi-VN").format(v);
}

export function parseVndInput(raw) {
  const s = String(raw || "")
    .replace(/[₫đĐ]/gi, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
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
  { key: "nkks", ten: "NKKS" },
  { key: "bcks", ten: "BCKS" },
  { key: "nghiem_thu", ten: "Nghiệm thu" },
];

export const KS_STATUS_LABELS = {
  chua_lam: "Chưa làm",
  dang_lam: "Đang làm",
  da_xuat_ban: "Đã xuất bản",
};
