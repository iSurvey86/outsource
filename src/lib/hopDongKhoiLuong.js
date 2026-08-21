/**
 * Bản nháp bảng khối lượng / số liệu theo giai đoạn — dùng chung Import Excel & Quét AI.
 */

import { formatGiaiDoanBadge, getGiaiDoanPhaseWeight, sortProjectsByGiaiDoan } from "./giaiDoanOrder";
import { bgdGroupKeyForProject } from "./giaoViecInbox";
import { formatGiaTriHopDong, parseGiaTriHopDong } from "./hopDong";
import { computeConLai, numOrNull } from "./hopDongThucHien";

export const KHOI_LUONG_FIELDS = [
  "gia_tri_hd",
  "gia_tri_ks",
  "gia_tri_ks_dia_hinh",
  "gia_tri_ks_dia_chat",
  "gia_tri_ks_khac",
  "gia_tri_lap_hs",
  "gia_tri_ctdt",
  "gia_tri_tong_phan_ra",
  "da_xuat_hd",
  "con_lai",
  "hien_trang",
];

function shortTenDuAn(ten) {
  const t = String(ten || "").trim();
  if (!t) return "";
  return t.length > 36 ? `${t.slice(0, 34)}…` : t;
}

/** Nhãn cột giai đoạn: FS hoặc «Tên CT · FS» khi HĐ khung nhiều công trình. */
export function buildPhaseAllocLabel({ giai_doan, ten_du_an, phaseLabel, multiCongTrinh = false } = {}) {
  const badge = phaseLabel || formatGiaiDoanBadge(giai_doan) || "—";
  if (!multiCongTrinh) return badge;
  const ten = shortTenDuAn(ten_du_an);
  return ten ? `${ten} · ${badge}` : badge;
}

function countDistinctCongTrinh(projects) {
  const keys = new Set();
  for (const p of projects || []) {
    const k = bgdGroupKeyForProject(p) || String(p?.ten_du_an || "").trim().toLowerCase() || p?.ma_du_an;
    if (k) keys.add(k);
  }
  return keys.size;
}

/** Sắp xếp: tên công trình rồi trọng số giai đoạn (HĐ khung đa CT). */
export function sortProjectsForHopDongAlloc(projects) {
  return [...(projects || [])].sort((a, b) => {
    const ta = String(a?.ten_du_an || "").localeCompare(String(b?.ten_du_an || ""), "vi");
    if (ta !== 0) return ta;
    const wa =
      getGiaiDoanPhaseWeight(a?.giai_doan_chuan || a?.giai_doan) -
      getGiaiDoanPhaseWeight(b?.giai_doan_chuan || b?.giai_doan);
    if (wa !== 0) return wa;
    return String(a?.ma_du_an || "").localeCompare(String(b?.ma_du_an || ""), "vi");
  });
}

/** Tạo dòng nháp trống cho một giai đoạn. */
export function emptyKhoiLuongRow({ ma_du_an, giai_doan, phaseLabel, ten_du_an, multiCongTrinh, ...rest } = {}) {
  const badge = formatGiaiDoanBadge(giai_doan) || ma_du_an || "—";
  const label = buildPhaseAllocLabel({
    giai_doan,
    ten_du_an,
    phaseLabel: phaseLabel || badge,
    multiCongTrinh: Boolean(multiCongTrinh),
  });
  const row = {
    key: rest.key || `${ma_du_an || "new"}||${badge}`,
    include: rest.include !== false,
    ma_du_an: ma_du_an || "",
    giai_doan: giai_doan || "",
    ten_du_an: ten_du_an || "",
    multiCongTrinh: Boolean(multiCongTrinh),
    phaseLabel: label,
    phaseBadge: badge,
    phaseWeight: getGiaiDoanPhaseWeight(giai_doan),
    gia_tri_hd: "",
    gia_tri_ks: "",
    gia_tri_ks_dia_hinh: "",
    gia_tri_ks_dia_chat: "",
    gia_tri_ks_khac: "",
    gia_tri_lap_hs: "",
    gia_tri_ctdt: "",
    gia_tri_tong_phan_ra: "",
    da_xuat_hd: "",
    con_lai: "",
    hien_trang: "",
    ...rest,
    phaseLabel: label,
    ten_du_an: ten_du_an || rest.ten_du_an || "",
    multiCongTrinh: Boolean(multiCongTrinh || rest.multiCongTrinh),
  };
  // Dữ liệu Excel / bản cũ chỉ có tổng KS: đưa vào "Khác" để không mất số,
  // người dùng có thể tách lại trong bước rà soát.
  const hasKsDetail = [
    row.gia_tri_ks_dia_hinh,
    row.gia_tri_ks_dia_chat,
    row.gia_tri_ks_khac,
  ].some((v) => v !== "" && v != null);
  if (!hasKsDetail && row.gia_tri_ks !== "" && row.gia_tri_ks != null) {
    row.gia_tri_ks_khac = row.gia_tri_ks;
  }
  return row;
}

