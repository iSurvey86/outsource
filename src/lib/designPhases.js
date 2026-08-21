/**
 * Quy tắc phân loại bước thiết kế theo ngày Giao A + TMĐT (đơn vị: triệu đồng — Tr.đ)
 *
 * Giai đoạn 1: 05/08/2015 – 29/12/2024  → mốc 15 tỷ  (< 15: BCKTKT | ≥ 15: FS+TKBVTC)
 * Giai đoạn 2: 30/12/2024 – 30/06/2026  → mốc 20 tỷ  (≤ 20: BCKTKT | > 20: FS+TKBVTC)
 * Giai đoạn 3: từ 01/07/2026 (NĐ 217)    → mốc 40 tỷ  (≤ 40: BCKTKT | > 40: FS+TKBVTC)
 */

const MS_DAY = 86400000;

const PERIOD1_START = utcDate(2015, 8, 5);
const PERIOD1_END = utcDate(2024, 12, 29);
const PERIOD2_START = utcDate(2024, 12, 30);
const PERIOD2_END = utcDate(2026, 6, 30);
const PERIOD3_START = utcDate(2026, 7, 1);

const THRESHOLD_TY_PERIOD1 = 15;
const THRESHOLD_TY_PERIOD2 = 20;
const THRESHOLD_TY_PERIOD3 = 40;

function utcDate(y, m, d) {
  return Date.UTC(y, m - 1, d);
}

/** Tr.đ (triệu) từ số tỷ */
export function tyToTrD(ty) {
  return ty * 1000;
}

/**
 * Chuẩn hoá TMĐT về triệu đồng (Tr.đ).
 *
 * Phụ lục Giao A thường ghi kiểu Việt: 93.500 (= 93.500 triệu = 93,5 tỷ).
 * JSON number từ AI dễ thành 93.5 → nếu chỉ strip dấu sẽ ra 935 (sai ~100 lần).
 *
 * Quy tắc:
 * - "93.500" / "1.234.567" (nhóm 3 chữ số) → bỏ chấm → 93500 / 1234567
 * - "93.5" / "94.42" (1–2 số lẻ, nghi float cắt số 0) → pad phần lẻ đủ 3 → 93500 / 94420
 * - "93500" / "93,500" → số nguyên Triệu
 */
export function parseTmdtTrD(raw) {
  if (raw == null || raw === '') return 0;

  let s;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (Number.isInteger(raw)) return raw > 0 ? raw : 0;
    // Giữ phần thập phân như AI trả (93.5, 94.42, 55.397) — không dùng toString khoa học
    s = String(raw);
  } else {
    s = String(raw).trim().replace(/\s/g, '');
  }
  if (!s) return 0;

  // Dạng Việt đủ nhóm nghìn: 93.500 | 1.234.567
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    return parseInt(s.replace(/\./g, ''), 10) || 0;
  }
  // Cùng kiểu nhưng dấu phẩy: 93,500 | 1,234,567
  if (/^\d{1,3}(,\d{3})+$/.test(s)) {
    return parseInt(s.replace(/,/g, ''), 10) || 0;
  }
  // Float bị cắt zero từ nhóm nghìn VN: 93.5 → 93.500; 94.42 → 94.420
  const trunc = s.match(/^(\d{1,3})\.(\d{1,2})$/);
  if (trunc) {
    return parseInt(trunc[1] + trunc[2].padEnd(3, '0'), 10) || 0;
  }
  // "93500" hoặc chuỗi lẫn dấu
  const stripped = parseFloat(s.replace(/[,.\s]/g, ''));
  return Number.isFinite(stripped) && stripped > 0 ? stripped : 0;
}

/**
 * Gợi ý nhân 10/100 khi TMĐT đã lưu bị co (hậu quả parse cũ),
 * chỉ khi kết quả nằm vùng TMĐT phụ lục hợp lý (10 nghìn – 500 nghìn Tr.đ).
 */
export function suggestRecoveredTmdtTrD(storedRaw) {
  const n = typeof storedRaw === 'number' ? storedRaw : parseFloat(String(storedRaw || '').replace(/[,.\s]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 10000) return null;
  const hits = [10, 100]
    .map((f) => n * f)
    .filter((v) => v >= 10000 && v <= 500000);
  if (hits.length === 1) return hits[0];
  if (hits.length === 2) return n < 1000 ? n * 100 : n * 10;
  return null;
}

/** Parse ngày Giao A từ Số QĐ / dòng QĐ đầy đủ (vd: ... ngày 14/01/2026 hoặc ngày 24 tháng 7 năm 2026) */
export function parseGiaoADate(qdGiaoA, qdGiaoADayDu = '') {
  const sources = [qdGiaoADayDu, qdGiaoA].filter(Boolean).join(' ');
  if (!sources.trim()) return null;

  const slash = sources.match(/ngày\s*(\d{1,2})[\/.\-](\d{1,2})[\/.\-]((\d{4})|(\d{2}))/i);
  if (slash) {
    const day = parseInt(slash[1], 10);
    const month = parseInt(slash[2], 10);
    let year = slash[3] ? parseInt(slash[3], 10) : parseInt(slash[4], 10);
    if (year < 100) year += 2000;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return utcDate(year, month, day);
    }
  }

  const longVi = sources.match(/ngày\s*(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{2,4})/i);
  if (longVi) {
    const day = parseInt(longVi[1], 10);
    const month = parseInt(longVi[2], 10);
    let year = parseInt(longVi[3], 10);
    if (year < 100) year += 2000;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return utcDate(year, month, day);
    }
  }
  return null;
}

