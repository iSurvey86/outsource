/**
 * Gợi ý / siết giai đoạn sau quét HĐ — tách file để smoke test không kéo toàn sổ HĐ.
 */
import { formatGiaiDoanBadge, formatGiaiDoanFullName } from "./giaiDoanOrder.js";

/** Chuẩn hoá text gói thầu / HĐ để dò giai đoạn */
export function normalizeHopDongScopeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Dò gợi ý giai đoạn từ nội dung gói thầu / HĐ đầy đủ (sau quét AI).
 * - Có BCNCKT/FS + (TKKT | BCKTKT | TKBVTC) → nhiều giai đoạn
 * - Chỉ một phía → một giai đoạn
 */
export function detectHopDongPhaseHints(text) {
  const t = normalizeHopDongScopeText(text);
  if (!t) {
    return { hasFs: false, hasThietKe: false, hasBcktkt: false, hasTkbvtc: false, hasTkkt: false };
  }

  const hasFs =
    /\bbcnckt\b/.test(t) ||
    /\bfs\b/.test(t) ||
    /nghien cuu kha thi/.test(t) ||
    /bao cao nghien cuu kha thi/.test(t);

  const hasTkbvtc = /\btkbvtc(?:\s*[-–]?\s*dt)?\b/.test(t) || /ban ve thi cong/.test(t);
  const hasBcktkt = /\bbcktkt\b/.test(t) || /kinh te ky thuat/.test(t);
  const hasTkkt = /\btkkt\b/.test(t) || /\bktkt\b/.test(t);
  const hasThietKe = hasTkbvtc || hasBcktkt || hasTkkt;

  return { hasFs, hasThietKe, hasBcktkt, hasTkbvtc, hasTkkt };
}

/** Chuẩn hoá badge giai đoạn để so khớp gợi ý HĐ (FS ≡ BCNCKT). */
export function normalizeHopDongPhaseKey(giaiDoanOrBadge) {
  const badge = formatGiaiDoanBadge(giaiDoanOrBadge);
  if (badge === "FS" || badge === "BCNCKT") return "FS";
  if (badge === "BCKTKT") return "BCKTKT";
  if (badge === "TKBVTC") return "TKBVTC";
  return "";
}

/**
 * Giai đoạn HĐ gợi ý: ưu tiên giai_doan_values (bảng giá), thiếu thì dò chữ gói thầu/HĐ.
 * @returns {{ keys: string[], source: string } | null}
 */
export function resolveSuggestedPhaseBadges({ scopeText = "", giaiDoanValues = [] } = {}) {
  const fromValues = new Set();
  for (const g of giaiDoanValues || []) {
    const k = normalizeHopDongPhaseKey(g?.giai_doan);
    if (k) fromValues.add(k);
  }
  if (fromValues.size) {
    return { keys: [...fromValues], source: "giai_doan_values" };
  }

  const hints = detectHopDongPhaseHints(scopeText);
  const keys = [];
  if (hints.hasFs) keys.push("FS");
  if (hints.hasBcktkt) keys.push("BCKTKT");
  if (hints.hasTkbvtc) keys.push("TKBVTC");
  if (hints.hasTkkt && !keys.includes("TKBVTC") && !keys.includes("BCKTKT")) {
    keys.push("TKBVTC");
  }
  if (!keys.length && hints.hasThietKe) keys.push("TKBVTC");
  if (!keys.length) return null;
  return { keys, source: "text" };
}

/** Gợi ý hẹp = chỉ FS hoặc chỉ thiết kế (không phải cả hai). */
export function isNarrowPhaseSuggestion(suggestedKeys = []) {
  if (!suggestedKeys?.length) return false;
  const hasFs = suggestedKeys.includes("FS");
  const hasTk = suggestedKeys.includes("BCKTKT") || suggestedKeys.includes("TKBVTC");
  return (hasFs && !hasTk) || (!hasFs && hasTk);
}