export function rowFromThucHien(th, meta = {}) {
  if (!th && !meta.ma_du_an) return emptyKhoiLuongRow(meta);
  return emptyKhoiLuongRow({
    ...meta,
    ma_du_an: meta.ma_du_an || th?.ma_du_an || "",
    gia_tri_hd: th?.gia_tri_hd ?? "",
    gia_tri_ks: th?.gia_tri_ks ?? "",
    gia_tri_ks_dia_hinh: th?.gia_tri_ks_dia_hinh ?? "",
    gia_tri_ks_dia_chat: th?.gia_tri_ks_dia_chat ?? "",
    gia_tri_ks_khac: th?.gia_tri_ks_khac ?? "",
    gia_tri_lap_hs: th?.gia_tri_lap_hs ?? "",
    gia_tri_ctdt: th?.gia_tri_ctdt ?? "",
    gia_tri_tong_phan_ra: th?.gia_tri_tong_phan_ra ?? "",
    da_xuat_hd: th?.da_xuat_hd ?? "",
    con_lai: th?.con_lai ?? "",
    hien_trang: th?.hien_trang || "",
  });
}

/** Đồng bộ danh sách dòng theo mã DA đã chọn (giữ giá trị đã nhập). */
export function syncKhoiLuongRowsWithPhases(rows, selectedProjects) {
  const multiCongTrinh = countDistinctCongTrinh(selectedProjects) > 1;
  const ordered =
    multiCongTrinh
      ? sortProjectsForHopDongAlloc(selectedProjects || [])
      : sortProjectsByGiaiDoan(selectedProjects || []);
  const prevByMa = new Map((rows || []).map((r) => [r.ma_du_an, r]));
  return ordered.map((p) => {
    const prev = prevByMa.get(p.ma_du_an);
    const gd = p.giai_doan_chuan || p.giai_doan;
    const ten = p.ten_du_an || prev?.ten_du_an || "";
    const badge = formatGiaiDoanBadge(gd);
    const label = buildPhaseAllocLabel({
      giai_doan: gd,
      ten_du_an: ten,
      phaseLabel: badge,
      multiCongTrinh,
    });
    if (prev) {
      return {
        ...prev,
        ma_du_an: p.ma_du_an,
        giai_doan: gd,
        ten_du_an: ten,
        multiCongTrinh,
        phaseBadge: badge,
        phaseLabel: label,
        phaseWeight: getGiaiDoanPhaseWeight(gd),
      };
    }
    return emptyKhoiLuongRow({
      ma_du_an: p.ma_du_an,
      giai_doan: gd,
      ten_du_an: ten,
      multiCongTrinh,
    });
  });
}

export function updateKhoiLuongField(row, field, rawValue) {
  const next = { ...row, [field]: rawValue };
  const ksFields = ["gia_tri_ks_dia_hinh", "gia_tri_ks_dia_chat", "gia_tri_ks_khac"];
  const phanRaEdit =
    ksFields.includes(field) || field === "gia_tri_lap_hs" || field === "gia_tri_ctdt";

  if (ksFields.includes(field)) {
    const ksParts = ksFields.map((key) => numOrNull(next[key])).filter((n) => n != null);
    next.gia_tri_ks = ksParts.length ? String(ksParts.reduce((a, b) => a + b, 0)) : "";
  }

  // Sửa cột thành phần → cập nhật tổng phân rã; Giá trị HĐ = tổng 5 cột (đối chiếu chéo).
  if (phanRaEdit) {
    const parts = [next.gia_tri_ks, next.gia_tri_lap_hs, next.gia_tri_ctdt]
      .map((v) => numOrNull(v))
      .filter((n) => n != null);
    if (parts.length) {
      const tong = String(parts.reduce((a, b) => a + b, 0));
      next.gia_tri_tong_phan_ra = tong;
      next.gia_tri_hd = tong;
    } else {
      next.gia_tri_tong_phan_ra = "";
      next.gia_tri_hd = "";
    }
    const con = computeConLai(next.gia_tri_hd, next.da_xuat_hd);
    next.con_lai = con != null ? String(con) : "";
  }

  if (field === "gia_tri_hd" || field === "da_xuat_hd") {
    const con = computeConLai(next.gia_tri_hd, next.da_xuat_hd);
    if (con != null) next.con_lai = String(con);
    else if (field === "gia_tri_hd" && (next.gia_tri_hd === "" || next.gia_tri_hd == null)) {
      next.con_lai = "";
    }
  }
  return next;
}

export function sumPhaseGiaTri(rows, { onlyIncluded = true } = {}) {
  return (rows || [])
    .filter((r) => (onlyIncluded ? r.include !== false : true))
    .reduce((s, r) => s + (numOrNull(r.gia_tri_hd) || 0), 0);
}

export function sumPhanRa(row) {
  const tong = numOrNull(row?.gia_tri_tong_phan_ra);
  if (tong != null) return tong;
  return [row?.gia_tri_ks, row?.gia_tri_lap_hs, row?.gia_tri_ctdt]
    .map((v) => numOrNull(v))
    .filter((n) => n != null)
    .reduce((a, b) => a + b, 0);
}

export function phaseChenhLech(row) {
  const gia = numOrNull(row?.gia_tri_hd);
  const tong = sumPhanRa(row);
  if (gia == null || !tong) return null;
  return tong - gia;
}

