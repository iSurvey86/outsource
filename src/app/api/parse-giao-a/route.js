import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { normalizeTenDuAn, resolveDiaDiemKs } from '../../../lib/giaoALocation.js';
import { normalizeChuDauTu } from '../../../lib/chuDauTuAlias.js';
import { parseTmdtTrD } from '../../../lib/designPhases.js';

function buildParseGiaoAErrorMessage(error) {
    const message = String(error?.message || error || '');
    const status = error?.status ?? error?.code ?? error?.error?.code;

    if (status === 503 || /503|UNAVAILABLE|high demand/i.test(message)) {
        return 'Dịch vụ AI (Gemini) đang quá tải tạm thời. Vui lòng thử lại sau 1–2 phút. (Mã lỗi: 503)';
    }
    if (status === 429 || /429|quota|rate limit|RESOURCE_EXHAUSTED/i.test(message)) {
        return 'Hết quota/rate limit API AI (free tier). Chờ ~25 giây rồi thử lại, hoặc quét ít file hơn. (Mã lỗi: 429)';
    }
    if (status === 404 || /404|not found for API|model.*not found/i.test(message)) {
        return 'Model AI không khả dụng trên hệ thống. Vui lòng liên hệ quản trị. (Mã lỗi: 404)';
    }
    if (status === 401 || status === 403 || /API key|API_KEY|permission|unauthorized/i.test(message)) {
        return 'Cấu hình khóa API AI không hợp lệ hoặc hết hạn. Vui lòng liên hệ quản trị.';
    }
    if (error instanceof SyntaxError || /JSON\.parse|Unexpected token/i.test(message)) {
        return 'AI trả về dữ liệu không đúng định dạng. Vui lòng thử quét lại hoặc nhập thủ công.';
    }
    if (/timeout|ETIMEDOUT|ECONNRESET|fetch failed|network/i.test(message)) {
        return 'Kết nối tới dịch vụ AI bị gián đoạn. Kiểm tra mạng và thử lại.';
    }
    if (/payload too large|413|file too large/i.test(message)) {
        return 'File PDF quá lớn để gửi lên AI. Vui lòng thử file nhỏ hơn.';
    }
    return `Không quét được file: ${message.slice(0, 180)}`;
}

function preserveQuyMoBulletLines(text) {
    if (!text || typeof text !== 'string') return text || '';
    const lines = text.split(/\r?\n/);
    const nonEmpty = lines.map((l) => l.trim()).filter(Boolean);
    if (nonEmpty.length <= 1) return text.trim();

    return lines
        .map((line) => {
            const trimmed = line.trim();
            if (!trimmed) return '';
            if (/^[-–—•]\s?/.test(trimmed)) {
                return `- ${trimmed.replace(/^[-–—•]\s*/, '')}`;
            }
            return `- ${trimmed}`;
        })
        .filter(Boolean)
        .join('\n');
}

function normalizeQuyMoInScanJson(jsonData) {
    const list = jsonData?.danh_sach_du_an?.value
        ?? jsonData?.danh_sach_du_an
        ?? jsonData?.projects?.value
        ?? jsonData?.projects;
    if (!Array.isArray(list)) return jsonData;

    list.forEach((item) => {
        if (item?.quy_mo?.value != null) {
            item.quy_mo.value = preserveQuyMoBulletLines(String(item.quy_mo.value));
        } else if (typeof item?.quy_mo === 'string') {
            item.quy_mo = preserveQuyMoBulletLines(item.quy_mo);
        }
    });
    return jsonData;
}

