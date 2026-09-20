/** Chuẩn hóa cấp điện áp từ DB (string, object AI, hoặc JSON string). */
export function normalizeCapDienAp(raw) {
  if (raw == null) return "";
  if (typeof raw === "object") {
    const v = raw.value ?? raw.label ?? "";
    return String(v).trim();
  }
  const s = String(raw).trim();
  if (s.startsWith("{")) {
    try {
      const parsed = JSON.parse(s);
      if (parsed && typeof parsed === "object") {
        return String(parsed.value ?? "").trim();
      }
    } catch {
      /* giữ nguyên chuỗi gốc */
    }
  }
  return s;
}

/**
 * Danh mục cấp điện áp chuẩn (lưu đúng chuỗi value vào DANH_MUC_DA).
 * Thứ tự: Cao áp → Trung áp → Trung Hạ áp → Hạ áp.
 */
export const CAP_DIEN_AP_CATALOG_OPTIONS = [
  { value: "220kV (Cao áp)", label: "220kV (Cao áp)" },
  { value: "110kV (Cao áp)", label: "110kV (Cao áp)" },
  { value: "110kV-220kV (Cao áp)", label: "110kV-220kV (Cao áp)" },
  { value: "22kV-35kV (Trung áp)", label: "22kV-35kV (Trung áp)" },
  { value: "0,4kV-35kV (Trung Hạ áp -THA)", label: "0,4kV-35kV (Trung Hạ áp -THA)" },
  { value: "0,4kV (Hạ áp)", label: "0,4kV (Hạ áp)" },
];

/** Map giá trị cũ → danh mục mới (dữ liệu đã lưu trước đây). */
const LEGACY_CAP_DIEN_AP_MAP = {
  "110kV": "110kV (Cao áp)",
  "220kV": "220kV (Cao áp)",
  "110kV-220kV": "110kV-220kV (Cao áp)",
  "110-220kV": "110kV-220kV (Cao áp)",
  "22kV-35kV": "22kV-35kV (Trung áp)",
  "22-35kV": "22kV-35kV (Trung áp)",
  "Trung áp": "22kV-35kV (Trung áp)",
  THA: "0,4kV-35kV (Trung Hạ áp -THA)",
  "Trung Hạ Áp": "0,4kV-35kV (Trung Hạ áp -THA)",
  "Trung Hạ Áp (THA)": "0,4kV-35kV (Trung Hạ áp -THA)",
  "Trung hạ áp (0.4-35kV)": "0,4kV-35kV (Trung Hạ áp -THA)",
  "Cao áp (110-220kV)": "110kV-220kV (Cao áp)",
  "Cao áp 110-220kV": "110kV-220kV (Cao áp)",
  "0,4kV": "0,4kV (Hạ áp)",
  "0.4kV": "0,4kV (Hạ áp)",
};

/** Đưa về đúng value trong danh mục (nếu map được). */
export function toCatalogCapDienAp(raw) {
  const v = normalizeCapDienAp(raw);
  if (!v) return "";
  if (CAP_DIEN_AP_CATALOG_OPTIONS.some((o) => o.value === v)) return v;
  if (LEGACY_CAP_DIEN_AP_MAP[v]) return LEGACY_CAP_DIEN_AP_MAP[v];
  // Khớp gần (không phân biệt hoa thường / khoảng trắng thừa)
  const compact = v.replace(/\s+/g, " ").trim();
  const hit = CAP_DIEN_AP_CATALOG_OPTIONS.find(
    (o) => o.value.toLowerCase() === compact.toLowerCase()
  );
  if (hit) return hit.value;
  if (LEGACY_CAP_DIEN_AP_MAP[compact]) return LEGACY_CAP_DIEN_AP_MAP[compact];
  return v;
}

/** Nhãn hiển thị trên UI (header, bảng). */
export function formatCapDienApDisplay(raw) {
  return toCatalogCapDienAp(raw) || "";
}

/** Gợi ý giá trị khi DB trống hoặc lỗi JSON. */
export function suggestCapDienApForEdit(raw, project) {
  const mapped = toCatalogCapDienAp(raw);
  if (mapped && CAP_DIEN_AP_CATALOG_OPTIONS.some((o) => o.value === mapped)) {
    return mapped;
  }

  const bucket = classifyCapDienApBucket(project || { cap_dien_ap: raw, ten_du_an: project?.ten_du_an, ma_du_an: project?.ma_du_an });
  if (bucket && bucket !== "Chưa xác định") return bucket;
  return "";
}