/** Hiển thị số tiền khi đang nhập: 1051229104 → 1.051.229.104 */
export function formatMoneyInput(v) {
  if (v === null || v === undefined || v === "") return "";
  const s = String(v).replace(/[^\d,-]/g, "");
  if (!s) return "";
  const neg = s.startsWith("-");
  const [intPart, decPart] = s.replace(/-/g, "").split(",");
  const grouped = (intPart || "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${neg ? "-" : ""}${grouped}${decPart !== undefined ? `,${decPart}` : ""}`;
}

/** Bỏ dấu ngăn cách để lưu: 1.051.229.104 → 1051229104 */
export function stripMoneyInput(v) {
  if (v === null || v === undefined || v === "") return "";
  return String(v)
    .replace(/[^\d,-]/g, "")
    .replace(/,/g, ".");
}

/** 5 cột phân rã — dán Excel / sửa tay (không gồm Giá trị HĐ). */
export const PHAN_RA_PASTE_FIELDS = [
  "gia_tri_ks_dia_hinh",
  "gia_tri_ks_dia_chat",
  "gia_tri_ks_khac",
  "gia_tri_lap_hs",
  "gia_tri_ctdt",
];

/** Parse ô dán từ Excel (bỏ `.` / `,` nghìn). Trả "" nếu trống; null nếu bỏ qua (vd. Tổng). */
export function parsePasteMoneyCell(raw) {
  const t = String(raw ?? "")
    .trim()
    .replace(/\s/g, "");
  if (!t) return "";
  if (/^(tổng|tong|total)$/i.test(t)) return null;
  if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) return t.replace(/\./g, "");
  if (/^-?\d{1,3}(,\d{3})+$/.test(t)) return t.replace(/,/g, "");
  const n = numOrNull(stripMoneyInput(t)) ?? parseGiaTriHopDong(t);
  return n != null ? String(Math.round(n)) : "";
}

function isGiaiDoanPasteLabel(cell) {
  const u = String(cell || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
  if (!u) return false;
  if (/^(TỔNG|TONG|TOTAL)$/i.test(u)) return true;
  return /^(FS|BCNCKT|BCKTKT|TKBVTC|TKKT)(\b|$)/.test(u);
}

function normalizePasteBadge(cell) {
  const u = String(cell || "")
    .trim()
    .toUpperCase();
  if (/TKBVTC|TKKT/.test(u)) return "TKBVTC";
  if (/BCKTKT/.test(u)) return "BCKTKT";
  if (/^(FS|BCNCKT)\b/.test(u) || u === "FS" || u === "BCNCKT") return "FS";
  return formatGiaiDoanBadge(cell);
}

/**
 * Parse clipboard TSV → các dòng phân rã (5 số). Bỏ cột Giá trị HĐ nếu có trong vùng dán.
 * @returns {{ badge: string, values: string[] }[]}
 */
export function parsePhanRaPasteClipboard(text) {
  const lines = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.split("\t").map((c) => String(c ?? "").trim()))
    .filter((cols) => cols.some((c) => c !== ""));

  const out = [];
  for (const cols of lines) {
    if (cols.some((c) => /^(tổng|tong|total)$/i.test(c.trim()))) continue;
    // Bỏ hàng tiêu đề
    if (
      cols.some((c) => /địa hình|dia hinh|khảo sát|giai đoạn|chủ trương|lập hồ sơ/i.test(c))
    ) {
      continue;
    }

    let badge = "";
    let moneyCols = cols;
    if (cols.length >= 2 && isGiaiDoanPasteLabel(cols[0])) {
      if (/^(tổng|tong|total)$/i.test(cols[0].trim())) continue;
      badge = normalizePasteBadge(cols[0]);
      moneyCols = cols.slice(1);
    }

    // Có thêm cột Giá trị HĐ đứng trước 5 cột phân rã
    if (moneyCols.length >= 6) {
      moneyCols = moneyCols.slice(moneyCols.length - 5);
    } else if (moneyCols.length === 6) {
      // HD + 5
      moneyCols = moneyCols.slice(1);
    }

    if (moneyCols.length < 5) {
      // Dán lệch: pad / cắt
      while (moneyCols.length < 5) moneyCols.push("");
    }
    moneyCols = moneyCols.slice(0, 5);

    const values = moneyCols.map((c) => parsePasteMoneyCell(c));
    if (values.some((v) => v === null)) continue;
    if (values.every((v) => v === "")) continue;
    out.push({ badge, values });
  }
  return out;
}

/**
 * Áp 5 cột phân rã vào bảng; Giá trị HĐ tự = tổng. Không đụng quét AI trừ khi user dán/sửa.
 * @returns {{ rows: object[], applied: number, message: string }}
 */
