/** Ví dụ viết tắt (1 dòng): 308/2020/HĐTV-BDAĐL-KHVT ngày 07/12/2020
 *  Ví dụ tiêu đề workspace (2 dòng):
 *    Hợp đồng số 308/2020/HĐTV-BDAĐL-KHVT
 *    ngày 07/12/2020
 *  Ví dụ chi tiết: Hợp đồng số … ngày … gói thầu: … dự án “…” giữa … và …
 */

function padYear(y) {
  const s = String(y || "");
  return s.length === 2 ? `20${s}` : s;
}

function stripHopDongSoPrefix(so) {
  return String(so || "")
    .trim()
    .replace(/^Hợp\s*đồng\s*số\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Chuẩn hoá ngày về d/m/yyyy nếu đọc được. */
function normalizeNgayText(raw) {
  const s = String(raw || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return "";
  const m = s.match(
    /(\d{1,2})\s*[\/.\-]\s*(\d{1,2})\s*[\/.\-]\s*((?:\d{4})|(?:\d{2}))/
  );
  if (m) return `${m[1]}/${m[2]}/${padYear(m[3])}`;
  const m2 = s.match(
    /(\d{1,2})\s*(?:tháng\s*)?(\d{1,2})\s*(?:năm\s*)?(\d{4})/i
  );
  if (m2) return `${m2[1]}/${m2[2]}/${m2[3]}`;
  return "";
}

/**
 * Tách số HĐ và ngày ký để ghép lại (1 dòng hoặc 2 dòng).
 * @returns {{ so: string, ngay: string }}
 */
export function resolveHopDongSoVaNgay(hopDong, hopDongDayDu = "") {
  const raw = String(hopDong || "")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const full = String(hopDongDayDu || "")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!raw && !full) return { so: "", ngay: "" };

  const fromInline = (text) => {
    const m = String(text || "").match(
      /^(.+?)\s+ngày\s+(\d{1,2})\s*[\/.\-]\s*(\d{1,2})\s*[\/.\-]\s*((?:\d{4})|(?:\d{2}))\s*$/i
    );
    if (!m) return null;
    return {
      so: stripHopDongSoPrefix(m[1]),
      ngay: `${m[2]}/${m[3]}/${padYear(m[4])}`,
    };
  };

  const inlineRaw = fromInline(raw);
  if (inlineRaw?.so) return inlineRaw;

  // «… ngày» dính cuối nhưng thiếu/lệch ngày → tách phần trước «ngày»
  if (raw && /\s+ngày\b/i.test(raw)) {
    const parts = raw.match(/^(.+?)\s+ngày\s*(.*)$/i);
    if (parts) {
      const so = stripHopDongSoPrefix(parts[1]);
      const ngay = normalizeNgayText(parts[2]) || normalizeNgayText(full);
      if (so) return { so, ngay };
    }
  }

  const fromFull = full.match(
    /(?:số\s*)?([0-9A-Za-zÀ-ỹ./\-]+(?:\/[0-9A-Za-zÀ-ỹ.\-]+)*)[^\n]{0,40}?ngày\s+(\d{1,2})\s*(?:tháng\s*)?(\d{1,2})\s*(?:năm\s*)?(\d{4})/i
  );
  if (fromFull) {
    return {
      so: stripHopDongSoPrefix(raw || fromFull[1]),
      ngay: `${fromFull[2]}/${fromFull[3]}/${fromFull[4]}`,
    };
  }

  const dateOnly = full.match(
    /ngày\s+(\d{1,2})\s*(?:tháng\s*)?(\d{1,2})\s*(?:năm\s*)?(\d{4})/i
  );
  if (raw && dateOnly) {
    return {
      so: stripHopDongSoPrefix(raw),
      ngay: `${dateOnly[1]}/${dateOnly[2]}/${dateOnly[3]}`,
    };
  }

  if (raw) return { so: stripHopDongSoPrefix(raw), ngay: "" };
  return {
    so: full.length > 60 ? `${full.slice(0, 57)}...` : full,
    ngay: "",
  };
}

/** Cắt hậu tố « ngày dd/mm/yyyy» — dùng gom trùng số HĐ trên sổ. */
export function normalizeSoHopDongKey(raw) {
  const { so } = resolveHopDongSoVaNgay(raw, "");
  if (so) return so.toLowerCase();
  let s = String(raw || "")
    .trim()
    .replace(/\s+/g, " ");
  if (!s) return "";
  const m = s.match(/^(.+?)\s+ngày\s+/i);
  if (m) s = m[1].trim();
  return s.toLowerCase();
}

/**
 * Ví dụ: 308/2020/HĐTV-BDAĐL-KHVT ngày 07/12/2020
 * @param {{ wrapDate?: boolean }} [options] wrapDate=true → xuống dòng *trước* chữ «ngày»
 *   (khác Giao A: «ngày» nằm cùng dòng với ngày)
 */
export function formatHopDongShort(hopDong, hopDongDayDu = "", options = {}) {
  const wrapDate = Boolean(options?.wrapDate);
  const { so, ngay } = resolveHopDongSoVaNgay(hopDong, hopDongDayDu);
  if (!so && !ngay) return "-";
  if (!ngay) return so || "-";
  return wrapDate ? `${so}\nngày ${ngay}` : `${so} ngày ${ngay}`;
}

/**
 * Tiêu đề: Hợp đồng số 308/2020/... + dòng ngày (khi wrapDate).
 * @param {{ wrapDate?: boolean }} [options]
 */
export function formatHopDongTitleLabel(
  hopDong,
  hopDongDayDu = "",
  fallback = "Hợp đồng",
  options = {}
) {
  const opts =
    fallback && typeof fallback === "object" ? fallback : options || {};
  const fb =
    typeof fallback === "string" ? fallback : "Hợp đồng";
  const wrapDate = Boolean(opts?.wrapDate);
  const { so, ngay } = resolveHopDongSoVaNgay(hopDong, hopDongDayDu);
  if (!so && !ngay) return fb;
  if (!ngay) return `Hợp đồng số ${so}`;
  return wrapDate
    ? `Hợp đồng số ${so}\nngày ${ngay}`
    : `Hợp đồng số ${so} ngày ${ngay}`;
}
