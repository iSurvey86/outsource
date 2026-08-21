/** Meta dự án — giai đoạn, format Giao A/HĐ, bundle mặc định (kiểu ksnpsc). */

import { DEFAULT_TY_LE_BEN_B, DEFAULT_TY_LE_TAM_UNG, KS_MODULE_DEFS } from "./finance";
import { uid } from "./storeLocal";
import { formatGiaoAShort as formatGiaoAShortRaw } from "./formatGiaoA";
import { formatHopDongShort as formatHopDongShortRaw } from "./formatHopDong";

export const GIAI_DOAN_OPTIONS = ["BCNCKT", "BCKTKT", "TKBVTC"];

export const GIAI_DOAN_BADGE = {
  BCNCKT: "bg-sky-100 text-sky-900 ring-sky-300",
  BCKTKT: "bg-amber-100 text-amber-950 ring-amber-300",
  TKBVTC: "bg-violet-100 text-violet-950 ring-violet-300",
};

export function giaiDoanBadgeClass(giaiDoan) {
  return GIAI_DOAN_BADGE[giaiDoan] || "bg-blue-100 text-blue-950 ring-blue-200";
}

/** Wrapper object duAn → format ksnpsc (bảng: số…ngày / xuống dòng / ngày) */
export function formatGiaoAShort(duAn, options = {}) {
  const wrapDate = Boolean(options?.wrapDate);
  let qd = String(duAn?.qd_giao_a || "").trim();
  let dayDu = String(duAn?.qd_giao_a_day_du || "").trim();
  const ngayIso = String(duAn?.ngay_giao_a || "").trim();

  // Ghép ngày từ cột ngay_giao_a nếu chuỗi QĐ chưa có «ngày …»
  if (ngayIso && qd && !/ngày/i.test(qd) && !/ngày/i.test(dayDu)) {
    const m = ngayIso.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) {
      const dmy = `${Number(m[3])}/${Number(m[2])}/${m[1]}`;
      dayDu = `${qd} ngày ${dmy}`;
    }
  }

  let text = formatGiaoAShortRaw(qd, dayDu, options);
  if (!text || text === "-") return "—";

  // Ép đúng layout: "406/QĐ-EVNNPC ngày\n24/7/2026"
  if (wrapDate && !text.includes("\n") && /\s+ngày\s+/i.test(text)) {
    text = text.replace(/\s+ngày\s+/i, " ngày\n");
  }
  return text;
}

export function formatHopDongShort(duAn, options = {}) {
  const text = formatHopDongShortRaw(duAn?.hop_dong, duAn?.hop_dong_day_du, options);
  return !text || text === "-" ? "—" : text;
}

export function formatTmdtTrieu(tmdt) {
  const n = Number(tmdt);
  if (!Number.isFinite(n) || n <= 0) return "—";
  const trieu = n / 1_000_000;
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(trieu)} Tr.đ`;
}

/** Chỉ số triệu — dùng khi đơn vị đã ghi trên header cột */
export function formatTmdtTrieuSo(tmdt) {
  const n = Number(tmdt);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(n / 1_000_000);
}

export function emptyDuAnForm(overrides = {}) {
  return {
    ma_du_an: "",
    ten: "",
    ben_a_user_id: "",
    chu_dau_tu: "",
    quy_mo: "",
    dia_diem: "",
    giai_doan: "BCNCKT",
    cap_dien_ap: "110kV",
    qd_giao_a: "",
    qd_giao_a_day_du: "",
    nam_giao_a: String(new Date().getFullYear()),
    ngay_giao_a: "",
    hop_dong: "",
    hop_dong_day_du: "",
    link_pdf_giao_a_goc: "",
    tmdt: "",
    gia_tri_tu_van: "",
    gia_tri_padt: "",
    gia_tri_hop_dong: "",
    ghi_chu_tai_chinh: "",
    nguon_gia_tri: "padt_tam_tinh",
    ...overrides,
  };
}

export function buildDuAnRecord(form, { id, userId }) {
  return {
    id,
    ma_du_an: String(form.ma_du_an || "").trim(),
    ten: String(form.ten || "").trim(),
    ben_a_user_id: form.ben_a_user_id || null,
    phu_trach_id: userId || null,
    chu_dau_tu: String(form.chu_dau_tu || "").trim(),
    quy_mo: String(form.quy_mo || "").trim(),
    dia_diem: String(form.dia_diem || "").trim(),
    giai_doan: form.giai_doan || "BCNCKT",
    cap_dien_ap: String(form.cap_dien_ap || "").trim(),
    qd_giao_a: String(form.qd_giao_a || "").trim(),
    qd_giao_a_day_du: String(form.qd_giao_a_day_du || "").trim(),
    nam_giao_a: String(form.nam_giao_a || "").trim() || null,
    ngay_giao_a: String(form.ngay_giao_a || "").trim() || null,
    hop_dong: String(form.hop_dong || "").trim(),
    hop_dong_day_du: String(form.hop_dong_day_du || "").trim(),
    link_pdf_giao_a_goc: String(form.link_pdf_giao_a_goc || "").trim() || null,
    tmdt: Number(form.tmdt) || 0,
    trang_thai: "moi",
    nguon_gia_tri: form.nguon_gia_tri || "padt_tam_tinh",
    gia_tri_tu_van: Number(form.gia_tri_tu_van) || 0,
    gia_tri_padt: Number(form.gia_tri_padt) || 0,
    gia_tri_hop_dong: Number(form.gia_tri_hop_dong) || 0,
    ghi_chu_tai_chinh: String(form.ghi_chu_tai_chinh || "").trim(),
    ty_le_ben_b: DEFAULT_TY_LE_BEN_B,
    ty_le_tam_ung: DEFAULT_TY_LE_TAM_UNG,
    mo_ta: "",
    ngay_bat_dau: new Date().toISOString().slice(0, 10),
    ngay_ket_thuc_dk: null,
  };
}

export function buildDefaultMocList(duAnId) {
  return [
    {
      id: uid("m"),
      du_an_id: duAnId,
      ma: "trien_khai",
      ten: "Triển khai",
      thu_tu: 1,
      trang_thai: "chua_lam",
      han: null,
    },
    {
      id: uid("m"),
      du_an_id: duAnId,
      ma: "giao_tuyen",
      ten: "Giao tuyến",
      thu_tu: 2,
      trang_thai: "chua_lam",
      han: null,
    },
  ];
}

export function buildDefaultKsList(duAnId) {
  return KS_MODULE_DEFS.map((def) => ({
    id: uid("ks"),
    du_an_id: duAnId,
    loai: def.key,
    trang_thai: "chua_lam",
  }));
}

/** Chuẩn hóa loai KS cũ (nhat_ky → nkks) khi đọc DB. */
export function normalizeKsLoai(loai) {
  if (loai === "nhat_ky") return "nkks";
  return loai;
}