export function applyPhanRaPasteToKhoiLuongRows(rows, pasteRows, { startRowIndex = 0 } = {}) {
  const list = (rows || []).map((r) => ({ ...r }));
  const editableIdx = [];
  for (let i = 0; i < list.length; i++) {
    if (list[i].include === false || list[i].canSave === false) continue;
    editableIdx.push(i);
  }
  if (!editableIdx.length || !(pasteRows || []).length) {
    return { rows: list, applied: 0, message: "Không có dòng để dán." };
  }

  let applied = 0;
  let cursor = editableIdx.findIndex((i) => i >= startRowIndex);
  if (cursor < 0) cursor = 0;

  for (const paste of pasteRows) {
    let targetPos = -1;
    if (paste.badge && paste.badge !== "—") {
      targetPos = editableIdx.findIndex((i) => {
        const b = list[i].phaseBadge || formatGiaiDoanBadge(list[i].giai_doan);
        return b === paste.badge;
      });
    }
    if (targetPos < 0) {
      if (cursor >= editableIdx.length) break;
      targetPos = cursor;
      cursor += 1;
    } else {
      cursor = targetPos + 1;
    }
    const rowIdx = editableIdx[targetPos];
    let next = { ...list[rowIdx], nguonNote: "", nguonNoteWarn: false };
    for (let f = 0; f < PHAN_RA_PASTE_FIELDS.length; f++) {
      next = updateKhoiLuongField(next, PHAN_RA_PASTE_FIELDS[f], paste.values[f] ?? "");
    }
    list[rowIdx] = next;
    applied += 1;
  }

  return {
    rows: list,
    applied,
    message:
      applied > 0
        ? `Đã dán ${applied} dòng phân rã — Giá trị HĐ tự cộng từ 5 cột.`
        : "Không dán được dòng nào (kiểm tra vùng chọn Excel).",
  };
}

export function displayMoney(v) {
  const n = numOrNull(v);
  if (n == null) return "—";
  return formatGiaTriHopDong(n);
}

/** Payload upsert từ dòng nháp. */
export function thucHienPayloadFromRow(row, hopDongId) {
  return {
    hop_dong_id: hopDongId,
    ma_du_an: row.ma_du_an,
    hien_trang: row.hien_trang || null,
    gia_tri_hd: row.gia_tri_hd,
    gia_tri_ks: row.gia_tri_ks,
    gia_tri_ks_dia_hinh: row.gia_tri_ks_dia_hinh,
    gia_tri_ks_dia_chat: row.gia_tri_ks_dia_chat,
    gia_tri_ks_khac: row.gia_tri_ks_khac,
    gia_tri_lap_hs: row.gia_tri_lap_hs,
    gia_tri_ctdt: row.gia_tri_ctdt,
    gia_tri_tong_phan_ra: row.gia_tri_tong_phan_ra,
    da_xuat_hd: row.da_xuat_hd,
    con_lai: row.con_lai,
    thang_pd_du_kien: row.thang_pd_du_kien,
    thang_pd_thuc_te: row.thang_pd_thuc_te,
    thang_nt_du_kien: row.thang_nt_du_kien,
    thang_nt_thuc_te: row.thang_nt_thuc_te,
    nam_nt: row.nam_nt,
    san_luong_du_kien: row.san_luong_du_kien,
    tinh_hinh_xuat_hd: row.tinh_hinh_xuat_hd,
    hsnt_trang_thai: row.hsnt_trang_thai,
    bb_ks_ht: row.bb_ks_ht,
    bb_nt: row.bb_nt,
    ton_tai_nt: row.ton_tai_nt,
    ton_tai_kt: row.ton_tai_kt,
    ghi_chu: row.ghi_chu,
  };
}

export function parseMoneyOrKeep(raw) {
  if (raw === "" || raw == null) return "";
  const n = parseGiaTriHopDong(raw);
  return n != null ? n : raw;
}

