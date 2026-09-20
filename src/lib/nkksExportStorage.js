/**
 * Upload file xuất NKKS — dùng bucket exports_nvks (cùng NVKS/PAKTKS).
 * Quy tắc tên: `{ma}-NKKS-{yyyyMMdd-HHmmss}.{ext}` — hiển thị `{ma}-NKKS.{ext}` + ngày tách.
 */
import {
  buildExportLocalFileName,
  extractFileNameFromUrl,
  formatExportDisplayTime,
  splitExportLocalFileName,
} from "./exportFileNaming";
import {
  cleanForFileName,
  uploadNvksExportBlob,
} from "./nvksExportStorage";

/** Tên gốc hiển thị — mã dự án + hậu tố NKKS */
export function buildNkksExportBaseName(formData) {
  const ma = String(formData?.ma_du_an || "").trim();
  const base = ma || String(formData?.ten_du_an || formData?.ten_cong_trinh || "NKKS").trim() || "NKKS";
  if (/[-_]NKKS$/i.test(base)) return base;
  return `${base}-NKKS`;
}

export function buildNkksExportFileNames(formData, { timestamp, ext = "docx" } = {}) {
  const baseName = buildNkksExportBaseName(formData);
  return buildExportLocalFileName(baseName, { timestamp, ext });
}

/** @deprecated dùng buildNkksExportFileNames — giữ tương thích */
export function buildNkksDownloadFileName(formData, { timestamp, ext = "docx" } = {}) {
  return buildNkksExportFileNames(formData, { timestamp, ext }).localFileName;
}

export function buildNkksExportStoragePath(formData, fileName) {
  const folder = cleanForFileName(formData.ma_du_an || formData.ten_du_an || "NKKS");
  return `${folder}/${fileName}`;
}

export async function uploadNkksExportBlob(supabase, blob, storagePath, contentType) {
  return uploadNvksExportBlob(supabase, blob, storagePath, contentType);
}

export function parseNkksExportLink(url, exportedAt) {
  const localFileName = extractFileNameFromUrl(url);
  const parts = splitExportLocalFileName(localFileName);
  if (!parts.displayTime && exportedAt) {
    parts.displayTime = formatExportDisplayTime(exportedAt);
  }
  return parts;
}