/** Ép TMĐT về chuỗi số nguyên Triệu VNĐ (vá lỗi AI trả 93.5 thay vì 93500). */
function normalizeTmdtInScanJson(jsonData) {
    const list = getProjectList(jsonData);
    list.forEach((item) => {
        const raw = item?.tmdt?.value ?? item?.tmdt ?? item?.tongMucDauTu?.value ?? item?.tongMucDauTu;
        if (raw == null || raw === '') return;
        const n = parseTmdtTrD(raw);
        if (!(n > 0)) return;
        const asStr = String(Math.round(n));
        if (item?.tmdt && typeof item.tmdt === 'object' && 'value' in item.tmdt) {
            item.tmdt.value = asStr;
            const rawStr = String(raw).trim();
            if (/^\d{1,3}\.\d{1,2}$/.test(rawStr) || (typeof raw === 'number' && !Number.isInteger(raw))) {
                item.tmdt.warning = item.tmdt.warning ||
                    'TMĐT đã chuẩn hoá từ dạng số thập phân/phụ lục (xác nhận lại với PDF).';
                if ((item.tmdt.confidence || 100) > 80) item.tmdt.confidence = 80;
            }
        } else {
            item.tmdt = asStr;
        }
    });
    return jsonData;
}

function getFieldValue(field) {
    if (field == null) return '';
    if (typeof field === 'object' && 'value' in field) return String(field.value ?? '').trim();
    return String(field).trim();
}

function setFieldMeta(obj, key, value, confidence, warning) {
    if (obj[key] && typeof obj[key] === 'object' && 'value' in obj[key]) {
        obj[key].value = value;
        obj[key].confidence = confidence;
        obj[key].warning = warning;
    } else {
        obj[key] = { value, confidence, warning };
    }
}

function getProjectList(jsonData) {
    const raw = jsonData?.danh_sach_du_an?.value
        ?? jsonData?.danh_sach_du_an
        ?? jsonData?.projects?.value
        ?? jsonData?.projects;
    return Array.isArray(raw) ? raw : [];
}

function applyChuDauTuNormalization(jsonData) {
    const raw = getFieldValue(jsonData.chu_dau_tu);
    if (!raw) return jsonData;

    const normalized = normalizeChuDauTu(raw);
    const existingConf = jsonData.chu_dau_tu?.confidence ?? 85;
    const existingWarn = jsonData.chu_dau_tu?.warning ?? '';
    const warn = raw !== normalized && !existingWarn
        ? `Đã chuẩn hóa CĐT: "${raw}" → "${normalized}"`
        : existingWarn;

    setFieldMeta(jsonData, 'chu_dau_tu', normalized, existingConf, warn);
    return jsonData;
}

function applyGiaoALocationRules(jsonData) {
    const chuDauTu = getFieldValue(jsonData.chu_dau_tu);
    const list = getProjectList(jsonData);

    list.forEach((item) => {
        const tenRaw = getFieldValue(item.ten_du_an);
        if (tenRaw) {
            setFieldMeta(
                item,
                'ten_du_an',
                normalizeTenDuAn(tenRaw),
                item.ten_du_an?.confidence ?? 95,
                item.ten_du_an?.warning ?? ''
            );
        }

        const resolved = resolveDiaDiemKs({
            diaDiemAppendix: getFieldValue(item.dia_diem),
            chuDauTu,
            existingConf: item.dia_diem?.confidence,
            existingWarn: item.dia_diem?.warning,
        });
        setFieldMeta(item, 'dia_diem', resolved.value, resolved.confidence, resolved.warning);
    });

    return jsonData;
}

