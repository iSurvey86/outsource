/**
 * Upload / quản lý ảnh chữ ký nhân sự (client).
 * loai: "chinh" | "nhay"
 * Slot "nhay": NL/CNKS = ký nháy; BGĐ = ký dấu (ảnh ghép dấu đỏ + chữ ký).
 */

import { supabase } from "./supabase";
import { isBanGiamDoc } from "./phanCongPermissions";
import { CHU_KY_ACCEPT, CHU_KY_BUCKET, CHU_KY_MAX_BYTES } from "./trinhKy/constants";
import { normalizeVnPhone } from "./trinhKy/steps";

export { CHU_KY_ACCEPT, CHU_KY_BUCKET, CHU_KY_MAX_BYTES };

/** Nhãn slot ảnh thứ 2 theo quyền / vai trò bước ký */
export function labelChuKySlot2(userOrOpts) {
  if (userOrOpts === "lanh_dao" || userOrOpts?.vai_tro === "lanh_dao") return "ký dấu";
  if (userOrOpts && typeof userOrOpts === "object" && isBanGiamDoc(userOrOpts)) return "ký dấu";
  return "ký nháy";
}

/** Gợi ý kích thước upload slot 2 */
export function hintChuKySlot2Size(userOrOpts) {
  return labelChuKySlot2(userOrOpts) === "ký dấu" ? "~420×180 px (dấu + chữ ký)" : "~220×110 px";
}

export function validateChuKyFile(file) {
  if (!file) return { ok: false, message: "Chưa chọn file." };
  if (file.size > CHU_KY_MAX_BYTES) {
    return { ok: false, message: "Ảnh chữ ký tối đa 1 MB." };
  }
  const mime = file.type || "";
  if (mime && !/^image\/(png|jpeg|webp)$/i.test(mime)) {
    return { ok: false, message: "Chỉ chấp nhận PNG, JPG hoặc WEBP." };
  }
  return { ok: true };
}

/** @param {"chinh"|"nhay"} loai */
export function buildChuKyStoragePath(maNv, fileName, loai = "chinh") {
  const ext = (fileName?.split(".")?.pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const safeId = String(maNv || "NV").replace(/[^a-zA-Z0-9]/g, "");
  const base = loai === "nhay" ? "chu_ky_nhay" : "chu_ky";
  return `${safeId}/${base}.${ext === "jpeg" ? "jpg" : ext}`;
}

/** @param {"chinh"|"nhay"} loai */
export async function uploadChuKyNhanSu(file, maNv, loai = "chinh") {
  const check = validateChuKyFile(file);
  if (!check.ok) throw new Error(check.message);

  const path = buildChuKyStoragePath(maNv, file.name, loai);
  const contentType = file.type || "image/png";
  const { error: uploadError } = await supabase.storage.from(CHU_KY_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType,
  });
  if (uploadError) throw new Error(`Không tải chữ ký lên: ${uploadError.message}`);

  const patch =
    loai === "nhay"
      ? { chu_ky_nhay_path: path, chu_ky_nhay_updated_at: new Date().toISOString() }
      : { chu_ky_path: path, chu_ky_updated_at: new Date().toISOString() };

  const { error: updateError } = await supabase.from("NHAN_SU").update(patch).eq("ma_nv", maNv);
  if (updateError) throw new Error(updateError.message);

  return path;
}

/** @param {"chinh"|"nhay"} loai */
export async function removeChuKyNhanSu(maNv, path, loai = "chinh") {
  if (path) {
    await supabase.storage.from(CHU_KY_BUCKET).remove([path]).catch(() => {});
  }
  const patch =
    loai === "nhay"
      ? { chu_ky_nhay_path: null, chu_ky_nhay_updated_at: new Date().toISOString() }
      : { chu_ky_path: null, chu_ky_updated_at: new Date().toISOString() };
  const { error } = await supabase.from("NHAN_SU").update(patch).eq("ma_nv", maNv);
  if (error) throw new Error(error.message);
}

export async function updateNhanSuSdt(maNv, sdtRaw) {
  const sdt = normalizeVnPhone(sdtRaw);
  if (!sdt) throw new Error("Số điện thoại không hợp lệ (cần 10–11 số, bắt đầu bằng 0).");
  const { error } = await supabase.from("NHAN_SU").update({ sdt }).eq("ma_nv", maNv);
  if (error) throw new Error(error.message);
  return sdt;
}

export async function fetchChuKySignedUrl(path) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(CHU_KY_BUCKET).createSignedUrl(path, 3600);
  if (error) return null;
  return data?.signedUrl || null;
}
