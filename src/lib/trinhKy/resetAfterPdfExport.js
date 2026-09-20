/**
 * Client-safe: reset chuỗi trình ký sau khi xuất PDF mới.
 * Không import service.js (nodemailer / Node builtins).
 */
import { HO_SO_KY_STATUS, TRINH_KY_MODULE_NVKS } from "./constants";
import { getTrinhKyModuleConfig } from "./modules";

/**
 * Xuất PDF mới sau khi đã ký nội bộ → reset chuỗi trình ký trên hồ sơ.
 * Giữ link PDF đã ký (+ký / +ký dấu); phiên cũ vẫn trong Hộp chờ ký / Hồ sơ đã ký.
 * @returns {Promise<boolean>} true nếu đã reset
 */
export async function resetTrinhKyAfterPdfExport(supabase, { module, hoSoId, trangThaiKy }) {
  if (trangThaiKy !== HO_SO_KY_STATUS.DA_KY || !hoSoId) return false;
  const cfg = getTrinhKyModuleConfig(module || TRINH_KY_MODULE_NVKS);
  const { error } = await supabase
    .from(cfg.table)
    .update({
      trang_thai_ky_noi_bo: HO_SO_KY_STATUS.CHUA_TRINH,
      trinh_ky_id: null,
    })
    .eq("id", hoSoId);
  if (error) throw error;
  return true;
}
