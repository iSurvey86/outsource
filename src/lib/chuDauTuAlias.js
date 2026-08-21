/**
 * Chuẩn hóa Chủ đầu tư: mã alias (PCBN, BA1…) → tên đầy đủ.
 * @see workflows/02_module_nhap_da.md
 */

function removeVietnameseTones(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

/** [alias, tên chuẩn] — miền Bắc → Ban/ETC/NPSC/KHN → miền Trung/Nam (dự phòng) */
export const CHU_DAU_TU_ALIAS_ENTRIES = [
  ['PCBN', 'Công ty Điện lực Bắc Ninh'],
  ['PCHY', 'Công ty Điện lực Hưng Yên'],
  ['PCPT', 'Công ty Điện lực Phú Thọ'],
  ['PCQN', 'Công ty Điện lực Quảng Ninh'],
  ['PCSL', 'Công ty Điện lực Sơn La'],
  ['PCTH', 'Công ty Điện lực Thanh Hóa'],
  ['PCTQ', 'Công ty Điện lực Tuyên Quang'],
  ['PCLK', 'Công ty Điện lực Lào Cai'],
  ['PCLC', 'Công ty Điện lực Lai Châu'],
  ['PCNA', 'Công ty Điện lực Nghệ An'],
  ['PCTN', 'Công ty Điện lực Thái Nguyên'],
  ['PCLS', 'Công ty Điện lực Lạng Sơn'],
  ['PCCB', 'Công ty Điện lực Cao Bằng'],
  ['PCĐB', 'Công ty Điện lực Điện Biên'],
  ['PCNB', 'Công ty Điện lực Ninh Bình'],
  ['PCHP', 'Công ty Điện lực Hải Phòng'],
  ['PCHT', 'Công ty Điện lực Hà Tĩnh'],
  ['PCHN', 'Công ty Điện lực Hà Nam'],
  ['PCBG', 'Công ty Điện lực Bắc Giang'],
  ['PCVP', 'Công ty Điện lực Vĩnh Phúc'],
  ['PCYB', 'Công ty Điện lực Yên Bái'],
  ['PCHB', 'Công ty Điện lực Hòa Bình'],
  ['PCHG', 'Công ty Điện lực Hà Giang'],
  ['PCBK', 'Công ty Điện lực Bắc Kạn'],
  ['PCHD', 'Công ty Điện lực Hải Dương'],
  ['PCTB', 'Công ty Điện lực Thái Bình'],
  ['PCNĐ', 'Công ty Điện lực Nam Định'],
  ['ETC', 'Công ty TNHH MTV Thí nghiệm điện miền Bắc'],
  ['NPSC', 'Công ty Dịch vụ Điện lực miền Bắc'],
  ['BA1', 'Ban Quản lý dự án Lưới điện'],
  ['BA2', 'Ban Quản lý dự án phát triển Điện lực'],
  ['BA3', 'Ban Quản lý dự án Xây dựng điện miền Bắc'],
  ['KHN', 'Khách hàng ngoài'],
  // Miền Trung / Nam — dự phòng
  ['PCQB', 'Công ty Điện lực Quảng Bình'],
  ['PCQT', 'Công ty Điện lực Quảng Trị'],
  ['PCTTH', 'Công ty Điện lực Thừa Thiên Huế'],
  ['PCQNA', 'Công ty Điện lực Quảng Nam'],
  ['PCQNI', 'Công ty Điện lực Quảng Ngãi'],
  ['PCBD', 'Công ty Điện lực Bình Định'],
  ['PCPY', 'Công ty Điện lực Phú Yên'],
  ['PCKH', 'Công ty Điện lực Khánh Hòa'],
  ['PCNTH', 'Công ty Điện lực Ninh Thuận'],
  ['PCBTH', 'Công ty Điện lực Bình Thuận'],
];

/** Thứ tự hiển thị dropdown (chỉ tên chuẩn, không trùng alias) */
export const CHU_DAU_TU_CANONICAL_ORDER = [
  ...new Set(CHU_DAU_TU_ALIAS_ENTRIES.map(([, name]) => name)),
];

const ALIAS_TO_CANONICAL = new Map();
for (const [alias, canonical] of CHU_DAU_TU_ALIAS_ENTRIES) {
  ALIAS_TO_CANONICAL.set(toAliasKey(alias), canonical);
  ALIAS_TO_CANONICAL.set(toAliasKey(alias.replace(/Đ/g, 'D')), canonical);
}

const CANONICAL_SET = new Set(CHU_DAU_TU_CANONICAL_ORDER);

const FULL_NAME_LOOKUP = buildFullNameLookup();

const BAN_PATTERNS = [
  {
    test: (n) => n.includes('ban quan ly du an luoi dien') || n.includes('(ba1)'),
    canonical: 'Ban Quản lý dự án Lưới điện',
  },
  {
    test: (n) => n.includes('ban quan ly du an phat trien dien luc') || n.includes('(ba2)'),
    canonical: 'Ban Quản lý dự án phát triển Điện lực',
  },
  {
    test: (n) => n.includes('ban quan ly du an xay dung dien mien bac') || n.includes('(ba3)'),
    canonical: 'Ban Quản lý dự án Xây dựng điện miền Bắc',
  },
];

function toAliasKey(str) {
  return removeVietnameseTones(str).replace(/[\s.\-_/]/g, '').toUpperCase();
}

function normalizeLookupKey(str) {
  return removeVietnameseTones(str).replace(/\s+/g, ' ').trim();
}

function buildFullNameLookup() {
  const map = new Map();

  const register = (variant, canonical) => {
    if (!variant) return;
    map.set(normalizeLookupKey(variant), canonical);
  };

  for (const canonical of CHU_DAU_TU_CANONICAL_ORDER) {
    register(canonical, canonical);

    const pcMatch = canonical.match(/^Công ty Điện lực (.+)$/);
    if (pcMatch) {
      const place = pcMatch[1];
      register(`Công ty Điện lực tỉnh ${place}`, canonical);
      register(`Công ty Điện lực Tỉnh ${place}`, canonical);
      register(`Công ty Điện lực TP. ${place}`, canonical);
      register(`Công ty Điện lực TP ${place}`, canonical);
      register(`Công ty Điện lực Thành phố ${place}`, canonical);
    }
  }

  register('Ban Quản lý dự án Lưới điện (BA1)', 'Ban Quản lý dự án Lưới điện');
  register('Ban Quản lý Dự án Phát triển Điện lực', 'Ban Quản lý dự án phát triển Điện lực');
  register('Ban Quản lý dự án phát triển Điện lực (BA2)', 'Ban Quản lý dự án phát triển Điện lực');
  register('Ban Quản lý dự án Xây dựng điện miền Bắc (BA3)', 'Ban Quản lý dự án Xây dựng điện miền Bắc');
  register('Khách hàng ngoài', 'Khách hàng ngoài');
  register('KH ngoài', 'Khách hàng ngoài');

  return map;
}

function matchBanCanonical(raw) {
  const normalized = normalizeLookupKey(raw);
  for (const { test, canonical } of BAN_PATTERNS) {
    if (test(normalized)) return canonical;
  }
  return null;
}

/**
 * Chuẩn hóa tên CĐT. Trả về tên đầy đủ nếu khớp alias/biến thể; giữ nguyên nếu không nhận diện được.
 */
export function normalizeChuDauTu(raw) {
  const trimmed = String(raw || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';

  // «Khách hàng ngoài - Ông …» / «KHN - …» → nhóm chuẩn KHN (lọc/báo cáo)
  if (/^(khách\s*hàng\s*ngoài|khn)\s*[-–—:]/i.test(trimmed)) {
    return 'Khách hàng ngoài';
  }

  const aliasHit = ALIAS_TO_CANONICAL.get(toAliasKey(trimmed));
  if (aliasHit) return aliasHit;

  const fullHit = FULL_NAME_LOOKUP.get(normalizeLookupKey(trimmed));
  if (fullHit) return fullHit;

  const banHit = matchBanCanonical(trimmed);
  if (banHit) return banHit;

  if (CANONICAL_SET.has(trimmed)) return trimmed;

  return trimmed;
}

/** Danh sách tên chuẩn cố định (dropdown form NVKS, tham chiếu) */
export function getCanonicalChuDauTuList() {
  return [...CHU_DAU_TU_CANONICAL_ORDER];
}

/** Dự án khách hàng ngoài — không có QĐ Giao A nội bộ, căn cứ HĐ 2 bên. */
export function isKhachHangNgoai(raw) {
  return normalizeChuDauTu(raw) === "Khách hàng ngoài";
}

/** Tách tên sau «Khách hàng ngoài - …» nếu đã gõ sẵn trên CĐT. */
export function extractTenKhachHangNgoai(chuDauTu) {
  const s = String(chuDauTu || "").trim().replace(/\s+/g, " ");
  if (!s) return "";
  const m = s.match(/^(?:khách\s*hàng\s*ngoài|khn)\s*[-–—:]\s*(.+)$/i);
  return m?.[1]?.trim() || "";
}

/** Suy Bên A từ câu «Giữa … &/và …» trên HĐ đầy đủ. */
export function extractBenAFromHopDongDayDu(hopDongDayDu) {
  const s = String(hopDongDayDu || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return "";
  const m = s.match(/Giữa\s+(.+?)\s*(?:&|và)\s+/i);
  if (!m) return "";
  return m[1]
    .replace(/^Ông\s*:\s*/i, "Ông ")
    .replace(/^Bà\s*:\s*/i, "Bà ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Hiển thị CĐT trên workspace.
 * KHN → «Khách hàng ngoài - [tên]» (từ CĐT đã gõ / Bên A HĐ / câu Giữa…).
 */
export function formatChuDauTuDisplay(chuDauTu, { benA, hopDongDayDu } = {}) {
  const raw = String(chuDauTu || "").trim().replace(/\s+/g, " ");
  if (!raw) return "—";
  if (!isKhachHangNgoai(raw)) return normalizeChuDauTu(raw) || raw;

  const tenFromCdt = extractTenKhachHangNgoai(raw);
  const ten =
    tenFromCdt ||
    String(benA || "").trim() ||
    extractBenAFromHopDongDayDu(hopDongDayDu);
  if (ten) return `Khách hàng ngoài - ${ten}`;
  return "Khách hàng ngoài";
}

/** Gom giá trị từ DB → unique, đã chuẩn hóa; tên đã biết xếp theo thứ tự bảng alias */
export function collectUniqueChuDauTu(values) {
  const normalized = (values || []).map((v) => normalizeChuDauTu(v)).filter(Boolean);
  const uniqueSet = new Set(normalized);
  const known = CHU_DAU_TU_CANONICAL_ORDER.filter((name) => uniqueSet.has(name));
  const unknown = [...uniqueSet]
    .filter((name) => !CHU_DAU_TU_CANONICAL_ORDER.includes(name))
    .sort((a, b) => a.localeCompare(b, 'vi'));
  return [...known, ...unknown];
}
