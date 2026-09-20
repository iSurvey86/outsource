/**
 * DOCX → PDF: ưu tiên LibreOffice (giữ mẫu Word/trang bìa),
 * fallback ConvertAPI khi máy chủ không có soffice.
 *
 * Env: CONVERTAPI_SECRET — dùng khi LibreOffice không khả dụng (Vercel).
 *      NVKS_PDF_PREFER_LIBREOFFICE=1 — luôn thử LibreOffice trước.
 */

function getConvertApiSecret() {
  return (
    process.env.CONVERTAPI_SECRET ||
    process.env.CONVERT_API_SECRET ||
    process.env.CONVERT_API_TOKEN ||
    ""
  ).trim();
}

function isConvertApiQuotaError(message) {
  return /403|402|quota|remaining|expired|trial|no conversions/i.test(String(message || ""));
}

async function convertViaConvertApi(docxBuffer) {
  const secret = getConvertApiSecret();
  if (!secret) return null;

  const res = await fetch("https://v2.convertapi.com/convert/docx/to/pdf", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      Parameters: [
        {
          Name: "File",
          FileValue: {
            Name: "export.docx",
            Data: Buffer.from(docxBuffer).toString("base64"),
          },
        },
        { Name: "StoreFile", Value: "false" },
      ],
    }),
  });

  const rawText = await res.text();
  let data = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const apiMsg =
      data?.Message || data?.message || data?.Error || rawText?.slice(0, 400) || res.statusText;
    throw new Error(`ConvertAPI lỗi ${res.status}: ${apiMsg}`);
  }

  const file = data?.Files?.[0];
  if (file?.FileData) {
    const pdfBuffer = Buffer.from(file.FileData, "base64");
    if (!pdfBuffer.length) throw new Error("ConvertAPI trả FileData rỗng");
    return pdfBuffer;
  }

  if (file?.Url) {
    const pdfRes = await fetch(file.Url);
    if (!pdfRes.ok) {
      throw new Error(`ConvertAPI tải PDF thất bại (${pdfRes.status})`);
    }
    const ab = await pdfRes.arrayBuffer();
    const pdfBuffer = Buffer.from(ab);
    if (!pdfBuffer.length) throw new Error("ConvertAPI URL trả PDF rỗng");
    return pdfBuffer;
  }

  throw new Error("ConvertAPI không trả FileData/Url trong phản hồi");
}

async function convertViaLibreOffice(docxBuffer) {
  const { promisify } = await import("util");
  const libre = (await import("libreoffice-convert")).default;
  const convert = promisify(libre.convert);
  return convert(docxBuffer, ".pdf", undefined);
}

async function tryLibreOffice(docxBuffer) {
  const pdfBuffer = await convertViaLibreOffice(docxBuffer);
  if (!pdfBuffer?.length) throw new Error("Kết quả LibreOffice rỗng");
  return pdfBuffer;
}

async function tryConvertApi(docxBuffer) {
  const pdfBuffer = await convertViaConvertApi(docxBuffer);
  if (!pdfBuffer?.length) throw new Error("Kết quả ConvertAPI rỗng");
  return pdfBuffer;
}

/**
 * Chuyển buffer DOCX → PDF.
 * @returns {Promise<Buffer>}
 */
export async function convertDocxBufferToPdf(docxBuffer) {
  const hasConvertApi = Boolean(getConvertApiSecret());
  const preferLo = process.env.NVKS_PDF_PREFER_LIBREOFFICE === "1";

  if (preferLo || !hasConvertApi) {
    try {
      return await tryLibreOffice(docxBuffer);
    } catch (loErr) {
      const loMsg = loErr?.message || String(loErr);
      if (hasConvertApi) {
        try {
          return await tryConvertApi(docxBuffer);
        } catch (apiErr) {
          throw new Error(
            `Không convert được PDF.\n\nLibreOffice: ${loMsg}\n\nConvertAPI: ${apiErr?.message || apiErr}`
          );
        }
      }
      if (/libreoffice|soffice|ENOENT|spawn/i.test(loMsg)) {
        throw new Error(
          "Không convert được PDF — máy chủ chưa có LibreOffice và chưa cấu hình ConvertAPI.\n\n" +
            "Dev local: cài LibreOffice (soffice trong PATH).\n" +
            "Production: thêm CONVERTAPI_SECRET hoặc NVKS_PDF_PREFER_LIBREOFFICE=0.\n\n" +
            `Chi tiết: ${loMsg}`
        );
      }
      throw new Error(`Lỗi convert DOCX sang PDF: ${loMsg}`);
    }
  }

  try {
    return await tryConvertApi(docxBuffer);
  } catch (apiErr) {
    const apiMsg = apiErr?.message || String(apiErr);
    if (isConvertApiQuotaError(apiMsg)) {
      try {
        return await tryLibreOffice(docxBuffer);
      } catch (loErr) {
        throw new Error(
          `ConvertAPI hết quota — LibreOffice cũng không dùng được.\n\nConvertAPI: ${apiMsg}\n\nLibreOffice: ${loErr?.message || loErr}`
        );
      }
    }
    throw new Error(`Không convert được PDF qua ConvertAPI.\n\n${apiMsg}`);
  }
}
