import { NextResponse } from "next/server";
import { createPartFromUri, createUserContent, GoogleGenAI } from "@google/genai";
import {
  aggregateKhaoSatChiTiet,
  normalizeBangChiTiet,
  normalizeGiaiDoanKey,
  normalizeKhaoSatChiTiet,
  reconcilePhaseValues,
} from "../../../lib/hopDongBangGia";
import { postProcessTnctttAfterParse } from "../../../lib/hopDongTncttt";
import { assessGiaiDoanValuesCoverage } from "../../../lib/hopDongScanMatch";

/** PDF HĐ khung BESS thường lớn — tránh inline base64 (x3 RAM → OOM). */
const MAX_PDF_BYTES = 80 * 1024 * 1024;
/** Trên ngưỡng này dùng Files API; dưới vẫn có thể inline nhưng ưu tiên Files để ổn định. */
const FILES_API_MIN_BYTES = 1 * 1024 * 1024;

function buildErrorMessage(error) {
  const message = String(error?.message || error || "");
  const status = error?.status ?? error?.code ?? error?.error?.code;

  if (status === 503 || /503|UNAVAILABLE|high demand/i.test(message)) {
    return "Dịch vụ AI đang quá tải tạm thời. Thử lại sau 1–2 phút.";
  }
  if (status === 429 || /429|quota|rate limit|RESOURCE_EXHAUSTED/i.test(message)) {
    return "Hết quota/rate limit API AI. Chờ vài giây rồi thử lại.";
  }
  if (status === 401 || status === 403 || /API key|API_KEY|permission/i.test(message)) {
    return "Cấu hình khóa API AI không hợp lệ. Liên hệ quản trị.";
  }
  if (error instanceof SyntaxError || /JSON\.parse|Unexpected token/i.test(message)) {
    return "AI trả về dữ liệu không đúng định dạng. Thử quét lại hoặc nhập tay.";
  }
  return `Không quét được hợp đồng: ${message.slice(0, 180)}`;
}

function getFieldValue(field) {
  if (field == null) return "";
  if (typeof field === "object" && "value" in field) return String(field.value ?? "").trim();
  return String(field).trim();
}

