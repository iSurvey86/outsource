/**
 * Registry FormBCKS — tab chính + hạng mục Địa chất (theo mẫu Excel MauTN).
 * Báo cáo Word: mẫu RTK — xem bcksReportSchema.js / bcksWordExport.js.
 */

import { createSeededEmptyBcksReport } from "./bcksReportSeed";

export const BCKS_MAIN_TABS = [
  { key: "dia_chat", shortLabel: "Địa chất", label: "Hạng mục địa chất — thí nghiệm & đo đạc" },
  { key: "bcks", shortLabel: "BCKS", label: "Lập hồ sơ báo cáo khảo sát" },
];

/** Sub-tab trong Địa chất — mẫu MauTN + mẫu PDF cơ lý lớp đất */
export const BCKS_DIA_CHAT_FORMS = {
  co_ly_dat: {
    key: "co_ly_dat",
    shortLabel: "Cơ lý đất",
    label: "Bảng tổng hợp chỉ tiêu cơ lý của mẫu đất nguyên dạng",
    sampleFile: "01. Tong hop chi tieu co ly dat.xlsx",
  },
  tn_nuoc: {
    key: "tn_nuoc",
    shortLabel: "TN nước",
    label: "Báo cáo kết quả thí nghiệm mẫu nước",
    sampleFile: "02. TN_mau_nuoc.xlsx",
  },
  co_ly_dat_2: {
    key: "co_ly_dat_2",
    shortLabel: "Cơ lý đất",
    label: "Bảng tổng hợp chỉ tiêu cơ lý các lớp đất",
    sampleFile: "11.pdf",
  },
  tn_da: {
    key: "tn_da",
    shortLabel: "TN đá",
    label: "Bảng tổng hợp kết quả thí nghiệm mẫu đá",
    sampleFile: "03. TN_mau_da.xlsx",
  },
  do_dts: {
    key: "do_dts",
    shortLabel: "Đo ĐTS",
    label: "Báo cáo kết quả đo điện trở suất",
    sampleFile: "04. Do_DTS.xlsx",
  },
  bao_cao_dts: {
    key: "bao_cao_dts",
    shortLabel: "Báo cáo DTS",
    label: "Bảng thông số tiếp địa",
    sampleFile: "nhapthongso tiep dia.xlsx",
  },
};

/** Thứ tự tab UI: Cơ lý đất → TN nước → TN đá → Đo ĐTS → Báo cáo DTS
 * (biểu mẫu cũ `co_ly_dat` giữ trong registry/data, không hiện tab)
 */
export const BCKS_DIA_CHAT_KEYS = ["co_ly_dat_2", "tn_nuoc", "tn_da", "do_dts", "bao_cao_dts"];

/** Số lớp mặc định trên bảng thông số tiếp địa */
export const BAO_CAO_DTS_DEFAULT_LOP = 4;

/** Toàn bộ khóa data (gồm biểu ẩn) — dùng init / merge / lưu */
export const BCKS_DIA_CHAT_DATA_KEYS = Object.keys(BCKS_DIA_CHAT_FORMS);

export function listBcksDiaChatForms() {
  return BCKS_DIA_CHAT_KEYS.map((k) => BCKS_DIA_CHAT_FORMS[k]);
}

/** Cột thành phần cỡ hạt — theo mẫu 01 */
export const CO_LY_DAT_HAT_COLS = [
  { key: "hat_soi_gt10", group: "sỏi", label: "> 10,0" },
  { key: "hat_soi_10_5", group: "sỏi", label: "10,0–5,0" },
  { key: "hat_soi_5_2", group: "sỏi", label: "5,0–2,0" },
  { key: "hat_cat_2_05", group: "cát", label: "2,0–0,5" },
  { key: "hat_cat_05_025", group: "cát", label: "0,5–0,25" },
  { key: "hat_cat_025_01", group: "cát", label: "0,25–0,10" },
  { key: "hat_cat_01_005", group: "cát", label: "0,1–0,05" },
  { key: "hat_bui_005_001", group: "bụi", label: "0,05–0,01" },
  { key: "hat_bui_001_0005", group: "bụi", label: "0,01–0,005" },
  { key: "hat_set_lt0005", group: "sét", label: "< 0,005" },
];

/** Cột thành phần hạt — mẫu Cơ lý đất / Excel HT update
 * Nhóm: Cuội–dăm | Sỏi–sạn | Cát (Thô/Vừa/Mịn) | Bụi (To/Nhỏ/Sét)
 */
