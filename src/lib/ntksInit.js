import { formatDiaDiemKs } from "./paktksInit";
import { normalizeChuDauTu } from "./chuDauTuAlias";
import { getGiaiDoanChuan } from "./hoSoKhaoSat";
import { DEFAULT_NHA_THAU_KS } from "./nkksInit";
import {
  cloneNtksDefaultMayMoc,
  createEmptyNtksFormDetail,
  isBlankNtksMayMoc,
  normalizeNtksChiTiet,
  NTKS_FORM_KEYS,
} from "./ntksFormRegistry";

/** Lãnh đạo XN TV — dropdown mục 1 BB nghiệm thu */
export const NTKS_LANH_DAO_TVTK_OPTIONS = ["Nguyễn Anh Tuấn", "Phạm Ngọc Oanh"];

const DEFAULT_CV_LANH_DAO_TVTK = "Phó Giám đốc";

function firstNonEmpty(...vals) {
  for (const v of vals) {
    const t = String(v ?? "").trim();
    if (t) return t;
  }
  return "";
}

function fillIfEmpty(detail, field, value) {
  if (!String(detail[field] ?? "").trim() && value) {
    detail[field] = value;
  }
}

/**
 * Căn cứ QĐ phê duyệt: luôn ưu tiên bản Chi tiết (_day_du).
 * Nếu ô đang trống hoặc đang giữ đúng bản rút gọn → ghi đè bằng chi tiết.
 * Fallback rút gọn chỉ khi chưa có chi tiết.
 */
function fillCanCuQuyetDinh(detail, field, dayDu, short) {
  const day = String(dayDu ?? "").trim();
  const ngan = String(short ?? "").trim();
  const cur = String(detail[field] ?? "").trim();
  if (day) {
    if (!cur || (ngan && cur === ngan)) {
      detail[field] = day;
    }
    return;
  }
  if (!cur && ngan) {
    detail[field] = ngan;
  }
}

