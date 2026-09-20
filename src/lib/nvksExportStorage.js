/**
 * Upload file xuất NVKS (Word/PDF) lên Supabase Storage.
 */

import {
  buildExportLocalFileName,
  extractFileNameFromUrl,
  formatExportDisplayTime,
  splitExportLocalFileName,
} from "./exportFileNaming";

export const NVKS_EXPORT_BUCKET = "exports_nvks";

/** Chuẩn hóa chuỗi thành segment thư mục Storage an toàn */
export function cleanForFileName(str) {
  if (!str) return "NVKS";
  let cleaned = str
    .replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a")
    .replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e")
    .replace(/ì|í|ị|ỉ|ĩ/g, "i")
    .replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o")
    .replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u")
    .replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y")
    .replace(/đ/g, "d")
    .replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A")
    .replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E")
    .replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I")
    .replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O")
    .replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U")
    .replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_");
  return cleaned.replace(/^_|_$/g, "") || "NVKS";
}

export function resolvePhienBanFileSuffix(phienBan, soLanDc) {
  if (!phienBan || phienBan === "GỐC") return "";
  const n = Number(soLanDc) || 0;
  if (n > 0) return `DC${n}`;
  if (String(phienBan).toUpperCase().includes("ĐIỀU CHỈNH") || phienBan === "DC") return "DC";
  return String(phienBan).replace(/\s+/g, "");
}

/** Tên gốc hiển thị — lấy từ mã dự án (+ hậu tố phiên bản ĐC), không gồm tên người */
export function buildNvksExportBaseName(formData) {
  const ma = String(formData?.ma_du_an || "").trim();
  const base = ma || String(formData?.ten_du_an || "NVKS").trim() || "NVKS";
  const pb = resolvePhienBanFileSuffix(formData?.phien_ban, formData?.so_lan_dc);
  if (pb) return `${base}-${pb}`;
  return base;
}

/** @deprecated dùng buildNvksExportFileNames */
export function buildNvksDownloadFileName(formData, { timestamp, ext = "docx" } = {}) {
  return buildNvksExportFileNames(formData, { timestamp, ext }).localFileName;
}

export function buildNvksExportFileNames(formData, { timestamp, ext = "docx" } = {}) {
  const baseName = buildNvksExportBaseName(formData);
  return buildExportLocalFileName(baseName, { timestamp, ext });
}

/** Đường dẫn trong bucket: {ma_du_an}/{fileName} */
export function buildNvksExportStoragePath(formData, fileName) {
  const folder = cleanForFileName(formData.ma_du_an || formData.ten_du_an);
  return `${folder}/${fileName}`;
}

export async function uploadNvksExportBlob(supabase, blob, storagePath, contentType) {
  const mime =
    contentType ||
    (storagePath.endsWith(".pdf")
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  const { error } = await supabase.storage.from(NVKS_EXPORT_BUCKET).upload(storagePath, blob, {
    cacheControl: "3600",
    upsert: true,
    contentType: mime,
  });
  if (error) {
    throw new Error(`Lỗi khi tải file lên Storage: ${error.message}`);
  }
  const { data } = supabase.storage.from(NVKS_EXPORT_BUCKET).getPublicUrl(storagePath);
  return data?.publicUrl || "";
}

/** Upload PDF trình ký (sau In/PDF) — ghi link_pdf_xuat. */
export async function uploadNvksPhatHanhPdf(supabase, file, formData) {
  const ts = Date.now();
  const { localFileName, displayName } = buildNvksExportFileNames(formData, {
    timestamp: ts,
    ext: "pdf",
  });
  const storagePath = buildNvksExportStoragePath(formData, localFileName);
  const { error } = await supabase.storage.from(NVKS_EXPORT_BUCKET).upload(storagePath, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: "application/pdf",
  });
  if (error) throw new Error(`Lỗi upload PDF để trình ký: ${error.message}`);
  const { data } = supabase.storage.from(NVKS_EXPORT_BUCKET).getPublicUrl(storagePath);
  return {
    storagePath,
    storageUrl: data?.publicUrl || "",
    fileName: localFileName,
    displayName,
    exportedAt: new Date(ts).toISOString(),
  };
}

export async function uploadNvksSignedPdf(supabase, file, formData) {
  const ts = Date.now();
  const { localFileName } = buildNvksExportFileNames(formData, {
    timestamp: ts,
    ext: "pdf",
  });
  const base = localFileName.replace(/\.pdf$/i, "_DA_KY.pdf");
  const storagePath = buildNvksExportStoragePath(formData, base);
  const { error } = await supabase.storage.from(NVKS_EXPORT_BUCKET).upload(storagePath, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: "application/pdf",
  });
  if (error) throw new Error(`Lỗi upload PDF đã ký: ${error.message}`);
  const { data } = supabase.storage.from(NVKS_EXPORT_BUCKET).getPublicUrl(storagePath);
  return { storagePath, storageUrl: data?.publicUrl || "", fileName: base };
}

export function parseNvksExportLink(url, exportedAt) {
  const localFileName = extractFileNameFromUrl(url);
  const parts = splitExportLocalFileName(localFileName);
  if (!parts.displayTime && exportedAt) {
    parts.displayTime = formatExportDisplayTime(exportedAt);
  }
  return parts;
}
