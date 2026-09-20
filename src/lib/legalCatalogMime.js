/**
 * MIME / loại file cho danh mục pháp lý (upload + Scan AI).
 */

export const LEGAL_CATALOG_ACCEPT_INPUT =
  ".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Gemini inline data — giữ dưới ~20 MB */
export const GEMINI_MAX_INLINE_BYTES = 18 * 1024 * 1024;

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOC_MIME = "application/msword";

export function resolveLegalCatalogMimeType(file) {
  const type = String(file?.type || "").toLowerCase();
  if (type === "application/pdf") return "application/pdf";
  if (type === DOCX_MIME) return DOCX_MIME;
  if (type === DOC_MIME) return DOC_MIME;
  if (type === "image/jpeg" || type === "image/jpg") return "image/jpeg";
  if (type === "image/png") return "image/png";
  if (type === "image/webp") return "image/webp";

  const name = String(file?.name || "").toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".docx")) return DOCX_MIME;
  if (name.endsWith(".doc")) return DOC_MIME;
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";

  return "application/pdf";
}

export function resolveLegalCatalogContentType(file) {
  return resolveLegalCatalogMimeType(file) || "application/octet-stream";
}

export function isLegalCatalogPdfMime(mimeType) {
  return mimeType === "application/pdf";
}

export function isLegalCatalogDocxMime(mimeType) {
  return mimeType === DOCX_MIME;
}

export function isLegalCatalogDocMime(mimeType) {
  return mimeType === DOC_MIME;
}

export function isLegalCatalogWordMime(mimeType) {
  return isLegalCatalogDocxMime(mimeType) || isLegalCatalogDocMime(mimeType);
}

export function isLegalCatalogImageMime(mimeType) {
  return String(mimeType || "").startsWith("image/");
}

export function formatFileSizeMb(bytes) {
  return `${(Number(bytes || 0) / (1024 * 1024)).toFixed(1)} MB`;
}