export const CO_LY_DAT_2_HAT_COLS = [
  { key: "hat_gt40", group: "cuoi", label: ">40" },
  { key: "hat_40_20", group: "cuoi", label: "40–20" },
  { key: "hat_20_10", group: "cuoi", label: "20–10" },
  { key: "hat_10_5", group: "soi", label: "10–5" },
  { key: "hat_5_2", group: "soi", label: "5–2" },
  { key: "hat_2_1", group: "cat_tho", label: "2–1" },
  { key: "hat_1_05", group: "cat_tho", label: "1–0,5" },
  { key: "hat_05_025", group: "cat_vua", label: "0,5–0,25" },
  { key: "hat_025_01", group: "cat_min", label: "0,25–0,10" },
  { key: "hat_01_005", group: "cat_min", label: "0,10–0,05" },
  { key: "hat_005_001", group: "bui_to", label: "0,05–0,01" },
  { key: "hat_001_0005", group: "bui_nho", label: "0,01–0,005" },
  { key: "hat_set", group: "set", label: "<0,005" },
];

/** Chỉ tiêu thí nghiệm nước mặc định — mẫu 02 */
export const TN_NUOC_DEFAULT_CHI_TIEU = [
  {
    chi_tieu: "Độ pH",
    yeu_cau: "4 – 12,5",
    ket_qua: "",
    phuong_phap: "TCVN 6492 – 99",
  },
  {
    chi_tieu: "Hàm lượng ion Cl⁻",
    yeu_cau: "< 350 mg/l",
    ket_qua: "",
    phuong_phap: "TCVN 6194 – 96",
  },
  {
    chi_tieu: "Hàm lượng ion SO₄²⁻",
    yeu_cau: "< 600 mg/l",
    ket_qua: "",
    phuong_phap: "TCVN 6200 – 96",
  },
  {
    chi_tieu: "Tổng lượng muối hòa tan",
    yeu_cau: "< 2000 mg/l",
    ket_qua: "",
    phuong_phap: "TCVN 4560 – 88",
  },
  {
    chi_tieu: "Hàm lượng cặn không tan",
    yeu_cau: "< 200 mg/l",
    ket_qua: "",
    phuong_phap: "TCVN 4560 – 88",
  },
  {
    chi_tieu: "Hàm lượng chất hữu cơ",
    yeu_cau: "< 15 mg/l",
    ket_qua: "",
    phuong_phap: "TCVN 2671 – 78",
  },
  {
    chi_tieu: "Hàm lượng dầu mỡ",
    yeu_cau: "Không có",
    ket_qua: "",
    phuong_phap: "—",
  },
];

/** Cột AB/2 mặc định đo ĐTS — mẫu 04 */
export const DO_DTS_DEFAULT_AB2 = [1.5, 4.5, 7.5, 10, 12.5, 15];

function emptyKeys(keys, defaults = {}) {
  const row = {};
  for (const k of keys) row[k] = defaults[k] ?? "";
  return row;
}

export function emptyCoLyDatRow() {
  return emptyKeys([
    "vi_tri_khoan",
    "so_hieu_mau",
    "lop",
    "do_sau",
    ...CO_LY_DAT_HAT_COLS.map((c) => c.key),
    "w",
    "gw",
    "gc",
    "r",
    "e0",
    "n",
    "g",
    "wl",
    "wp",
    "ip",
    "b",
    "goc_nghi_kho",
    "goc_nghi_uot",
    "c",
    "phi",
    "a12",
    "r0",
    "e0_modun",
    "ten_dat",
  ]);
}

/** Dòng mẫu / trung bình — Cơ lý đất */
export function emptyCoLyDat2MauRow(defaults = {}) {
  return emptyKeys(
    [
      "ho_khoan",
      "so_hieu_mau",
      "lop",
      "do_sau_tu",
      "do_sau_den",
      ...CO_LY_DAT_2_HAT_COLS.map((c) => c.key),
      "w",
      "gamma_w",
      "gamma_bh",
      "gamma_k",
      "delta",
      "e0",
      "n",
      "g",
      "wch",
      "wd",
      "ip",
      "b",
      "phi_do",
      "phi_phut",
      "c",
      "a12",
      "phan_loai",
    ],
    defaults
  );
}

export function emptyCoLyDat2SampleRow(defaults = {}) {
  return { type: "mau", ...emptyCoLyDat2MauRow(defaults) };
}