function softMatchKey(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Token yếu (địa danh / từ chung) — khớp CHỈ các token này dễ gán nhầm
 * mọi CT «… Sơn La» / «… Hà Nội» vào cùng một phụ lục.
 */
const WEAK_NAME_TOKENS = new Set([
  "tba",
  "110",
  "220",
  "kv",
  "110kv",
  "220kv",
  "tinh",
  "thanh",
  "pho",
  "tp",
  "tai",
  "bess",
  "lap",
  "dat",
  "he",
  "thong",
  "pin",
  "luu",
  "tru",
  "nang",
  "luong",
  "cua",
  "evnnpc",
  "va",
  "cac",
  "duong",
  "day",
  "cong",
  "trinh",
  "du",
  "an",
  "cai",
  "tao",
  "cao",
  "luc",
  "truyen",
  "tren",
  "dia",
  "ban",
  "theo",
  "qd",
  "khoang",
  "cach",
  "trang",
  "bi",
  // tỉnh / địa danh ngắn hay trùng nhiều CT trong cùng HĐ
  "son",
  "la",
  "ha",
  "noi",
  "nam",
  "dinh",
  "ninh",
  "binh",
  "hoa",
  "nghe",
  "quang",
  "bac",
  "giang",
  "thuan",
  "chau",
  "tuan",
  "giao",
]);

/** Rút tên TBA ngắn để khớp (bỏ tiền tố BESS / hậu tố tỉnh). */
function extractTbaHint(ten) {
  const s = String(ten || "");
  const m =
    s.match(/TBA\s*110\s*kV\s+([^,;/]+)/i) ||
    s.match(/tại\s+TBA\s*110\s*kV\s+([^,;/]+)/i) ||
    s.match(/tại\s+([^,;/]+)/i);
  let hint = softMatchKey(m ? m[1] : s);
  hint = hint
    .replace(/\s+tinh\s+.+$/i, "")
    .replace(/\s+thanh\s+pho\s+.+$/i, "")
    .replace(/\s+tp\s+.+$/i, "")
    .trim();
  const kv = hint.search(/(?:^|\s)110\s*kv\s+/);
  if (kv >= 0) {
    hint = hint.slice(kv).replace(/^(?:.*?\s)?110\s*kv\s+/, "").trim();
  }
  return hint;
}

const TBA_HINT_STOP = WEAK_NAME_TOKENS;

function tbaHintTokens(hint) {
  return softMatchKey(hint)
    .split(/\s+/)
    .filter((t) => t && t.length >= 2 && !TBA_HINT_STOP.has(t));
}

/** Token đặc trưng từ CẢ tên CT: số hiệu ĐZ + từ khóa việc (không địa danh tỉnh). */
function distinctiveNameTokens(ten) {
  const full = softMatchKey(ten);
  const raw = full.split(/\s+/).filter(Boolean);
  const out = [];
  for (const t of raw) {
    if (!t || t.length < 2) continue;
    if (/^\d{2,4}$/.test(t)) {
      out.push(`#${t}`);
      continue;
    }
    if (WEAK_NAME_TOKENS.has(t)) continue;
    if (["khoang", "cach", "trang", "bi", "tu", "van", "khao"].includes(t)) continue;
    if (t === "sat" && !/giam\s+sat/.test(full)) continue;
    if (t === "online" && !/nhiet|giam\s+sat/.test(full)) continue;
    if (t.length >= 3) out.push(t);
  }
  if (/pha\s+dat|khoang\s+cach\s+pha/.test(full)) out.push("feat:pha_dat");
  if (/giam\s+sat\s+nhiet|nhiet\s+do\s+online/.test(full)) out.push("feat:giam_sat_nhiet");
  if (/son\s+la\s+2/.test(full)) out.push("feat:son_la_2");
  if (/thuan\s+chau/.test(full)) out.push("feat:thuan_chau");
  if (/tuan\s+giao/.test(full)) out.push("feat:tuan_giao");
  return [...new Set(out)];
}

/**
 * Điểm khớp tên công trình / TBA.
 * Không cho khớp chỉ vì cùng tỉnh («Sơn La») — tránh kéo CT ngoài HĐ vào bảng.
 * Không khớp chỉ vì một số hiệu trùng (vd cùng #174 nhưng CT kia có #172 / Sơn La 2).
 */
export function scoreTbaNameMatch(rowTen, candTen) {
  const rowFull = softMatchKey(rowTen);
  const candFull = softMatchKey(candTen);
  if (!rowFull || !candFull) return 0;
  if (rowFull === candFull) return 100;

  const rowStrong = distinctiveNameTokens(rowTen);
  const candStrong = distinctiveNameTokens(candTen);
  if (rowStrong.length && candStrong.length) {
    const rowSet = new Set(rowStrong);
    const candSet = new Set(candStrong);
    const hit = rowStrong.filter((t) => candSet.has(t));
    const digitHits = hit.filter((t) => t.startsWith("#"));
    const featHits = hit.filter((t) => t.startsWith("feat:"));
    const wordHits = hit.filter((t) => !t.startsWith("#") && !t.startsWith("feat:"));
    const rowDigits = rowStrong.filter((t) => t.startsWith("#"));
    const candDigits = candStrong.filter((t) => t.startsWith("#"));
    // Hai CT đều có số hiệu ĐZ nhưng không trùng số nào → khác công trình
    if (rowDigits.length && candDigits.length && digitHits.length === 0) return 0;
    const digitPartial =
      digitHits.length > 0 &&
      (rowDigits.some((t) => !candSet.has(t)) || candDigits.some((t) => !rowSet.has(t)));

    if (digitHits.length >= 2 || featHits.length >= 1) return 98;
    if (digitHits.length === 1 && digitPartial) {
      // Cùng một số hiệu nhưng mỗi bên còn số/đặc trưng khác → chưa đủ để gán
      if (featHits.length >= 1) return 98;
      if (wordHits.length >= 2) return 95;
      return 0;
    }
    if (digitHits.length === 1 && wordHits.length >= 1) return 97;
    if (digitHits.length === 1) return 96;
    if (wordHits.length >= 2) return 95;
    if (wordHits.length === 1 && wordHits[0].length >= 4) return 94;
  }

  // Fallback TBA hint — chỉ khi còn token mạnh (không chỉ địa danh tỉnh)
  const rowHint = extractTbaHint(rowTen);
  const candHint = extractTbaHint(candTen);
  if (!rowHint || !candHint) return 0;
  if (rowHint === candHint) {
    const hintTok = tbaHintTokens(rowHint);
    if (hintTok.length >= 2) return 93;
    if (hintTok.length === 1 && hintTok[0].length >= 5) return 92;
    return 0;
  }

  const rowTok = tbaHintTokens(rowHint);
  const candTok = tbaHintTokens(candHint);
  if (!rowTok.length || !candTok.length) return 0;

  const [shorter, longer] =
    rowTok.length <= candTok.length ? [rowTok, candTok] : [candTok, rowTok];
  const longSet = new Set(longer);
  const hit = shorter.filter((t) => longSet.has(t)).length;
  if (hit === shorter.length && shorter.length >= 2) return 91;
  if (hit === shorter.length && shorter.length === 1 && shorter[0].length >= 5) return 90;
  return 0;
}

/**
 * Từ phụ lục từng TBA → chọn đủ mã DA (mọi giai đoạn) trong danh mục khớp tên.
 * Dùng sau Quét AI để phân bổ «nhà nào về nhà nấy» khi mở form từ 1 công trình.
 */
export function expandMaDuAnsFromPhuLucCongTrinh(catalog, phuLucList = []) {
  const list = Array.isArray(phuLucList) ? phuLucList : [];
  const projects = catalog || [];
  if (!list.length || !projects.length) {
    return { maDuAns: [], matchedPl: 0, unmatchedPl: list.length, matchedCt: 0 };
  }

  const ctMap = new Map();
  for (const p of projects) {
    const ctKey =
      bgdGroupKeyForProject(p) || softMatchKey(p?.ten_du_an) || String(p?.ma_du_an || "");
    if (!ctKey) continue;
    if (!ctMap.has(ctKey)) ctMap.set(ctKey, { sample: p, mas: [] });
    const g = ctMap.get(ctKey);
    if (p?.ma_du_an) g.mas.push(String(p.ma_du_an).trim());
  }

  const ctEntries = [...ctMap.entries()];
  const pairs = [];
  list.forEach((pl, plIdx) => {
    const plTen = pl?.ten_du_an || pl?.ten || "";
    ctEntries.forEach(([ctKey, g]) => {
      const score = scoreTbaNameMatch(g.sample?.ten_du_an, plTen);
      if (score < 90) return;
      const tokN = distinctiveNameTokens(g.sample?.ten_du_an).filter((t) =>
        distinctiveNameTokens(plTen).includes(t)
      ).length;
      pairs.push({ ctKey, plIdx, score, tokN, mas: g.mas });
    });
  });
  pairs.sort((a, b) => b.score - a.score || b.tokN - a.tokN || a.plIdx - b.plIdx);

  const usedPl = new Set();
  const usedCt = new Set();
  const maSet = new Set();
  for (const p of pairs) {
    if (usedPl.has(p.plIdx) || usedCt.has(p.ctKey)) continue;
    usedPl.add(p.plIdx);
    usedCt.add(p.ctKey);
    for (const ma of p.mas) {
      if (ma) maSet.add(ma);
    }
  }

  return {
    maDuAns: [...maSet],
    matchedPl: usedPl.size,
    unmatchedPl: list.length - usedPl.size,
    matchedCt: usedCt.size,
  };
}

function moneyStr(raw) {
  if (raw == null || raw === "") return "";
  if (typeof raw === "object" && "value" in raw) return moneyStr(raw.value);
  const n = numOrNull(raw) ?? parseGiaTriHopDong(raw);
  return n != null ? String(n) : "";
}

/**
 * Suy badge giai đoạn từ dòng phụ lục (AI ghi giai_doan hoặc tên mục lập).
 * "" = không rõ → áp mọi giai đoạn CT như cũ.
 */
export function inferPhuLucPhaseBadge(pl = {}) {
  const raw = String(pl.giai_doan || pl.phase || "").trim().toUpperCase();
  if (/TKBVTC|TKKT/.test(raw)) return "TKBVTC";
  if (/BCKTKT|TKKT-TDT|TKKT_TDT/.test(raw)) return "BCKTKT";
  if (/^(FS|BCNCKT)\b/.test(raw) || raw === "FS" || raw === "BCNCKT") return "FS";
  const blob = softMatchKey(
    [pl.ten_du_an, pl.ten, pl.mo_ta, pl.ghi_chu].filter(Boolean).join(" ")
  );
  if (/lap\s+bcktkt|bcktkt/.test(blob) && !/bcnckt/.test(blob)) return "BCKTKT";
  if (/lap\s+bcnckt|bcnckt/.test(blob) && !/bcktkt/.test(blob)) return "FS";
  if (/tkbvtc|tkkt/.test(blob) && !/bcktkt|bcnckt/.test(blob)) return "TKBVTC";
  // Có cột lập TKBVTC riêng, không có KS → thường là giai đoạn TK
  if (moneyStr(pl.gia_tri_lap_tkbvtc) && !moneyStr(pl.gia_tri_ks) && !moneyStr(pl.gia_tri_lap_bcnckt)) {
    return "TKBVTC";
  }
  return "";
}

function phaseBadgeCompatible(rowBadge, plBadge) {
  if (!plBadge) return true;
  const row = String(rowBadge || "").toUpperCase();
  const pl = String(plBadge || "").toUpperCase();
  if (row === pl) return true;
  // FS ↔ BCNCKT cùng nhóm khảo sát lập BCNCKT
  if ((row === "FS" || row === "BCNCKT") && (pl === "FS" || pl === "BCNCKT")) return true;
  return false;
}

/**
 * Tách KS từ phụ lục: ưu tiên 3 cột địa hình / địa chất / khác;
 * nếu phụ lục chỉ có tổng KS → đổ vào địa hình (tương thích HĐ khung BESS).
 */
export function resolvePhuLucKsSplit(pl = {}) {
  const diaHinh = moneyStr(pl.gia_tri_ks_dia_hinh);
  const diaChat = moneyStr(pl.gia_tri_ks_dia_chat);
  const khac = moneyStr(pl.gia_tri_ks_khac);
  const ksTong = moneyStr(pl.gia_tri_ks);
  const hasSplit = Boolean(diaHinh || diaChat || khac);
  if (hasSplit) {
    const sum =
      (numOrNull(diaHinh) || 0) + (numOrNull(diaChat) || 0) + (numOrNull(khac) || 0);
    return {
      hasSplit: true,
      gia_tri_ks_dia_hinh: diaHinh,
      gia_tri_ks_dia_chat: diaChat,
      gia_tri_ks_khac: khac,
      gia_tri_ks: ksTong || (sum > 0 ? String(sum) : ""),
    };
  }
  return {
    hasSplit: false,
    gia_tri_ks_dia_hinh: ksTong,
    gia_tri_ks_dia_chat: "",
    gia_tri_ks_khac: "",
    gia_tri_ks: ksTong,
  };
}

/**
 * Ghép dòng phụ lục (từng TBA) vào bảng khối lượng theo tên công trình + giai đoạn.
 * Khớp tên CT (số hiệu / đặc trưng); nếu phụ lục ghi giai đoạn thì chỉ đổ vào đúng badge.
 * - FS/BCNCKT/BCKTKT: KS tách địa hình/địa chất/khác nếu có; lập BCNCKT → Lập HS; HĐ ưu tiên tong net
 * - TKBVTC: lập TKBVTC-DT/HSMT → Lập HS + Giá trị HĐ
 */
export function applyPhuLucCongTrinhToKhoiLuongRows(rows, phuLucList = []) {
  const list = Array.isArray(phuLucList) ? phuLucList : [];
  if (!list.length || !(rows || []).length) {
    return { rows: rows || [], matched: 0, unmatched: list.length };
  }

  const byHint = list.map((item) => ({
    item,
    hint: extractTbaHint(item.ten_du_an || item.ten || ""),
    soft: softMatchKey(item.ten_du_an || item.ten || ""),
  }));

  const ctKeyOf = (row) => softMatchKey(row.ten_du_an) || extractTbaHint(row.ten_du_an) || row.ma_du_an;
  const ctKeys = [...new Set((rows || []).map(ctKeyOf).filter(Boolean))];
  const samples = ctKeys.map((ctKey) => ({
    ctKey,
    sample: (rows || []).find((r) => ctKeyOf(r) === ctKey),
  }));

    // Gán toàn cục theo điểm cao → thấp; điểm bằng nhau ưu tiên khớp nhiều token hơn (tránh «giữ cái đầu»).
  const pairs = [];
  for (const { ctKey, sample } of samples) {
    if (!sample) continue;
    byHint.forEach((cand, idx) => {
      const plTen = cand.item.ten_du_an || cand.item.ten || "";
      const score = scoreTbaNameMatch(sample.ten_du_an, plTen);
      if (score < 90) return;
      const tokN = distinctiveNameTokens(sample.ten_du_an).filter((t) =>
        distinctiveNameTokens(plTen).includes(t)
      ).length;
      pairs.push({ ctKey, idx, score, tokN });
    });
  }
  pairs.sort((a, b) => b.score - a.score || b.tokN - a.tokN || a.idx - b.idx);

  const ctToPlIdx = new Map();
  const usedPl = new Set();
  for (const p of pairs) {
    if (ctToPlIdx.has(p.ctKey) || usedPl.has(p.idx)) continue;
    ctToPlIdx.set(p.ctKey, p.idx);
    usedPl.add(p.idx);
  }

  let matchedRows = 0;
  const next = (rows || []).map((row) => {
    const plIdx = ctToPlIdx.get(ctKeyOf(row));
    if (plIdx == null) {
      return {
        ...row,
        nguonNote: row.nguonNote || "Chưa khớp phụ lục TBA — kiểm tra tên / quét lại",
        nguonNoteWarn: true,
      };
    }
    const pl = byHint[plIdx].item;
    const plPhase = inferPhuLucPhaseBadge(pl);
    const badge = row.phaseBadge || formatGiaiDoanBadge(row.giai_doan);
    if (!phaseBadgeCompatible(badge, plPhase)) {
      return {
        ...row,
        nguonNote:
          row.nguonNote ||
          `Phụ lục khớp CT nhưng giai đoạn ${plPhase || "?"} ≠ ${badge || "?"} — không gán số`,
        nguonNoteWarn: true,
      };
    }
    matchedRows += 1;
    const ksSplit = resolvePhuLucKsSplit(pl);
    const ks = ksSplit.gia_tri_ks;
    const lapFs = moneyStr(pl.gia_tri_lap_bcnckt ?? pl.gia_tri_lap_hs_fs);
    const lapTk = moneyStr(pl.gia_tri_lap_tkbvtc ?? pl.gia_tri_lap_hs_tkbvtc);
    const tong = moneyStr(pl.gia_tri_tong ?? pl.gia_tri_hd);
    const tbaLabel =
      (() => {
        const toks = distinctiveNameTokens(pl.ten_du_an || pl.ten || "");
        const nice = toks
          .filter((t) => t.startsWith("#") || t.startsWith("feat:") || t.length >= 4)
          .slice(0, 3)
          .map((t) => t.replace(/^#/, "").replace(/^feat:/, ""));
        if (nice.length) return nice.join("·");
        return extractTbaHint(pl.ten_du_an || pl.ten || "") || "—";
      })();

    let patch = {
      ...row,
      nguonNote: `Phụ lục TBA «${tbaLabel}»`,
      nguonNoteWarn: false,
    };
    if (badge === "TKBVTC") {
      const hd = lapTk || "";
      patch = {
        ...patch,
        gia_tri_lap_hs: lapTk || patch.gia_tri_lap_hs,
        gia_tri_hd: hd || patch.gia_tri_hd,
      };
      return updateKhoiLuongField(patch, "gia_tri_lap_hs", patch.gia_tri_lap_hs || "");
    }

    const sumKsLap = (numOrNull(ks) || 0) + (numOrNull(lapFs) || 0);
    const hasSeparateTk = Boolean(lapTk);
    // Ưu tiên gia_tri_tong (net sau TNCTTT nếu có); không thì gross KS+Lập.
    const hdFromTong = tong;
    const hdFromSum = sumKsLap ? String(sumKsLap) : "";
    const hdFallback =
      badge === "BCKTKT" ? hdFromSum || lapFs || ks || "" : hdFromSum || lapFs || ks || "";

    patch = {
      ...patch,
      gia_tri_ks_dia_hinh: ksSplit.gia_tri_ks_dia_hinh || patch.gia_tri_ks_dia_hinh,
      gia_tri_ks_dia_chat: ksSplit.hasSplit
        ? ksSplit.gia_tri_ks_dia_chat || ""
        : patch.gia_tri_ks_dia_chat,
      gia_tri_ks_khac: ksSplit.hasSplit
        ? ksSplit.gia_tri_ks_khac || ""
        : patch.gia_tri_ks_khac,
      gia_tri_ks: ks || patch.gia_tri_ks,
      gia_tri_lap_hs:
        lapFs || (badge === "BCKTKT" && !hasSeparateTk ? lapTk : "") || patch.gia_tri_lap_hs,
      gia_tri_hd: hdFromTong || hdFallback || patch.gia_tri_hd,
    };

    let out = updateKhoiLuongField(
      patch,
      "gia_tri_ks_dia_hinh",
      patch.gia_tri_ks_dia_hinh || ""
    );
    out = updateKhoiLuongField(out, "gia_tri_ks_dia_chat", patch.gia_tri_ks_dia_chat || "");
    out = updateKhoiLuongField(out, "gia_tri_ks_khac", patch.gia_tri_ks_khac || "");
    out = updateKhoiLuongField(out, "gia_tri_lap_hs", patch.gia_tri_lap_hs || "");
    // Gán lại HĐ net từ phụ lục (updateField có thể đã gắn HĐ = tổng gross phân rã).
    if (hdFromTong) {
      out = updateKhoiLuongField(out, "gia_tri_hd", hdFromTong);
    }
    return out;
  });

  return {
    rows: next,
    matched: matchedRows,
    unmatched: list.length - usedPl.size,
    matchedCt: ctToPlIdx.size,
  };
}

/** Dòng chi phí chung HĐ (không gắn mã DA). */
export function emptyChiPhiChungRow(partial = {}) {
  return {
    key: partial.key || `chung-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    mo_ta: partial.mo_ta ?? "",
    gia_tri: partial.gia_tri != null ? String(partial.gia_tri) : "",
    loai: partial.loai || "khac",
  };
}

export function normalizeChiPhiChungRows(rawList) {
  const list = Array.isArray(rawList) ? rawList : [];
  return list.map((r, i) =>
    emptyChiPhiChungRow({
      key: r.key || `chung-${i}`,
      mo_ta: r.mo_ta || r.ten || r.noi_dung || "",
      gia_tri: r.gia_tri ?? r.value ?? "",
      loai: r.loai || guessChiPhiChungLoai(r.mo_ta || r.ten || ""),
    })
  );
}

function guessChiPhiChungLoai(moTa) {
  const t = String(moTa || "").toLowerCase();
  if (/dịch\s*thuật|dich\s*thuat/.test(t) && /hsmt/.test(t)) return "dich_thuat_hsmt";
  if (/lập\s*hsmt|lap\s*hsmt|hồ sơ mời thầu|ho so moi thau/.test(t)) return "hsmt";
  if (/hsmt/.test(t)) return "hsmt";
  return "khac";
}

export function sumChiPhiChung(rows) {
  return (rows || []).reduce((s, r) => s + (numOrNull(r.gia_tri) || 0), 0);
}

export function chiPhiChungLoaiLabel(loai) {
  if (loai === "hsmt") return "Lập HSMT";
  if (loai === "dich_thuat_hsmt") return "Dịch thuật HSMT";
  return "Chi phí chung";
}
