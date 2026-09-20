import { TRINH_KY_MODULE_NVKS, TRINH_KY_MODULE_PAKTKS } from "./constants";

/** Cấu hình bảng hồ sơ theo module trình ký */
export const TRINH_KY_MODULE_CONFIG = {
  [TRINH_KY_MODULE_NVKS]: {
    table: "HO_SO_NVKS",
    /** Phân hệ nhật ký QLHT (`LICHSU_HOATDONG.phan_he`) */
    phanHe: "NVKS",
    label: "NVKS",
    khoModuleLoai: "nvks",
    stampModule: "nvks",
    signedFileTag: "NVKS_ky",
    signedFileTagKyDau: "NVKS_ky_dau",
    otpEmailLabel: "NVKS",
    missingHoSoError: "Không tìm thấy hồ sơ NVKS.",
    missingHoSoIdError: "Thiếu mã hồ sơ NVKS.",
    selectFields:
      "id, ma_du_an, link_pdf_xuat, trang_thai_ky_noi_bo, trinh_ky_id, nguoi_lap, chu_nhiem_ks, lanh_dao_duyet",
  },
  [TRINH_KY_MODULE_PAKTKS]: {
    table: "HO_SO_PAKTKS",
    phanHe: "PAKTKS",
    label: "PAKTKS",
    khoModuleLoai: "paktks",
    stampModule: "paktks",
    signedFileTag: "PAKTKS_ky",
    signedFileTagKyDau: "PAKTKS_ky_dau",
    otpEmailLabel: "PAKTKS",
    missingHoSoError: "Không tìm thấy hồ sơ PAKTKS.",
    missingHoSoIdError: "Thiếu mã hồ sơ PAKTKS.",
    selectFields:
      "id, ma_du_an, link_pdf_xuat, trang_thai_ky_noi_bo, trinh_ky_id, nguoi_lap, chu_nhiem_ks, lanh_dao_duyet",
  },
};

export function getTrinhKyModuleConfig(module) {
  const key = module || TRINH_KY_MODULE_NVKS;
  const cfg = TRINH_KY_MODULE_CONFIG[key];
  if (!cfg) throw new Error(`Module trình ký không hỗ trợ: ${module}`);
  return { module: key, ...cfg };
}
