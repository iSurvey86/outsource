/**
 * Chụp sơ đồ đo + đồ thị Giải tích (DOM) → PNG để nhúng Excel.
 */

import { toPng } from "html-to-image";

export const DO_DTS_CAPTURE_ATTR = {
  boTri: "bo-tri",
  chart: "chart",
};

function dataUrlToUint8Array(dataUrl) {
  const base64 = String(dataUrl || "").split(",")[1];
  if (!base64) return null;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function captureEl(el, opts = {}) {
  if (!el) return null;
  // Đợi layout/Recharts ổn định một nhịp
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const dataUrl = await toPng(el, {
    pixelRatio: 2,
    backgroundColor: "#ffffff",
    cacheBust: true,
    skipFonts: true,
    filter: (node) => {
      if (!(node instanceof Element)) return true;
      if (node.classList?.contains("bcks-no-print")) return false;
      if (node.tagName === "BUTTON") return false;
      return true;
    },
    ...opts,
  });
  const bytes = dataUrlToUint8Array(dataUrl);
  if (!bytes) return null;
  const w = el.offsetWidth || 480;
  const h = el.offsetHeight || 160;
  return { bytes, width: w, height: h };
}

/**
 * @param {ParentNode} [root]
 * @returns {Promise<{ boTri: {bytes,width,height}|null, chart: {bytes,width,height}|null }>}
 */
export async function captureDoDtsExportImages(root = typeof document !== "undefined" ? document : null) {
  if (!root) return { boTri: null, chart: null };
  const boTriEl = root.querySelector(`[data-do-dts-capture="${DO_DTS_CAPTURE_ATTR.boTri}"]`);
  const chartEl = root.querySelector(`[data-do-dts-capture="${DO_DTS_CAPTURE_ATTR.chart}"]`);
  const [boTri, chart] = await Promise.all([captureEl(boTriEl), captureEl(chartEl)]);
  return { boTri, chart };
}
