/**
 * Quy tắc địa điểm khảo sát từ QĐ Giao A
 * @see workflows/02_module_nhap_da.md
 */

function removeVietnameseTones(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

const CENTRAL_BAN_PATTERNS = [
  'ban quan ly du an luoi dien',
  'ban quan ly du an phat trien dien luc',
  'ban quan ly du an xay dung dien mien bac',
];

/** CĐT là một trong 3 Ban trung ương EVNNPC */
export function isCentralBanChuDauTu(chuDauTu) {
  const normalized = removeVietnameseTones(chuDauTu || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return false;
  return CENTRAL_BAN_PATTERNS.some((pattern) => normalized.includes(pattern));
}

/** Suy tỉnh/TP từ "Công ty Điện lực …" khi phụ lục không có cột địa điểm */
export function extractProvinceFromCongTyDienLuc(chuDauTu) {
  const raw = (chuDauTu || '').trim();
  if (!raw) return '';

  const match = raw.match(
    /C[oô]ng\s+ty\s+[ĐD]i[eệ]n\s+l[cự]c\s+(?:t[iỉ]nh\s+|TP\.?\s*|Th[aà]nh\s+ph[oố]\s+)?(.+?)(?:\s+đ[eể]\b|$)/iu
  );
  if (!match) return '';

  let province = match[1].trim();
  province = province.replace(/\s*(đ[eể]|thực\s+hiện).*$/iu, '').trim();
  return province;
}

/**
 * @returns {{ value: string, confidence: number, warning: string, requiresManual: boolean }}
 */
export function resolveDiaDiemKs({
  diaDiemAppendix = '',
  chuDauTu = '',
  existingConf = 95,
  existingWarn = '',
} = {}) {
  const appendix = String(diaDiemAppendix || '').trim();

  if (appendix) {
    return {
      value: appendix,
      confidence: existingConf ?? 95,
      warning: existingWarn || '',
      requiresManual: false,
    };
  }

  if (isCentralBanChuDauTu(chuDauTu)) {
    return {
      value: '',
      confidence: 0,
      warning:
        'Không xác định được địa điểm từ phụ lục. CĐT là Ban trung ương — vui lòng nhập tay địa điểm khảo sát.',
      requiresManual: true,
    };
  }

  const fromCdt = extractProvinceFromCongTyDienLuc(chuDauTu);
  if (fromCdt) {
    return {
      value: fromCdt,
      confidence: Math.min(existingConf ?? 85, 85),
      warning:
        existingWarn ||
        'Suy ra từ tên Công ty Điện lực (phụ lục không có cột địa điểm). Vui lòng đối chiếu PDF.',
      requiresManual: false,
    };
  }

  return {
    value: '',
    confidence: 0,
    warning: 'Không xác định được địa điểm khảo sát. Vui lòng nhập tay.',
    requiresManual: true,
  };
}

/** Chuẩn hóa tên dự án: giữ nguyên nội dung, chỉ trim khoảng trắng thừa */
export function normalizeTenDuAn(tenDuAn) {
  return String(tenDuAn || '').replace(/\s+/g, ' ').trim();
}