/** Tách năm Giao A (dùng sinh mã dự án) */
export function extractNamGiaoA(qdGiaoA, qdGiaoADayDu = '') {
  const parsed = parseGiaoADate(qdGiaoA, qdGiaoADayDu);
  if (parsed != null) return String(new Date(parsed).getUTCFullYear());

  const sources = [qdGiaoADayDu, qdGiaoA].filter(Boolean).join(' ');
  const yearMatch = sources.match(/\b(20\d{2})\b/);
  return yearMatch ? yearMatch[1] : '';
}

/** Giá trị filter đặc biệt: dự án chưa có năm Giao A */
export const FILTER_NAM_CHUA_CO = '__chua_co_nam__';

export function isValidNamGiaoA(value) {
  if (value == null || String(value).trim() === '') return false;
  const y = Number(value);
  return !Number.isNaN(y) && y > 1900 && y < 2100;
}

export function formatNamGiaoA(value, missingLabel = 'Chưa có năm') {
  return isValidNamGiaoA(value) ? String(Number(value)) : missingLabel;
}

export function projectMatchesNamFilter(project, filterNam) {
  if (!filterNam) return true;
  if (filterNam === FILTER_NAM_CHUA_CO) return !isValidNamGiaoA(project?.nam_giao_a);
  return String(project?.nam_giao_a) === String(filterNam);
}

/**
 * @returns {'period1'|'period2'|'period3'}
 * Trước 05/08/2015 → period1; không parse được ngày → period2 (mốc 20 tỷ)
 */
export function getRegulatoryPeriod(qdGiaoA, qdGiaoADayDu = '') {
  const ts = parseGiaoADate(qdGiaoA, qdGiaoADayDu);
  if (ts == null) return 'period2';

  if (ts < PERIOD1_START) return 'period1';
  if (ts <= PERIOD1_END) return 'period1';
  if (ts >= PERIOD2_START && ts <= PERIOD2_END) return 'period2';
  if (ts >= PERIOD3_START) return 'period3';

  return 'period2';
}

export function getPeriodMeta(period) {
  switch (period) {
    case 'period1':
      return {
        period,
        label: '05/08/2015 – 29/12/2024',
        thresholdTy: THRESHOLD_TY_PERIOD1,
        thresholdTrD: tyToTrD(THRESHOLD_TY_PERIOD1),
        singlePhaseOp: '<',
        twoPhaseOp: '≥',
      };
    case 'period3':
      return {
        period,
        label: 'từ 01/07/2026 (NĐ 217/2026)',
        thresholdTy: THRESHOLD_TY_PERIOD3,
        thresholdTrD: tyToTrD(THRESHOLD_TY_PERIOD3),
        singlePhaseOp: '≤',
        twoPhaseOp: '>',
      };
    default:
      return {
        period: 'period2',
        label: '30/12/2024 – 30/06/2026',
        thresholdTy: THRESHOLD_TY_PERIOD2,
        thresholdTrD: tyToTrD(THRESHOLD_TY_PERIOD2),
        singlePhaseOp: '≤',
        twoPhaseOp: '>',
      };
  }
}

/** true = cần 2 bước (FS + TKBVTC) */
export function usesTwoDesignSteps(qdGiaoA, qdGiaoADayDu, tmdtRaw) {
  const tmdt = parseTmdtTrD(tmdtRaw);
  const period = getRegulatoryPeriod(qdGiaoA, qdGiaoADayDu);

  if (period === 'period1') return tmdt >= tyToTrD(THRESHOLD_TY_PERIOD1);
  if (period === 'period3') return tmdt > tyToTrD(THRESHOLD_TY_PERIOD3);
  return tmdt > tyToTrD(THRESHOLD_TY_PERIOD2);
}

/** @returns {('BCKTKT'|'FS'|'TKBVTC')[]} */
export function getDesignPhases(qdGiaoA, qdGiaoADayDu, tmdtRaw) {
  return usesTwoDesignSteps(qdGiaoA, qdGiaoADayDu, tmdtRaw)
    ? ['FS', 'TKBVTC']
    : ['BCKTKT'];
}

export function getDesignPhasesForProject(qdGiaoA, qdGiaoADayDu, tmdtRaw) {
  const period = getRegulatoryPeriod(qdGiaoA, qdGiaoADayDu);
  const meta = getPeriodMeta(period);
  const phases = getDesignPhases(qdGiaoA, qdGiaoADayDu, tmdtRaw);
  return { phases, period, meta };
}

export function describePhaseRule(qdGiaoA, qdGiaoADayDu) {
  const { meta } = getDesignPhasesForProject(qdGiaoA, qdGiaoADayDu, 0);
  if (meta.period === 'period1') {
    return `Giao A ${meta.label}: TMĐT ${meta.singlePhaseOp} ${meta.thresholdTy} tỷ → BCKTKT; ${meta.twoPhaseOp} ${meta.thresholdTy} tỷ → FS + TKBVTC.`;
  }
  return `Giao A ${meta.label}: TMĐT ${meta.singlePhaseOp} ${meta.thresholdTy} tỷ → BCKTKT; ${meta.twoPhaseOp} ${meta.thresholdTy} tỷ → FS + TKBVTC.`;
}

export function getMergeToSinglePhaseMessage(qdGiaoA, qdGiaoADayDu, tmdtRaw) {
  const tmdt = parseTmdtTrD(tmdtRaw);
  const { meta } = getDesignPhasesForProject(qdGiaoA, qdGiaoADayDu, tmdt);
  return (
    `TMĐT điều chỉnh (${tmdt.toLocaleString('vi-VN')} Tr.đ) thuộc diện 1 bước thiết kế ` +
    `(mốc ${meta.thresholdTy} tỷ — ${meta.label}).\n\n` +
    `Hệ thống sẽ GỘP về giai đoạn BCKTKT và XÓA bản ghi TKBVTC (nếu có).\n\n` +
    `Anh có chắc chắn muốn thực hiện?`
  );
}
