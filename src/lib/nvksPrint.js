/**
 * In/PDF qua trình duyệt (docx-preview) — chỉ dùng khi không convert được server.
 * NVKS / PAKTKS / NKKS: ưu tiên /api/export-nvks-pdf (LibreOffice) qua exportPdfClient.
 */
import { renderAsync } from "docx-preview";

const IFRAME_ID = "idescon-nvks-print-frame";

const PRINT_CSS = `
  @page {
    size: A4 portrait;
    margin: 15mm 12mm 15mm 12mm;
  }
  @media print {
    @page {
      size: A4 portrait;
      margin: 15mm 12mm 15mm 12mm;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
      width: 100% !important;
    }
    .docx-wrapper {
      background: #fff !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    .docx-wrapper > section.docx {
      box-shadow: none !important;
      margin: 0 auto !important;
      page-break-after: always;
      break-after: page;
    }
    .docx-wrapper > section.docx:last-child {
      page-break-after: auto;
      break-after: auto;
    }
  }
  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
    color: #000;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    font-family: "Times New Roman", Times, serif;
  }
  .docx-wrapper {
    background: #fff !important;
    padding: 0 !important;
    margin: 0 !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
  }
  .docx-wrapper > section.docx {
    box-shadow: none !important;
    margin: 0 auto 12px auto !important;
    background: #fff !important;
    box-sizing: border-box !important;
  }
  /* Giữ bố cục bảng / ô chữ ký sát Word */
  .docx-wrapper table {
    border-collapse: collapse !important;
  }
  .docx-wrapper td, .docx-wrapper th {
    vertical-align: top;
  }
  .docx-wrapper p {
    margin-top: 0;
    margin-bottom: 0;
  }
  .docx-wrapper img {
    max-width: 100%;
    height: auto;
  }
`;

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Mở hộp thoại In — user chọn máy in hoặc «Lưu dưới dạng PDF» (A4).
 * @param {Blob} docxBlob
 * @param {{ title?: string }} [opts]
 */
/** In/PDF từ blob Word — dùng chung NVKS / PAKTKS / NKKS / NTKS. */
export async function printDocxBlob(docxBlob, { title = "Hồ sơ khảo sát" } = {}) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Chỉ in được trên trình duyệt.");
  }

  document.getElementById(IFRAME_ID)?.remove();

  const iframe = document.createElement("iframe");
  iframe.id = IFRAME_ID;
  iframe.setAttribute("title", "In NVKS");
  // ~A4 @ 96dpi để docx-preview đo layout gần Word hơn
  iframe.style.cssText =
    "position:fixed;left:-14000px;top:0;width:794px;height:1123px;border:0;opacity:0;pointer-events:none;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc || !iframe.contentWindow) {
    iframe.remove();
    throw new Error("Không tạo được khung in trên trình duyệt.");
  }

  doc.open();
  doc.write(
    `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><style>${PRINT_CSS}</style></head><body></body></html>`
  );
  doc.close();

  await renderAsync(docxBlob, doc.body, doc.head, {
    className: "docx",
    inWrapper: true,
    hideWrapperOnPrint: true,
    ignoreWidth: false,
    ignoreHeight: false,
    breakPages: true,
    ignoreLastRenderedPageBreak: false,
    experimental: true,
    useBase64URL: true,
    renderHeaders: true,
    renderFooters: true,
    renderFootnotes: true,
    renderEndnotes: true,
  });

  // Chờ font / layout ổn định trước khi mở hộp thoại in
  await new Promise((resolve) => setTimeout(resolve, 700));
  try {
    if (doc.fonts?.ready) await doc.fonts.ready;
  } catch {
    /* ignore */
  }

  iframe.contentWindow.focus();
  iframe.contentWindow.print();

  setTimeout(() => document.getElementById(IFRAME_ID)?.remove(), 120000);

  return { ok: true };
}

/** @deprecated alias — dùng printDocxBlob */
export const printNvksDocx = printDocxBlob;