export function phaseBadgeMatchesSuggestion(giaiDoanOrBadge, suggestedKeys = []) {
  if (!suggestedKeys?.length) return true;
  const k = normalizeHopDongPhaseKey(giaiDoanOrBadge);
  if (!k) return true;
  return suggestedKeys.includes(k);
}

function labelSuggestedPhaseKeys(keys = []) {
  return keys
    .map((k) => (k === "FS" ? "FS/BCNCKT" : k))
    .filter(Boolean)
    .join(" · ");
}

export function formatSuggestedPhaseKeysLabel(suggestedKeys = []) {
  return labelSuggestedPhaseKeys(suggestedKeys);
}

/**
 * Sau quét: nếu HĐ chỉ gợi ý một phía giai đoạn → bỏ tích mã không khớp
 * (kể cả giai đoạn đang mở nếu lệch). HĐ nhiều giai đoạn → giữ nguyên.
 */
export function refineMaDuAnsAfterHopDongScan({
  candidateMas = [],
  openMaDuAn = "",
  projects = [],
  siblings = [],
  scopeText = "",
  giaiDoanValues = [],
} = {}) {
  const candidates = [...new Set((candidateMas || []).filter(Boolean))];
  const resolved = resolveSuggestedPhaseBadges({ scopeText, giaiDoanValues });
  if (!resolved || !isNarrowPhaseSuggestion(resolved.keys)) {
    return {
      maDuAns: candidates,
      suggestedKeys: resolved?.keys || [],
      openMismatch: false,
      trimmed: false,
      warning: "",
    };
  }

  const byMa = new Map();
  for (const p of [...(projects || []), ...(siblings || [])]) {
    const ma = String(p?.ma_du_an || "").trim();
    if (ma) byMa.set(ma, p);
  }

  const matchesMa = (ma) => {
    const p = byMa.get(ma);
    return phaseBadgeMatchesSuggestion(p?.giai_doan_chuan || p?.giai_doan, resolved.keys);
  };

  let next = candidates.filter(matchesMa);
  if (!next.length) {
    next = (siblings || [])
      .map((p) => p?.ma_du_an)
      .filter((ma) => ma && matchesMa(ma));
  }
  next = [...new Set(next.filter(Boolean))];

  const openMa = String(openMaDuAn || "").trim();
  const openP = openMa ? byMa.get(openMa) : null;
  const openGd = openP?.giai_doan_chuan || openP?.giai_doan || "";
  const openMismatch = Boolean(openMa) && !phaseBadgeMatchesSuggestion(openGd, resolved.keys);
  const trimmed = candidates.some((ma) => !next.includes(ma));

  const sugLabel = labelSuggestedPhaseKeys(resolved.keys);
  const openLabel =
    formatGiaiDoanFullName(openGd) || formatGiaiDoanBadge(openGd) || "đang mở";

  let warning = "";
  if (openMismatch) {
    warning = `Đang mở «${openLabel}» nhưng HĐ chỉ gợi ý ${sugLabel}. Đã bỏ tích giai đoạn đang mở — kiểm tra trước khi lưu.`;
  } else if (trimmed) {
    warning = `HĐ gợi ý ${sugLabel} — đã bỏ các giai đoạn không khớp trong phạm vi đã chọn.`;
  }

  return {
    maDuAns: next,
    suggestedKeys: resolved.keys,
    openMismatch,
    trimmed,
    warning,
  };
}

/** Mã đang chọn nằm ngoài gợi ý hẹp (dùng khi lưu). */
export function findMaDuAnsOutsidePhaseSuggestion(selectedMas = [], projects = [], suggestedKeys = []) {
  if (!isNarrowPhaseSuggestion(suggestedKeys)) return [];
  const byMa = new Map(
    (projects || [])
      .filter((p) => p?.ma_du_an)
      .map((p) => [p.ma_du_an, p])
  );
  return [...new Set((selectedMas || []).filter(Boolean))].filter((ma) => {
    const p = byMa.get(ma);
    return !phaseBadgeMatchesSuggestion(p?.giai_doan_chuan || p?.giai_doan, suggestedKeys);
  });
}
