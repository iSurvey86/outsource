import { formatDiaDiemKs } from "./paktksInit";
import { normalizeChuDauTu } from "./chuDauTuAlias";
import { getGiaiDoanChuan } from "./hoSoKhaoSat";
import {
  DEFAULT_THOI_TIET,
  isNkksDayFieldFilled,
  NKKS_DEFAULT_GIAM_SAT_VALUE,
  NKKS_DEFAULT_KHONG_FIELDS,
  NKKS_DEFAULT_KHONG_VALUE,
  normalizeGiamSatField,
  normalizeKhongField,
  normalizeThoiTiet,
} from "./nkksThoiTiet";
import { NKKS_DEFAULT_MAY_MOC, NKKS_DEFAULT_NHAN_LUC } from "./nkksAutoFillFromKl";

export const DEFAULT_NHA_THAU_KS = "Xí nghiệp Tư vấn - Công ty Dịch vụ Điện lực miền Bắc";

export const NKKS_DAY_FIELDS = [
  "ngay_khao_sat",
  "thoi_tiet",
  "cong_viec_thuc_hien",
  "khoi_luong_thuc_hien",
  "y_kien_chu_dau_tu",
  "y_kien_giam_sat",
  "cac_van_de_dac_biet",
];

export function createEmptyNkksDayRow(ngay = "") {
  return {
    ngay_khao_sat: ngay,
    thoi_tiet: {
      sang: [...DEFAULT_THOI_TIET.sang],
      chieu: [...DEFAULT_THOI_TIET.chieu],
    },
    cong_viec_thuc_hien: "",
    khoi_luong_thuc_hien: "",
    y_kien_chu_dau_tu: NKKS_DEFAULT_KHONG_VALUE,
    y_kien_giam_sat: NKKS_DEFAULT_GIAM_SAT_VALUE,
    cac_van_de_dac_biet: NKKS_DEFAULT_KHONG_VALUE,
    la_ngay_du_phong: false,
  };
}

export const MAX_NKKS_RANGE_DAYS = 366;

function parseIsoLocalDate(iso) {
  const s = String(iso || "").slice(0, 10);
  const parts = s.split("-").map(Number);
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null;
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  if (
    date.getFullYear() !== parts[0] ||
    date.getMonth() !== parts[1] - 1 ||
    date.getDate() !== parts[2]
  ) {
    return null;
  }
  return date;
}

function formatIsoLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Liệt kê ngày ISO (yyyy-mm-dd) từ đầu đến cuối, tính cả hai đầu. */
export function enumerateNkksIsoDates(ngayBatDau, ngayKetThuc) {
  const start = parseIsoLocalDate(ngayBatDau);
  const end = parseIsoLocalDate(ngayKetThuc);
  if (!start || !end || end < start) return [];

  const dates = [];
  const cur = new Date(start);
  while (cur <= end) {
    dates.push(formatIsoLocalDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

export function getNkksDateRangeDayCount(ngayBatDau, ngayKetThuc) {
  return enumerateNkksIsoDates(ngayBatDau, ngayKetThuc).length;
}

export function isNkksDateRangeActive(ngayBatDau, ngayKetThuc) {
  return getNkksDateRangeDayCount(ngayBatDau, ngayKetThuc) > 0;
}

/**
 * Sinh mảng nhật ký theo ngày — giữ dữ liệu đã nhập nếu trùng ngày KS.
 * Trả về null nếu chưa đủ 2 ngày hoặc khoảng không hợp lệ.
 */
export function buildNkksNgaysFromRange(ngayBatDau, ngayKetThuc, existingRows = []) {
  const dates = enumerateNkksIsoDates(ngayBatDau, ngayKetThuc);
  if (!dates.length) return null;

  const byDate = new Map();
  for (const row of normalizeNkksDays(existingRows)) {
    const key = String(row.ngay_khao_sat || "").slice(0, 10);
    if (key) byDate.set(key, row);
  }

  return dates.map((iso) => {
    const existing = byDate.get(iso);
    if (existing) {
      return {
        ...existing,
        ngay_khao_sat: iso,
        y_kien_giam_sat: normalizeGiamSatField(existing.y_kien_giam_sat),
        y_kien_chu_dau_tu: normalizeKhongField(existing.y_kien_chu_dau_tu),
        cac_van_de_dac_biet: normalizeKhongField(existing.cac_van_de_dac_biet),
      };
    }
    return createEmptyNkksDayRow(iso);
  });
}

export function normalizeNkksDays(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const base = createEmptyNkksDayRow();
    for (const key of NKKS_DAY_FIELDS) {
      if (key === "thoi_tiet") {
        base[key] = normalizeThoiTiet(row?.[key]);
        continue;
      }
      if (key === "y_kien_giam_sat") {
        base[key] = normalizeGiamSatField(row?.[key]);
        continue;
      }
      if (NKKS_DEFAULT_KHONG_FIELDS.includes(key)) {
        base[key] = normalizeKhongField(row?.[key]);
        continue;
      }
      base[key] = row?.[key] ?? row?.[key === "ngay_khao_sat" ? "ngay" : ""] ?? "";
    }
    base.la_ngay_du_phong = Boolean(row?.la_ngay_du_phong || row?.is_ngay_du_phong);
    return base;
  });
}

export function normalizeBangKhoiLuong(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => ({
    stt: row?.stt ?? "",
    noi_dung: row?.noi_dung ?? "",
    cap_dh: row?.cap_dh ?? "",
    don_vi: row?.don_vi ?? "",
    khoi_luong: row?.khoi_luong ?? row?.kl_02 ?? row?.kl_01 ?? "",
    is_header: Boolean(row?.is_header),
    ...(row?.id_cong_viec ? { id_cong_viec: row.id_cong_viec } : {}),
  }));
}

