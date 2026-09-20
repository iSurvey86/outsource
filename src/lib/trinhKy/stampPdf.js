import { PDFDocument } from "pdf-lib";
import { VAI_TRO } from "./constants";
import { resolveStampPositionsWithAnchors } from "./stampAnchors";

/**
 * Vị trí stamp mặc định NVKS — trang bìa (pageIndex 0).
 * Người lập / CNKS: ký nháy cạnh tên; Lãnh đạo: ký chính giữa chức danh và tên.
 * Không ghi ngày giờ dưới chữ ký.
 */
export const DEFAULT_NVKS_STAMP_POSITIONS = {
  /** Fallback khi không đọc được neo chữ — căn phải khối ký bìa A4 (~1.35× ký chính) */
  [`${VAI_TRO.NGUOI_LAP}_nhay`]: { pageIndex: 0, x: 430, y: 468, w: 46, h: 20 },
  [`${VAI_TRO.CNKS}_nhay`]: { pageIndex: 0, x: 430, y: 438, w: 46, h: 20 },
  [VAI_TRO.LANH_DAO]: { pageIndex: 0, x: 348, y: 318, w: 135, h: 46 },
  /** Ô chứa chứa ảnh ký dấu — đủ cao để contain giữ dấu tròn */
  [`${VAI_TRO.LANH_DAO}_dau`]: { pageIndex: 0, x: 270, y: 280, w: 210, h: 150 },
};

/** Mở rộng tọa độ LĐ → khung chứa ký dấu (rộng hơn cao, lệch trái nhẹ) */
export function withLanhDaoDauPosition(positions) {
  const map = { ...(positions || {}) };
  const ld = map[VAI_TRO.LANH_DAO];
  if (ld) {
    const h = Math.round(Math.max((Number(ld.h) || 46) * 3.0, 130));
    const w = Math.round(Math.max(h * 1.35, (Number(ld.w) || 135) * 1.75));
    const midX = (Number(ld.x) || 348) + (Number(ld.w) || 135) / 2;
    const midY = (Number(ld.y) || 318) + (Number(ld.h) || 46) / 2;
    const x = Math.max(72, midX - w / 2 - Math.round(w * 0.06));
    const y = Math.max(24, midY - h / 2 + 6);
    map[`${VAI_TRO.LANH_DAO}_dau`] = {
      pageIndex: ld.pageIndex ?? 0,
      pageFromEnd: ld.pageFromEnd,
      x,
      y,
      w,
      h,
    };
  }
  return map;
}

/**
 * @param {Uint8Array|Buffer} pdfBytes
 * @param {{ role: string, imageBytes: Uint8Array|Buffer, signedAt?: Date, preserveAspect?: boolean }[]} stamps
 * @param {Record<string, { pageFromEnd?: number, pageIndex?: number, x: number, y: number, w: number, h: number }>} [positions]
 * @param {{ resolveAnchors?: boolean }} [opts]
 */
export async function stampSignaturesOnPdf(
  pdfBytes,
  stamps,
  positions = DEFAULT_NVKS_STAMP_POSITIONS,
  opts = {}
) {
  const resolveAnchors = opts.resolveAnchors !== false;
  const posMap = resolveAnchors
    ? await resolveStampPositionsWithAnchors(pdfBytes, positions)
    : { ...positions };

  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  if (!pages.length) throw new Error("PDF không có trang.");

  for (const stamp of stamps) {
    const pos = posMap[stamp.role];
    if (!pos) continue;
    const pageIdx =
      typeof pos.pageIndex === "number"
        ? pos.pageIndex
        : Math.max(0, pages.length - (pos.pageFromEnd || 1));
    const page = pages[pageIdx] || pages[pages.length - 1];
    const imgBytes = stamp.imageBytes;
    const isPng = looksLikePng(imgBytes);
    const image = isPng ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes);
    const boxW = Number(pos.w) || 120;
    const boxH = Number(pos.h) || 40;
    const boxX = Number(pos.x) || 72;
    const boxY = Number(pos.y) || 72;

    /**
     * Giữ tỷ lệ ảnh (đặc biệt ký dấu: dấu đỏ phải tròn tuyệt đối).
     * Mặc định preserveAspect; chỉ tắt khi stamp.preserveAspect === false.
     */
    const preserve = stamp.preserveAspect !== false;
    let drawW = boxW;
    let drawH = boxH;
    let x = boxX;
    let y = boxY;
    if (preserve) {
      const natW = image.width || boxW;
      const natH = image.height || boxH;
      const scale = Math.min(boxW / natW, boxH / natH);
      drawW = Math.max(1, natW * scale);
      drawH = Math.max(1, natH * scale);
      x = boxX + (boxW - drawW) / 2;
      y = boxY + (boxH - drawH) / 2;
    }
    page.drawImage(image, { x, y, width: drawW, height: drawH });
  }

  const out = await pdfDoc.save();
  return Buffer.from(out);
}

function looksLikePng(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
}
