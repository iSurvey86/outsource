/**
 * Sinh nội dung nhật ký NKKS từ bảng khối lượng NVKS.
 * - Số ngày cố định theo form; tổng KL từng hạng mục khớp quyết định.
 * - Chia KL theo ngày có biến thiên (không đều máy móc); ngày cuối = phần dư.
 * - Ưu tiên khống chế ngày đầu; sơ bộ → PA chọn; trong giai đoạn ĐZ → TBA.
 * - Phần công việc/ngày gói trong ngân sách dòng (giữa khối đầu/cuối cố định trên mẫu A4).
 * - Không đưa thỏa thuận / lưu trú / lập báo cáo vào nhật ký hiện trường.
 */

import { parseKlNumber, formatKlNumber } from "./klTableUtils";
import { isNkksDayFieldFilled, normalizeGiamSatField } from "./nkksThoiTiet";

export const NKKS_DEFAULT_NHAN_LUC =
  "05 người (gồm 01 Kỹ sư phụ trách và 04 Công nhân kỹ thuật/Kỹ thuật viên khảo sát). Nhân sự có đầy đủ bảo hộ lao động và tuân thủ đúng quy định an toàn trên công trường.";

export const NKKS_DEFAULT_MAY_MOC =
  "Máy phục vụ công tác khảo sát địa hình (Máy GNSS RTK, Toàn đạc điện tử, Thủy bình, UAV...); Thiết bị khảo sát địa chất (Máy khoan xoay dã chiến, bộ đóng SPT...). Toàn bộ máy móc, thiết bị và dụng cụ lưu mẫu đều hoạt động ổn định, đảm bảo độ chính xác theo quy phạm và còn trong thời hạn kiểm định/hiệu chuẩn.";

export const NKKS_DEFAULT_CHUAN_BI =
  "+ Chuẩn bị công cụ, dụng cụ làm việc trong ngày. Kiểm tra máy móc thiết bị khảo sát.";

/**
 * Ngân sách dòng phần «Công việc thực hiện trong ngày».
 * Chặn đầu/cuối template cố định; phần giữa ~8–9 dòng (siết giãn dòng → ~10).
 * Không dự phòng trống quá tay — vẫn rải KL đều/biến thiên trên đủ số ngày.
 */
export const NKKS_WORK_CONTENT_LINE_BUDGET = 9;

/** Khi số hạng mục trong một khối ≤ ngưỡng này: trải từng hạng mục lên cả dải ngày (tránh 1 ngày 36 km). */
export const NKKS_SPREAD_ALL_ITEMS_THRESHOLD = 8;

/** Ước số ký tự / dòng mắt trên A4 lề chuẩn, TNR 13. */
export const NKKS_CHARS_PER_VISUAL_LINE = 72;

/** @typedef {'CONTROL'|'TOPO'|'GEO'|'SAMPLE'|'OTHER'} NkksWorkKind */

const EXCLUDE_SECTION_RE = /^(IV|V|VI)(\.|$)/i;

const CHILD_NOI_DUNG_RE =
  /^\s*[-–—]|\bđất đá cấp\b|\bchỉ tiêu\b|\bhàm lượng\b|\bthí nghiệm cơ lý\b/i;

const CONTROL_RE =
  /khống chế|đường chuyền|dẫn mốc|mốc độ cao|thủy chuẩn hạng|gps\s*\(3 máy\)/i;

const GEO_RE =
  /khoan|địa chất|spt|điện trở suất|điểm qs|\bqs\b|mẫu nước|mẫu nguyên trạng/i;

const SAMPLE_RE = /mẫu nước|mẫu nguyên trạng|thí nghiệm mẫu/i;

const TOPO_RE =
  /đo vẽ|bản đồ địa hình|đường dây|tuyến|bình đồ|đồng mức|gpmb|bồi thường|địa hình/i;

function normText(s) {
  return String(s || "")
    .normalize("NFC")
    .trim();
}

function sectionRoman(stt) {
  const m = String(stt || "")
    .trim()
    .toUpperCase()
    .match(/^([IVXLC]+)/);
  return m ? m[1] : "";
}

/** Tiêu đề chương I / II / III… (không có .1/.2) */
function isChapterHeaderStt(stt) {
  return /^[IVXLC]+$/i.test(String(stt || "").trim());
}

/** Tiêu đề phần khu vực I.1 / II.2… */
function isSubsectionHeaderStt(stt) {
  return /^[IVXLC]+\.\d+/i.test(String(stt || "").trim());
}

/**
 * Nhãn khu vực ngắn từ tiêu đề KL (vd. «II.1 PHẦN ĐƯỜNG DÂY 110KV»).
 * @returns {string} rỗng nếu không suy ra được
 */
export function formatNkksKhuVucLabel(noiDung) {
  const s = normText(noiDung);
  if (!s) return "";
  if (/đường\s*dây/i.test(s)) return "Khu vực đường dây";
  if (/trạm\s*biến\s*áp|\bTBA\b|phần\s*trạm|\btrạm\b/i.test(s)) return "Khu vực TBA";
  let t = s.replace(/^phần\s+/i, "").trim();
  t = softTrimAtWord(t, 50);
  return t ? `Khu vực ${t}` : "";
}

/** @typedef {'so_bo'|'phuong_an'|'other'} NkksSurveyPhase */

