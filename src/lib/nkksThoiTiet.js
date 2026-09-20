export const NKKS_THOI_TIET_OPTIONS = ["Nắng", "Râm", "Mưa", "Mưa dầm"];

/** Màu chip theo loại thời tiết — sáng (nắng) / trầm (mưa) */
export const NKKS_THOI_TIET_CHIP_STYLES = {
  Nắng: {
    idle: "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300",
    active: "border-amber-500 bg-gradient-to-b from-amber-200 to-amber-300 text-amber-950 shadow-sm",
    box: "border-amber-500 bg-amber-400",
  },
  Râm: {
    idle: "border-slate-300 bg-slate-100 text-slate-600 hover:border-slate-400",
    active: "border-slate-500 bg-gradient-to-b from-slate-300 to-slate-400 text-slate-900 shadow-sm",
    box: "border-slate-600 bg-slate-500",
  },
  Mưa: {
    idle: "border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300",
    active: "border-sky-600 bg-gradient-to-b from-sky-400 to-sky-500 text-white shadow-sm",
    box: "border-sky-700 bg-sky-600",
  },
  "Mưa dầm": {
    idle: "border-indigo-200 bg-indigo-50 text-indigo-700 hover:border-indigo-300",
    active: "border-indigo-700 bg-gradient-to-b from-indigo-500 to-indigo-600 text-white shadow-sm",
    box: "border-indigo-800 bg-indigo-700",
  },
};

export const DEFAULT_THOI_TIET = {
  sang: ["Nắng"],
  chieu: ["Nắng"],
};

export const NKKS_DEFAULT_KHONG_VALUE = "Không";

/** Mặc định ô Ý kiến giám sát */
export const NKKS_DEFAULT_GIAM_SAT_VALUE = "Thống nhất";

export const NKKS_DEFAULT_KHONG_FIELDS = [
  "y_kien_chu_dau_tu",
  "cac_van_de_dac_biet",
];

export function isDefaultKhongValue(value) {
  const v = String(value || "").trim().toLowerCase();
  return v === "không" || v === "khong";
}

export function isDefaultGiamSatValue(value) {
  const v = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFC");
  return v === "thống nhất" || v === "thong nhat";
}

export function normalizeKhongField(value) {
  const v = String(value ?? "").trim();
  return v || NKKS_DEFAULT_KHONG_VALUE;
}

/** Mặc định «Thống nhất»; đổi luôn giá trị cũ «Không» (mặc định chung trước đây). */
export function normalizeGiamSatField(value) {
  const v = String(value ?? "").trim();
  if (!v || isDefaultKhongValue(v)) return NKKS_DEFAULT_GIAM_SAT_VALUE;
  return v;
}

function uniqueOptions(list) {
  return NKKS_THOI_TIET_OPTIONS.filter((opt) => (list || []).includes(opt));
}

export function normalizeThoiTiet(raw) {
  if (!raw) return { ...DEFAULT_THOI_TIET, sang: [...DEFAULT_THOI_TIET.sang], chieu: [...DEFAULT_THOI_TIET.chieu] };

  if (typeof raw === "object" && !Array.isArray(raw)) {
    return {
      sang: uniqueOptions(raw.sang?.length ? raw.sang : DEFAULT_THOI_TIET.sang),
      chieu: uniqueOptions(raw.chieu?.length ? raw.chieu : DEFAULT_THOI_TIET.chieu),
    };
  }

  const text = String(raw).trim();
  if (!text) {
    return { ...DEFAULT_THOI_TIET, sang: [...DEFAULT_THOI_TIET.sang], chieu: [...DEFAULT_THOI_TIET.chieu] };
  }

  const lower = text.toLowerCase();
  const pickFromText = (segment) =>
    NKKS_THOI_TIET_OPTIONS.filter((opt) => segment.toLowerCase().includes(opt.toLowerCase()));

  const sangMatch = text.match(/buổi\s*sáng\s*:?\s*([^\n+]+)/i);
  const chieuMatch = text.match(/buổi\s*chiều\s*:?\s*([^\n+]+)/i);

  if (sangMatch || chieuMatch) {
    const sang = pickFromText(sangMatch?.[1] || "");
    const chieu = pickFromText(chieuMatch?.[1] || "");
    return {
      sang: sang.length ? sang : [...DEFAULT_THOI_TIET.sang],
      chieu: chieu.length ? chieu : [...DEFAULT_THOI_TIET.chieu],
    };
  }

  const picked = pickFromText(lower);
  if (picked.length) {
    return { sang: [...picked], chieu: [...picked] };
  }

  return { ...DEFAULT_THOI_TIET, sang: [...DEFAULT_THOI_TIET.sang], chieu: [...DEFAULT_THOI_TIET.chieu] };
}

export function isDefaultThoiTiet(value) {
  const norm = normalizeThoiTiet(value);
  return (
    norm.sang.length === 1 &&
    norm.sang[0] === "Nắng" &&
    norm.chieu.length === 1 &&
    norm.chieu[0] === "Nắng"
  );
}

export function toggleThoiTietOption(value, buoi, option) {
  const norm = normalizeThoiTiet(value);
  const key = buoi === "chieu" ? "chieu" : "sang";
  const current = new Set(norm[key]);
  if (current.has(option)) {
    if (current.size === 1) return norm;
    current.delete(option);
  } else {
    current.add(option);
  }
  return {
    ...norm,
    [key]: NKKS_THOI_TIET_OPTIONS.filter((opt) => current.has(opt)),
  };
}

function formatBuoiLine(label, selected) {
  const parts = NKKS_THOI_TIET_OPTIONS.map((opt) =>
    selected.includes(opt) ? `☑ ${opt}` : `☐ ${opt}`
  );
  return `+ ${label}: ${parts.join(" ")}`;
}

export function formatThoiTietForExport(value) {
  const norm = normalizeThoiTiet(value);
  return [formatBuoiLine("Buổi sáng", norm.sang), formatBuoiLine("Buổi chiều", norm.chieu)].join("\n");
}

export function isNkksDayFieldFilled(row, key) {
  if (key === "thoi_tiet") return !isDefaultThoiTiet(row?.thoi_tiet);
  if (key === "y_kien_giam_sat") return !isDefaultGiamSatValue(row?.[key]);
  if (NKKS_DEFAULT_KHONG_FIELDS.includes(key)) return !isDefaultKhongValue(row?.[key]);
  return Boolean(String(row?.[key] || "").trim());
}