/** Mặc định nhân sự TVTK + căn cứ Giao A / NVKS / PAKTKS (chỉ khi ô còn trống). */
export function applyNghiemThuKqDefaults(detail, { project, nvks, nkks, paktks } = {}) {
  const d = { ...detail };

  fillIfEmpty(d, "so_bien_ban", "01/BBNT");
  fillIfEmpty(d, "dia_diem_lap", DEFAULT_NHA_THAU_KS);

  fillIfEmpty(d, "ten_lanh_dao_tvtk", NTKS_LANH_DAO_TVTK_OPTIONS[0]);
  fillIfEmpty(d, "cv_lanh_dao_tvtk", DEFAULT_CV_LANH_DAO_TVTK);
  fillIfEmpty(d, "ten_kdoanh_cty", "Nguyễn Tiến Đức");
  fillIfEmpty(d, "cv_kdoanh_cty", "P.TP Kinh doanh");
  fillIfEmpty(d, "ten_gdxntv_tvtk", "Phạm Tuấn Nam");
  fillIfEmpty(d, "cv_gdxntv_tvtk", "Giám đốc XNTV");
  fillIfEmpty(d, "ten_cnks_tvtk", "Đỗ Minh Phương");
  fillIfEmpty(d, "cv_cnks_tvtk", "Chủ nhiệm khảo sát");

  fillIfEmpty(
    d,
    "can_cu_hop_dong",
    firstNonEmpty(project?.qd_giao_a_day_du, project?.qd_giao_a)
  );
  fillCanCuQuyetDinh(
    d,
    "can_cu_qdpd_nvks",
    nvks?.quyet_dinh_phe_duyet_nvks_day_du,
    nvks?.quyet_dinh_phe_duyet_nvks
  );
  fillCanCuQuyetDinh(
    d,
    "can_cu_qdpd_paktks",
    paktks?.quyet_dinh_phe_duyet_paktks_day_du,
    paktks?.quyet_dinh_phe_duyet_paktks
  );

  fillIfEmpty(d, "cdt_to_chuc", normalizeChuDauTu(project?.chu_dau_tu || nvks?.chu_dau_tu || ""));
  fillIfEmpty(d, "tu_van_thiet_ke", nkks?.nha_thau_ks || DEFAULT_NHA_THAU_KS);
  fillIfEmpty(d, "giam_sat_ks", nkks?.nha_thau_tvgs || "");

  if (!d.ngay_bat_dau && nkks?.ngay_bat_dau) {
    d.ngay_bat_dau = String(nkks.ngay_bat_dau).slice(0, 10);
  }
  if (!d.ngay_ket_thuc && nkks?.ngay_ket_thuc) {
    d.ngay_ket_thuc = String(nkks.ngay_ket_thuc).slice(0, 10);
  }

  // Mục 5–6: đánh giá / kết luận chung (chỉ khi ô trống — vẫn sửa trên form)
  fillIfEmpty(
    d,
    "danh_gia_chat_luong",
    "Công tác khảo sát được thực hiện đúng trình tự, phương pháp và yêu cầu kỹ thuật đã được phê duyệt; kết quả khảo sát phản ánh đúng điều kiện thực tế hiện trường, đủ cơ sở phục vụ giai đoạn tiếp theo."
  );
  fillIfEmpty(
    d,
    "danh_gia_quy_mo",
    "Quy mô và phạm vi khảo sát phù hợp với nhiệm vụ khảo sát / phương án kỹ thuật khảo sát đã được phê duyệt; các hạng mục thực hiện đầy đủ theo yêu cầu."
  );
  fillIfEmpty(
    d,
    "danh_gia_khoi_luong",
    "Khối lượng khảo sát thực hiện phù hợp với khối lượng được duyệt; việc nghiệm thu khối lượng được các bên thống nhất trên cơ sở hồ sơ và hiện trường."
  );
  fillIfEmpty(
    d,
    "danh_gia_bao_cao",
    "Báo cáo kết quả khảo sát được lập đầy đủ thành phần, hình thức trình bày rõ ràng, số lượng bộ hồ sơ theo thỏa thuận của các bên và đủ điều kiện để nghiệm thu."
  );
  fillIfEmpty(d, "danh_gia_khac", "Không có.");
  fillIfEmpty(d, "ket_luan", "Chấp nhận nghiệm thu kết quả khảo sát xây dựng.");
  fillIfEmpty(
    d,
    "yeu_cau_bo_sung",
    "Đề nghị các bên hoàn thiện thủ tục theo quy định."
  );

  return d;
}

/** Tổ chức nhà thầu KS mặc định trên BB kiểm tra NL/TB. */
export const NTKS_DEFAULT_NT_TO_CHUC =
  "Xí nghiệp Tư vấn - Công ty Dịch vụ điện lực miền Bắc";

const NTKS_NT_TO_CHUC_LEGACY = [
  "XNTV - Công ty dịch vụ điện lực miền Bắc",
  DEFAULT_NHA_THAU_KS,
];
/**
 * BB kiểm tra NL/TB: không có TVGS riêng → giám sát = tên Chủ đầu tư
 * (Công ty Điện lực… / Ban Quản lý…). Chỉ áp dụng form này.
 */
export function resolveNtksKiemTraGsToChuc({ tvgs, chuDauTu } = {}) {
  const gs = String(tvgs || "").trim();
  if (gs) return gs;
  return normalizeChuDauTu(chuDauTu || "") || "";
}

/** Mặc định BB lấy mẫu — tổ chức GS/NT; chỉ điền ô trống. */
export function applyLayMauDefaults(detail, { nkks, chuDauTu } = {}) {
  const d = { ...detail };
  fillIfEmpty(
    d,
    "gs_to_chuc",
    resolveNtksKiemTraGsToChuc({ tvgs: nkks?.nha_thau_tvgs, chuDauTu })
  );
  fillIfEmpty(d, "nt_to_chuc", nkks?.nha_thau_ks || NTKS_DEFAULT_NT_TO_CHUC);
  fillIfEmpty(d, "so_ban", "02");
  fillIfEmpty(d, "so_ban_moi_ben", "01");
  fillIfEmpty(
    d,
    "kien_nghi",
    "Công tác lấy mẫu thí nghiệm đảm bảo đúng quy cách và yêu cầu kỹ thuật."
  );
  return d;
}

