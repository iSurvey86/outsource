/**
 * Tìm vị trí stamp trên trang bìa NVKS/PAKTKS theo chữ neo trong PDF.
 * Mẫu bìa: «Người lập: …» / «CNKS: …» → ký nháy bên phải tên;
 * «PHÓ GIÁM ĐỐC» + tên LĐ phía dưới → ký chính giữa chức danh và tên.
 * Không dùng tag Word {ky_chinh}/{ky_nhay}.
 */

import path from "path";
import { pathToFileURL } from "url";
import { VAI_TRO } from "./constants";

let pdfWorkerConfigured = false;

async function getPdfjs() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (!pdfWorkerConfigured && typeof window === "undefined") {
    const workerPath = path.join(
      process.cwd(),
      "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"
    );
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
    pdfWorkerConfigured = true;
  }
  return pdfjs;
}

function toPdfUint8Array(buffer) {
  if (buffer == null) return new Uint8Array(0);
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(buffer)) {
    return Uint8Array.from(buffer);
  }
  return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
}

function normalizeLabel(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function compactNorm(s) {
  return normalizeLabel(s).replace(/\s+/g, "");
}

/** Ưu tiên «PHÓ GIÁM ĐỐC»; chấp nhận «GIÁM ĐỐC» đơn khi không có Phó. */
function isChucDanhLd(norm) {
  const c = String(norm || "").replace(/\s+/g, "");
  if (c.includes("phogiamdoc")) return true;
  if (c === "giamdoc") return true;
  if (c.endsWith("giamdoc") && !c.includes("phong") && !c.includes("chuong") && !c.includes("pho")) {
    return true;
  }
  return false;
}

function scoreChucDanhLd(norm) {
  const c = compactNorm(norm);
  if (c.includes("phogiamdoc")) return 3;
  if (c === "giamdoc") return 2;
  if (isChucDanhLd(norm)) return 1;
  return 0;
}

function itemBox(item) {
  const t = item.transform || [1, 0, 0, 1, 0, 0];
  const x = Number(t[4]) || 0;
  const y = Number(t[5]) || 0;
  const h = Math.abs(Number(t[3]) || item.height || 10);
  const w = Number(item.width) || 0;
  return { x, y, w, h, str: String(item.str || "") };
}

/** Gộp item cùng dòng (theo y) — PDF hay tách «PHÓ» «GIÁM» «ĐỐC» */
function groupLines(boxes) {
  if (!boxes.length) return [];
  const sorted = [...boxes].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  for (const b of sorted) {
    const last = lines[lines.length - 1];
    const yTol = Math.min(7, Math.max(3, b.h * 0.35));
    if (last && Math.abs(last.y - b.y) <= yTol) {
      last.items.push(b);
      last.y = (last.y * (last.items.length - 1) + b.y) / last.items.length;
    } else {
      lines.push({ y: b.y, items: [b] });
    }
  }
  return lines.map((line) => {
    const items = line.items.sort((a, b) => a.x - b.x);
    let minX = items[0].x;
    let maxX = items[0].x + items[0].w;
    let maxH = items[0].h;
    let text = "";
    for (const it of items) {
      text += it.str;
      minX = Math.min(minX, it.x);
      maxX = Math.max(maxX, it.x + it.w);
      maxH = Math.max(maxH, it.h);
    }
    return {
      y: line.y,
      h: maxH,
      minX,
      maxX,
      midX: (minX + maxX) / 2,
      text: text.replace(/\s+/g, " ").trim(),
      norm: normalizeLabel(text),
    };
  });
}

/**
 * Ô ký chính gần đầy khoảng chức danh ↔ tên LĐ (đỉnh gần chức danh, đáy gần tên).
 * Scale ~1.2–1.5× so với kích thước chuẩn; pdf-lib drawImage (x,y) = góc dưới trái.
 */
function placeLdStamp(chucDanh, tenLd, LD_W, LD_H, PAGE_RIGHT) {
  const PAD = 2;
  const minScale = 1.2;
  const maxScale = 1.5;
  let h = Math.round(LD_H * minScale);
  let w = Math.round(LD_W * minScale);
  let y;

  if (tenLd) {
    const roomTop = chucDanh.y - PAD;
    const nameTop = tenLd.y + Math.max(tenLd.h * 0.85, 8);
    const roomBottom = nameTop + PAD;
    const available = roomTop - roomBottom;
    if (available >= 18) {
      const maxH = Math.round(LD_H * maxScale);
      const minH = Math.round(LD_H * minScale);
      // Gần chạm chức danh ↔ tên: dùng gần hết khoảng trống (trong biên 1.2–1.5×)
      if (available <= maxH + 6) {
        h = Math.max(minH, available);
      } else {
        h = maxH;
      }
      y = roomBottom + Math.max(0, (available - h) * 0.58);
      const scale = Math.min(maxScale, Math.max(minScale, h / LD_H));
      w = Math.round(LD_W * scale);
    } else {
      h = Math.min(Math.round(LD_H * minScale), 30);
      w = Math.round(LD_W * minScale);
      y = Math.max(tenLd.y + 2, chucDanh.y - h - 4);
    }
  } else {
    h = Math.round(LD_H * minScale);
    w = Math.round(LD_W * minScale);
    y = chucDanh.y - h - 10;
  }

  y = Math.max(36, y + 8);
  const x = Math.max(260, Math.min(chucDanh.midX - w / 2, PAGE_RIGHT - w));
  return { pageIndex: 0, x, y, w, h };
}

/**
 * @param {Uint8Array|Buffer} pdfBytes
 * @returns {Promise<Record<string, { pageIndex: number, x: number, y: number, w: number, h: number }>>}
 */
export async function findCoverSignatureAnchors(pdfBytes) {
  const pdfjs = await getPdfjs();
  const data = toPdfUint8Array(pdfBytes);
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  if (!doc.numPages) return {};

  const page = await doc.getPage(1);
  const content = await page.getTextContent();
  const boxes = (content.items || []).map(itemBox).filter((b) => b.str.trim());
  const lines = groupLines(boxes);

  const out = {};
  /** Ký nháy nhỏ cạnh tên; ký chính scale ~1.2–1.5× trong khoảng PHÓ GIÁM ĐỐC ↔ tên */
  const NHAY_W = 46;
  const NHAY_H = 20;
  const LD_W = 100;
  const LD_H = 34;
  const PAGE_RIGHT = 548;
  const preferRight = (a, b) => b.midX - a.midX || b.y - a.y;

  const nguoiLap = findLine(lines, (n) => n.includes("nguoi lap"), preferRight);
  if (nguoiLap) {
    out[`${VAI_TRO.NGUOI_LAP}_nhay`] = {
      pageIndex: 0,
      x: Math.min(nguoiLap.maxX + 6, PAGE_RIGHT - NHAY_W),
      y: Math.max(24, nguoiLap.y - NHAY_H * 0.15),
      w: NHAY_W,
      h: NHAY_H,
    };
  }

  const cnks = findLine(
    lines,
    (n) => /(^|\s)cnks(\s|:|$)/.test(n) || n.startsWith("cnks"),
    preferRight
  );
  if (cnks) {
    out[`${VAI_TRO.CNKS}_nhay`] = {
      pageIndex: 0,
      x: Math.min(cnks.maxX + 6, PAGE_RIGHT - NHAY_W),
      y: Math.max(24, cnks.y - NHAY_H * 0.15),
      w: NHAY_W,
      h: NHAY_H,
    };
  }

  /**
   * Chức danh LĐ phải nằm *dưới* khối Người lập/CNKS (cùng cột ký).
   * Tránh dính «Giám đốc» ở đầu trang → kéo ký chính lên dòng Người lập.
   */
  const blockTopY = Math.min(
    nguoiLap?.y ?? Number.POSITIVE_INFINITY,
    cnks?.y ?? Number.POSITIVE_INFINITY
  );
  const chucDanh = findLine(lines, isChucDanhLd, (a, b) => {
    const aBelow = Number.isFinite(blockTopY) ? a.y < blockTopY - 8 : true;
    const bBelow = Number.isFinite(blockTopY) ? b.y < blockTopY - 8 : true;
    if (aBelow !== bBelow) return aBelow ? -1 : 1;
    const scoreDiff = scoreChucDanhLd(b.norm) - scoreChucDanhLd(a.norm);
    if (scoreDiff) return scoreDiff;
    return b.midX - a.midX || a.y - b.y;
  });

  if (chucDanh && (!Number.isFinite(blockTopY) || chucDanh.y < blockTopY - 8)) {
    const tenLd = findNameBelowChucDanh(lines, chucDanh);
    out[VAI_TRO.LANH_DAO] = placeLdStamp(chucDanh, tenLd, LD_W, LD_H, PAGE_RIGHT);
  } else if (cnks || nguoiLap) {
    const ref = cnks || nguoiLap;
    const w = Math.round(LD_W * 1.35);
    const h = Math.round(LD_H * 1.35);
    const x = Math.max(260, Math.min(ref.midX - w / 2, PAGE_RIGHT - w));
    const y = Math.max(36, ref.y - h - 78);
    out[VAI_TRO.LANH_DAO] = { pageIndex: 0, x, y, w, h };
  }

  return out;
}

/**
 * Gộp tọa độ mặc định / DB với neo chữ trang bìa (neo thắng nếu tìm thấy).
 */
export async function resolveStampPositionsWithAnchors(pdfBytes, basePositions) {
  const map = { ...(basePositions || {}) };
  try {
    const anchors = await findCoverSignatureAnchors(pdfBytes);
    Object.assign(map, anchors);
  } catch (err) {
    console.warn("[trinh-ky] Không đọc được neo chữ ký trên PDF:", err?.message || err);
  }
  const ld = map[VAI_TRO.LANH_DAO];
  if (ld) {
    const h = Math.round(Math.max((Number(ld.h) || 34) * 3.0, 130));
    const w = Math.round(Math.max(h * 1.35, (Number(ld.w) || 100) * 1.75));
    const midX = (Number(ld.x) || 300) + (Number(ld.w) || 100) / 2;
    const midY = (Number(ld.y) || 300) + (Number(ld.h) || 34) / 2;
    const x = Math.max(72, midX - w / 2 - Math.round(w * 0.06));
    const y = Math.max(24, midY - h / 2 + 6);
    map[`${VAI_TRO.LANH_DAO}_dau`] = {
      pageIndex: ld.pageIndex ?? 0,
      x,
      y,
      w,
      h,
    };
  }
  return map;
}

function findLine(lines, pred, sortFn) {
  const hits = lines.filter((l) => pred(l.norm));
  if (!hits.length) return null;
  hits.sort(sortFn);
  return hits[0];
}

function findNameBelowChucDanh(lines, chucDanh) {
  const candidates = lines.filter((l) => {
    if (l.y >= chucDanh.y - 4) return false;
    if (chucDanh.y - l.y > 140) return false;
    if (l.midX < 250) return false;
    const n = l.norm;
    if (!n || n.length < 3) return false;
    if (n.includes("nguoi lap") || n.includes("cnks")) return false;
    if (n.includes("xi nghiep") || n.includes("cong ty") || n.includes("ha noi")) return false;
    if (isChucDanhLd(n)) return false;
    if (compactNorm(n).length < 3) return false;
    return true;
  });
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.y - a.y);
  return candidates[0];
}
