/**
 * Registry biểu mẫu NTKS — map template Word + cấu trúc form/jsonb.
 */

export const NTKS_FORM_KEYS = ["hien_truong", "lay_mau", "kiem_tra_nl_tb", "nghiem_thu_kq"];

export const NTKS_FORMS = {
  hien_truong: {
    key: "hien_truong",
    shortLabel: "BB hiện trường",
    label: "Biên bản xác nhận khối lượng khảo sát tại hiện trường",
    templatePath: "/templates/templates_ntks/ntks_bb_hien_truong.docx",
    exportPrefix: "NTKS_HT",
  },
  lay_mau: {
    key: "lay_mau",
    shortLabel: "BB lấy mẫu",
    label: "Biên bản lấy mẫu tại hiện trường",
    templatePath: "/templates/templates_ntks/ntks_bb_lay_mau.docx",
    exportPrefix: "NTKS_LM",
  },
  kiem_tra_nl_tb: {
    key: "kiem_tra_nl_tb",
    shortLabel: "BB NL/TB",
    label: "Biên bản kiểm tra nhân lực, thiết bị trước thi công",
    templatePath: "/templates/templates_ntks/ntks_bb_kiem_tra_nl_tb.docx",
    exportPrefix: "NTKS_KT",
  },
  nghiem_thu_kq: {
    key: "nghiem_thu_kq",
    shortLabel: "BB nghiệm thu",
    label: "Biên bản nghiệm thu kết quả khảo sát xây dựng",
    templatePath: "/templates/templates_ntks/ntks_bb_nghiem_thu_kq.docx",
    exportPrefix: "NTKS_NT",
  },
};

/** Placeholder Docxtemplater — gắn vào template Word trước khi xuất có dữ liệu */
export const NTKS_DOC_PLACEHOLDER_HINT = {
  shared: [
    "ten_du_an",
    "dia_diem",
    "giai_doan",
    "chu_dau_tu",
    "nha_thau_ks",
    "nha_thau_tvgs",
    "dia_diem_lap",
    "ngay_bat_dau",
    "ngay_ket_thuc",
  ],
  hien_truong: [
    "can_cu_hop_dong",
    "can_cu_qd_giam_sat",
    "can_cu_nv_paktks",
    "gs_to_chuc",
    "ten_gs_1",
    "cv_gs_1",
    "ten_gs_2",
    "cv_gs_2",
    "ten_gs_3",
    "cv_gs_3",
    "nt_to_chuc",
    "ten_nt_1",
    "cv_nt_1",
    "ten_nt_2",
    "cv_nt_2",
    "ten_nt_3",
    "cv_nt_3",
    "kien_nghi",
    "so_ban",
    "so_ban_moi_ben",
    "{#khoan_dia_chat}stt vi_tri chieu_sau duong_kinh danh_gia{/khoan_dia_chat}",
    "{#lay_mau}stt ten_mau vi_tri so_luong ngay_bb danh_gia quy_cach yeu_cau{/lay_mau}",
    "{#do_dien_tro_suat}stt noi_dung ngay_do ghi_chu{/do_dien_tro_suat}",
    "{#khao_sat_dia_hinh}stt noi_dung don_vi khoi_luong ghi_chu{/khao_sat_dia_hinh}",
  ],
  lay_mau: [
    "gs_to_chuc",
    "ten_gs_1",
    "cv_gs_1",
    "ten_gs_2",
    "cv_gs_2",
    "ten_gs_3",
    "cv_gs_3",
    "nt_to_chuc",
    "ten_nt_1",
    "cv_nt_1",
    "ten_nt_2",
    "cv_nt_2",
    "ten_nt_3",
    "cv_nt_3",
    "kien_nghi",
    "so_ban",
    "so_ban_moi_ben",
    "{#lay_mau}stt vi_tri ten_mau quy_cach so_luong yeu_cau{/lay_mau}",
  ],
  kiem_tra_nl_tb: [
    "cong_trinh",
    "muc",
    "noi_dung_kiem_tra",
    "dia_diem_kiem_tra",
    "gs_to_chuc",
    "ten_gs_1",
    "cv_gs_1",
    "ten_gs_2",
    "cv_gs_2",
    "ten_gs_3",
    "cv_gs_3",
    "nt_to_chuc",
    "ten_nt_1",
    "cv_nt_1",
    "ten_nt_2",
    "cv_nt_2",
    "ten_nt_3",
    "cv_nt_3",
    "nl_chu_nhiem",
    "nl_ks_dia_hinh",
    "nl_ks_dia_chat",
    "nl_cong_nhan",
    "nhan_luc_chi_huy",
    "nhan_luc_ky_thuat",
    "nhan_luc_cong_nhan",
    "ket_luan",
    "so_ban",
    "so_ban_moi_ben",
    "gs_ho_ten",
    "gs_chuc_vu",
    "nt_ho_ten",
    "nt_chuc_vu",
    "{#may_moc}stt ten_may cong_suat_ma so_luong tinh_trang{/may_moc}",
    "label_gs",
    "label_nt",
  ],
  /** Khớp ntks_bb_nghiem_thu_kq.docx (schema 2026-07-20) */
  nghiem_thu_kq: [
    "so_bien_ban",
    "giai_doan_in_hoa",
    "can_cu_hop_dong",
    "can_cu_qd_giam_sat",
    "can_cu_qdpd_nvks",
    "can_cu_qdpd_paktks",
    "cdt_to_chuc",
    "ten_pgd_cdt",
    "cv_pgd_cdt",
    "ten_tr_phong_cdt",
    "cv_tr_phong_cdt",
    "ten_chuyen_vien_cdt",
    "cv_chuyen_vien_cdt",
    "giam_sat_ks",
    "ten_lanh_dao_gsks",
    "cv_lanh_dao_gsks",
    "ten_cnks_gsks",
    "cv_cnks_gsks",
    "ten_cvien_gsks",
    "cv_cvien_gsks",
    "tu_van_thiet_ke",
    "ten_lanh_dao_tvtk",
    "cv_lanh_dao_tvtk",
    "ten_gdxntv_tvtk",
    "cv_gdxntv_tvtk",
    "ten_kdoanh_cty",
    "cv_kdoanh_cty",
    "ten_cnks_tvtk",
    "cv_cnks_tvtk",
    "danh_gia_chat_luong",
    "danh_gia_quy_mo",
    "danh_gia_khoi_luong",
    "danh_gia_bao_cao",
    "danh_gia_khac",
    "ket_luan",
    "yeu_cau_bo_sung",
    "so_ban",
    "so_ban_ben_a",
    "so_ban_ben_b",
  ],
};

