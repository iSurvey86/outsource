/**
 * Upload file xuất PAKTKS (Word/PDF) — dùng bucket exports_nvks.
 */
import {
  cleanForFileName,
  NVKS_EXPORT_BUCKET,
  resolvePhienBanFileSuffix,
  uploadNvksExportBlob,
} from "./nvksExportStorage";

export { NVKS_EXPORT_BUCKET as PAKTKS_EXPORT_BUCKET };

export function buildPaktkDownloadFileName(formData, { timestamp, ext = "docx" } = {}) {
  const safeMa = cleanForFileName(formData.ma_du_an || formData.ten_du_an);
  const giaiDoan = cleanForFileName((formData.giai_doan || "PAKTKS").toUpperCase());
  const pb = resolvePhienBanFileSuffix(formData.phien_ban, formData.so_lan_dc);
  const ts = timestamp ?? Date.now();
  return `${safeMa}_PAKTKS_${pb}_${giaiDoan}_${ts}.${ext}`;
}

export function buildPaktkExportStoragePath(formData, fileName) {
  const folder = cleanForFileName(formData.ma_du_an || formData.ten_du_an);
  return `${folder}/${fileName}`;
}

export async function uploadPaktkExportBlob(supabase, blob, storagePath, contentType) {
  return uploadNvksExportBlob(supabase, blob, storagePath, contentType);
}

export async function uploadPaktkSignedPdf(supabase, file, formData) {
  const ts = Date.now();
  const localFileName = buildPaktkDownloadFileName(formData, { timestamp: ts, ext: "pdf" });
  const signedName = localFileName.replace(/\.pdf$/i, "_DA_KY.pdf");
  const storagePath = buildPaktkExportStoragePath(formData, signedName);
  const { error } = await supabase.storage.from(NVKS_EXPORT_BUCKET).upload(storagePath, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: "application/pdf",
  });
  if (error) throw new Error(`Lỗi upload PDF đã ký: ${error.message}`);
  const { data } = supabase.storage.from(NVKS_EXPORT_BUCKET).getPublicUrl(storagePath);
  return { storagePath, storageUrl: data?.publicUrl || "", fileName: signedName };
}