const PHASE_ORDER = { so_bo: 1, phuong_an: 2, other: 3 };

/**
 * Nhận diện giai đoạn KS từ tiêu đề chương / nội dung hạng mục.
 * Ưu tiên chữ «sơ bộ» / «phương án chọn»; không có thì I → sơ bộ, II → phương án chọn.
 */
export function detectNkksSurveyPhase(text, sectionRoman = "") {
  const s = normText(text);
  if (/khảo\s*sát\s*sơ\s*bộ|khu\s*vực\s*khảo\s*sát\s*sơ\s*bộ|\bsơ\s*bộ\b/i.test(s)) {
    return "so_bo";
  }
  if (/phương\s*án\s*chọn|phuong\s*an\s*chon/i.test(s)) {
    return "phuong_an";
  }
  const roman = String(sectionRoman || "")
    .trim()
    .toUpperCase();
  if (roman === "I") return "so_bo";
  if (roman === "II") return "phuong_an";
  return "other";
}

export function nkksSurveyPhaseLabel(phase) {
  if (phase === "so_bo") return "Khảo sát sơ bộ";
  if (phase === "phuong_an") return "Khảo sát phương án chọn";
  return "";
}

function isExcludedSection(roman) {
  return roman === "IV" || roman === "V" || roman === "VI";
}

function isChildWorkRow(row) {
  const stt = String(row.stt || "").trim();
  const nd = normText(row.noi_dung);
  if (CHILD_NOI_DUNG_RE.test(nd)) return true;
  // 1.1, 2.3 dưới cùng nhóm số — coi là dòng con chi tiết
  if (/^\d+\.\d+/.test(stt) && (SAMPLE_RE.test(nd) || /đất đá|chỉ tiêu|hàm lượng/i.test(nd))) {
    return true;
  }
  return false;
}

/** Dòng KL chi tiết (mục con «- …») — dùng gom UI bảng tham chiếu. */
export function isNkksKlDetailRow(row) {
  return /^\s*[-–—]/.test(String(row?.noi_dung || ""));
}

/** Ẩn trọn các chương III–V khỏi bảng KL tham chiếu NKKS. */
export function filterNkksKlRowsForDisplay(rows = []) {
  const visible = [];
  let hiddenChapter = false;

  for (const row of Array.isArray(rows) ? rows : []) {
    const stt = String(row?.stt || "").trim().toUpperCase();
    if (row?.is_header && /^[IVXLC]+$/.test(stt)) {
      hiddenChapter = ["III", "IV", "V"].includes(stt);
    }
    if (!hiddenChapter) visible.push(row);
  }

  return visible;
}

/**
 * Gom dòng KL: header giữ nguyên; hạng mục chính + các mục con (-) thành nhóm chi tiết.
 * @returns {{ kind: 'header'|'item', row?: object, parent?: object, children?: object[], sourceIndex: number }[]}
 */
export function groupNkksKlRowsForDisplay(rows = []) {
  const list = filterNkksKlRowsForDisplay(rows);
  const groups = [];
  let i = 0;
  while (i < list.length) {
    const row = list[i];
    if (row?.is_header) {
      groups.push({ kind: "header", row, sourceIndex: i });
      i += 1;
      continue;
    }
    if (isNkksKlDetailRow(row)) {
      // Mục con mồ côi — gắn vào nhóm item trước nếu có, không thì hiện như hạng mục thường
      const prev = groups[groups.length - 1];
      if (prev?.kind === "item") {
        prev.children.push(row);
      } else {
        groups.push({ kind: "item", parent: row, children: [], sourceIndex: i });
      }
      i += 1;
      continue;
    }
    const children = [];
    let j = i + 1;
    while (j < list.length && !list[j]?.is_header && isNkksKlDetailRow(list[j])) {
      children.push(list[j]);
      j += 1;
    }
    groups.push({ kind: "item", parent: row, children, sourceIndex: i });
    i = j;
  }
  return groups;
}

export const NKKS_DU_PHONG_CONG_VIEC = "Làm nội nghiệp....";

export function createNkksDuPhongThoiTiet() {
  return { sang: ["Mưa"], chieu: ["Mưa"] };
}

function isNkksDuPhongThoiTiet(thoiTiet) {
  const sang = Array.isArray(thoiTiet?.sang) ? thoiTiet.sang : [];
  const chieu = Array.isArray(thoiTiet?.chieu) ? thoiTiet.chieu : [];
  return (
    sang.length === 1 &&
    sang[0] === "Mưa" &&
    chieu.length === 1 &&
    chieu[0] === "Mưa"
  );
}

export function applyNkksDuPhongToDay(day, enabled) {
  const base = { ...(day || {}) };
  if (enabled) {
    return {
      ...base,
      la_ngay_du_phong: true,
      thoi_tiet: createNkksDuPhongThoiTiet(),
      cong_viec_thuc_hien: NKKS_DU_PHONG_CONG_VIEC,
    };
  }
  const next = { ...base, la_ngay_du_phong: false };
  // Chỉ xóa nội dung mặc định dự phòng — giữ chỉnh tay khác
  if (String(next.cong_viec_thuc_hien || "").trim() === NKKS_DU_PHONG_CONG_VIEC) {
    next.cong_viec_thuc_hien = "";
  }
  if (isNkksDuPhongThoiTiet(next.thoi_tiet)) {
    next.thoi_tiet = { sang: [], chieu: [] };
  }
  return next;
}