/** Field detail BB nghiệm thu KQ — đồng bộ template Word */
export const NTKS_NT_KQ_DETAIL_FIELDS = [
  "so_bien_ban",
  "dia_diem_lap",
  "ngay_bat_dau",
  "ngay_ket_thuc",
  "can_cu_hop_dong",
  "can_cu_qd_giam_sat",
  "can_cu_qdpd_nvks",
  "can_cu_qdpd_paktks",
  "cdt_to_chuc",
  "ten_pgd_cdt",
  "cv_pgd_cdt",
  "ten_tr_phong_cdt",
  "cv_tr_phong_cdt",
  "ten_chuyen_vien_cdt",
  "cv_chuyen_vien_cdt",
  "giam_sat_ks",
  "ten_lanh_dao_gsks",
  "cv_lanh_dao_gsks",
  "ten_cnks_gsks",
  "cv_cnks_gsks",
  "ten_cvien_gsks",
  "cv_cvien_gsks",
  "tu_van_thiet_ke",
  "ten_lanh_dao_tvtk",
  "cv_lanh_dao_tvtk",
  "ten_gdxntv_tvtk",
  "cv_gdxntv_tvtk",
  "ten_kdoanh_cty",
  "cv_kdoanh_cty",
  "ten_cnks_tvtk",
  "cv_cnks_tvtk",
  "danh_gia_chat_luong",
  "danh_gia_quy_mo",
  "danh_gia_khoi_luong",
  "danh_gia_bao_cao",
  "danh_gia_khac",
  "ket_luan",
  "yeu_cau_bo_sung",
  "so_ban",
  "so_ban_ben_a",
  "so_ban_ben_b",
];

export function getNtksFormDef(formKey) {
  return NTKS_FORMS[formKey] || null;
}

export function listNtksForms() {
  return NTKS_FORM_KEYS.map((k) => NTKS_FORMS[k]);
}

/**
 * Thiết bị KS mặc định BB NL/TB — theo mẫu thực tế (Từ Sơn 2).
 * Cột cong_suat_ma = Đơn vị (Bộ/Cái) trên form; vẫn khớp tag Word.
 */
