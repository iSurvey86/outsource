import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import * as XLSX from "xlsx";
import {
  formatFileSizeMb,
  GEMINI_MAX_INLINE_BYTES,
  isLegalCatalogImageMime,
  isLegalCatalogPdfMime,
} from "../../../lib/legalCatalogMime";
import {
  buildBcksKqPrompt,
  excelAoaToPromptText,
  isBcksKqFormKey,
  normalizeBcksKqPayload,
} from "../../../lib/bcksKqScan";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const XLS_MIME = "application/vnd.ms-excel";

function buildParseErrorMessage(error) {
  const message = String(error?.message || error || "");
  const status = error?.status ?? error?.code ?? error?.error?.code;

  if (status === 503 || /503|UNAVAILABLE|high demand/i.test(message)) {
    return "Dịch vụ AI (Gemini) đang quá tải tạm thời. Vui lòng thử lại sau 1–2 phút.";
  }
  if (status === 429 || /429|quota|rate limit|RESOURCE_EXHAUSTED/i.test(message)) {
    return "Hết quota/rate limit API AI. Chờ vài giây rồi thử lại.";
  }
  if (status === 401 || status === 403 || /API key|API_KEY|permission/i.test(message)) {
    return "Cấu hình khóa API AI không hợp lệ. Liên hệ quản trị.";
  }
  if (status === 400 || /INVALID_ARGUMENT/i.test(message)) {
    return "File không hợp lệ hoặc quá lớn cho AI (tối đa khoảng 20 MB). Thử nén hoặc nhập thủ công.";
  }
  if (error instanceof SyntaxError || /JSON\.parse|Unexpected token/i.test(message)) {
    return "AI trả về dữ liệu không đúng định dạng. Vui lòng thử quét lại hoặc nhập thủ công.";
  }
  return `Không quét được file: ${message.slice(0, 180)}`;
}

function resolveBcksKqMime(file) {
  const type = String(file?.type || "").toLowerCase();
  const name = String(file?.name || "").toLowerCase();
  if (type === "application/pdf" || name.endsWith(".pdf")) return "application/pdf";
  if (type === "image/jpeg" || type === "image/jpg" || name.endsWith(".jpg") || name.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (type === "image/png" || name.endsWith(".png")) return "image/png";
  if (type === "image/webp" || name.endsWith(".webp")) return "image/webp";
  if (type === XLSX_MIME || name.endsWith(".xlsx")) return XLSX_MIME;
  if (type === XLS_MIME || name.endsWith(".xls") || name.endsWith(".csv")) {
    return name.endsWith(".csv") ? "text/csv" : XLS_MIME;
  }
  return type || "application/octet-stream";
}

function isExcelMime(mime) {
  return mime === XLSX_MIME || mime === XLS_MIME || mime === "text/csv";
}

function parseJsonFromAi(text) {
  let aiText = String(text || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const jsonMatch = aiText.match(/\{[\s\S]*\}/);
  if (jsonMatch) aiText = jsonMatch[0];
  return JSON.parse(aiText);
}

async function callGeminiJson(apiKey, parts) {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash-lite",
    contents: [{ role: "user", parts }],
    config: {
      responseMimeType: "application/json",
    },
  });
  return parseJsonFromAi(response.text || "");
}

export async function POST(request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Chưa cấu hình GEMINI_API_KEY." }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const formKey = String(formData.get("form_key") || "").trim();

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Thiếu file kết quả lab." }, { status: 400 });
    }
    if (!isBcksKqFormKey(formKey)) {
      return NextResponse.json(
        { error: "Tab biểu mẫu không hỗ trợ ScanKQ (chọn Cơ lý / TN nước / TN đá / Đo ĐTS)." },
        { status: 400 }
      );
    }

    const mimeType = resolveBcksKqMime(file);
    const ok =
      isLegalCatalogPdfMime(mimeType) ||
      isLegalCatalogImageMime(mimeType) ||
      isExcelMime(mimeType);
    if (!ok) {
      return NextResponse.json(
        { error: "Chỉ hỗ trợ PDF, ảnh (PNG/JPG/WebP) hoặc Excel (.xlsx/.xls)." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!isExcelMime(mimeType) && buffer.length > GEMINI_MAX_INLINE_BYTES) {
      return NextResponse.json(
        {
          error: `File quá lớn (${formatFileSizeMb(buffer.length)}). AI nhận PDF/ảnh tối đa ~20 MB.`,
        },
        { status: 400 }
      );
    }

    const prompt = buildBcksKqPrompt(formKey);
    let raw;

    if (isExcelMime(mimeType)) {
      const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) {
        return NextResponse.json({ error: "File Excel không có sheet." }, { status: 400 });
      }
      const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
        header: 1,
        defval: "",
        raw: false,
      });
      const tableText = excelAoaToPromptText(aoa);
      if (!tableText.trim()) {
        return NextResponse.json({ error: "Sheet Excel trống hoặc không đọc được." }, { status: 400 });
      }
      raw = await callGeminiJson(apiKey, [
        { text: `${prompt}\n\n--- NỘI DUNG BẢNG EXCEL (sheet: ${sheetName}) ---\n${tableText}` },
      ]);
    } else {
      raw = await callGeminiJson(apiKey, [
        { inlineData: { mimeType, data: buffer.toString("base64") } },
        { text: prompt },
      ]);
    }

    const normalized = normalizeBcksKqPayload(formKey, raw);
    return NextResponse.json({
      ok: true,
      form_key: formKey,
      data: normalized.data,
      confidence: normalized.confidence,
      warning: normalized.warning,
      stats: normalized.stats,
    });
  } catch (error) {
    console.error("parse-bcks-kq:", error);
    return NextResponse.json({ error: buildParseErrorMessage(error) }, { status: 500 });
  }
}