export function emptyCoLyDat2AvgRow() {
  return { type: "trung_binh", ...emptyCoLyDat2MauRow() };
}

export function emptyCoLyDat2DefaultRows() {
  /** Mẫu mặc định: 5 hố × 2 mẫu U1/U2 = 10 dòng (có thể sửa) */
  const rows = [];
  for (let hk = 1; hk <= 5; hk++) {
    for (const mau of ["U1", "U2"]) {
      rows.push(
        emptyCoLyDat2SampleRow({
          ho_khoan: `HK${hk}`,
          so_hieu_mau: mau,
        })
      );
    }
  }
  return rows;
}

export function emptyTnDaRow() {
  return emptyKeys([
    "so_hieu_tn",
    "lop",
    "vi_tri",
    "do_sau",
    "mo_ta_da",
    "w0",
    "ws",
    "r",
    "g0",
    "gs",
    "gc",
    "n",
    "g0_bh",
    "gs_bh",
    "dc",
    "dch",
    "k",
  ]);
}

/** Mặc định 6 dòng trống cho bảng TN đá */
export function emptyTnDaDefaultRows() {
  return Array.from({ length: 6 }, () => emptyTnDaRow());
}

export function emptyDoDtsRow(ab2 = "", mn = "") {
  return computeDoDtsRow({
    ab2: ab2 === "" ? "" : String(ab2),
    mn: mn === "" ? "" : String(mn),
    k: "",
    u_mv: "",
    i_ma: "",
    rho_k: "",
    do_sau: "",
  });
}

/** Dòng bảng phân tích ĐTS (nhập tay sau IPI2Win / RES1D) */
export function emptyDoDtsPhanTichRow() {
  return { rho: "", h: "", d: "", alt: "" };
}

export function emptyDoDtsPhanTichDefaultRows() {
  return [emptyDoDtsPhanTichRow(), emptyDoDtsPhanTichRow(), emptyDoDtsPhanTichRow()];
}

/**
 * Parse số Đo ĐTS: hỗ trợ nghìn kiểu Excel (5,537 / 5,537.00)
 * và thập phân VN (12,5) / EN (12.5).
 */
export function parseDoDtsNumber(raw) {
  const s = String(raw ?? "")
    .trim()
    .replace(/\s/g, "");
  if (!s) return NaN;
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
    return Number(s.replace(/,/g, ""));
  }
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    return Number(s.replace(/\./g, "").replace(",", "."));
  }
  if (s.includes(",") && !s.includes(".")) {
    return Number(s.replace(",", "."));
  }
  return Number(s);
}

/** Tính d tích lũy và Alt = −d từ cột h */
export function computeDoDtsPhanTichRows(rows) {
  let cum = 0;
  return (rows || []).map((row) => {
    const h = parseDoDtsNumber(row?.h);
    if (Number.isFinite(h) && h > 0) {
      cum += h;
      return { ...row, d: String(Math.round(cum * 100) / 100), alt: String(-Math.round(cum * 100) / 100) };
    }
    return { ...row, d: "", alt: "" };
  });
}

/** k = π×(AB/2−MN/2)×(AB/2+MN/2)/MN · ρₖ = k×U/I · độ sâu = (1/3)×(AB/2) */
export function computeDoDtsRow(row) {
  const ab2 = parseDoDtsNumber(row?.ab2);
  const mn = parseDoDtsNumber(row?.mn);
  const u = parseDoDtsNumber(row?.u_mv);
  const i = parseDoDtsNumber(row?.i_ma);
  const ab2Ok = Number.isFinite(ab2);
  const mnOk = Number.isFinite(mn) && mn !== 0;
  let k = "";
  let rho = "";
  let doSau = "";
  if (ab2Ok && mnOk) {
    const kN = (Math.PI * (ab2 - mn / 2) * (ab2 + mn / 2)) / mn;
    k = kN.toFixed(2);
    if (Number.isFinite(u) && Number.isFinite(i) && i !== 0) {
      rho = ((kN * u) / i).toFixed(2);
    }
  }
  if (ab2Ok) {
    doSau = (ab2 / 3).toFixed(2);
  }
  return { ...row, k, rho_k: rho, do_sau: doSau };
}