export const NTKS_DEFAULT_MAY_MOC_ROWS = [
  { ten_may: "Máy GPS Comnav T300 và phụ kiện", cong_suat_ma: "Bộ", so_luong: "03", tinh_trang: "Tốt" },
  {
    ten_may: "Máy toàn đạc điện tử Leica TS06 plus kèm gương, mia và phụ kiện",
    cong_suat_ma: "Bộ",
    so_luong: "02",
    tinh_trang: "Tốt",
  },
  { ten_may: "Máy đo khoảng cách laser Leica Disto X4", cong_suat_ma: "Cái", so_luong: "02", tinh_trang: "Tốt" },
  { ten_may: "Máy thủy bình Sokkia B40A kèm phụ kiện", cong_suat_ma: "Bộ", so_luong: "01", tinh_trang: "Tốt" },
  { ten_may: "Máy tính xách tay", cong_suat_ma: "Cái", so_luong: "03", tinh_trang: "Tốt" },
  { ten_may: "Bộ đàm liên lạc", cong_suat_ma: "Bộ", so_luong: "02", tinh_trang: "Tốt" },
  { ten_may: "Máy ảnh", cong_suat_ma: "Cái", so_luong: "02", tinh_trang: "Tốt" },
  {
    ten_may:
      "Máy đo điện trở suất của đất Fluke 1625-2 (có tính năng tương đương như UJ-18, phù hợp với tiêu chuẩn áp dụng TCXD161-1987)",
    cong_suat_ma: "Bộ",
    so_luong: "01",
    tinh_trang: "Tốt",
  },
  { ten_may: "Bộ dụng cụ khoan tay và thiết bị lấy mẫu", cong_suat_ma: "Bộ", so_luong: "01", tinh_trang: "Tốt" },
  {
    ten_may: "Máy khoan UKB12/25, thiết bị lấy mẫu và phụ kiện",
    cong_suat_ma: "Bộ",
    so_luong: "01",
    tinh_trang: "Tốt",
  },
  { ten_may: "Máy khoan XY-1A, bộ dụng cụ lấy mẫu", cong_suat_ma: "Bộ", so_luong: "01", tinh_trang: "Tốt" },
  { ten_may: "Bộ thí nghiệm xuyên tiêu chuẩn SPT", cong_suat_ma: "Bộ", so_luong: "01", tinh_trang: "Tốt" },
];

export function cloneNtksDefaultMayMoc() {
  return NTKS_DEFAULT_MAY_MOC_ROWS.map((r) => ({ ...r }));
}

export function isBlankNtksMayMoc(rows) {
  if (!Array.isArray(rows) || !rows.length) return true;
  return rows.every((r) => !String(r?.ten_may ?? "").trim());
}

