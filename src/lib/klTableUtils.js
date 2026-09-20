/** Tiện ích hiển thị bảng khối lượng (NKKS / NVKS ĐC). */

export function parseKlNumber(value) {
  if (value === "" || value == null) return 0;
  const n = parseFloat(String(value).replace(",", "."));
  return Number.isNaN(n) ? 0 : n;
}

export function formatKlNumber(n) {
  if (!n) return "";
  if (Number.isInteger(n)) return String(n).replace(".", ",");
  return String(parseFloat(n.toFixed(4))).replace(".", ",");
}

export function getKlSectionHeaderClass(stt, { isThoiGianSection = false } = {}) {
  if (isThoiGianSection) {
    return "bg-violet-100/85 text-violet-950 border-t border-violet-200/80";
  }
  const s = String(stt || "").trim();
  if (/^[IVXLC]+$/i.test(s)) {
    return "bg-sky-100/80 text-sky-950 border-t border-sky-200/80";
  }
  if (/^[IVXLC]+\.\d+$/i.test(s)) {
    return "bg-amber-50 text-amber-950 border-t border-amber-200/70";
  }
  return "bg-rose-50/90 text-rose-950 border-t border-rose-200/60";
}

/** Tiêu đề mục I–VI trong bảng KL — đồng bộ cỡ chữ. */
export const KL_SECTION_TITLE_CELL_CLASS =
  "font-bold uppercase tracking-wide text-justify text-sm leading-snug align-middle";

/** Ô mô tả công việc NVKS — cha sát trái, con thụt nhẹ, căn giữa dọc + justify. */
export function getKlNvksDescCellClass({ isTitle, isCongViecCon }) {
  if (isTitle) {
    return `border border-gray-200 px-2 py-2 uppercase text-black bg-slate-100/50 ${KL_SECTION_TITLE_CELL_CLASS}`;
  }
  const base = "border border-gray-200 px-2 py-2 align-middle text-justify text-sm leading-snug";
  if (isCongViecCon) {
    return `${base} pl-5 text-gray-600`;
  }
  return `${base} text-gray-800`;
}

export function preventKlNumberInput(e) {
  if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault();
}