const NTKS_DOI_TUONG_PREFIX =
  "Công tác huy động nhân sự, máy móc thiết bị khảo sát xây dựng phục vụ lập ";

/** Câu đối tượng kiểm tra — khớp giai đoạn trên tiêu đề BB. */
export function buildNtksDoiTuongKiemTra(giaiDoan) {
  const gd = String(giaiDoan || "").trim() || "…";
  return `${NTKS_DOI_TUONG_PREFIX}${gd}.`;
}

/** True nếu ô còn trống hoặc vẫn là câu mẫu (chỉ khác phần giai đoạn). */
export function isAutoNtksDoiTuongKiemTra(text) {
  const t = String(text || "").trim();
  if (!t) return true;
  return new RegExp(
    `^${NTKS_DOI_TUONG_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}.+\\.?$`
  ).test(t);
}

/** Mặc định BB kiểm tra NL/TB — theo mẫu thực tế; chỉ điền khi ô/bảng còn trống. */
export function applyKiemTraNlTbDefaults(detail, { project, nvks, nkks, giaiDoan, chuDauTu } = {}) {
  const d = { ...detail };
  const gd = firstNonEmpty(
    giaiDoan,
    getGiaiDoanChuan(project),
    nvks?.giai_doan
  );
  const cdt = firstNonEmpty(
    chuDauTu,
    normalizeChuDauTu(project?.chu_dau_tu || nvks?.chu_dau_tu || "")
  );

  fillIfEmpty(
    d,
    "cong_trinh",
    firstNonEmpty(project?.ten_du_an, nvks?.ten_du_an)
  );

  const doiTuong = buildNtksDoiTuongKiemTra(gd);
  if (isAutoNtksDoiTuongKiemTra(d.noi_dung_kiem_tra)) {
    d.noi_dung_kiem_tra = doiTuong;
  }

  fillIfEmpty(d, "dia_diem_kiem_tra", "Hiện trường công trình");

  // Có TVGS → dùng TVGS; không có → tên Chủ đầu tư (tự giám sát)
  const tvgs = String(nkks?.nha_thau_tvgs || "").trim();
  const gsDefault = resolveNtksKiemTraGsToChuc({ tvgs, chuDauTu: cdt });
  fillIfEmpty(d, "gs_to_chuc", gsDefault);
  // Bản cũ từng ghi «Chủ đầu tư tự giám sát» → đổi thành tên CDT thật
  if (
    String(d.gs_to_chuc || "").trim() === "Chủ đầu tư tự giám sát" &&
    cdt
  ) {
    d.gs_to_chuc = cdt;
  }
  fillIfEmpty(d, "nt_to_chuc", NTKS_DEFAULT_NT_TO_CHUC);
  // Bản cũ từng ghi XNTV rút gọn / biến thể Điện lực → chuẩn hóa tên đầy đủ
  if (NTKS_NT_TO_CHUC_LEGACY.includes(String(d.nt_to_chuc || "").trim())) {
    d.nt_to_chuc = NTKS_DEFAULT_NT_TO_CHUC;
  }

  // Tương thích bản cũ (1 người GS/NT) → slot 1
  fillIfEmpty(d, "ten_gs_1", d.gs_ho_ten);
  fillIfEmpty(d, "cv_gs_1", d.gs_chuc_vu);
  fillIfEmpty(d, "ten_nt_1", d.nt_ho_ten);
  fillIfEmpty(d, "cv_nt_1", d.nt_chuc_vu);

  fillIfEmpty(d, "ten_nt_1", "Đỗ Minh Phương");
  fillIfEmpty(d, "cv_nt_1", "Chủ nhiệm khảo sát");
  fillIfEmpty(d, "ten_nt_2", "Đinh Đức Đoàn");
  fillIfEmpty(d, "cv_nt_2", "CB khảo sát địa hình");
  fillIfEmpty(d, "ten_nt_3", "Nguyễn Hữu Huấn");
  fillIfEmpty(d, "cv_nt_3", "CB khảo sát địa chất");

  fillIfEmpty(d, "nl_chu_nhiem", "Đỗ Minh Phương");
  fillIfEmpty(d, "nl_ks_dia_hinh", "Đinh Đức Đoàn");
  fillIfEmpty(d, "nl_ks_dia_chat", "Nguyễn Hữu Huấn, Đỗ Gia Hiếu");
  fillIfEmpty(d, "nl_cong_nhan", "05 công nhân đo đạc; 03 công nhân khoan.");

  fillIfEmpty(
    d,
    "ket_luan",
    "Nhân lực và máy móc thiết bị huy động theo phương án kỹ thuật khảo sát đã được Chủ đầu tư chấp thuận. Đồng ý nghiệm thu và cho phép tiến hành công tác khảo sát."
  );
  fillIfEmpty(d, "so_ban", "02");
  fillIfEmpty(d, "so_ban_moi_ben", "01");

  if (isBlankNtksMayMoc(d.may_moc)) {
    d.may_moc = cloneNtksDefaultMayMoc();
  }

  return d;
}