/**
 * @returns {NkksWorkKind}
 */
export function classifyNkksKlWork(row) {
  const nd = normText(row.noi_dung);
  if (SAMPLE_RE.test(nd) && !/khoan/i.test(nd)) return "SAMPLE";
  if (CONTROL_RE.test(nd)) return "CONTROL";
  if (GEO_RE.test(nd)) return "GEO";
  if (TOPO_RE.test(nd)) return "TOPO";
  return "OTHER";
}

function stripDuKienPhrases(s) {
  return String(s || "")
    .replace(/\s*dự\s*kiến\s*/gi, " ")
    .replace(/\s*du\s*kien\s*/gi, " ")
    .replace(/:{2,}/g, ":")
    .replace(/\s+([,.;])/g, "$1")
    .replace(/[:：]+\s*$/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+,/g, ",")
    .trim();
}

/** Cắt tại ranh giới từ — không cắt giữa từ, không thêm "…" trước dấu ":". */
function softTrimAtWord(s, max = 120) {
  const t = normText(s);
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf(","));
  return (sp > Math.floor(max * 0.55) ? cut.slice(0, sp) : cut).trim();
}

function cleanWorkLabel(noiDung, max = 120) {
  let s = stripDuKienPhrases(normText(noiDung));
  s = s.replace(/,?\s*chiều sâu hố khoan[\s\S]*$/i, "").trim();
  s = s.replace(/\(\s*\d+\s*hố\s*\)/gi, "").trim();
  s = s.replace(/,+\s*$/g, "").trim();
  return softTrimAtWord(s, max);
}

/**
 * Parse khoan: sâu/hố + số hố kế hoạch từ nội dung KL.
 * @returns {{ base: string, depth: number|null, holesPlan: number|null }}
 */
export function parseKhoanMeta(noiDung) {
  const s = stripDuKienPhrases(normText(noiDung));
  const depthMatch =
    s.match(/(?:đến|sau)?\s*([\d.,]+)\s*m\s*\/\s*hố/i) ||
    s.match(/([\d.,]+)\s*m\s*\/\s*hố/i);
  const holesMatch = String(noiDung || "").match(/\(\s*(\d+)\s*hố\s*\)/i);
  const depth = depthMatch ? parseFloat(String(depthMatch[1]).replace(",", ".")) : null;
  const holesPlan = holesMatch ? parseInt(holesMatch[1], 10) : null;
  let base = s
    .replace(/,?\s*chiều sâu hố khoan[\s\S]*$/i, "")
    .replace(/\(\s*\d+\s*hố\s*\)/gi, "")
    .replace(/,+\s*$/g, "")
    .trim();
  if (!base) base = "Khoan thủ công thăm dò địa chất ở trên cạn";
  return {
    base: softTrimAtWord(base, 100),
    depth: Number.isFinite(depth) && depth > 0 ? depth : null,
    holesPlan: Number.isFinite(holesPlan) && holesPlan > 0 ? holesPlan : null,
  };
}

/** Dòng khoan: «…, 9 m/hố × 2 hố» (qty = mét khoan trong ngày). */
export function formatKhoanWorkLine(item, qty) {
  const { base, depth } = parseKhoanMeta(item.noi_dung);
  const q = Number(qty) || 0;
  if (depth && q > 0) {
    const holes = Math.max(1, Math.round(q / depth));
    return `${base}, ${formatQty(depth)} m/hố × ${holes} hố`;
  }
  const dvt = item.don_vi || "m";
  return `${base}: ${formatQty(q)}${dvt ? ` ${dvt}` : ""}`;
}

export function formatNkksWorkLine(item, qty) {
  const nd = normText(item.noi_dung);
  if (/khoan/i.test(nd)) return formatKhoanWorkLine(item, qty);
  if (item.kind === "SAMPLE" || SAMPLE_RE.test(nd)) {
    return sampleSummaryLine({ ...item, khoi_luong: qty, noi_dung: stripDuKienPhrases(nd) });
  }
  const label = cleanWorkLabel(nd);
  const dvt = item.don_vi || "";
  return `${label}: ${formatQty(qty)}${dvt ? ` ${dvt}` : ""}`;
}

function sampleSummaryLine(row) {
  const nd = stripDuKienPhrases(normText(row.noi_dung));
  const qty = parseKlNumber(row.khoi_luong);
  const dvt = normText(row.don_vi) || "mẫu";
  if (/mẫu nước/i.test(nd)) {
    return `Lấy mẫu nước phục vụ công tác thí nghiệm: ${formatQty(qty)} ${dvt}`;
  }
  if (/nguyên trạng|mẫu đất|thí nghiệm mẫu/i.test(nd)) {
    return `Lấy mẫu đất (nguyên trạng) phục vụ thí nghiệm: ${formatQty(qty)} ${dvt}`;
  }
  return `${cleanWorkLabel(nd, 80)}: ${formatQty(qty)} ${dvt}`;
}

function formatQty(n) {
  if (!Number.isFinite(n)) return "0";
  if (Number.isInteger(n)) return String(n);
  const t = Math.round(n * 10) / 10;
  return String(t).replace(".", ",");
}

