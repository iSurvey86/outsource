import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

function buildErrorMessage(error) {
  const message = String(error?.message || error || "");
  const status = error?.status ?? error?.code ?? error?.error?.code;

  if (status === 503 || /503|UNAVAILABLE|high demand/i.test(message)) {
    return "Dịch vụ AI đang quá tải tạm thời. Thử lại sau 1–2 phút.";
  }
  if (status === 429 || /429|quota|rate limit|RESOURCE_EXHAUSTED/i.test(message)) {
    return "Hết hạn mức AI tạm thời. Chờ khoảng 25 giây rồi thử lại.";
  }
  if (status === 401 || status === 403 || /API key|API_KEY|permission|unauthorized/i.test(message)) {
    return "Cấu hình AI chưa sẵn sàng. Liên hệ quản trị viên.";
  }
  if (/timeout|ETIMEDOUT|ECONNRESET|fetch failed|network/i.test(message)) {
    return "Kết nối AI bị gián đoạn. Kiểm tra mạng và thử lại.";
  }
  return `Không đọc được bill: ${message.slice(0, 160)}`;
}

function parseJsonLoose(text) {
  const raw = String(text || "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1].trim() : raw;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new SyntaxError("No JSON object");
  return JSON.parse(body.slice(start, end + 1));
}

function normalizeSoTien(raw) {
  if (raw == null || raw === "") return 0;
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.round(raw);
  const s = String(raw)
    .replace(/[₫đĐ]/gi, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function normalizeNgay(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (dmy) {
    const dd = dmy[1].padStart(2, "0");
    const mm = dmy[2].padStart(2, "0");
    return `${dmy[3]}-${mm}-${dd}`;
  }
  return "";
}

export async function POST(req) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "Chưa cấu hình AI để đọc bill. Liên hệ quản trị viên." },
        { status: 503 }
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ ok: false, error: "Chưa có file bill." }, { status: 400 });
    }

    const mimeType = file.type || "application/pdf";
    const buf = Buffer.from(await file.arrayBuffer());
    if (!buf.length) {
      return NextResponse.json({ ok: false, error: "File bill trống." }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const model = process.env.GEMINI_BILL_MODEL?.trim() || "gemini-2.5-flash";

    const prompt = `Bạn là trợ lý kế toán. Đọc bill / ủy nhiệm chi / biên lai / chứng từ thanh toán (PDF hoặc ảnh).
Trả về ĐÚNG 1 JSON (không markdown) với các field:
{
  "so_tien": số tiền VND (integer, không dấu chấm),
  "ngay": "YYYY-MM-DD" (ngày giao dịch / ngày chứng từ; ưu tiên ngày chuyển tiền),
  "noi_dung": "nội dung chuyển khoản / diễn giải ngắn",
  "nguoi_nop": "đơn vị/người nộp nếu có",
  "nguoi_nhan": "đơn vị/người nhận nếu có",
  "so_chung_tu": "số chứng từ / mã giao dịch nếu có"
}
Nếu không chắc một field thì để "" hoặc 0. Chỉ JSON.`;

    const result = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: buf.toString("base64") } },
            { text: prompt },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const text =
      result?.text ||
      result?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("\n") ||
      "";
    const parsed = parseJsonLoose(text);
    const soTien = normalizeSoTien(parsed.so_tien ?? parsed.soTien ?? parsed.amount);
    const ngay = normalizeNgay(parsed.ngay ?? parsed.date ?? parsed.ngay_giao_dich);
    const noiDung = String(parsed.noi_dung || parsed.noiDung || parsed.content || "").trim();
    const nguoiNop = String(parsed.nguoi_nop || parsed.nguoiNop || "").trim();
    const nguoiNhan = String(parsed.nguoi_nhan || parsed.nguoiNhan || "").trim();
    const soChungTu = String(parsed.so_chung_tu || parsed.soChungTu || "").trim();

    return NextResponse.json({
      ok: true,
      so_tien: soTien,
      ngay,
      noi_dung: noiDung,
      nguoi_nop: nguoiNop,
      nguoi_nhan: nguoiNhan,
      so_chung_tu: soChungTu,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[parse-bill]", err);
    return NextResponse.json(
      { ok: false, error: buildErrorMessage(err) },
      { status: 500 }
    );
  }
}