/** Có TVGS trên thông tin chung / detail BB nghiệm thu → hiện khối giám sát (BB NT). */
export function ntksHasGiamSat(formData = {}) {
  const nt = formData?.chi_tiet_ntks?.nghiem_thu_kq || {};
  return Boolean(firstNonEmpty(formData.nha_thau_tvgs, nt.giam_sat_ks));
}

export function buildInitialNtksForm(project, nvks, nkks, paktks) {
  const giaiDoan = getGiaiDoanChuan(project) || nvks?.giai_doan || "";
  const chi_tiet_ntks = {};
  for (const key of NTKS_FORM_KEYS) {
    let detail = createEmptyNtksFormDetail(key);
    if (key === "hien_truong") {
      detail.can_cu_nv_paktks = firstNonEmpty(
        nvks?.quyet_dinh_phe_duyet_nvks_day_du,
        nvks?.quyet_dinh_phe_duyet_nvks
      );
    }
    if (key === "lay_mau") {
      detail = applyLayMauDefaults(detail, {
        nkks,
        chuDauTu: normalizeChuDauTu(project?.chu_dau_tu || nvks?.chu_dau_tu || ""),
      });
    }
    if (key === "nghiem_thu_kq") {
      detail = applyNghiemThuKqDefaults(detail, { project, nvks, nkks, paktks });
    }
    if (key === "kiem_tra_nl_tb") {
      detail = applyKiemTraNlTbDefaults(detail, {
        project,
        nvks,
        nkks,
        giaiDoan,
        chuDauTu: normalizeChuDauTu(project?.chu_dau_tu || nvks?.chu_dau_tu || ""),
      });
    }
    chi_tiet_ntks[key] = detail;
  }

  return {
    ma_du_an: project?.ma_du_an || nvks?.ma_du_an || "",
    ten_du_an: project?.ten_du_an || nvks?.ten_du_an || "",
    dia_diem: nvks?.dia_diem || formatDiaDiemKs(project?.dia_diem_ks),
    giai_doan: giaiDoan,
    chu_dau_tu: normalizeChuDauTu(project?.chu_dau_tu || nvks?.chu_dau_tu || ""),
    nha_thau_ks: nkks?.nha_thau_ks || DEFAULT_NHA_THAU_KS,
    nha_thau_tvgs: nkks?.nha_thau_tvgs || "",
    trang_thai_ntks: "dang_lap",
    chi_tiet_ntks,
    link_docx_xuat: "",
    exported_at: null,
  };
}