function hashSeed(str) {
  let h = 2166136261;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Chia khối lượng theo ngày — biến thiên tự nhiên, tổng khớp quyết định.
 * Ví dụ 18 km / 2 ngày → khoảng 8,5 và 9,5 (không đều 9+9).
 * seedKey cố định → cùng kết quả mỗi lần VIẾT lại.
 */
export function splitQuantityAcrossDays(total, dayCount, seedKey = "") {
  const n = Math.max(0, Math.floor(dayCount));
  if (n <= 0 || !Number.isFinite(total) || total <= 0) return [];
  if (n === 1) return [roundSmart(total)];

  const rand = mulberry32(hashSeed(`${seedKey}|${n}|${total}`));
  const isInt = Number.isInteger(total) || Math.abs(total - Math.round(total)) < 1e-9;

  // Trọng số ngày ∈ [0.72, 1.28] — lệch rõ so với chia đều, vẫn hài hòa
  const weights = Array.from({ length: n }, () => 0.72 + rand() * 0.56);
  const sumW = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => (w / sumW) * total);

  if (isInt) {
    const T = Math.round(total);
    const floors = raw.map((r) => Math.floor(r));
    let used = floors.reduce((a, b) => a + b, 0);
    let rem = T - used;
    const order = raw
      .map((r, i) => ({ i, f: r - Math.floor(r), jitter: rand() }))
      .sort((a, b) => b.f - a.f || b.jitter - a.jitter);
    for (let k = 0; k < rem; k++) {
      floors[order[k % order.length].i] += 1;
    }
    // Tránh ngày 0 khi tổng đủ lớn
    if (T >= n) {
      for (let i = 0; i < n; i++) {
        if (floors[i] > 0) continue;
        const donor = floors.indexOf(Math.max(...floors));
        if (floors[donor] <= 1) break;
        floors[donor] -= 1;
        floors[i] = 1;
      }
    }
    return floors;
  }

  const parts = [];
  let allocated = 0;
  for (let i = 0; i < n - 1; i++) {
    const v = roundSmart(raw[i]);
    parts.push(v);
    allocated += v;
  }
  parts.push(roundSmart(total - allocated));
  // Nếu ngày cuối âm do làm tròn — kéo về 0 và bù từ ngày lớn nhất
  if (parts[n - 1] < 0) {
    let need = -parts[n - 1];
    parts[n - 1] = 0;
    for (let i = 0; i < n - 1 && need > 0; i++) {
      const take = Math.min(parts[i], need);
      parts[i] = roundSmart(parts[i] - take);
      need = roundSmart(need - take);
    }
  }
  return parts;
}

function roundSmart(n) {
  if (!Number.isFinite(n)) return 0;
  if (Number.isInteger(n)) return n;
  return Math.round(n * 10) / 10;
}

/**
 * Nhặt hạng mục chính từ bảng KL (bỏ header, IV–VI, dòng con chi tiết).
 * Gắn khu_vuc từ tiêu đề phần (II.1 đường dây / II.2 TBA…) và giai đoạn KS (sơ bộ / PA chọn).
 */
export function pickNkksWorkItemsFromKl(rows = []) {
  let currentRoman = "";
  let currentKhuVuc = "";
  let currentKhuVucKey = "";
  let currentPhase = /** @type {NkksSurveyPhase} */ ("other");
  const items = [];

  for (const row of rows || []) {
    if (row?.is_header) {
      const stt = String(row.stt || "").trim();
      currentRoman = sectionRoman(stt) || currentRoman;
      if (isSubsectionHeaderStt(stt)) {
        currentKhuVuc = formatNkksKhuVucLabel(row.noi_dung);
        currentKhuVucKey = stt.toUpperCase();
        const fromTitle = detectNkksSurveyPhase(row.noi_dung, currentRoman);
        if (fromTitle !== "other") currentPhase = fromTitle;
      } else if (isChapterHeaderStt(stt)) {
        // Sang chương mới (I / II …) — reset khu vực; cập nhật giai đoạn KS
        currentKhuVuc = "";
        currentKhuVucKey = "";
        currentPhase = detectNkksSurveyPhase(row.noi_dung, stt);
      }
      continue;
    }
    if (isExcludedSection(currentRoman)) continue;
    if (EXCLUDE_SECTION_RE.test(String(row.stt || "").trim())) continue;

    const kl = parseKlNumber(row.khoi_luong);
    if (kl <= 0) continue;
    if (isChildWorkRow(row)) continue;

    const kind = classifyNkksKlWork(row);
    const phaseFromRow = detectNkksSurveyPhase(row.noi_dung, currentRoman);
    items.push({
      id: row.id_cong_viec || `${row.stt}-${normText(row.noi_dung).slice(0, 40)}`,
      stt: row.stt || "",
      noi_dung: normText(row.noi_dung),
      don_vi: normText(row.don_vi),
      khoi_luong: kl,
      kind,
      section: currentRoman,
      khu_vuc: currentKhuVuc,
      khu_vuc_key: currentKhuVucKey,
      phase: phaseFromRow !== "other" ? phaseFromRow : currentPhase,
    });
  }

  return items;
}

function dayHasManualContent(day) {
  return isNkksDayFieldFilled(day, "cong_viec_thuc_hien");
}

