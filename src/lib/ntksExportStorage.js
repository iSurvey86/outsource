import { cleanForFileName, uploadNvksExportBlob } from "./nvksExportStorage";
import { getNtksFormDef } from "./ntksFormRegistry";

export function buildNtksDownloadFileName(formData, formKey, { timestamp, ext = "docx" } = {}) {
  const def = getNtksFormDef(formKey);
  const prefix = def?.exportPrefix || "NTKS";
  const safeMa = cleanForFileName(formData.ma_du_an || formData.ten_du_an || "NTKS");
  const ts = timestamp ?? Date.now();
  return `${safeMa}_${prefix}_${ts}.${ext}`;
}

export function buildNtksExportStoragePath(formData, fileName) {
  const folder = cleanForFileName(formData.ma_du_an || formData.ten_du_an || "NTKS");
  return `${folder}/${fileName}`;
}

export async function uploadNtksExportBlob(supabase, blob, storagePath, contentType) {
  return uploadNvksExportBlob(supabase, blob, storagePath, contentType);
}
