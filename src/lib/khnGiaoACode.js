/**
 * Mã căn cứ giả lập cho dự án Khách hàng ngoài (không có QĐ Giao A).
 * Dạng: KHN-YYYY-SLUG[ ngày dd/mm/yyyy] — ngày = ngày ký HĐ khi đã có.
 */

export {
  toNgayIso as normalizeNgayKyIso,
  formatNgayVi as formatNgayKyViSlash,
  formatNgayViLong as formatNgayKyViLong,
} from "./formatNgay.js";

import {
  toNgayIso as normalizeNgayKyIso,
  formatNgayVi as formatNgayKyViSlash,
  formatNgayViLong as formatNgayKyViLong,
} from "./formatNgay.js";
import { isKhachHangNgoai } from "./chuDauTuAlias.js";

function removeVietnameseTones(str) {
  if (!str) return "";
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

/** Slug ổn định từ tên dự án, tối đa 10 ký tự A–Z/0–9. */
export function buildKhnSlugFromTen(tenDuAn, maxLen = 10) {
  const clean = removeVietnameseTones(tenDuAn || "")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "DA";

  const words = clean.split(" ").filter(Boolean);
  let acronym = words.map((w) => w[0]?.toUpperCase() || "").join("");
  if (acronym.length >= 3) {
    return acronym.slice(0, maxLen);
  }

  const compact = clean.replace(/\s+/g, "").toUpperCase();
  if (compact.length <= maxLen) return compact || "DA";
  return compact.slice(0, maxLen);
}

export function isKhnQdCode(qd) {
  return /^KHN-\d{4}-[A-Z0-9]+(\s+ngày\s+.+)?$/i.test(String(qd || "").trim());
}

/** QĐ trống / giả / placeholder — cần cấp mã KHN. */
export function needsKhnQdAssignment(qd, chuDauTu) {
  if (!isKhachHangNgoai(chuDauTu)) return false;
  const s = String(qd || "").trim();
  if (!s) return true;
  if (s === "0" || s === "-" || s === "—") return true;
  if (/chưa\s*gắn/i.test(s)) return true;
  if (isKhnQdCode(s)) return false;
  // Đã có QĐ nội bộ thật (hiếm với KHN) — giữ nguyên
  if (/Q[ĐđD]/i.test(s) && /\d/.test(s)) return false;
  return true;
}

export function khnQdHasNgay(qd) {
  return /\s+ngày\s+\d{1,2}\s*[\/.\-]\s*\d{1,2}\s*[\/.\-]\s*\d{2,4}/i.test(
    String(qd || "")
  );
}

export function parseKhnQdParts(qd) {
  const s = String(qd || "").trim();
  const m = s.match(/^KHN-(\d{4})-([A-Z0-9]+)(?:\s+ngày\s+(.+))?$/i);
  if (!m) return null;
  return {
    year: m[1],
    slug: m[2].toUpperCase(),
    ngayRaw: (m[3] || "").trim(),
  };
}

/**
 * @param {{ year: string|number, slug: string, ngayKyIso?: string }} opts
 */
export function formatKhnQdGiaoA({ year, slug, ngayKyIso } = {}) {
  const y = String(year || new Date().getFullYear()).replace(/\D/g, "").slice(0, 4);
  let sl = String(slug || "DA")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);
  if (!sl) sl = "DA";
  let out = `KHN-${y || new Date().getFullYear()}-${sl}`;
  const vi = formatNgayKyViSlash(ngayKyIso);
  if (vi) out += ` ngày ${vi}`;
  return out;
}

export function formatKhnQdDayDu(qdShort) {
  const parts = parseKhnQdParts(qdShort);
  if (!parts) {
    const s = String(qdShort || "").trim();
    return s
      ? `Căn cứ dự án khách hàng ngoài ${s} (không có QĐ Giao A nội bộ).`
      : "";
  }
  const ngayLong = parts.ngayRaw
    ? formatNgayKyViLong(
        normalizeNgayKyIso(parts.ngayRaw) ||
          (() => {
            const m = parts.ngayRaw.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
            return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
          })()
      )
    : "";
  const ngayBit = ngayLong ? ` ngày ${ngayLong}` : "";
  return `Căn cứ dự án khách hàng ngoài KHN-${parts.year}-${parts.slug}${ngayBit} (không có QĐ Giao A nội bộ).`;
}

/** Gắn ngày ký HĐ nếu mã KHN chưa có ngày — không đổi ngày đã có. */
export function attachNgayKyToKhnQd(qd, ngayKyIso) {
  const s = String(qd || "").trim();
  if (!isKhnQdCode(s)) return s;
  if (khnQdHasNgay(s)) return s;
  const iso = normalizeNgayKyIso(ngayKyIso);
  if (!iso) return s;
  const parts = parseKhnQdParts(s);
  if (!parts) return s;
  return formatKhnQdGiaoA({
    year: parts.year,
    slug: parts.slug,
    ngayKyIso: iso,
  });
}