/**
 * Trọng số chia ngày theo khu vực: ưu tiên mét khoan, rồi GEO/SAMPLE, rồi tổng KL.
 */
export function weightNkksAreaItems(items = []) {
  const list = items || [];
  if (!list.length) return 0;
  const khoan = list.filter((i) => /khoan/i.test(i.noi_dung || ""));
  if (khoan.length) return khoan.reduce((s, i) => s + (Number(i.khoi_luong) || 0), 0);
  const geo = list.filter((i) => i.kind === "GEO" || i.kind === "SAMPLE");
  if (geo.length) return geo.reduce((s, i) => s + (Number(i.khoi_luong) || 0), 0);
  const sum = list.reduce((s, i) => s + (Number(i.khoi_luong) || 0), 0);
  return sum > 0 ? sum : list.length;
}

/**
 * Chia số ngày nguyên theo trọng số (largest remainder); mỗi nhóm weight>0 ≥ 1 ngày nếu đủ ngày.
 */
export function allocateDaysByWeights(weights, totalDays) {
  const n = Math.max(0, Math.floor(totalDays));
  const w = (weights || []).map((x) => Math.max(0, Number(x) || 0));
  const m = w.length;
  if (n <= 0 || m === 0) return w.map(() => 0);

  const active = w.map((x, i) => (x > 0 ? i : -1)).filter((i) => i >= 0);
  if (!active.length) {
    // Không có weight — chia đều
    const base = Math.floor(n / m);
    const rem = n - base * m;
    return w.map((_, i) => base + (i < rem ? 1 : 0));
  }

  if (n < active.length) {
    // Ít ngày hơn số khu vực: ưu tiên khu vực nặng trước, mỗi khu tối đa 1 ngày
    const ordered = [...active].sort((a, b) => w[b] - w[a] || a - b);
    const out = w.map(() => 0);
    for (let k = 0; k < n; k++) out[ordered[k]] = 1;
    return out;
  }

  const sumW = active.reduce((s, i) => s + w[i], 0) || 1;
  const raw = w.map((x) => (x > 0 ? (x / sumW) * n : 0));
  const floors = raw.map((r) => Math.floor(r));
  // Đảm bảo mỗi active ≥ 1
  for (const i of active) {
    if (floors[i] < 1) floors[i] = 1;
  }
  let used = floors.reduce((a, b) => a + b, 0);
  if (used > n) {
    // co lại từ khu vực lớn nhất (giữ ≥ 1)
    const shrink = [...active].sort((a, b) => floors[b] - floors[a] || w[b] - w[a]);
    let over = used - n;
    for (const i of shrink) {
      if (over <= 0) break;
      const can = floors[i] - 1;
      if (can <= 0) continue;
      const take = Math.min(can, over);
      floors[i] -= take;
      over -= take;
    }
    return floors;
  }

  let rem = n - used;
  const frac = active
    .map((i) => ({ i, f: raw[i] - Math.floor(raw[i]) }))
    .sort((a, b) => b.f - a.f || w[b.i] - w[a.i]);
  for (let k = 0; k < rem; k++) {
    floors[frac[k % frac.length].i] += 1;
  }
  return floors;
}

/** Khóa gộp lịch trong một giai đoạn: đường dây / TBA (gộp I.1+II.1 cùng loại khu). */
export function nkksAreaScheduleKey(item) {
  const label = String(item?.khu_vuc || "");
  if (/đường\s*dây/i.test(label)) return "dz";
  if (/TBA|trạm/i.test(label)) return "tram";
  const key = String(item?.khu_vuc_key || "").trim();
  if (key) return `stt:${key}`;
  return "";
}

export function nkksAreaScheduleLabel(item) {
  const label = String(item?.khu_vuc || "").trim();
  if (label) return label;
  const sk = nkksAreaScheduleKey(item);
  if (sk === "dz") return "Khu vực đường dây";
  if (sk === "tram") return "Khu vực TBA";
  return "";
}

const AREA_SCHEDULE_ORDER = { dz: 1, tram: 2 };

