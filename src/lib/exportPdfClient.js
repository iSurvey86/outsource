/**
 * Client: gửi DOCX lên /api/export-nvks-pdf → PDF chuẩn (LibreOffice / ConvertAPI).
 */
import { saveAs } from "file-saver";

/**
 * @param {Blob} docxBlob
 * @param {{ fileName?: string }} [opts]
 * @returns {Promise<Blob>}
 */
export async function convertDocxBlobToPdfBlob(docxBlob, opts = {}) {
  const fileName = String(opts.fileName || "export.pdf").replace(/\.docx$/i, ".pdf");

  const fd = new FormData();
  fd.append("file", docxBlob, fileName.replace(/\.pdf$/i, ".docx"));
  fd.append("fileName", fileName);

  const res = await fetch("/api/export-nvks-pdf", { method: "POST", body: fd });
  if (!res.ok) {
    let msg = `Convert PDF thất bại (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) msg = data.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }

  const pdfBlob = await res.blob();
  if (!pdfBlob?.size) throw new Error("Máy chủ trả PDF rỗng.");
  return pdfBlob;
}

/**
 * Convert (+ tùy chọn tải về / mở tab). Mặc định: chỉ trả blob — xem/tải ở File xuất trên form.
 * @param {Blob} docxBlob
 * @param {{ fileName?: string, download?: boolean, openAfterDownload?: boolean }} [opts]
 * @returns {Promise<Blob>}
 */
export async function convertDocxBlobToPdfDownload(docxBlob, opts = {}) {
  const fileName = String(opts.fileName || "export.pdf").replace(/\.docx$/i, ".pdf");
  const doDownload = opts.download === true;
  const openAfter = doDownload && opts.openAfterDownload !== false;

  const pdfBlob = await convertDocxBlobToPdfBlob(docxBlob, { fileName });

  if (doDownload) {
    saveAs(pdfBlob, fileName);
  }

  if (openAfter && typeof window !== "undefined") {
    const url = URL.createObjectURL(pdfBlob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 180000);
  }

  return pdfBlob;
}
