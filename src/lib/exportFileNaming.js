/**
 * Quy tắc tên file xuất (NVKS và module khác dùng chung):
 * - Tải local / lưu Storage: `{baseName}-{yyyyMMdd-HHmmss}.{ext}`
 * - Hiển thị form/kho: `{baseName}.{ext}` + thời gian tách riêng (màu khác)
 */

const EXPORT_TIME_SUFFIX_RE = /^(.+)-(\d{8}-\d{6})\.([a-z0-9]+)$/i;
/** Quy tắc cũ: `..._{milliseconds}.ext` — số 13 chữ số = thời điểm xuất (ms) */
const LEGACY_MS_SUFFIX_RE = /^(.+)_(\d{13})\.([a-z0-9]+)$/i;

/** Slug thời gian trong tên file local */
export function formatExportTimeSlug(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${y}${m}${day}-${h}${mi}${s}`;
}

/** Hiển thị dd/MM/yyyy HH:mm */
export function formatExportDisplayTime(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const y = d.getFullYear();
  const h = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${m}/${y} ${h}:${mi}`;
}

/** Tách tên file local — hỗ trợ cả quy tắc mới và cũ */
export function splitExportLocalFileName(fileName) {
  const raw = String(fileName || "").trim();
  if (!raw) return { baseName: "", displayName: "", ext: "", timeSlug: "", displayTime: "" };

  const m = raw.match(EXPORT_TIME_SUFFIX_RE);
  if (m) {
    const baseName = m[1];
    const ext = m[3];
    const timeSlug = m[2];
    const y = timeSlug.slice(0, 4);
    const mo = timeSlug.slice(4, 6);
    const day = timeSlug.slice(6, 8);
    const h = timeSlug.slice(9, 11);
    const mi = timeSlug.slice(11, 13);
    return {
      baseName,
      displayName: `${baseName}.${ext}`,
      ext,
      timeSlug,
      displayTime: formatExportDisplayTime(new Date(`${y}-${mo}-${day}T${h}:${mi}:00`)),
    };
  }

  const legacy = raw.match(LEGACY_MS_SUFFIX_RE);
  if (legacy) {
    const baseName = legacy[1];
    const ext = legacy[3];
    const ms = Number(legacy[2]);
    return {
      baseName,
      displayName: `${baseName}.${ext}`,
      ext,
      timeSlug: "",
      displayTime: Number.isFinite(ms) ? formatExportDisplayTime(ms) : "",
    };
  }

  const dot = raw.lastIndexOf(".");
  const ext = dot >= 0 ? raw.slice(dot + 1) : "";
  const stem = dot >= 0 ? raw.slice(0, dot) : raw;
  return {
    baseName: stem,
    displayName: raw,
    ext,
    timeSlug: "",
    displayTime: "",
  };
}

export function extractFileNameFromUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  try {
    const path = raw.split("?")[0];
    const seg = decodeURIComponent(path.split("/").pop() || "");
    return seg;
  } catch {
    return raw.split("/").pop() || "";
  }
}

/**
 * @param {string} baseName — không gồm timestamp / không gồm tên người
 */
export function buildExportLocalFileName(baseName, { timestamp, ext = "docx" } = {}) {
  const base = String(baseName || "file").trim() || "file";
  const safeExt = String(ext || "docx").replace(/^\./, "").toLowerCase();
  const ts = timestamp ?? Date.now();
  const timeSlug = formatExportTimeSlug(ts);
  return {
    baseName: base,
    localFileName: `${base}-${timeSlug}.${safeExt}`,
    displayName: `${base}.${safeExt}`,
    displayTime: formatExportDisplayTime(ts),
    timeSlug,
    timestamp: ts,
    ext: safeExt,
  };
}

export function parseExportFromStorageUrl(url, fallbackTime) {
  const localFileName = extractFileNameFromUrl(url);
  const parts = splitExportLocalFileName(localFileName);
  if (parts.displayTime) return parts;
  if (fallbackTime) {
    return {
      ...parts,
      displayTime: formatExportDisplayTime(fallbackTime),
    };
  }
  return parts;
}