/** Màu biểu đồ — 6 hue tách biệt rõ (nhìn là phân biệt ngay). */
export const CAP_DIEN_AP_CHART_COLORS = {
  "220kV (Cao áp)": "#1e3a8a", // xanh navy
  "110kV (Cao áp)": "#a21caf", // hồng tím fuchsia
  "110kV-220kV (Cao áp)": "#0d9488", // teal — dự án lẫn cao áp
  "22kV-35kV (Trung áp)": "#ea580c", // cam — dự án lẫn / trung áp
  "0,4kV-35kV (Trung Hạ áp -THA)": "#e11d48", // đỏ hồng
  "0,4kV (Hạ áp)": "#16a34a", // xanh lá
  "Chưa xác định": "#64748b", // xám
};

/**
 * Phân loại 1 dự án vào bucket danh mục.
 * «110kV-220kV» / «22kV-35kV» = dự án lẫn nhiều cấp (ưu tiên nhận diện trước cấp đơn).
 */
export function classifyCapDienApBucket(project) {
  const mapped = toCatalogCapDienAp(project?.cap_dien_ap);
  if (mapped && CAP_DIEN_AP_CATALOG_OPTIONS.some((o) => o.value === mapped)) {
    return mapped;
  }

  const pName = (project?.ten_du_an || "").toLowerCase();
  const pCode = (project?.ma_du_an || "").toLowerCase();
  const pCap = normalizeCapDienAp(project?.cap_dien_ap).toLowerCase();
  const hay = `${pCap} ${pName} ${pCode}`;

  const has110 = /\b110\s*k?v\b/.test(hay) || /(?:^|[^0-9])110(?:kv)?(?:$|[^0-9])/.test(pCap);
  const has220 = /\b220\s*k?v\b/.test(hay) || /(?:^|[^0-9])220(?:kv)?(?:$|[^0-9])/.test(pCap);
  const has22 = /\b22\s*k?v\b/.test(hay);
  const has35 = /\b35\s*k?v\b/.test(hay);
  const has04 = /0[,.]4\s*k?v\b/.test(hay) || /\b0[,.]4\b/.test(hay);
  const hasTha =
    hay.includes("trung hạ") ||
    /\btha\b/.test(hay) ||
    hay.includes("0,4kv-35") ||
    hay.includes("0.4-35") ||
    hay.includes("0,4-35");

  // Dự án lẫn cao áp (110 và 220) hoặc ghi khoảng 110–220
  if (
    (has110 && has220) ||
    hay.includes("110kv-220") ||
    hay.includes("110-220") ||
    hay.includes("110kv – 220") ||
    hay.includes("110÷220") ||
    hay.includes("110 ~ 220") ||
    (hay.includes("cao áp") && !has110 && !has220 && !/\b500\s*k?v\b/.test(hay))
  ) {
    return "110kV-220kV (Cao áp)";
  }

  // Dự án lẫn / trung áp 22–35 (không phải THA có 0,4)
  if (
    hay.includes("22kv-35") ||
    hay.includes("22-35") ||
    hay.includes("22÷35") ||
    (has22 && has35 && !has04 && !hasTha) ||
    (hay.includes("trung áp") && !hay.includes("hạ") && !hasTha)
  ) {
    return "22kV-35kV (Trung áp)";
  }

  if (has220) return "220kV (Cao áp)";
  if (has110 || /\b500\s*k?v\b/.test(hay)) return "110kV (Cao áp)";

  if (hasTha || (has04 && has35)) {
    return "0,4kV-35kV (Trung Hạ áp -THA)";
  }
  if (has04 || (hay.includes("hạ áp") && !hay.includes("trung"))) {
    return "0,4kV (Hạ áp)";
  }
  if (has35 || has22) {
    return "22kV-35kV (Trung áp)";
  }

  return "Chưa xác định";
}

/** Dữ liệu Pie/Legend: luôn đủ 6 mức danh mục (kể cả = 0). */
export function buildCapDienApChartData(projects) {
  const counts = Object.fromEntries(
    CAP_DIEN_AP_CATALOG_OPTIONS.map((o) => [o.value, 0])
  );
  counts["Chưa xác định"] = 0;

  for (const p of projects || []) {
    const bucket = classifyCapDienApBucket(p);
    if (counts[bucket] == null) counts["Chưa xác định"] += 1;
    else counts[bucket] += 1;
  }

  const rows = CAP_DIEN_AP_CATALOG_OPTIONS.map((o) => ({
    name: o.label,
    value: counts[o.value] || 0,
    color: CAP_DIEN_AP_CHART_COLORS[o.value],
  }));

  if (counts["Chưa xác định"] > 0) {
    rows.push({
      name: "Chưa xác định",
      value: counts["Chưa xác định"],
      color: CAP_DIEN_AP_CHART_COLORS["Chưa xác định"],
    });
  }

  return rows;
}
