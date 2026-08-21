/** Chuẩn hóa hậu tố QĐ: QĐ-EVNNPC */
export function normalizeQdOrgSuffix(org) {
  if (!org) return "QĐ-EVNNPC";
  const cleaned = org.replace(/\s+/g, "");
  const suffix = cleaned.replace(/^(?:Q[ĐđD]|q[đd])[-\s]?/i, "").toUpperCase();
  return suffix ? `QĐ-${suffix}` : "QĐ-EVNNPC";
}

/** d/m/yyyy — bỏ số 0 thừa (24/7/2026) */
function toSlashDate(day, month, year) {
  let y = String(year);
  if (y.length === 2) y = `20${y}`;
  return `${Number(day)}/${Number(month)}/${y}`;
}

/** «ngày 24 tháng 7 năm 2026» → «ngày 24/7/2026» (giữ nguyên phần còn lại) */
export function normalizeVietnameseGiaoADate(text) {
  if (!text) return text;
  return String(text).replace(
    /ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{2,4})/gi,
    (_, d, m, y) => `ngày ${toSlashDate(d, m, y)}`
  );
}

/**
 * Hiển thị Giao A dạng ngắn: 67/QĐ-EVNNPC ngày 16/01/2026
 * @param {{ wrapDate?: boolean }} [options] wrapDate=true → xuống dòng sau «ngày» (bảng danh mục)
 */
export function formatGiaoAShort(qdGiaoA, qdGiaoADayDu = "", options = {}) {
  const wrapDate = Boolean(options?.wrapDate);
  const sep = wrapDate ? "ngày\n" : "ngày ";
  const raw = normalizeVietnameseGiaoADate((qdGiaoA || "").trim());
  const full = normalizeVietnameseGiaoADate((qdGiaoADayDu || "").trim());
  if (!raw && !full) return "-";

  const combined = raw && !/ngày/i.test(raw) && full ? `${raw} ${full}` : raw || full;

  const inline = combined.match(
    /(\d+)\s*[/\\-]\s*((?:Q[ĐđD]|q[đd])[-\w]*)[^\n,;]*?\s+ngày\s+(\d{1,2})[/\\.-](\d{1,2})[/\\.-]((\d{4})|(\d{2}))/i
  );
  if (inline) {
    const org = normalizeQdOrgSuffix(inline[2]);
    const year = inline[5] || `20${inline[6]}`;
    return `${inline[1]}/${org} ${sep}${Number(inline[3])}/${Number(inline[4])}/${year}`;
  }

  const fromFull = combined.match(
    /số\s*(\d+)\s*(?:[/\\-]\s*((?:Q[ĐđD]|q[đd])[-\w]*))?[^\n,;]*?ngày\s+(\d{1,2})[/\\.-](\d{1,2})[/\\.-]((\d{4})|(\d{2}))/i
  );
  if (fromFull) {
    const org = normalizeQdOrgSuffix(fromFull[2]);
    const year = fromFull[5] || `20${fromFull[6]}`;
    return `${fromFull[1]}/${org} ${sep}${Number(fromFull[3])}/${Number(fromFull[4])}/${year}`;
  }

  if (raw) {
    if (wrapDate && /\s+ngày\s+/i.test(raw)) {
      return raw.replace(/\s+ngày\s+/i, " ngày\n");
    }
    return raw;
  }
  if (wrapDate && /\s+ngày\s+/i.test(full)) {
    return full.replace(/\s+ngày\s+/i, " ngày\n");
  }
  return full.length > 55 ? `${full.slice(0, 52)}...` : full;
}

/** Tiêu đề hiển thị: Giao A số 1220/QĐ-EVNNPC ngày 23/6/2026 */
export function formatGiaoATitleLabel(qdGiaoA, qdGiaoADayDu = "", fallback = "—") {
  const short = formatGiaoAShort(qdGiaoA, qdGiaoADayDu);
  if (short !== "-") return `Giao A số ${short}`;
  const raw = (qdGiaoA || "").trim();
  if (raw) return `Giao A số ${raw}`;
  return fallback;
}