export function buildInitialNkksForm(project, nvks) {
  return {
    ma_du_an: project?.ma_du_an || nvks?.ma_du_an || "",
    ten_du_an: project?.ten_du_an || nvks?.ten_du_an || "",
    ten_cong_trinh: project?.ten_du_an || nvks?.ten_du_an || "",
    dia_diem: nvks?.dia_diem || formatDiaDiemKs(project?.dia_diem_ks),
    loai_hinh: nvks?.loai_hinh || "",
    hang_muc: nvks?.loai_hinh || "",
    giai_doan: getGiaiDoanChuan(project) || nvks?.giai_doan || "",
    chu_dau_tu: normalizeChuDauTu(project?.chu_dau_tu || nvks?.chu_dau_tu || ""),
    nha_thau_ks: DEFAULT_NHA_THAU_KS,
    nha_thau_tvgs: "",
    goi_thau: "",
    ngay_bat_dau: "",
    ngay_ket_thuc: "",
    nhan_luc: NKKS_DEFAULT_NHAN_LUC,
    may_moc_thiet_bi: NKKS_DEFAULT_MAY_MOC,
    trang_thai_nkks: "dang_lap",
    bang_khoi_luong: [],
    nvks_kl_source_id: null,
    nvks_kl_source_label: "",
    nkks_ngays: [createEmptyNkksDayRow()],
  };
}

function pickFirstDayField(rows, field) {
  if (!Array.isArray(rows)) return "";
  for (const row of rows) {
    const val = String(row?.[field] || "").trim();
    if (val) return val;
  }
  return "";
}

