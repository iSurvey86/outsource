/**
 * Đối chiếu tổng sau quét HĐ: Σ giai đoạn (+ chi phí chung, TNCTTT) ?=? trước VAT điều khoản.
 */

import { formatGiaiDoanBadge } from "./giaiDoanOrder.js";
import { MONEY_TOLERANCE, toMoneyNumber } from "./hopDongBangGia.js";

function toNum(v) {
  return toMoneyNumber(v);
}

function fmt(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  try {
    return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(n)} đ`;
  } catch {
    return `${n} đ`;
  }
}

function applyPercentDiscount(amount, tyLePct) {
  const a = toNum(amount);
  const r = toNum(tyLePct);
  if (a == null || r == null || r <= 0) return a;
  return Math.round(a * (1 - r / 100));
}

function shouldApplyTnctttScale(rowsSum, truocVat, tyLePct) {
  const sum = toNum(rowsSum);
  const legal = toNum(truocVat);
  const r = toNum(tyLePct);
  if (sum == null || legal == null || r == null || r <= 0 || sum <= 0) return false;
  if (Math.abs(sum - legal) <= MONEY_TOLERANCE) return false;
  const net = applyPercentDiscount(sum, r);
  return net != null && Math.abs(net - legal) <= MONEY_TOLERANCE;
}

function normalizeChiet(raw) {
  if (!raw || typeof raw !== "object") {
    return { co_chiet_giam: false, ty_le: null };
  }
  const ty = toNum(raw.ty_le);
  return {
    co_chiet_giam: Boolean(raw.co_chiet_giam) || (ty != null && ty > 0),
    ty_le: ty,
  };
}

/**
 * Hậu kiểm AI: tổng giai_doan_values vs trước VAT — phát hiện thiếu giai đoạn (vd. chỉ FS).
 * @returns {{ warning: string, badges: string[], sumPhases: number|null, likelyMissing: string }}
 */
export function assessGiaiDoanValuesCoverage(giaiDoanValues = [], truocVat) {
  const list = Array.isArray(giaiDoanValues) ? giaiDoanValues : [];
  const badges = [];
  let sumPhases = 0;
  let hasAny = false;
  for (const g of list) {
    const badge = formatGiaiDoanBadge(g?.giai_doan);
    if (badge && badge !== "—") badges.push(badge);
    const gia = toNum(g?.gia_tri_hd);
    if (gia != null) {
      sumPhases += gia;
      hasAny = true;
    }
  }
  const uniqueBadges = [...new Set(badges)];
  const legal = toNum(truocVat);
  const sum = hasAny ? sumPhases : null;

  if (legal == null || sum == null) {
    return { warning: "", badges: uniqueBadges, sumPhases: sum, likelyMissing: "" };
  }
  if (Math.abs(sum - legal) <= MONEY_TOLERANCE) {
    return { warning: "", badges: uniqueBadges, sumPhases: sum, likelyMissing: "" };
  }

  let likelyMissing = "";
  if (uniqueBadges.length === 1 && legal > sum * 1.15) {
    const have = uniqueBadges[0];
    if (have === "FS" || have === "BCNCKT" || have === "BCKTKT") likelyMissing = "TKBVTC";
    else if (have === "TKBVTC") likelyMissing = "FS";
  }

  const warning = likelyMissing
    ? `Thiếu giai đoạn ${likelyMissing} trên bảng giá trị (đã đọc: ${uniqueBadges.join(", ")}; tổng ${fmt(sum)} ≠ trước VAT ${fmt(legal)}).`
    : `Tổng các giai đoạn đã đọc (${fmt(sum)}) ≠ giá trị trước VAT trên điều khoản (${fmt(legal)}).`;

  return { warning, badges: uniqueBadges, sumPhases: sum, likelyMissing };
}

/**
 * Báo cáo ĐÃ KHỚP / CHƯA KHỚP cho UI sau quét / panel meta.
 */
export function buildHopDongTongMatchReport({
  rowsSum,
  chiPhiChungSum = 0,
  truocVat,
  chietGiam,
  coverageWarning = "",
  likelyMissing = "",
} = {}) {
  const rows = toNum(rowsSum);
  const chung = toNum(chiPhiChungSum) || 0;
  const legal = toNum(truocVat);
  const combined = rows != null ? rows + chung : chung > 0 ? chung : null;
  const chiet = normalizeChiet(chietGiam);

  if (combined == null || legal == null) {
    return {
      matched: null,
      title: "",
      reason: "",
      fix: "",
      combined,
      legal,
      text: "",
    };
  }

  if (Math.abs(combined - legal) <= MONEY_TOLERANCE) {
    return {
      matched: true,
      title: "ĐÃ KHỚP",
      reason: "",
      fix: "",
      combined,
      legal,
      text: `ĐÃ KHỚP — tổng giai đoạn${chung > 0 ? " + chi phí chung" : ""} = giá trị HĐ trước VAT (${fmt(legal)}).`,
    };
  }

  if (chiet.ty_le && shouldApplyTnctttScale(combined, legal, chiet.ty_le)) {
    const net = applyPercentDiscount(combined, chiet.ty_le);
    return {
      matched: true,
      title: "ĐÃ KHỚP",
      reason: `Tổng bảng đang là số trước giảm TNCTTT ${chiet.ty_le}% → sau giảm ≈ ${fmt(net)}.`,
      fix: "Bấm «Áp dụng % lên cột HĐ» hoặc quét lại để điền net.",
      combined,
      legal,
      text: [
        "ĐÃ KHỚP (sau TNCTTT)",
        `Lý do: tổng bảng ${fmt(combined)} − ${chiet.ty_le}% ≈ trước VAT ${fmt(legal)}.`,
        "Cách xử lý: Áp dụng % lên cột HĐ hoặc quét lại.",
      ].join("\n"),
    };
  }

  const reasonParts = [];
  if (coverageWarning) reasonParts.push(coverageWarning);
  else {
    reasonParts.push(
      `Tổng giai đoạn${chung > 0 ? " + chi phí chung" : ""} ${fmt(combined)} ≠ trước VAT ${fmt(legal)} (chênh ${fmt(Math.abs(combined - legal))}).`
    );
  }
  if (likelyMissing) {
    reasonParts.push(`Thiếu dòng giai đoạn ${likelyMissing} so với BẢNG GIÁ HỢP ĐỒNG.`);
  }

  const fixParts = [];
  if (likelyMissing) {
    fixParts.push(
      `Nhập tay / quét lại để bổ sung giá trị giai đoạn ${likelyMissing} theo mục tương ứng trên BẢNG GIÁ (trước thuế).`
    );
  } else {
    fixParts.push(
      "Đối chiếu lại BẢNG GIÁ (đủ mọi giai đoạn), chi phí chung và % TNCTTT; sửa ô trên bảng rồi lưu."
    );
  }

  return {
    matched: false,
    title: "CHƯA KHỚP",
    reason: reasonParts.join(" "),
    fix: fixParts.join(" "),
    combined,
    legal,
    text: ["CHƯA KHỚP", `Lý do: ${reasonParts.join(" ")}`, `Cách xử lý: ${fixParts.join(" ")}`].join(
      "\n"
    ),
  };
}

/** Chuỗi ngắn cho alert / hint. */
export function formatHopDongMatchAlert({ matchReport, confidenceTongHop, extraLines = [] } = {}) {
  const parts = [];
  if (matchReport?.text) parts.push(matchReport.text);
  if (confidenceTongHop != null) parts.push(`Tin cậy AI: ${confidenceTongHop}%.`);
  for (const line of extraLines) {
    const s = String(line || "").trim();
    if (s) parts.push(s);
  }
  return parts.join("\n\n");
}
