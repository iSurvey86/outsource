/** So sánh kết quả TN nước với cột Yêu cầu — ngoài giới hạn → true (tô đỏ). */

function parseVnNumber(raw) {
  const m = String(raw ?? "")
    .trim()
    .replace(/\s/g, "")
    .match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return null;
  return Number.parseFloat(m[0].replace(",", "."));
}

function normalizeText(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * @param {string} yeuCau — VD: "4 – 12,5" | "< 350 mg/l" | "Không có"
 * @param {string} ketQua
 * @returns {boolean} true nếu có kết quả và nằm ngoài giới hạn tham chiếu
 */
export function isTnNuocKetQuaOutOfSpec(yeuCau, ketQua) {
  const y = String(yeuCau ?? "").trim();
  const k = String(ketQua ?? "").trim();
  if (!y || !k) return false;

  const yNorm = normalizeText(y);
  const kNorm = normalizeText(k);

  // Yêu cầu định tính: Không có
  if (/^khong\s*co$/.test(yNorm)) {
    if (/^(khong(\s*co)?|0|-|—|–|nd|n\/a)$/.test(kNorm)) return false;
    const n = parseVnNumber(k);
    if (n != null && n > 0) return true;
    if (/^co$/.test(kNorm) || /co\s|phat|phat\s*hien/.test(kNorm)) return true;
    // Chuỗi khác «không có» → coi là có dầu mỡ → ngoài yêu cầu
    return true;
  }

  // Khoảng: 4 – 12,5 | 4-12.5 | 4 ~ 12,5
  const range = y.match(/(-?\d+(?:[.,]\d+)?)\s*[–—\-~÷]\s*(-?\d+(?:[.,]\d+)?)/);
  if (range) {
    const min = Number.parseFloat(range[1].replace(",", "."));
    const max = Number.parseFloat(range[2].replace(",", "."));
    const v = parseVnNumber(k);
    if (v == null || Number.isNaN(min) || Number.isNaN(max)) return false;
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    return v < lo || v > hi;
  }

  // < / ≤ giới hạn — VD: "< 350 mg/l" | "<600mg/l" | "≤ 15"
  const lt = y.match(/(≤|<=|<)\s*(-?\d+(?:[.,]\d+)?)/);
  if (lt) {
    const lim = Number.parseFloat(lt[2].replace(",", "."));
    const v = parseVnNumber(k);
    if (v == null || Number.isNaN(lim)) return false;
    const inclusive = lt[1] === "≤" || lt[1] === "<=";
    return inclusive ? v > lim : v >= lim;
  }

  // > / ≥ giới hạn — VD: "> 5" | "≥ 1,5"
  const gt = y.match(/(≥|>=|>)\s*(-?\d+(?:[.,]\d+)?)/);
  if (gt) {
    const lim = Number.parseFloat(gt[2].replace(",", "."));
    const v = parseVnNumber(k);
    if (v == null || Number.isNaN(lim)) return false;
    const inclusive = gt[1] === "≥" || gt[1] === ">=";
    return inclusive ? v < lim : v <= lim;
  }

  return false;
}