/** Nhóm field theo khu vực lịch (ĐZ / TBA); thứ tự ĐZ → TBA. */
export function groupNkksFieldItemsByArea(fieldItems = []) {
  const map = new Map();
  for (const item of fieldItems || []) {
    const key = nkksAreaScheduleKey(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  const keys = [...map.keys()].sort((a, b) => {
    if (!a && b) return 1;
    if (a && !b) return -1;
    const oa = AREA_SCHEDULE_ORDER[a] || 50;
    const ob = AREA_SCHEDULE_ORDER[b] || 50;
    if (oa !== ob) return oa - ob;
    return String(a).localeCompare(String(b), "vi", { numeric: true });
  });
  return keys.map((key) => ({
    key,
    label: nkksAreaScheduleLabel(map.get(key)[0]),
    items: map.get(key),
  }));
}

/** Nhóm field theo giai đoạn KS; thứ tự sơ bộ → phương án chọn → khác. */
export function groupNkksFieldItemsByPhase(fieldItems = []) {
  const map = new Map();
  for (const item of fieldItems || []) {
    const phase = item?.phase || detectNkksSurveyPhase(item?.noi_dung, item?.section);
    if (!map.has(phase)) map.set(phase, []);
    map.get(phase).push(item);
  }
  const keys = [...map.keys()].sort(
    (a, b) => (PHASE_ORDER[a] || 99) - (PHASE_ORDER[b] || 99)
  );
  return keys.map((phase) => ({
    phase,
    label: nkksSurveyPhaseLabel(phase),
    items: map.get(phase),
  }));
}

/**
 * Số ngày tối thiểu hợp lý để rải KL (tránh 1 ngày 36 km / 22 mốc).
 */
function estimateMinDaysForItem(item, totalDays) {
  const D = Math.max(1, totalDays);
  const kl = Number(item.khoi_luong) || 0;
  if (kl <= 0 || D <= 1) return 1;
  const dvt = String(item.don_vi || "").toLowerCase();
  const nd = String(item.noi_dung || "");
  if (/km/.test(dvt) || /\bkm\b/i.test(nd)) {
    return Math.min(D, Math.max(1, Math.ceil(kl / 4)));
  }
  if (/điểm|mốc/.test(dvt) || /mốc|điểm/i.test(nd)) {
    return Math.min(D, Math.max(1, Math.ceil(kl / 6)));
  }
  if (/khoan/i.test(nd) || dvt === "m") {
    return Math.min(D, Math.max(1, Math.ceil(kl / 12)));
  }
  return 1;
}

/**
 * Phân bổ hạng mục lên dải ngày (logic ổn định trước khi siết trống quá tay):
 * - Ít/vừa hạng mục: MỖI hạng mục trải cả dải ngày, KL biến thiên (18 km / 5 ngày → ~2–5 km/ngày).
 * - Rất nhiều hạng mục: chia dải theo trọng số, nhưng hạng mục lớn (km/điểm) vẫn ≥ vài ngày.
 */
function distributeItemsOnDaySlice(dayAssignments, items, dayIdxList) {
  if (!items?.length || !dayIdxList?.length) return;

  const D = dayIdxList.length;

  if (items.length <= NKKS_SPREAD_ALL_ITEMS_THRESHOLD) {
    for (const item of items) {
      const seed = item.id || item.noi_dung || item.stt;
      const parts = splitQuantityAcrossDays(item.khoi_luong, D, seed);
      dayIdxList.forEach((di, pi) => {
        const qty = parts[pi] ?? 0;
        if (qty > 0) dayAssignments[di].push({ item, qty });
      });
    }
    return;
  }

  const weights = items.map((i) => Math.max(Number(i.khoi_luong) || 0, 0.01));
  let spans = allocateDaysByWeights(weights, D);
  for (let i = 0; i < items.length; i++) {
    spans[i] = Math.max(spans[i] || 0, estimateMinDaysForItem(items[i], D));
  }
  let spanSum = spans.reduce((a, b) => a + b, 0);
  while (spanSum > D) {
    let hi = -1;
    let hiExtra = 0;
    for (let i = 0; i < spans.length; i++) {
      const floor = estimateMinDaysForItem(items[i], D);
      const extra = spans[i] - floor;
      if (extra > hiExtra) {
        hiExtra = extra;
        hi = i;
      }
    }
    if (hi < 0 || hiExtra <= 0) break;
    spans[hi] -= 1;
    spanSum -= 1;
  }

  let cursor = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    let span = spans[i] || 0;
    if (span <= 0 || (Number(item.khoi_luong) || 0) <= 0) continue;
    if (cursor + span > D) {
      span = Math.max(1, D - cursor);
      if (cursor >= D) {
        const parts = splitQuantityAcrossDays(item.khoi_luong, 1, item.id || item.noi_dung);
        dayAssignments[dayIdxList[D - 1]].push({ item, qty: parts[0] ?? item.khoi_luong });
        continue;
      }
    }
    const slice = dayIdxList.slice(cursor, cursor + span);
    cursor += span;
    if (!slice.length) continue;
    const seed = item.id || item.noi_dung || item.stt;
    const parts = splitQuantityAcrossDays(item.khoi_luong, slice.length, seed);
    slice.forEach((di, pi) => {
      const qty = parts[pi] ?? 0;
      if (qty > 0) dayAssignments[di].push({ item, qty });
    });
  }
}

/**
 * Phân bổ hạng mục field vào một dải ngày (đã cố định).
 * Có khu vực ĐZ/TBA → khối tuần tự; không thì trải trên cả dải.
 */
function assignFieldItemsToDaySlice(dayAssignments, fieldItems, dayIdxList) {
  if (!fieldItems.length || !dayIdxList.length) return {};

  const areas = groupNkksFieldItemsByArea(fieldItems);
  const hasNamedArea = areas.some(
    (a) => a.key === "dz" || a.key === "tram" || String(a.key).startsWith("stt:")
  );

  if (!hasNamedArea) {
    distributeItemsOnDaySlice(dayAssignments, fieldItems, dayIdxList);
    return {};
  }

  const weights = areas.map((a) => weightNkksAreaItems(a.items));
  const dayCounts = allocateDaysByWeights(weights, dayIdxList.length);
  const areaDayCounts = {};
  let cursor = 0;
  for (let ai = 0; ai < areas.length; ai++) {
    const area = areas[ai];
    const dCount = dayCounts[ai] || 0;
    const slice = dayIdxList.slice(cursor, cursor + dCount);
    cursor += dCount;
    if (area.key || area.label) {
      areaDayCounts[area.label || area.key] = slice.length;
    }
    if (!slice.length) continue;
    distributeItemsOnDaySlice(dayAssignments, area.items, slice);
  }
  return areaDayCounts;
}

/**
 * Xây lịch:
 * - CONTROL: vài ngày đầu
 * - Field: xong Khảo sát sơ bộ (nếu có) → mới tới Phương án chọn
 * - Trong mỗi giai đoạn: khối khu vực ĐZ → TBA; tỷ lệ ngày ~ KL khoan/GEO
 * - Trong mỗi khối: địa hình + địa chất cùng khu vực
 * @returns {{ dayAssignments: Array<Array<{item: object, qty: number}>>, controlDayCount: number, areaDayCounts?: object, phaseDayCounts?: object }}
 */
export function buildNkksDayAssignments(items, dayCount) {
  const n = Math.max(0, dayCount);
  const dayAssignments = Array.from({ length: n }, () => []);
  if (n === 0 || !items.length) return { dayAssignments, controlDayCount: 0 };

  const control = items.filter((i) => i.kind === "CONTROL");
  const field = items.filter((i) => i.kind !== "CONTROL");

  let controlDayCount = 0;
  if (control.length) {
    const need = Math.max(1, ...control.map((c) => estimateMinDaysForItem(c, n)));
    // Đủ ngày để rải mốc/điểm; không chiếm quá nửa lịch
    controlDayCount = Math.min(n, Math.max(need, Math.min(control.length, 2)), Math.max(1, Math.floor(n / 2)));
  }

  const controlDays = Array.from({ length: controlDayCount }, (_, i) => i);
  const fieldDays = Array.from({ length: n }, (_, i) => i).filter((i) => i >= controlDayCount);
  const fieldDayIdx = fieldDays.length ? fieldDays : Array.from({ length: n }, (_, i) => i);

  if (control.length) {
    // Trải KL khống chế trên cả dải control (không dồn 22 mốc/1 ngày)
    for (const item of control) {
      const seed = item.id || item.noi_dung || item.stt;
      const targets = controlDays.length ? controlDays : [0];
      const parts = splitQuantityAcrossDays(item.khoi_luong, targets.length, seed);
      targets.forEach((di, pi) => {
        const qty = parts[pi] ?? 0;
        if (qty > 0) dayAssignments[di].push({ item, qty });
      });
    }
  }

  if (!field.length) {
    return { dayAssignments, controlDayCount };
  }

  const phases = groupNkksFieldItemsByPhase(field);
  const hasMultiPhase = phases.length > 1 && phases.some((p) => p.phase === "so_bo" || p.phase === "phuong_an");

  // Một giai đoạn (hoặc không nhận diện sơ bộ/PA) — giữ lịch theo khu vực như cũ
  if (!hasMultiPhase) {
    const areaDayCounts = assignFieldItemsToDaySlice(dayAssignments, field, fieldDayIdx);
    return { dayAssignments, controlDayCount, areaDayCounts };
  }

  const weights = phases.map((p) => weightNkksAreaItems(p.items));
  const phaseDayCountsArr = allocateDaysByWeights(weights, fieldDayIdx.length);
  const phaseDayCounts = {};
  const areaDayCounts = {};

  let cursor = 0;
  for (let pi = 0; pi < phases.length; pi++) {
    const phase = phases[pi];
    const dCount = phaseDayCountsArr[pi] || 0;
    const slice = fieldDayIdx.slice(cursor, cursor + dCount);
    cursor += dCount;
    const label = phase.label || phase.phase;
    if (label) phaseDayCounts[label] = slice.length;
    if (!slice.length) continue;
    const areaCounts = assignFieldItemsToDaySlice(dayAssignments, phase.items, slice);
    Object.assign(areaDayCounts, areaCounts);
  }

  return { dayAssignments, controlDayCount, areaDayCounts, phaseDayCounts };
}

function compareKhuVucKey(a, b) {
  const ka = nkksAreaScheduleKey(a?.item) || a?.item?.khu_vuc_key || "zzz";
  const kb = nkksAreaScheduleKey(b?.item) || b?.item?.khu_vuc_key || "zzz";
  const oa = AREA_SCHEDULE_ORDER[ka] || 50;
  const ob = AREA_SCHEDULE_ORDER[kb] || 50;
  if (oa !== ob) return oa - ob;
  return String(ka).localeCompare(String(kb), "vi", { numeric: true });
}

/**
 * Đẩy dòng công việc; nếu có ≥1 khu vực từ KL thì chia nhóm theo khu vực.
 */
function pushWorkByKhuVuc(lines, list, { workPrefix = "+ ", areaPrefix = "" } = {}) {
  if (!list.length) return;

  const pushFlat = (prefix, rows) => {
    for (const { item, qty } of rows) {
      const line = formatNkksWorkLine(item, qty).replace(/^\+\s*/, "").trim();
      lines.push(`${prefix}${line}`);
    }
  };

  const hasArea = list.some((a) => a.item?.khu_vuc || nkksAreaScheduleKey(a.item));
  if (!hasArea) {
    pushFlat(workPrefix, list);
    return;
  }

  const sorted = [...list].sort(compareKhuVucKey);
  const order = [];
  const map = new Map();
  for (const row of sorted) {
    const key = nkksAreaScheduleKey(row.item) || row.item.khu_vuc || "";
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key).push(row);
  }

  for (const key of order) {
    const rows = map.get(key) || [];
    const label = nkksAreaScheduleLabel(rows[0]?.item) || key;
    if (label) lines.push(`${areaPrefix}${label}:`);
    pushFlat(workPrefix, rows);
  }
}