/** Khung jsonb mặc định cho một biểu mẫu */
export function createEmptyNtksFormDetail(formKey) {
  const base = {
    dia_diem_lap: "",
    ngay_bat_dau: "",
    ngay_ket_thuc: "",
    link_docx_xuat: "",
    exported_at: null,
  };

  if (formKey === "hien_truong") {
    return {
      ...base,
      can_cu_hop_dong: "",
      can_cu_qd_giam_sat: "",
      can_cu_nv_paktks: "",
      gs_to_chuc: "",
      gs_ho_ten: "",
      gs_chuc_vu: "",
      ten_gs_1: "",
      cv_gs_1: "",
      ten_gs_2: "",
      cv_gs_2: "",
      ten_gs_3: "",
      cv_gs_3: "",
      nt_to_chuc: "",
      nt_ho_ten: "",
      nt_chuc_vu: "",
      ten_nt_1: "",
      cv_nt_1: "",
      ten_nt_2: "",
      cv_nt_2: "",
      ten_nt_3: "",
      cv_nt_3: "",
      khoan_dia_chat: [emptyRow(["vi_tri", "chieu_sau", "duong_kinh", "danh_gia"])],
      lay_mau: [
        emptyRow(["ten_mau", "vi_tri", "so_luong", "ngay_bb", "danh_gia", "quy_cach", "yeu_cau"], {
          ten_mau: "Mẫu đất",
        }),
        emptyRow(["ten_mau", "vi_tri", "so_luong", "ngay_bb", "danh_gia", "quy_cach", "yeu_cau"], {
          ten_mau: "Mẫu nước",
        }),
      ],
      do_dien_tro_suat: [
        emptyRow(["noi_dung", "ngay_do", "ghi_chu"], { noi_dung: "Đường dây" }),
        emptyRow(["noi_dung", "ngay_do", "ghi_chu"], { noi_dung: "Trạm biến áp" }),
      ],
      khao_sat_dia_hinh: [
        emptyRow(["noi_dung", "don_vi", "khoi_luong", "ghi_chu"], {
          noi_dung: "Xây dựng lưới khống chế tọa độ",
          don_vi: "điểm",
        }),
        emptyRow(["noi_dung", "don_vi", "khoi_luong", "ghi_chu"], {
          noi_dung: "Xây dựng lưới khống chế cao độ",
          don_vi: "km",
        }),
      ],
      kien_nghi: "",
      so_ban: "02",
      so_ban_moi_ben: "01",
    };
  }

  if (formKey === "lay_mau") {
    return {
      ...base,
      gs_to_chuc: "",
      ten_gs_1: "",
      cv_gs_1: "",
      ten_gs_2: "",
      cv_gs_2: "",
      ten_gs_3: "",
      cv_gs_3: "",
      nt_to_chuc: "",
      ten_nt_1: "",
      cv_nt_1: "",
      ten_nt_2: "",
      cv_nt_2: "",
      ten_nt_3: "",
      cv_nt_3: "",
      lay_mau: [
        emptyRow(["ten_mau", "vi_tri", "quy_cach", "so_luong", "yeu_cau", "ngay_bb", "danh_gia"], {
          ten_mau: "Mẫu đất",
          quy_cach: "Ống nhựa PVC 76mm, h=200mm",
          yeu_cau: "Xác định chỉ tiêu cơ lý với đất",
        }),
        emptyRow(["ten_mau", "vi_tri", "quy_cach", "so_luong", "yeu_cau", "ngay_bb", "danh_gia"], {
          ten_mau: "Mẫu nước",
          quy_cach: "Can nhựa 2,0 lít",
          yeu_cau: "Xác định các chỉ tiêu ăn mòn bê tông",
        }),
      ],
      kien_nghi:
        "Công tác lấy mẫu thí nghiệm đảm bảo đúng quy cách và yêu cầu kỹ thuật.",
      so_ban: "02",
      so_ban_moi_ben: "01",
    };
  }

  if (formKey === "kiem_tra_nl_tb") {
    return {
      ...base,
      cong_trinh: "",
      muc: "",
      noi_dung_kiem_tra: "",
      dia_diem_kiem_tra: "",
      gs_to_chuc: "",
      ten_gs_1: "",
      cv_gs_1: "",
      ten_gs_2: "",
      cv_gs_2: "",
      ten_gs_3: "",
      cv_gs_3: "",
      gs_ho_ten: "",
      gs_chuc_vu: "",
      nt_to_chuc: "",
      ten_nt_1: "",
      cv_nt_1: "",
      ten_nt_2: "",
      cv_nt_2: "",
      ten_nt_3: "",
      cv_nt_3: "",
      nt_ho_ten: "",
      nt_chuc_vu: "",
      nl_chu_nhiem: "",
      nl_ks_dia_hinh: "",
      nl_ks_dia_chat: "",
      nl_cong_nhan: "",
      nhan_luc_chi_huy: "",
      nhan_luc_ky_thuat: "",
      nhan_luc_cong_nhan: "",
      may_moc: cloneNtksDefaultMayMoc(),
      ket_luan: "",
      so_ban: "",
      so_ban_moi_ben: "",
    };
  }

  if (formKey === "nghiem_thu_kq") {
    const detail = { ...base };
    for (const f of NTKS_NT_KQ_DETAIL_FIELDS) {
      if (detail[f] === undefined) detail[f] = "";
    }
    detail.so_ban = "06";
    detail.so_ban_ben_a = "04";
    detail.so_ban_ben_b = "02";
    return detail;
  }

  return base;
}

function emptyRow(fields, defaults = {}) {
  const row = {};
  for (const f of fields) row[f] = defaults[f] ?? "";
  return row;
}

export function normalizeNtksChiTiet(raw = {}) {
  const out = {};
  for (const key of NTKS_FORM_KEYS) {
    const def = createEmptyNtksFormDetail(key);
    const saved = raw?.[key] && typeof raw[key] === "object" ? raw[key] : {};
    out[key] = { ...def, ...saved };
    for (const arrKey of tableKeysForForm(key)) {
      if (!Array.isArray(out[key][arrKey]) || !out[key][arrKey].length) {
        out[key][arrKey] = def[arrKey] || [];
      }
    }
  }
  return out;
}

function tableKeysForForm(formKey) {
  if (formKey === "hien_truong") {
    return ["khoan_dia_chat", "lay_mau", "do_dien_tro_suat", "khao_sat_dia_hinh"];
  }
  if (formKey === "lay_mau") return ["lay_mau"];
  if (formKey === "kiem_tra_nl_tb") return ["may_moc"];
  return [];
}