/** Chuẩn hoá «dự án "…"» → «dự án: …» */
function normalizeHopDongDayDu(text) {
  let s = String(text || "").trim();
  s = s.replace(/dự\s*án\s*[“"«]([^”"»]+)[”"»]/gi, "dự án: $1");
  s = s.replace(/dự\s*án:\s*[“"«]([^”"»]+)[”"»]/gi, "dự án: $1");
  return s.replace(/\s{2,}/g, " ").trim();
}

/** Chuỗi tiền → số thuần (bỏ 1.234.567 / 1,234,567 → 1234567). */
function toMoneyNumber(raw) {
  const s0 = getFieldValue(raw) || String(raw ?? "").trim();
  if (!s0) return null;
  // Bỏ ký tự tiền tệ, giữ số + phân tách
  const s = s0.replace(/[^\d.,\-]/g, "");
  if (!s) return null;
  // Định dạng VN: dấu chấm = ngăn nghìn, phẩy = thập phân
  const normalized = s.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function moneyField(field) {
  const n = toMoneyNumber(field);
  return {
    value: n != null ? String(n) : "",
    confidence: field?.confidence ?? (n != null ? 60 : 0),
    warning: field?.warning || "",
  };
}

function toIntOrNull(v) {
  const n = toMoneyNumber(v);
  return n != null ? Math.round(n) : null;
}

export async function POST(req) {
  let uploadedFileName = null;
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || typeof file !== "object" || typeof file.arrayBuffer !== "function") {
      return NextResponse.json({ error: "Không tìm thấy file" }, { status: 400 });
    }

    const fileName = String(file.name || "").toLowerCase();
    let mimeType = file.type || "application/pdf";
    const size = Number(file.size || 0);
    if (size > MAX_PDF_BYTES) {
      return NextResponse.json(
        {
          error: `PDF quá lớn (${(size / (1024 * 1024)).toFixed(1)} MB). Nén hoặc tách file dưới 80 MB rồi quét lại.`,
        },
        { status: 413 }
      );
    }

    // Đọc buffer một lần — dùng cho kiểm tra .doc cũ và gửi AI (file nhỏ).
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const isZipBuffer = fileBuffer.length >= 2 && fileBuffer[0] === 0x50 && fileBuffer[1] === 0x4b;
    const isLegacyDocName =
      fileName.endsWith(".doc") && !fileName.endsWith(".docx");
    // .doc cũ (OLE Word 97–2003): Gemini gần như không đọc được → tin cậy 0%.
    if (
      (isLegacyDocName || mimeType === "application/msword") &&
      !isZipBuffer &&
      !fileName.endsWith(".docx")
    ) {
      return NextResponse.json(
        {
          error:
            "File Word .doc (định dạng cũ) AI không đọc được. Mở bằng Word → Lưu thành .docx hoặc xuất PDF rồi quét lại.",
        },
        { status: 400 }
      );
    }
    if (isLegacyDocName && isZipBuffer) {
      mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }

    // HĐ khung nhiều TBA + phụ lục dài: Flash-Lite hay cắt JSON / bỏ số giữa bảng.
    // Dùng 3.6 Flash cho parse HĐ (độ đúng ưu tiên hơn throughput).
    const hopDongModel =
      process.env.GEMINI_HOP_DONG_MODEL?.trim() || "gemini-3.6-flash";

    const prompt = `
Bạn là trợ lý đọc HỢP ĐỒNG tư vấn / khảo sát ngành điện lực Việt Nam.
Đọc TOÀN BỘ tài liệu (không chỉ trang bìa), TRẢ VỀ ĐÚNG JSON (không markdown, không text thừa).
Số trang là số IN trên tài liệu nếu có, nếu không thì số thứ tự trang trong file (bắt đầu 1).

=== ƯU TIÊN KHI LÀ HĐ KHUNG / NHIỀU TBA (NHƯ BESS) ===
Nếu có bảng phụ lục liệt kê TỪNG dự án/TBA kèm cột tiền (Khảo sát | BCNCKT | TKBVTC | Tổng):
1) NHIỆM VỤ SỐ 1: điền ĐỦ "phu_luc_cong_trinh" — MỌI dòng có tên TBA, MỌI cột tiền đọc được.
   Không bỏ sót TBA giữa bảng / trang sau; không để gia_tri_* rỗng nếu PDF có số.
2) "chi_phi_chung": dòng chung cả gói (HSMT, dịch thuật…) không gắn tên TBA.
3) Với HĐ khung kiểu này: để "khao_sat_chi_tiet": [] và "bang_chi_tiet": []
   (KHÔNG liệt kê từng dòng khảo sát chi tiết — tránh cắt JSON giữa chừng).
4) "giai_doan_values": chỉ tổng FS / TKBVTC từ BẢNG GIÁ HỢP ĐỒNG nếu có; không thay thế phụ lục TBA.

Chỉ khi KHÔNG có phụ lục từng TBA mới liệt kê khao_sat_chi_tiet / bang_chi_tiet đầy đủ.

=== NGUYÊN TẮC TÌM THEO MẪU, KHÔNG THEO SỐ TRANG CỐ ĐỊNH ===
Mẫu hợp đồng giống nhau nhưng số trang thay đổi theo từng file. PHẢI nhận diện theo TIÊU ĐỀ MỤC:
- Điều khoản "Giá Hợp đồng" / "Giá trị Hợp đồng là ...": lấy TỔNG giá trị hợp đồng (thường ĐÃ gồm VAT).
- "BẢNG GIÁ HỢP ĐỒNG": bảng tổng hợp — nguồn tổng theo giai đoạn (FS / TKBVTC).
- "BẢNG TIẾN ĐỘ THỰC HIỆN HỢP ĐỒNG": tổng số ngày thực hiện.
- "BẢNG NHÂN SỰ THỰC HIỆN HỢP ĐỒNG": danh sách nhân sự.

=== ĐỊNH DẠNG (học đúng mẫu) ===

Viết tắt (so_hop_dong) — MỘT DÒNG: [Số/ký hiệu HĐ] ngày [dd/mm/yyyy]
Ví dụ: 308/2020/HĐTV-BDAĐL-KHVT ngày 07/12/2020 (không thêm chữ "Hợp đồng số").

Chi tiết (hop_dong_day_du) — MỘT CÂU liền mạch, ĐỦ nội dung trang bìa:
Hợp đồng số [Số/ký hiệu] ngày [dd tháng mm năm yyyy] Gói thầu [mã gói]: [nội dung gói] Thuộc các dự án: [tên cụm dự án] (theo Quyết định số [số QĐ]/[ký hiệu] ngày [dd/mm/yyyy] của [Cơ quan]) Giữa [Bên A] & [Bên B]
- PHẢI giữ nguyên cụm "(theo Quyết định số … của …)" nếu có trên trang bìa — đây là khóa để gắn dự án Giao A.
- Dùng "dự án: " hoặc "Thuộc các dự án: " (hai chấm), KHÔNG bọc tên dự án trong ngoặc kép.
- Bỏ chức danh cá nhân.
- Ví dụ ĐÚNG: Hợp đồng số 05/2026/HĐTV/BDAXD-KHVT ngày 17 tháng 01 năm 2026 Gói thầu BESS.G01: Tư vấn khảo sát, lập BCNCKT DTXD, TKBVTC-DTXD các dự án Lắp đặt hệ thống Pin lưu trữ năng lượng (BESS) tại các TBA 110kV của EVNNPC Thuộc các dự án: Lắp đặt hệ thống Pin lưu trữ năng lượng (BESS) tại các TBA 110kV của EVNNPC (theo Quyết định số 67/QĐ-EVNNPC ngày 16/01/2026 của Tổng Công ty Điện lực miền Bắc) Giữa Ban Quản lý Dự án Xây dựng điện miền Bắc – Chi nhánh Tổng công ty Điện lực miền Bắc & Công ty Dịch vụ Điện lực miền Bắc – Chi nhánh Tổng công ty Điện lực miền Bắc

=== PHỤ LỤC PHÂN BỔ GIÁ TRỊ TỪNG CÔNG TRÌNH / TBA (QUAN TRỌNG VỚI HĐ KHUNG) ===
Hai dạng phụ lục (đều điền "phu_luc_cong_trinh", mỗi công trình / TBA = 1 object):

Dạng A — bảng tóm tắt cột: Khảo sát | Lập BCNCKT | Lập TKBVTC | Tổng
→ gia_tri_ks / gia_tri_lap_bcnckt / gia_tri_lap_tkbvtc / gia_tri_tong.
→ Ba trường tách KS để "" (không bịa).

Dạng B — bảng dự toán chi tiết từng CT (có mục I KHẢO SÁT với đề mục con):
  «1. Khảo sát địa hình» / «2. Khảo sát địa chất» / «3. Điều tra thu thập» (hoặc «thỏa thuận»)
→ CỘNG thành tiền các dòng con dưới từng đề mục:
  - gia_tri_ks_dia_hinh = tổng mục địa hình
  - gia_tri_ks_dia_chat = tổng mục địa chất (không có mục → "")
  - gia_tri_ks_khac = tổng «Điều tra thu thập» / thỏa thuận / công nhật điều tra (không có → "")
  - gia_tri_ks = tổng mục I KHẢO SÁT (= tổng 3 nhóm nếu khớp)
  - gia_tri_lap_bcnckt / gia_tri_lap_tkbvtc từ mục II «Lập BCKTKT / BCNCKT / TKBVTC»
  - gia_tri_tong từ «Cộng trước thuế sau triết giảm» nếu có, không thì I+II
  - giai_doan: "FS" nếu mục II là Lập BCNCKT; "BCKTKT" nếu Lập BCKTKT; "TKBVTC" nếu lập TKBVTC — PHẢI điền đúng theo đề mục phụ lục
Không cần liệt kê từng dòng đo/khoan vào khao_sat_chi_tiet (tránh cắt JSON) — CHỈ cần 3 tổng nhóm trên.

Chung cho cả hai dạng:
- ten_du_an: copy đúng tên công trình/TBA — giữ mã tuyến (#174, #176…), không rút gọn chung.
- Mỗi CT/TBA = đúng một object; không lệch hàng số.
- Số thuần; thiếu cột → "".
Nếu không có bảng phụ lục từng công trình → phu_luc_cong_trinh = [].

CHI PHÍ CHUNG CỦA CẢ GÓI HĐ (không gắn tên dự án / TBA — cột Địa điểm trống, hoặc dòng kiểu «× N bộ»):
- Ví dụ: "Chi phí lập HSMT mua sắm… (60.000.000 × 10 bộ)" = 600.000.000
- Ví dụ: "Chi phí dịch thuật HSMT… (400 trang × … × 10 bộ)" = 200.000.000
→ Đưa vào mảng "chi_phi_chung" (KHÔNG nhét vào phu_luc_cong_trinh, KHÔNG chia đều các TBA).
  {
    "mo_ta": "Nguyên văn tên dòng chi phí",
    "gia_tri": "Số thuần trước VAT",
    "loai": "hsmt | dich_thuat_hsmt | khac"
  }
Nếu không có → chi_phi_chung = [].

=== CHIẾT GIẢM TNCTTT (THU NHẬP CHỊU THUẾ TÍNH TRƯỚC) ===
Nhiều HĐ ghi điều khoản: giá «không bao gồm thu nhập chịu thuế tính trước (x%)».
Trong bảng dự toán từng công trình thường có:
  - «Cộng trước thuế (I + II)» = số THÔ (gross)
  - «Triết giảm / Chiết giảm x% TNCTTT»
  - «Cộng trước thuế sau triết giảm» = số NET (đưa vào giá HĐ trước VAT)

QUY TẮC BẮT BUỘC:
1) gia_tri_truoc_vat / giá trị trên điều khoản = số NET (sau TNCTTT, trước VAT).
2) gia_tri_tong / gia_tri_hd (cột Giá trị HĐ) = số NET «sau triết giảm».
3) Các cột phân rã KS giữ GROSS (thành tiền trên bảng dự toán TRƯỚC TNCTTT):
   gia_tri_ks, gia_tri_ks_dia_hinh, gia_tri_ks_dia_chat, gia_tri_ks_khac, gia_tri_lap_bcnckt / gia_tri_lap_tkbvtc
   = cộng thành tiền mục I / II trước dòng triết giảm. KHÔNG nhân (1−%).
4) Điền "chiet_giam_tncttt":
   {
     "co_chiet_giam": true,
     "ty_le": "6",
     "so_tien": "tổng tiền chiết giảm nếu đọc được",
     "so_tien_truoc_giam": "tổng gross (I+II) nếu đọc được",
     "ghi_chu": "ngắn — ví dụ Điều 5 không gồm TNCTTT 6%"
   }
Nếu HĐ không có TNCTTT → chiet_giam_tncttt = { "co_chiet_giam": false, "ty_le": "", "so_tien": "", "so_tien_truoc_giam": "", "ghi_chu": "" }.
Lưu ý: KS + Lập (gross) có thể ≠ gia_tri_tong (net) — đó là đúng khi có TNCTTT.

=== CÁCH ĐỌC BẢNG GIÁ (khi KHÔNG phải ưu tiên phụ lục TBA) ===
Bảng tổng hợp "BẢNG GIÁ HỢP ĐỒNG" có các cột: Giá trị TRƯỚC thuế | Thuế VAT | Giá trị SAU thuế.
- Mục I "Chi phí khảo sát và lập BCNCKT ..." = giai đoạn FS.
- Mục II "Chi phí khảo sát và lập TKKT-TDT, TKBVTC ..." = giai đoạn TKBVTC.
- gia_tri_hd của mỗi giai đoạn = tổng mục TRƯỚC thuế.

TÁCH CHI TIẾT KHẢO SÁT — CHỈ khi không có phụ lục từng TBA:
Liệt kê từng dòng thành tiền vào "khao_sat_chi_tiet" với nhom dia_hinh | dia_chat | khac theo đề mục bao.

THỨ TỰ ƯU TIÊN NGUỒN:
1. Phụ lục từng TBA (nếu có) → phu_luc_cong_trinh.
2. Bảng tổng hợp "BẢNG GIÁ HỢP ĐỒNG" → giai_doan_values / tổng HĐ.
3. Bảng chi tiết chỉ khi thiếu dòng trên bảng tổng hợp.

TỰ KIỂM TRA — với mỗi giai đoạn (nếu có giai_doan_values):
   gia_tri_ks + gia_tri_lap_hs + gia_tri_ctdt = gia_tri_hd  (chênh tối đa 1 đồng)
Với phu_luc_cong_trinh: đếm số dòng có ten_du_an ≈ số TBA trên phụ lục; mỗi dòng nên có ít nhất một gia_tri_* khác rỗng.
BẮT BUỘC — BẢNG GIÁ HỢP ĐỒNG có mục I (BCNCKT/FS) VÀ mục II (TKBVTC/TKKT):
   giai_doan_values PHẢI có đủ 2 object (FS + TKBVTC). Tổng gia_tri_hd (trước thuế) ≈ gia_tri_truoc_vat.
   KHÔNG được chỉ trả một giai đoạn khi bảng giá có cả I và II.

CẤU TRÚC JSON:
{
  "so_hop_dong": { "value": "", "confidence": 95, "warning": "" },
  "hop_dong_day_du": { "value": "", "confidence": 90, "warning": "" },
  "qd_giao_a_tham_chieu": { "value": "Số QĐ Giao A rút gọn nếu HĐ ghi «theo Quyết định số …», ví dụ: 67/QĐ-EVNNPC ngày 16/01/2026", "confidence": 85, "warning": "" },
  "ngay_hop_dong": { "value": "yyyy-mm-dd nếu suy được, không thì \\"\\"", "confidence": 90, "warning": "" },
  "ben_a": { "value": "Tên bên A (thường chủ đầu tư)", "confidence": 85, "warning": "" },
  "ben_b": { "value": "Tên bên B (thường nhà thầu / tư vấn)", "confidence": 85, "warning": "" },
  "goi_thau": { "value": "Nội dung gói thầu", "confidence": 80, "warning": "" },
  "ten_du_an": { "value": "Tên dự án / công trình", "confidence": 90, "warning": "" },

  "gia_tri_truoc_vat": { "value": "Tổng HĐ TRƯỚC thuế SAU TNCTTT nếu có (số thuần pháp lý)", "confidence": 70, "warning": "" },
  "vat": { "value": "Tiền thuế VAT (số thuần)", "confidence": 70, "warning": "" },
  "vat_percent": { "value": "Thuế suất VAT, ví dụ 8 hoặc 10", "confidence": 70, "warning": "" },
  "gia_tri_sau_vat": { "value": "Tổng HĐ SAU thuế = giá trị hợp đồng pháp lý (số thuần)", "confidence": 80, "warning": "" },

  "chiet_giam_tncttt": {
    "co_chiet_giam": false,
    "ty_le": "",
    "so_tien": "",
    "so_tien_truoc_giam": "",
    "ghi_chu": ""
  },

  "gia_tri_hd": { "value": "Bằng gia_tri_truoc_vat (tương thích cũ) — net trước VAT", "confidence": 60, "warning": "" },
  "gia_tri_ks": { "value": "Tổng Khảo sát toàn HĐ nếu tách được", "confidence": 55, "warning": "" },
  "gia_tri_lap_hs": { "value": "Tổng Lập HS/TK toàn HĐ nếu tách được", "confidence": 55, "warning": "" },
  "gia_tri_ctdt": { "value": "Tổng Chủ trương ĐT toàn HĐ nếu tách được", "confidence": 55, "warning": "" },

  "giai_doan_values": [
    {
      "giai_doan": "FS | BCKTKT | TKBVTC",
      "gia_tri_hd": "tổng mục TRƯỚC thuế",
      "gia_tri_ks": "Khảo sát (trước thuế)",
      "gia_tri_lap_hs": "Lập BCNCKT / TKKT, TKBVTC (trước thuế)",
      "gia_tri_ctdt": "Chủ trương ĐT / chấp thuận NĐT (trước thuế)",
      "gia_tri_sau_vat": "tổng mục SAU thuế nếu đọc được"
    }
  ],

  "phu_luc_cong_trinh": [
    {
      "stt": "",
      "ten_du_an": "",
      "dia_diem": "",
      "giai_doan": "FS | BCKTKT | TKBVTC",
      "gia_tri_ks": "",
      "gia_tri_ks_dia_hinh": "",
      "gia_tri_ks_dia_chat": "",
      "gia_tri_ks_khac": "",
      "gia_tri_lap_bcnckt": "",
      "gia_tri_lap_tkbvtc": "",
      "gia_tri_tong": ""
    }
  ],
  "chi_phi_chung": [
    {
      "mo_ta": "Chi phí lập HSMT / dịch thuật HSMT / mục chung khác (nguyên văn)",
      "gia_tri": "",
      "loai": "hsmt | dich_thuat_hsmt | khac"
    }
  ],

  "khao_sat_chi_tiet": [],
  "bang_chi_tiet": [],

  "thoi_han_ngay": { "value": "Tổng số ngày thực hiện (số nguyên) nếu có bảng tiến độ", "confidence": 60, "warning": "" },
  "moc_bat_dau": { "value": "Điều kiện/mốc bắt đầu tính thời hạn nếu hợp đồng nêu rõ", "confidence": 55, "warning": "" },

  "nhan_su": [
    { "ho_ten": "", "chuyen_mon": "", "chuc_danh": "" }
  ],

  "nguon_trang": {
    "gia_tri_dieu_khoan": "số trang điều khoản Giá Hợp đồng, hoặc \\"\\"",
    "bang_gia": "số trang BẢNG GIÁ HỢP ĐỒNG, hoặc \\"\\"",
    "tien_do": "số trang bảng tiến độ, hoặc \\"\\"",
    "nhan_su": "số trang bảng nhân sự, hoặc \\"\\"",
    "phu_luc_tba": "số trang bắt đầu phụ lục từng TBA nếu có, hoặc \\"\\""
  }
}

- Mọi giá trị tiền: CHỈ số (vd 1051229104), bỏ đơn vị đ/VND và dấu ngăn cách.
- giai_doan_values: chỉ liệt kê giai đoạn thực có trong HĐ; không có thì [].
- HĐ khung có phụ lục TBA: khao_sat_chi_tiet và bang_chi_tiet = [] (đã nêu trên).
- nhan_su: liệt kê từ bảng nhân sự nếu có; không có thì [].
- Trường nào không thấy: để value "".
`;

    // Files API: không giữ bản base64 khổng lồ trong heap Node (PDF HĐ khung hay OOM ~8GB).
    let pdfPart;
    if (size >= FILES_API_MIN_BYTES) {
      const blob = new Blob([fileBuffer], { type: mimeType });
      const uploadFile = new File([blob], file.name || "hop-dong.pdf", { type: mimeType });
      const uploaded = await ai.files.upload({
        file: uploadFile,
        config: { mimeType },
      });
      uploadedFileName = uploaded.name || null;
      if (!uploaded.uri) {
        throw new Error("Upload PDF lên Gemini Files API thất bại (thiếu uri).");
      }
      pdfPart = createPartFromUri(uploaded.uri, uploaded.mimeType || mimeType);
    } else {
      pdfPart = {
        inlineData: { mimeType, data: fileBuffer.toString("base64") },
      };
    }

    const result = await ai.models.generateContent({
      model: hopDongModel,
      contents: createUserContent([prompt, pdfPart]),
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = result.text || "";
    let jsonData;
    try {
      jsonData = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new SyntaxError("JSON parse failed");
      jsonData = JSON.parse(m[0]);
    }

    const bangChiTiet = normalizeBangChiTiet(jsonData.bang_chi_tiet);
    const khaoSatChiTiet = normalizeKhaoSatChiTiet(jsonData.khao_sat_chi_tiet);
    const khaoSatTheoGiaiDoan = aggregateKhaoSatChiTiet(khaoSatChiTiet);

    const giaiDoanValues = Array.isArray(jsonData.giai_doan_values)
      ? jsonData.giai_doan_values
          .map((g) => ({
            giai_doan: String(g?.giai_doan || "").trim(),
            gia_tri_hd: moneyField(g?.gia_tri_hd).value,
            gia_tri_ks: moneyField(g?.gia_tri_ks).value,
            gia_tri_ks_dia_hinh: "",
            gia_tri_ks_dia_chat: "",
            gia_tri_ks_khac: "",
            gia_tri_lap_hs: moneyField(g?.gia_tri_lap_hs).value,
            gia_tri_ctdt: moneyField(g?.gia_tri_ctdt).value,
            gia_tri_sau_vat: moneyField(g?.gia_tri_sau_vat).value,
          }))
          .map((g) =>
            reconcilePhaseValues(
              g,
              bangChiTiet,
              khaoSatTheoGiaiDoan.get(normalizeGiaiDoanKey(g.giai_doan)) ||
                (khaoSatTheoGiaiDoan.size === 1 ? [...khaoSatTheoGiaiDoan.values()][0] : null)
            )
          )
      : [];

    const nhanSu = Array.isArray(jsonData.nhan_su)
      ? jsonData.nhan_su
          .map((p) => ({
            ho_ten: String(p?.ho_ten || "").trim(),
            chuyen_mon: String(p?.chuyen_mon || "").trim(),
            chuc_danh: String(p?.chuc_danh || "").trim(),
          }))
          .filter((p) => p.ho_ten)
      : [];

    const nguon = jsonData.nguon_trang || {};
    const nguonTrang = {
      gia_tri_dieu_khoan: toIntOrNull(nguon.gia_tri_dieu_khoan),
      bang_gia: toIntOrNull(nguon.bang_gia),
      tien_do: toIntOrNull(nguon.tien_do),
      nhan_su: toIntOrNull(nguon.nhan_su),
    };

    const truocVat = moneyField(jsonData.gia_tri_truoc_vat);
    const sauVat = moneyField(jsonData.gia_tri_sau_vat);
    // gia_tri_hd (tương thích cũ) = trước VAT nếu có, không thì lấy trường cũ
    const giaTriHd = truocVat.value ? truocVat : moneyField(jsonData.gia_tri_hd);

    // Hợp đồng một giai đoạn chỉ có trường tổng — đối chiếu bằng cùng một quy tắc.
    const tongKhoanMuc = giaiDoanValues.length
      ? null
      : reconcilePhaseValues(
          {
            giai_doan: "",
            gia_tri_hd: giaTriHd.value,
            gia_tri_ks: moneyField(jsonData.gia_tri_ks).value,
            gia_tri_ks_dia_hinh: "",
            gia_tri_ks_dia_chat: "",
            gia_tri_ks_khac: "",
            gia_tri_lap_hs: moneyField(jsonData.gia_tri_lap_hs).value,
            gia_tri_ctdt: moneyField(jsonData.gia_tri_ctdt).value,
          },
          bangChiTiet,
          khaoSatTheoGiaiDoan.size ? [...khaoSatTheoGiaiDoan.values()][0] : null
        );
    const tongField = (key) => {
      const base = moneyField(jsonData[key]);
      if (!tongKhoanMuc) return base;
      return { ...base, value: tongKhoanMuc[key] || base.value };
    };

    // Kiểm tra chéo trước+VAT=sau
    const nTruoc = toMoneyNumber(truocVat.value);
    const nVat = toMoneyNumber(jsonData.vat);
    const nSau = toMoneyNumber(sauVat.value);
    let vatWarning = "";
    if (nTruoc != null && nVat != null && nSau != null) {
      if (Math.abs(nTruoc + nVat - nSau) > 1) {
        vatWarning = "Trước VAT + VAT ≠ Sau VAT — kiểm tra lại bảng giá.";
      }
    }

    const phuLucCongTrinhRaw = Array.isArray(jsonData.phu_luc_cong_trinh)
      ? jsonData.phu_luc_cong_trinh
          .map((row) => {
            const ksDh = moneyField(
              row?.gia_tri_ks_dia_hinh_sau_giam ?? row?.gia_tri_ks_dia_hinh
            ).value;
            const ksDc = moneyField(
              row?.gia_tri_ks_dia_chat_sau_giam ?? row?.gia_tri_ks_dia_chat
            ).value;
            const ksKhac = moneyField(
              row?.gia_tri_ks_khac_sau_giam ?? row?.gia_tri_ks_khac
            ).value;
            const ksParts = [ksDh, ksDc, ksKhac]
              .map((v) => toMoneyNumber(v))
              .filter((n) => n != null);
            const ksFromParts =
              ksParts.length > 0 ? String(ksParts.reduce((a, b) => a + b, 0)) : "";
            const ksRaw = moneyField(
              row?.gia_tri_ks_sau_giam ?? row?.gia_tri_ks
            ).value;
            return {
              stt: String(row?.stt ?? "").trim(),
              ten_du_an: String(row?.ten_du_an || row?.ten || "").trim(),
              dia_diem: String(row?.dia_diem || "").trim(),
              giai_doan: String(row?.giai_doan || "").trim(),
              gia_tri_ks: ksRaw || ksFromParts,
              gia_tri_ks_dia_hinh: ksDh,
              gia_tri_ks_dia_chat: ksDc,
              gia_tri_ks_khac: ksKhac,
              gia_tri_lap_bcnckt: moneyField(
                row?.gia_tri_lap_bcnckt_sau_giam ??
                  row?.gia_tri_lap_bcnckt ??
                  row?.gia_tri_lap_hs_fs
              ).value,
              gia_tri_lap_tkbvtc: moneyField(
                row?.gia_tri_lap_tkbvtc_sau_giam ??
                  row?.gia_tri_lap_tkbvtc ??
                  row?.gia_tri_lap_hs_tkbvtc
              ).value,
              gia_tri_tong: moneyField(
                row?.gia_tri_tong_sau_giam ?? row?.gia_tri_tong ?? row?.gia_tri_hd
              ).value,
            };
          })
          .filter((row) => row.ten_du_an)
      : [];

    const rootMoneyIn = {
      gia_tri_hd: giaTriHd.value,
      gia_tri_ks: moneyField(jsonData.gia_tri_ks).value,
      gia_tri_ks_dia_hinh: "",
      gia_tri_ks_dia_chat: "",
      gia_tri_ks_khac: "",
      gia_tri_lap_hs: moneyField(jsonData.gia_tri_lap_hs).value,
      gia_tri_ctdt: moneyField(jsonData.gia_tri_ctdt).value,
    };

    const tnctttProcessed = postProcessTnctttAfterParse({
      chietGiamRaw: jsonData.chiet_giam_tncttt,
      truocVat: truocVat.value,
      phuLucCongTrinh: phuLucCongTrinhRaw,
      giaiDoanValues,
      rootMoney: rootMoneyIn,
    });

    const phuLucCongTrinh = tnctttProcessed.phu_luc_cong_trinh;
    const giaiDoanValuesOut = tnctttProcessed.giai_doan_values;
    const rootMoneyOut = tnctttProcessed.rootMoney;
    const chietGiamTncttt = tnctttProcessed.chiet_giam_tncttt;

    const coverage = assessGiaiDoanValuesCoverage(giaiDoanValuesOut, truocVat.value);
    const thieuGiaiDoanWarning = coverage.warning || "";
    if (thieuGiaiDoanWarning) {
      console.warn("[parse-hop-dong] coverage:", thieuGiaiDoanWarning);
    }

    // Đồng bộ lại tongKhoanMuc fields nếu đã scale root
    const tongFieldScaled = (key) => {
      const base = tongField(key);
      if (!tnctttProcessed.scaled || rootMoneyOut[key] == null || rootMoneyOut[key] === "") {
        return base;
      }
      return { ...base, value: rootMoneyOut[key] };
    };

    const phuLucCoSo = phuLucCongTrinh.filter(
      (r) =>
        r.gia_tri_ks ||
        r.gia_tri_ks_dia_hinh ||
        r.gia_tri_ks_dia_chat ||
        r.gia_tri_ks_khac ||
        r.gia_tri_lap_bcnckt ||
        r.gia_tri_lap_tkbvtc ||
        r.gia_tri_tong
    ).length;
    const phuLucThieuSo = phuLucCongTrinh.length - phuLucCoSo;
    let phuLucQualityWarning = "";
    if (phuLucCongTrinh.length >= 3 && phuLucThieuSo > 0) {
      phuLucQualityWarning = `Phụ lục TBA: ${phuLucCoSo}/${phuLucCongTrinh.length} dòng có số tiền — còn ${phuLucThieuSo} dòng thiếu số (quét lại hoặc nhập tay).`;
    } else if (phuLucCongTrinh.length >= 5 && phuLucCoSo < Math.ceil(phuLucCongTrinh.length * 0.6)) {
      phuLucQualityWarning =
        "Phụ lục TBA nhận được ít số tiền hơn kỳ vọng — có thể AI cắt giữa bảng. Quét lại PDF.";
    }

    let tnctttHint = "";
    if (chietGiamTncttt?.co_chiet_giam && chietGiamTncttt.ty_le) {
      tnctttHint = tnctttProcessed.scaled
        ? `Đã đưa cột Giá trị HĐ về net sau ${chietGiamTncttt.ty_le}% TNCTTT; KS/Lập giữ gross.`
        : `HĐ có chiết giảm TNCTTT ${chietGiamTncttt.ty_le}% (HĐ net; KS/Lập gross nếu có).`;
    }

    return NextResponse.json({
      so_hop_dong: {
        value: getFieldValue(jsonData.so_hop_dong),
        confidence: jsonData.so_hop_dong?.confidence ?? 90,
        warning: jsonData.so_hop_dong?.warning || "",
      },
      hop_dong_day_du: {
        value: normalizeHopDongDayDu(getFieldValue(jsonData.hop_dong_day_du)),
        confidence: jsonData.hop_dong_day_du?.confidence ?? 85,
        warning: jsonData.hop_dong_day_du?.warning || "",
      },
      qd_giao_a_tham_chieu: {
        value: getFieldValue(jsonData.qd_giao_a_tham_chieu),
        confidence: jsonData.qd_giao_a_tham_chieu?.confidence ?? 80,
        warning: jsonData.qd_giao_a_tham_chieu?.warning || "",
      },
      ngay_hop_dong: {
        value: getFieldValue(jsonData.ngay_hop_dong),
        confidence: jsonData.ngay_hop_dong?.confidence ?? 80,
        warning: jsonData.ngay_hop_dong?.warning || "",
      },
      ben_a: getFieldValue(jsonData.ben_a),
      ben_b: getFieldValue(jsonData.ben_b),
      goi_thau: getFieldValue(jsonData.goi_thau),
      ten_du_an: getFieldValue(jsonData.ten_du_an),

      gia_tri_truoc_vat: truocVat,
      vat: moneyField(jsonData.vat),
      vat_percent: {
        value: getFieldValue(jsonData.vat_percent),
        confidence: jsonData.vat_percent?.confidence ?? 60,
        warning: jsonData.vat_percent?.warning || "",
      },
      gia_tri_sau_vat: { ...sauVat, warning: sauVat.warning || vatWarning },
      chiet_giam_tncttt: chietGiamTncttt,

      gia_tri_hd: tongFieldScaled("gia_tri_hd"),
      gia_tri_ks: tongFieldScaled("gia_tri_ks"),
      gia_tri_ks_dia_hinh: tongFieldScaled("gia_tri_ks_dia_hinh"),
      gia_tri_ks_dia_chat: tongFieldScaled("gia_tri_ks_dia_chat"),
      gia_tri_ks_khac: tongFieldScaled("gia_tri_ks_khac"),
      gia_tri_lap_hs: tongFieldScaled("gia_tri_lap_hs"),
      gia_tri_ctdt: tongFieldScaled("gia_tri_ctdt"),
      nguon_ghi_chu: [tongKhoanMuc?.nguon_ghi_chu || "", tnctttHint].filter(Boolean).join(" "),
      canh_bao_gia_tri: tongKhoanMuc?.canh_bao || "",
      giai_doan_values: giaiDoanValuesOut,
      bang_chi_tiet: bangChiTiet,
      phu_luc_cong_trinh: phuLucCongTrinh,
      phu_luc_quality_warning: phuLucQualityWarning,
      thieu_giai_doan_warning: thieuGiaiDoanWarning,
      thieu_giai_doan_likely: coverage.likelyMissing || "",
      chi_phi_chung: Array.isArray(jsonData.chi_phi_chung)
        ? jsonData.chi_phi_chung
            .map((row) => ({
              mo_ta: String(row?.mo_ta || row?.ten || row?.noi_dung || "").trim(),
              gia_tri: moneyField(row?.gia_tri ?? row?.thanh_tien).value,
              loai: String(row?.loai || "khac").trim() || "khac",
            }))
            .filter((row) => row.mo_ta || row.gia_tri)
        : [],

      thoi_han_ngay: {
        value: toIntOrNull(jsonData.thoi_han_ngay) != null ? String(toIntOrNull(jsonData.thoi_han_ngay)) : "",
        confidence: jsonData.thoi_han_ngay?.confidence ?? 55,
        warning: jsonData.thoi_han_ngay?.warning || "",
      },
      moc_bat_dau: {
        value: getFieldValue(jsonData.moc_bat_dau),
        confidence: jsonData.moc_bat_dau?.confidence ?? 50,
        warning: jsonData.moc_bat_dau?.warning || "",
      },
      nhan_su: nhanSu,
      nguon_trang: nguonTrang,
      _meta: { model: hopDongModel, tncttt_scaled: Boolean(tnctttProcessed.scaled) },
    });
  } catch (error) {
    console.error("[parse-hop-dong]", error);
    return NextResponse.json({ error: buildErrorMessage(error) }, { status: 500 });
  } finally {
    if (uploadedFileName) {
      try {
        await ai.files.delete({ name: uploadedFileName });
      } catch (delErr) {
        console.warn("[parse-hop-dong] Xóa file Gemini tạm thất bại:", delErr?.message || delErr);
      }
    }
  }
}
