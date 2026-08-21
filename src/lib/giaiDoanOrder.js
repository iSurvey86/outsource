/** Thứ tự chuẩn giai đoạn: FS (BCNCKT) → BCKTKT → TKBVTC */

export function normalizeGiaiDoanChuan(gd) {
  const g = String(gd || "")
    .trim()
    .toUpperCase();
  if (g === "FS" || g === "BCNCKT") return "BCNCKT";
  if (g === "TKKT-TKBVTC") return "TKBVTC";
  return g;
}

export function getGiaiDoanPhaseWeight(gd) {
  const g = normalizeGiaiDoanChuan(gd);
  if (g === "BCNCKT") return 1;
  if (g === "BCKTKT") return 2;
  if (g === "TKBVTC") return 3;
  return 99;
}

export function compareProjectsByGiaiDoan(a, b) {
  const w = getGiaiDoanPhaseWeight(a?.giai_doan) - getGiaiDoanPhaseWeight(b?.giai_doan);
  if (w !== 0) return w;
  return String(a?.ma_du_an || "").localeCompare(String(b?.ma_du_an || ""), "vi");
}

export function sortProjectsByGiaiDoan(projects) {
  return [...(projects || [])].sort(compareProjectsByGiaiDoan);
}

/** Nhãn ngắn trên badge — FS thay cho BCNCKT trong UI */
export function formatGiaiDoanBadge(gd) {
  const g = String(gd || "").trim();
  const u = g.toUpperCase();
  if (u === "FS" || u === "BCNCKT") return "FS";
  if (u === "TKKT-TKBVTC") return "TKBVTC";
  return g || "—";
}

/**
 * Suy giai đoạn từ mã DA khi danh mục thiếu / chưa load (vd. TH-2025-FS-…, …-TKBVTC-…).
 */
export function inferGiaiDoanFromMaDuAn(maDuAn) {
  const ma = String(maDuAn || "").toUpperCase();
  if (!ma) return "";
  if (/(^|-)TKBVTC(-|$)/.test(ma) || /(^|-)TKKT-TKBVTC(-|$)/.test(ma)) return "TKBVTC";
  if (/(^|-)BCKTKT(-|$)/.test(ma)) return "BCKTKT";
  if (/(^|-)BCNCKT(-|$)/.test(ma) || /(^|-)FS(-|$)/.test(ma)) return "FS";
  // Mã rút gọn kiểu …-TK-… (không nhầm với TKBVTC đã bắt ở trên)
  if (/(^|-)TK(-|$)/.test(ma)) return "TKBVTC";
  return "";
}

/** Badge giai đoạn từ object dự án hoặc mã DA */
export function resolveGiaiDoanBadge(projectOrPhase, maDuAnFallback = "") {
  const gd =
    projectOrPhase?.giai_doan_chuan ||
    projectOrPhase?.giai_doan ||
    inferGiaiDoanFromMaDuAn(projectOrPhase?.ma_du_an || maDuAnFallback);
  return formatGiaiDoanBadge(gd);
}

/** Tên đầy đủ giai đoạn — kèm mã ngắn (FS / BCKTKT / TKBVTC) */
export function formatGiaiDoanFullName(gd) {
  const badge = formatGiaiDoanBadge(gd);
  if (badge === "FS") return "Báo cáo nghiên cứu khả thi";
  if (badge === "BCKTKT") return "Báo cáo kinh tế kỹ thuật";
  if (badge === "TKBVTC") return "Thiết kế bản vẽ thi công";
  return badge !== "—" ? badge : "";
}

/** Dòng hiển thị: FS = Báo cáo nghiên cứu khả thi */
export function formatGiaiDoanWithFullName(gd) {
  const badge = formatGiaiDoanBadge(gd);
  const full = formatGiaiDoanFullName(gd);
  if (!full || full === badge) return badge;
  return `${badge} = ${full}`;
}

export function formatGiaiDoanList(projects) {
  return sortProjectsByGiaiDoan(projects)
    .map((p) => formatGiaiDoanBadge(p.giai_doan))
    .join(" · ");
}