export function createEmptyDiaChatDetail(formKey) {
  if (formKey === "co_ly_dat") {
    return {
      cong_trinh: "",
      don_vi_yeu_cau: "",
      ngay: "",
      rows: [emptyCoLyDatRow()],
      nguoi_tong_hop: "",
      phong_thi_nghiem: "",
      pho_giam_doc: "",
    };
  }
  if (formKey === "tn_nuoc") {
    return {
      lab_ten: "Công ty CP Đầu tư Khoa học Công nghệ Vật liệu và Kiểm định",
      lab_phong: "Phòng thí nghiệm và kiểm định chất lượng công trình",
      lab_dia_chi: "",
      don_vi_yeu_cau: "Xí nghiệp Tư vấn - Công ty Dịch vụ Điện lực miền Bắc",
      cong_trinh: "",
      nguon_goc_mau: "",
      ngay_gui_mau: "",
      ngay_thi_nghiem: "",
      chi_tieu: TN_NUOC_DEFAULT_CHI_TIEU.map((r) => ({ ...r })),
      ghi_chu: "Kết quả thí nghiệm đúng với mẫu do đơn vị gửi đến.",
      nguoi_thi_nghiem: "",
      phong_thi_nghiem: "",
      pho_giam_doc: "",
    };
  }
  if (formKey === "co_ly_dat_2") {
    return {
      du_an: "",
      giai_doan: "",
      rows: emptyCoLyDat2DefaultRows(),
      nguoi_lap: "",
      nguoi_kiem_tra: "",
      ngay: "",
    };
  }
  if (formKey === "tn_da") {
    return {
      lab_ten: "Công ty cổ phần đầu tư khoa học công nghệ vật liệu và kiểm định",
      lab_phong: "Trung tâm thí nghiệm và kiểm định chất lượng công trình",
      so_phieu: "",
      lab_dia_chi: "",
      pp_tn: "7572-10:06",
      don_vi_yeu_cau: "Xí nghiệp Tư vấn - Công ty Dịch vụ Điện lực miền Bắc",
      du_an: "",
      ngay_nhan_mau: "",
      ngay_thi_nghiem: "",
      rows: emptyTnDaDefaultRows(),
      nguoi_thi_nghiem: "",
      truong_phong_tn: "",
      pho_giam_doc: "",
    };
  }
  if (formKey === "do_dts") {
    return {
      ten_du_an: "",
      giai_doan: "",
      ma_thiet_bi: "TD-2000",
      so_series: "",
      diem_do: "",
      rows: DO_DTS_DEFAULT_AB2.map((ab2, i) =>
        emptyDoDtsRow(ab2, i === 0 ? 1 : 3)
      ),
      phan_tich: emptyDoDtsPhanTichDefaultRows(),
      nguoi_do: "",
      nguoi_kiem_tra: "",
    };
  }
  if (formKey === "bao_cao_dts") {
    return {
      ten_du_an: "",
      giai_doan: "",
      so_lop: BAO_CAO_DTS_DEFAULT_LOP,
      rows: emptyBaoCaoDtsDefaultRows(BAO_CAO_DTS_DEFAULT_LOP),
    };
  }
  return {};
}

export function emptyBaoCaoDtsLayer() {
  return { h: "", rho: "" };
}

export function emptyBaoCaoDtsRow(soLop = BAO_CAO_DTS_DEFAULT_LOP) {
  const n = Math.max(1, Number(soLop) || BAO_CAO_DTS_DEFAULT_LOP);
  return {
    vi_tri: "",
    mo_ta: "",
    layers: Array.from({ length: n }, () => emptyBaoCaoDtsLayer()),
  };
}

/** Pad / cắt mảng lớp theo so_lop */
export function normalizeBaoCaoDtsLayers(layers, soLop = BAO_CAO_DTS_DEFAULT_LOP) {
  const n = Math.max(1, Number(soLop) || BAO_CAO_DTS_DEFAULT_LOP);
  const src = Array.isArray(layers) ? layers : [];
  const next = [];
  for (let i = 0; i < n; i++) {
    next.push({
      h: src[i]?.h ?? "",
      rho: src[i]?.rho ?? "",
    });
  }
  return next;
}

export function emptyBaoCaoDtsDefaultRows(soLop = BAO_CAO_DTS_DEFAULT_LOP) {
  /** Mặc định 5 vị trí trống — người dùng tự điền */
  return Array.from({ length: 5 }, () => emptyBaoCaoDtsRow(soLop));
}

export function createEmptyBcksChiTiet() {
  const dia_chat = {};
  for (const k of BCKS_DIA_CHAT_DATA_KEYS) {
    dia_chat[k] = createEmptyDiaChatDetail(k);
  }
  return {
    dia_chat,
    bcks: createSeededEmptyBcksReport(),
  };
}