/**
 * Đảm bảo slug không trùng trong cùng năm (danh sách mã KHN-YYYY-* đã có).
 * @param {string[]} existingQdList
 */
export function ensureUniqueKhnSlug(baseSlug, year, existingQdList = []) {
  const y = String(year || new Date().getFullYear());
  const used = new Set();
  for (const qd of existingQdList) {
    const p = parseKhnQdParts(qd);
    if (p && p.year === y) used.add(p.slug);
  }
  let slug = String(baseSlug || "DA")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);
  if (!slug) slug = "DA";
  if (!used.has(slug)) return slug;

  for (let i = 2; i <= 99; i++) {
    const num = String(i);
    const next = `${slug.slice(0, Math.max(1, 10 - num.length))}${num}`;
    if (!used.has(next)) return next;
  }
  return `${slug.slice(0, 6)}${String(Date.now()).slice(-4)}`.slice(0, 10);
}

/**
 * Cấp mã KHN cho một công trình (các giai đoạn cùng tên dùng chung).
 */
export function assignKhnQdForCongTrinh({
  tenDuAn,
  year,
  ngayKyIso = "",
  existingQdList = [],
  reservedSlugs = [],
} = {}) {
  const base = buildKhnSlugFromTen(tenDuAn);
  const slug = ensureUniqueKhnSlug(base, year, [
    ...existingQdList,
    ...reservedSlugs.map((s) => formatKhnQdGiaoA({ year, slug: s })),
  ]);
  const qd = formatKhnQdGiaoA({ year, slug, ngayKyIso });
  return { qd, slug, dayDu: formatKhnQdDayDu(qd) };
}

/**
 * Hiển thị / khóa nhóm báo cáo khi DA KHN còn thiếu qd_giao_a trên DB.
 */
export function resolveKhnQdForDisplay(project) {
  const chu = project?.chu_dau_tu;
  if (!isKhachHangNgoai(chu)) {
    return String(project?.qd_giao_a || "").trim();
  }
  const raw = String(project?.qd_giao_a || "").trim();
  if (raw && !needsKhnQdAssignment(raw, chu)) return raw;
  return formatKhnQdGiaoA({
    year: project?.nam_giao_a || new Date().getFullYear(),
    slug: buildKhnSlugFromTen(project?.ten),
    ngayKyIso: "",
  });
}

/**
 * Sau lưu HĐ: cấp mã KHN (nếu thiếu) và/hoặc gắn ngày ký (nếu mã chưa có ngày).
 * @returns {Promise<number>} số dòng du_an đã cập nhật
 */
export async function syncKhnQdNgayKyFromHopDong(
  supabase,
  { maDuAns = [], ngayKy = "", tenDuAnHint = "" } = {}
) {
  const mas = [...new Set((maDuAns || []).map((m) => String(m || "").trim()).filter(Boolean))];
  if (!mas.length || !supabase) return 0;

  const iso = normalizeNgayKyIso(ngayKy);
  const { data: rows, error } = await supabase
    .from("du_an")
    .select("ma_du_an, ten, chu_dau_tu, qd_giao_a, qd_giao_a_day_du, nam_giao_a")
    .in("ma_du_an", mas);
  if (error) throw error;

  let updated = 0;
  for (const row of rows || []) {
    if (!isKhachHangNgoai(row.chu_dau_tu)) continue;
    const year = String(row.nam_giao_a || iso.slice(0, 4) || new Date().getFullYear());
    let nextQd = String(row.qd_giao_a || "").trim();

    if (needsKhnQdAssignment(nextQd, row.chu_dau_tu)) {
      const assigned = assignKhnQdForCongTrinh({
        tenDuAn: row.ten || tenDuAnHint,
        year,
        ngayKyIso: iso,
      });
      nextQd = assigned.qd;
    } else if (iso) {
      nextQd = attachNgayKyToKhnQd(nextQd, iso);
    }

    if (!nextQd || nextQd === String(row.qd_giao_a || "").trim()) continue;

    const dayDu = formatKhnQdDayDu(nextQd);
    const { error: upErr } = await supabase
      .from("du_an")
      .update({
        qd_giao_a: nextQd,
        qd_giao_a_day_du: dayDu,
        ...(row.nam_giao_a ? {} : { nam_giao_a: year }),
      })
      .eq("ma_du_an", row.ma_du_an);
    if (upErr) throw upErr;
    updated += 1;
  }
  return updated;
}
