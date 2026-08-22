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
    amountFixed: false,
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

/** Tổng tạm ứng đã nhận từ A (mọi đợt L1/L2/L3). */
export function tongTamUngTuA(giaoDichList = []) {
  return giaoDichList
    .filter((g) => g.loai === "tam_ung")
    .reduce((s, g) => s + (Number(g.so_tien) || 0), 0);
}

/** Tổng thanh toán đã nhận từ A. */
export function tongThanhToanTuA(giaoDichList = []) {
  return giaoDichList
    .filter((g) => g.loai === "thanh_toan")
    .reduce((s, g) => s + (Number(g.so_tien) || 0), 0);
}

/** Gộp cả dự án: tổng tiền thật đã nhận từ A (căn chia nội bộ 1 lần). */
export function tongNhanTuA(giaoDichList = []) {
  return tongThu(giaoDichList);
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
 * Hiển thị cột Tạm ứng lần 1:
 * - Chỉ khóa khi Admin đã bấm Nhận (`tam_ung_lan1_khoa = 1`)
 * - Chưa khóa → gợi ý 30%×phần B nếu đã có GTV (placeholder / nút Nhận)
 */
export function tamUngLan1HienThi(duAn, giaoDichList = []) {
  const daChi = tongTheoDot(giaoDichList, "lan1");
  const gd = findGiaoDichByDot(giaoDichList, "lan1");
  const locked = Number(duAn?.tam_ung_lan1_khoa) === 1 && daChi > 0;
  if (locked) {
    return {
      soTien: daChi,
      locked: true,
      label: "đã khóa",
      nguon: "da_tam_ung",
      gd,
    };
  }
  const goiY = Math.round(tamUngLan1KyVong(duAn));
  const hd = giaTriHopDongTv(duAn);
  return {
    soTien: goiY,
    locked: false,
    label: goiY > 0 ? (hd > 0 ? "gợi ý 30% HĐ" : "gợi ý 30% PAĐT") : "nhập tay",
    nguon: goiY > 0 ? (hd > 0 ? "hop_dong" : "padt") : "manual",
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

/** Format tiền khi đang gõ: 50000000 → 50.000.000 (dấu chấm ngay). */
export function formatVndLive(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  const n = Number(digits);
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("vi-VN").format(n);
}

/**
 * Gõ tiền có format live + giữ vị trí con trỏ theo số chữ số.
 * @returns {{ text: string, caret: number }}
 */
export function applyVndLiveInput(raw, caret = null) {
  const value = String(raw || "");
  const pos = caret == null ? value.length : caret;
  const digitsBefore = value.slice(0, pos).replace(/\D/g, "").length;
  const text = formatVndLive(value);
  if (!text) return { text: "", caret: 0 };
  let seen = 0;
  let newCaret = text.length;
  for (let i = 0; i < text.length; i++) {
    if (/\d/.test(text[i])) {
      seen += 1;
      if (seen >= digitsBefore) {
        newCaret = i + 1;
        break;
      }
    }
  }
  return { text, caret: newCaret };
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

/** Góp vốn nội bộ B↔B — lọc theo dự án */
export function listGopVonNoiBo(rows = [], duAnId) {
  return (rows || []).filter((r) => r.du_an_id === duAnId);
}

export function tongGopVonNoiBo(rows = [], duAnId) {
  return listGopVonNoiBo(rows, duAnId).reduce((s, r) => s + (Number(r.so_tien) || 0), 0);
}

/** Tổng từng người đã góp */
export function tongGopTheoNguoi(rows = [], duAnId, userId) {
  return listGopVonNoiBo(rows, duAnId)
    .filter((r) => r.nguoi_gop_id === userId)
    .reduce((s, r) => s + (Number(r.so_tien) || 0), 0);
}

/** Quỹ đang giữ theo người nhận chuyển */
export function quyGiuTheoNguoi(rows = [], duAnId, users = []) {
  const map = new Map();
  for (const r of listGopVonNoiBo(rows, duAnId)) {
    const id = r.nguoi_giu_id;
    if (!id) continue;
    map.set(id, (map.get(id) || 0) + (Number(r.so_tien) || 0));
  }
  return [...map.entries()]
    .map(([id, so]) => ({
      nguoi_dung_id: id,
      ho_ten: users.find((u) => u.id === id)?.ho_ten || id,
      so_tien: so,
    }))
    .filter((x) => x.so_tien > 0)
    .sort((a, b) => b.so_tien - a.so_tien);
}