export async function POST(req) {
    try {
        const formData = await req.formData();
        const file = formData.get('file');

        if (!file) {
            return NextResponse.json({ error: "Không tìm thấy file" }, { status: 400 });
        }

        // Chuyển file PDF sang định dạng base64 để gửi cho Gemini
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Data = buffer.toString('base64');

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        // CÂU LỆNH PROMPT (Ép AI lấy quy_mo cho từng công trình và định dạng qd_giao_a)
        const prompt = `
            Bạn là một trợ lý ảo chuyên phân tích tài liệu Quyết định giao danh mục đầu tư/khảo sát của ngành Điện lực Việt Nam (EVN).
            Hãy đọc file PDF đính kèm và trích xuất các thông tin sau, TRẢ VỀ ĐÚNG ĐỊNH DẠNG JSON (không có markdown, không có text dư thừa).
            ĐẶC BIỆT LƯU Ý: Với mỗi trường dữ liệu, bạn phải trả về một đối tượng gồm 3 thuộc tính:
            - "value": Giá trị trích xuất được.
            - "confidence": Điểm đánh giá độ tin cậy của bạn về dữ liệu này (từ 0 đến 100).
            - "warning": Câu cảnh báo nếu điểm tin cậy < 85 (Ví dụ: "Cảnh báo: Chữ ký số đè lên văn bản làm mờ chữ, độ tin cậy chỉ đạt 60%"). Nếu >= 85 thì để rỗng "".
            
            CẤU TRÚC JSON BẮT BUỘC:
            {
                "so_quyet_dinh": { "value": "Dạng rút gọn để hiển thị. BẮT BUỘC dùng ngày kiểu số dd/m/yyyy (KHÔNG viết 'tháng…năm…'). Ví dụ ĐÚNG: '1220/QĐ-EVNNPC ngày 23/6/2026'. Ví dụ SAI: '1220/QĐ-EVNNPC ngày 23 tháng 6 năm 2026'.", "confidence": 95, "warning": "" },
                "qd_giao_a_day_du": { "value": "Hãy ghép thành một câu hoàn chỉnh theo ĐÚNG MẪU: 'Quyết định số [Số quyết định] ngày [dd/m/yyyy] của [Cơ quan ban hành] về việc [Nội dung]'. Phần ngày trong câu đầy đủ cũng phải là số (vd: ngày 23/6/2026), KHÔNG viết 'ngày 23 tháng 6 năm 2026'. CHÚ Ý: Phần [Nội dung] lấy toàn bộ text nằm ngay dưới chữ QUYẾT ĐỊNH và nằm ngay trên đường kẻ ngang ngắn (trước Điều 1). CHÚ Ý QUAN TRỌNG: Trong phần [Cơ quan ban hành], TUYỆT ĐỐI lược bỏ các chức danh (như Tổng Giám đốc, Phó Tổng Giám đốc, Giám đốc, Phó Giám đốc). CHỈ LẤY TÊN TỔ CHỨC. Phải viết hoa chuẩn xác (Ví dụ: 'Tổng Công ty Điện lực miền Bắc', không in hoa toàn bộ).", "confidence": 90, "warning": "" },
                "nam_giao_a": { "value": "Ví dụ: 2025", "confidence": 95, "warning": "" },
                "chu_dau_tu": { "value": "Hãy tìm cụm từ nằm giữa chữ 'cho' và chữ 'để' trong phần trích yếu nội dung quyết định (ví dụ: 'giao dự án ... cho Công ty Điện lực Hà Tĩnh để...'). Chỉ lấy chính xác tên đơn vị.", "confidence": 85, "warning": "" },
                "cap_dien_ap": { "value": "Ví dụ: 110kV", "confidence": 95, "warning": "" },
                "danh_sach_du_an": [
                    {
                        "ten_du_an": { "value": "Copy NGUYÊN VĂN toàn bộ tên công trình/dự án từ cột Tên dự án (hoặc Tên công trình) trong PHỤ LỤC bảng danh mục. KHÔNG rút gọn, KHÔNG tách bỏ phần địa danh nếu PDF ghi chung trong ô tên (vd: '..., tỉnh Quảng Ninh' phải giữ nguyên). KHÔNG tự thêm tỉnh nếu PDF không ghi trong ô tên.", "confidence": 95, "warning": "" },
                        "dia_diem": { "value": "Địa điểm khảo sát theo QUY TẮC: (1) Ưu tiên lấy từ cột 'Địa điểm' / 'Địa điểm khảo sát' trong phụ lục cho TỪNG dòng dự án. (2) Nếu phụ lục KHÔNG có cột địa điểm VÀ chủ đầu tư (sau chữ 'cho') là Công ty Điện lực tỉnh/TP → lấy tên tỉnh/TP đó (vd: Phú Thọ, Lào Cai). (3) Nếu chủ đầu tư là Ban Quản lý dự án Lưới điện / Ban Quản lý Dự án Phát triển Điện lực / Ban Quản lý dự án Xây dựng điện miền Bắc → CHỈ lấy từ cột phụ lục; nếu không có → để rỗng \"\".", "confidence": 95, "warning": "" },
                        "tmdt": { "value": "TMĐT cột phụ lục — ĐƠN VỊ Triệu VNĐ. LUÔN trả CHUỖI CHỈ GỒM CHỮ SỐ (không dấu chấm/phẩy). Ví dụ PDF ghi 93.500 → value \"93500\"; PDF ghi 55.397 → \"55397\"; PDF ghi 137.988 → \"137988\". TUYỆT ĐỐI KHÔNG trả số thập phân kiểu 93.5 (sẽ mất 100 lần). KHÔNG dùng kiểu number JSON.", "confidence": 90, "warning": "" },
                        "quy_mo": { "value": "Nội dung quy mô đầu tư của riêng công trình này. Nếu có nhiều hạng mục, mỗi hạng mục trên một dòng và PHẢI giữ dấu gạch đầu dòng '-' như trong PDF (ví dụ: '- Lắp đặt 29 bộ tiếp địa...\\n- Lắp đặt 75 quả chống sét...')", "confidence": 80, "warning": "Cảnh báo: Bản scan bị mờ ở dòng 2, nội dung suy đoán." }
                    }
                ]
            }
            Lưu ý: Nếu không tìm thấy thông tin nào, hãy để chuỗi rỗng "". Nếu có nhiều dự án, hãy liệt kê đầy đủ vào mảng danh_sach_du_an. Đặc biệt chú ý bóc tách đúng "quy_mo" cho từng dự án. Đối với quy_mo: TUYỆT ĐỐI giữ dấu "-" đầu dòng cho từng hạng mục, xuống dòng giữa các hạng mục như bảng gốc. TUYỆT ĐỐI KHÔNG tách phần tỉnh/TP ra khỏi ten_du_an sang dia_diem nếu PDF ghi chung trong ô tên dự án.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                {
                    role: 'user',
                    parts: [
                        { inlineData: { mimeType: 'application/pdf', data: base64Data } },
                        { text: prompt }
                    ]
                }
            ],
            config: {
                responseMimeType: "application/json",
            }
        });

        // Xử lý chuỗi JSON trả về bằng chuỗi thuần túy (Tuyệt đối không dùng Regex để tránh lỗi copy)
        let aiText = response.text || "";
        aiText = aiText.replace(/```json/g, "").replace(/```/g, "").trim();
        const jsonMatch = aiText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            aiText = jsonMatch[0];
        }

        const jsonData = JSON.parse(aiText);

        // LỚP BẢO VỆ 2: Post-processing (Dùng Regex loại bỏ sạch chức danh nếu AI vẫn lọt)
        if (jsonData.qd_giao_a_day_du && jsonData.qd_giao_a_day_du.value) {
            let cleaned = jsonData.qd_giao_a_day_du.value;
            // 1. Lọc bỏ các từ chỉ chức danh nằm sau chữ "của"
            cleaned = cleaned.replace(/của\s+(Tổng giám đốc|Phó tổng giám đốc|Giám đốc|Phó giám đốc)\s+/gi, 'của ');
            
            // 2. Chỉnh lại viết hoa đúng chuẩn nếu AI vẫn in hoa toàn bộ
            cleaned = cleaned.replace(/TỔNG CÔNG TY ĐIỆN LỰC MIỀN BẮC/g, 'Tổng Công ty Điện lực miền Bắc');
            cleaned = cleaned.replace(/TỔNG CÔNG TY/g, 'Tổng Công ty');
            cleaned = cleaned.replace(/CÔNG TY ĐIỆN LỰC/g, 'Công ty Điện lực');
            
            jsonData.qd_giao_a_day_du.value = cleaned;
        }

        normalizeQuyMoInScanJson(jsonData);
        normalizeTmdtInScanJson(jsonData);
        applyChuDauTuNormalization(jsonData);
        applyGiaoALocationRules(jsonData);

        return NextResponse.json(jsonData, { status: 200 });

    } catch (error) {
        console.error("Lỗi API Gemini:", error);
        const userMessage = buildParseGiaoAErrorMessage(error);
        const status = error?.status === 429 ? 429 : error?.status === 503 ? 503 : 500;
        return NextResponse.json({ error: userMessage }, { status });
    }
}