/** Ước số dòng mắt (bọc chữ) của một dòng text. */
export function estimateNkksWorkVisualLines(line, charsPerLine = NKKS_CHARS_PER_VISUAL_LINE) {
  const t = String(line || "").trim();
  if (!t) return 0;
  return Math.max(1, Math.ceil(t.length / Math.max(40, charsPerLine)));
}

function renderDayTexts(assignments) {
  const prep = NKKS_DEFAULT_CHUAN_BI;
  if (!assignments.length) {
    return {
      cong_viec_thuc_hien: prep,
      khoi_luong_thuc_hien: "",
    };
  }

  const geo = assignments.filter((a) => a.item.kind === "GEO");
  const sample = assignments.filter((a) => a.item.kind === "SAMPLE");
  const control = assignments.filter((a) => a.item.kind === "CONTROL");
  const topoOnly = assignments.filter((a) => a.item.kind === "TOPO" || a.item.kind === "OTHER");

  const lines = [prep];
  const hasGroups =
    (control.length || topoOnly.length) && (geo.length || sample.length);

  if (hasGroups) {
    if (control.length || topoOnly.length) {
      lines.push("* Nhóm 1 (Địa hình / khống chế):");
      pushWorkByKhuVuc(lines, [...control, ...topoOnly], {
        workPrefix: "  + ",
        areaPrefix: "  ",
      });
    }
    if (geo.length || sample.length) {
      lines.push("* Nhóm 2 (Địa chất):");
      pushWorkByKhuVuc(lines, [...geo, ...sample], {
        workPrefix: "  + ",
        areaPrefix: "  ",
      });
    }
  } else {
    pushWorkByKhuVuc(lines, assignments, { workPrefix: "+ ", areaPrefix: "" });
  }

  return {
    cong_viec_thuc_hien: lines.join("\n"),
    khoi_luong_thuc_hien: "",
  };
}

