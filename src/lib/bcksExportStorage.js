/**
 * Upload file xuất BCKS — dùng bucket exports_nvks (cùng NVKS/PAKTKS/NKKS).
 */
import { cleanForFileName, uploadNvksExportBlob } from "./nvksExportStorage";

export function buildBcksDownloadFileName(formData, { timestamp, ext = "docx" } = {}) {
  const safeMa = cleanForFileName(formData.ma_du_an || formData.ten_du_an || "BCKS");
  const ts = timestamp ?? Date.now();
  return `${safeMa}_BCKS_RTK_${ts}.${ext}`;
}

export function buildBcksExportStoragePath(formData, fileName) {
  const folder = cleanForFileName(formData.ma_du_an || formData.ten_du_an || "BCKS");
  return `${folder}/${fileName}`;
}

export async function uploadBcksExportBlob(supabase, blob, storagePath, contentType) {
  return uploadNvksExportBlob(supabase, blob, storagePath, contentType);
}