export function mergeSavedNtksIntoForm(saved, project, nvks, nkks, paktks) {
  const base = buildInitialNtksForm(project, nvks, nkks, paktks);
  if (!saved) return base;

  const chi = normalizeNtksChiTiet(saved.chi_tiet_ntks || base.chi_tiet_ntks);
  chi.nghiem_thu_kq = applyNghiemThuKqDefaults(chi.nghiem_thu_kq, {
    project,
    nvks,
    nkks,
    paktks,
  });
  chi.kiem_tra_nl_tb = applyKiemTraNlTbDefaults(chi.kiem_tra_nl_tb, {
    project,
    nvks,
    nkks,
    giaiDoan: saved.giai_doan ?? base.giai_doan,
    chuDauTu: saved.chu_dau_tu ?? base.chu_dau_tu,
  });
  chi.lay_mau = applyLayMauDefaults(chi.lay_mau, {
    nkks,
    chuDauTu: saved.chu_dau_tu ?? base.chu_dau_tu,
  });

  return {
    ...base,
    ...saved,
    ma_du_an: saved.ma_du_an || base.ma_du_an,
    ten_du_an: saved.ten_du_an || base.ten_du_an,
    dia_diem: saved.dia_diem ?? base.dia_diem,
    giai_doan: saved.giai_doan ?? base.giai_doan,
    chu_dau_tu: saved.chu_dau_tu ?? base.chu_dau_tu,
    nha_thau_ks: saved.nha_thau_ks ?? base.nha_thau_ks,
    nha_thau_tvgs: saved.nha_thau_tvgs ?? base.nha_thau_tvgs,
    trang_thai_ntks: saved.trang_thai_ntks || "dang_lap",
    chi_tiet_ntks: chi,
    link_docx_xuat: saved.link_docx_xuat || "",
    exported_at: saved.exported_at || null,
  };
}

export function buildNtksDbPayload(formData, { nvksId, nkksId } = {}) {
  return {
    ma_du_an: formData.ma_du_an,
    nvks_id: nvksId,
    nkks_id: nkksId || null,
    ten_du_an: formData.ten_du_an,
    dia_diem: formData.dia_diem,
    giai_doan: formData.giai_doan,
    chu_dau_tu: formData.chu_dau_tu,
    nha_thau_ks: formData.nha_thau_ks,
    nha_thau_tvgs: formData.nha_thau_tvgs,
    chi_tiet_ntks: normalizeNtksChiTiet(formData.chi_tiet_ntks),
    trang_thai_ntks: formData.trang_thai_ntks || "dang_lap",
    updated_at: new Date().toISOString(),
  };
}

export function patchNtksFormDetail(formData, formKey, patch) {
  const chi = normalizeNtksChiTiet(formData.chi_tiet_ntks);
  chi[formKey] = { ...chi[formKey], ...patch };
  return { ...formData, chi_tiet_ntks: chi };
}

export function patchNtksTableRow(formData, formKey, tableKey, rowIndex, field, value) {
  const chi = normalizeNtksChiTiet(formData.chi_tiet_ntks);
  const rows = [...(chi[formKey][tableKey] || [])];
  if (!rows[rowIndex]) return formData;
  rows[rowIndex] = { ...rows[rowIndex], [field]: value };
  chi[formKey] = { ...chi[formKey], [tableKey]: rows };
  return { ...formData, chi_tiet_ntks: chi };
}

export function addNtksTableRow(formData, formKey, tableKey, emptyRow) {
  const chi = normalizeNtksChiTiet(formData.chi_tiet_ntks);
  const rows = [...(chi[formKey][tableKey] || []), emptyRow];
  chi[formKey] = { ...chi[formKey], [tableKey]: rows };
  return { ...formData, chi_tiet_ntks: chi };
}

export function removeNtksTableRow(formData, formKey, tableKey, rowIndex) {
  const chi = normalizeNtksChiTiet(formData.chi_tiet_ntks);
  const prev = chi[formKey][tableKey] || [];
  const rows = prev.filter((_, i) => i !== rowIndex);
  chi[formKey] = { ...chi[formKey], [tableKey]: rows.length ? rows : prev.slice(0, 1) };
  return { ...formData, chi_tiet_ntks: chi };
}