/**
 * @param {object} opts
 * @param {object[]} opts.klRows — bang KL
 * @param {object[]} opts.days — nkks_ngays
 * @param {'empty_only'|'overwrite'} opts.mode
 * @param {string} [opts.nhanLuc]
 * @param {string} [opts.mayMoc]
 */
export function generateNkksDiaryFromKl({
  klRows,
  days,
  mode = "empty_only",
  nhanLuc = "",
  mayMoc = "",
}) {
  const dayList = Array.isArray(days) ? days : [];
  const items = pickNkksWorkItemsFromKl(klRows);
  const workIndices = dayList
    .map((day, idx) => ({ day, idx }))
    .filter(({ day }) => !day?.la_ngay_du_phong)
    .map(({ idx }) => idx);

  if (items.length > 0 && workIndices.length === 0) {
    return {
      days: dayList,
      nhan_luc: String(nhanLuc || "").trim() || NKKS_DEFAULT_NHAN_LUC,
      may_moc_thiet_bi: String(mayMoc || "").trim() || NKKS_DEFAULT_MAY_MOC,
      stats: {
        workItemCount: items.length,
        dayCount: dayList.length,
        workDayCount: 0,
        filled: 0,
        skipped: 0,
        spareKept: dayList.length,
        blockedAllSpare: true,
      },
      error: "all_spare",
    };
  }

  const { dayAssignments } = buildNkksDayAssignments(items, workIndices.length);

  let filled = 0;
  let skipped = 0;
  let spareKept = 0;
  let assignCursor = 0;

  const nextDays = dayList.map((day, idx) => {
    if (day?.la_ngay_du_phong) {
      spareKept += 1;
      return applyNkksDuPhongToDay(day, true);
    }
    const hasManual = dayHasManualContent(day);
    if (mode === "empty_only" && hasManual) {
      skipped += 1;
      return day;
    }
    const texts = renderDayTexts(dayAssignments[assignCursor] || []);
    assignCursor += 1;
    filled += 1;
    return {
      ...day,
      la_ngay_du_phong: false,
      cong_viec_thuc_hien: texts.cong_viec_thuc_hien,
      khoi_luong_thuc_hien: texts.khoi_luong_thuc_hien,
      y_kien_giam_sat: normalizeGiamSatField(day.y_kien_giam_sat),
    };
  });

  return {
    days: nextDays,
    nhan_luc: String(nhanLuc || "").trim() || NKKS_DEFAULT_NHAN_LUC,
    may_moc_thiet_bi: String(mayMoc || "").trim() || NKKS_DEFAULT_MAY_MOC,
    stats: {
      workItemCount: items.length,
      dayCount: dayList.length,
      workDayCount: workIndices.length,
      filled,
      skipped,
      spareKept,
      controlCount: items.filter((i) => i.kind === "CONTROL").length,
      geoCount: items.filter((i) => i.kind === "GEO").length,
    },
  };
}

export function countDaysWithDiaryContent(days = []) {
  return (days || []).filter((day) => !day?.la_ngay_du_phong && dayHasManualContent(day)).length;
}