export function mergeSavedNkksIntoForm(saved, project, nvks) {
  const base = buildInitialNkksForm(project, nvks);
  const days = normalizeNkksDays(saved?.chi_tiet_nhat_ky || saved?.nkks_ngays);
  const savedBang = normalizeBangKhoiLuong(saved?.bang_khoi_luong);

  return {
    ...base,
    ...saved,
    ma_du_an: saved?.ma_du_an || base.ma_du_an,
    ten_du_an: saved?.ten_du_an || base.ten_du_an,
    ten_cong_trinh: saved?.ten_cong_trinh || saved?.ten_du_an || base.ten_cong_trinh,
    dia_diem: saved?.dia_diem ?? base.dia_diem,
    loai_hinh: saved?.loai_hinh ?? base.loai_hinh,
    hang_muc: saved?.hang_muc ?? saved?.loai_hinh ?? base.hang_muc,
    chu_dau_tu: saved?.chu_dau_tu ?? base.chu_dau_tu,
    nha_thau_ks: saved?.nha_thau_ks ?? base.nha_thau_ks,
    nha_thau_tvgs: saved?.nha_thau_tvgs ?? "",
    nhan_luc:
      String(saved?.nhan_luc || "").trim() ||
      pickFirstDayField(saved?.chi_tiet_nhat_ky || saved?.nkks_ngays, "nhan_luc") ||
      NKKS_DEFAULT_NHAN_LUC,
    may_moc_thiet_bi:
      String(saved?.may_moc_thiet_bi || "").trim() ||
      pickFirstDayField(saved?.chi_tiet_nhat_ky || saved?.nkks_ngays, "may_moc_thiet_bi") ||
      NKKS_DEFAULT_MAY_MOC,
    ngay_bat_dau: saved?.ngay_bat_dau ? String(saved.ngay_bat_dau).slice(0, 10) : "",
    ngay_ket_thuc: saved?.ngay_ket_thuc ? String(saved.ngay_ket_thuc).slice(0, 10) : "",
    bang_khoi_luong: savedBang.length ? savedBang : base.bang_khoi_luong,
    nvks_kl_source_id: saved?.nvks_kl_source_id || null,
    nvks_kl_source_label: saved?.nvks_kl_source_label || "",
    giai_doan: saved?.giai_doan || base.giai_doan,
    link_docx_xuat: saved?.link_docx_xuat || "",
    link_pdf_xuat: saved?.link_pdf_xuat || "",
    exported_at: saved?.exported_at || null,
    nkks_ngays: (() => {
      const ngayBatDau = saved?.ngay_bat_dau ? String(saved.ngay_bat_dau).slice(0, 10) : "";
      const ngayKetThuc = saved?.ngay_ket_thuc ? String(saved.ngay_ket_thuc).slice(0, 10) : "";
      const baseDays = days.length ? days : base.nkks_ngays;
      return buildNkksNgaysFromRange(ngayBatDau, ngayKetThuc, baseDays) || baseDays;
    })(),
  };
}

export function buildNkksDbPayload(formData, nvksGocId, klSnapshot = {}) {
  const days = normalizeNkksDays(formData.nkks_ngays).filter((row) =>
    NKKS_DAY_FIELDS.some((k) => isNkksDayFieldFilled(row, k))
  );

  return {
    ma_du_an: formData.ma_du_an,
    nvks_id: nvksGocId,
    ten_du_an: formData.ten_du_an || formData.ten_cong_trinh || "",
    dia_diem: formData.dia_diem || "",
    loai_hinh: formData.loai_hinh || formData.hang_muc || "",
    hang_muc: formData.hang_muc || formData.loai_hinh || "",
    chu_dau_tu: normalizeChuDauTu(formData.chu_dau_tu || ""),
    nha_thau_ks: formData.nha_thau_ks || DEFAULT_NHA_THAU_KS,
    nha_thau_tvgs: formData.nha_thau_tvgs || "",
    goi_thau: formData.goi_thau || "",
    ngay_bat_dau: formData.ngay_bat_dau || null,
    ngay_ket_thuc: formData.ngay_ket_thuc || null,
    nhan_luc: formData.nhan_luc || "",
    may_moc_thiet_bi: formData.may_moc_thiet_bi || "",
    bang_khoi_luong: normalizeBangKhoiLuong(klSnapshot.rows || formData.bang_khoi_luong),
    nvks_kl_source_id: klSnapshot.klSourceId || formData.nvks_kl_source_id || null,
    nvks_kl_source_label: klSnapshot.klSourceLabel || formData.nvks_kl_source_label || "",
    chi_tiet_nhat_ky: days,
    trang_thai_nkks: formData.trang_thai_nkks || "dang_lap",
    updated_at: new Date().toISOString(),
  };
}

export function countFilledNkksDays(rows) {
  return normalizeNkksDays(rows).filter((row) =>
    NKKS_DAY_FIELDS.some((k) => isNkksDayFieldFilled(row, k))
  ).length;
}

/** Số ngày đủ điều kiện xuất — khoảng ngày: có ngày KS; thủ công: có nội dung ghi */
export function countNkksDaysForExport(rows, ngayBatDau, ngayKetThuc) {
  const normalized = normalizeNkksDays(rows);
  if (isNkksDateRangeActive(ngayBatDau, ngayKetThuc)) {
    return normalized.filter((row) => String(row.ngay_khao_sat || "").slice(0, 10)).length;
  }
  return countFilledNkksDays(rows);
}
