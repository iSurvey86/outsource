/**
 * Xuất Excel Đo ĐTS (ExcelJS) — 2 sheet + ảnh sơ đồ đo / đồ thị.
 */

import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { parseDoDtsNumber } from "./bcksFormRegistry";
import { formatGiaiDoanFullName } from "./giaiDoanOrder";

const INK = "134E4A";
const INK_MUTED = "0F766E";
const SKY = "075985";

function toNum(v) {
  if (v === "" || v == null) return null;
  const n = parseDoDtsNumber(v);
  return Number.isFinite(n) ? n : String(v);
}

function thinBorder() {
  const b = { style: "thin", color: { argb: "FF0F766E" } };
  return { top: b, left: b, bottom: b, right: b };
}

function fitImageSize(srcW, srcH, maxW, maxH) {
  const w0 = srcW || maxW;
  const h0 = srcH || maxH;
  const scale = Math.min(maxW / w0, maxH / h0, 1);
  return {
    width: Math.round(w0 * scale),
    height: Math.round(h0 * scale),
  };
}

/**
 * @param {object} data
 * @param {object} formMeta
 * @param {string} filename
 * @param {{ boTri?: {bytes:Uint8Array,width:number,height:number}|null, chart?: {bytes:Uint8Array,width:number,height:number}|null }} [images]
 */
export async function exportDoDtsStyledExcelJs(data, formMeta, filename, images = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "iSurvey";
  wb.created = new Date();

  const gdRaw = formMeta.giai_doan || data?.giai_doan || "";
  const gdLabel = formatGiaiDoanFullName(gdRaw) || gdRaw;
  const ten = String(formMeta.ten_du_an || data?.ten_du_an || "").trim();
  const rows = data?.rows || [];
  const rowCount = Math.max(rows.length, 1);

  // —— Sheet 1: Báo cáo ——
  const ws1 = wb.addWorksheet("Bao cao", {
    pageSetup: {
      paperSize: 9,
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.55, right: 0.55, top: 0.7, bottom: 0.55, header: 0.3, footer: 0.3 },
    },
  });
  ws1.columns = [
    { width: 8 },
    { width: 12 },
    { width: 10 },
    { width: 10 },
    { width: 12 },
    { width: 10 },
    { width: 12 },
    { width: 12 },
  ];

  // Lề trên
  ws1.getRow(1).height = 10;
  ws1.getRow(2).height = 10;

  ws1.mergeCells(3, 1, 3, 8);
  ws1.getCell(3, 1).value = "BÁO CÁO KẾT QUẢ ĐO ĐIỆN TRỞ SUẤT";
  ws1.getCell(3, 1).font = { name: "Arial", size: 14, bold: true, color: { argb: `FF${INK}` } };
  ws1.getCell(3, 1).alignment = { horizontal: "center", vertical: "middle" };
  ws1.getRow(3).height = 22;

  ws1.mergeCells(4, 1, 4, 8);
  ws1.getCell(4, 1).value = `DỰ ÁN: ${ten ? ten.toUpperCase() : "—"}`;
  ws1.getCell(4, 1).font = { name: "Arial", size: 10, bold: true, color: { argb: `FF${SKY}` } };
  ws1.getCell(4, 1).alignment = { horizontal: "center", wrapText: true };

  ws1.mergeCells(5, 1, 5, 8);
  ws1.getCell(5, 1).value = `GIAI ĐOẠN: ${gdLabel ? String(gdLabel).toUpperCase() : "—"}`;
  ws1.getCell(5, 1).font = { name: "Arial", size: 10, bold: true, color: { argb: `FF${SKY}` } };
  ws1.getCell(5, 1).alignment = { horizontal: "center", wrapText: true };

  ws1.mergeCells(7, 1, 7, 4);
  ws1.getCell(7, 1).value = `Mã số thiết bị: ${data?.ma_thiet_bi || ""}`;
  ws1.getCell(7, 1).font = { name: "Arial", size: 10, bold: true, color: { argb: `FF${INK_MUTED}` } };
  ws1.mergeCells(7, 5, 7, 8);
  ws1.getCell(7, 5).value = `Số Serial: ${data?.so_series || ""}`;
  ws1.getCell(7, 5).font = { name: "Arial", size: 10, bold: true, color: { argb: `FF${INK_MUTED}` } };
  ws1.getCell(7, 5).alignment = { horizontal: "right" };

  const bodyFont = { name: "Arial", size: 10, color: { argb: `FF${INK}` } };
  ws1.mergeCells(9, 1, 9, 8);
  ws1.getCell(9, 1).value = "Điện trở của đất được tính từ kết quả đo ngoài hiện trường:";
  ws1.getCell(9, 1).font = bodyFont;

  ws1.mergeCells(10, 1, 10, 8);
  ws1.getCell(10, 1).value = "ρₖ = k × U / I";
  ws1.getCell(10, 1).font = { name: "Arial", size: 12, bold: true, color: { argb: "FF0000FF" } };
  ws1.getCell(10, 1).alignment = { horizontal: "center" };

  const notes = [
    [11, "Trong đó:"],
    [12, "    U: Hiệu điện thế"],
    [13, "    I: Cường độ dòng điện A-B"],
    [14, "    k: Hệ số thiết bị k = π × AM × AN / MN"],
    [15, "Độ sâu bất kỳ tương ứng với Điện trở suất của đất được tính bởi công thức (1/3)×(AB/2)"],
  ];
  for (const [r, text] of notes) {
    ws1.mergeCells(r, 1, r, 8);
    ws1.getCell(r, 1).value = text;
    ws1.getCell(r, 1).font = bodyFont;
  }

  ws1.mergeCells(17, 1, 17, 8);
  ws1.getCell(17, 1).value = `Bảng tính điểm: ${data?.diem_do || ""}`;
  ws1.getCell(17, 1).font = { name: "Arial", size: 10, bold: true, color: { argb: `FF${INK_MUTED}` } };

  const headers = ["TT", "AB/2 (m)", "MN (m)", "k", "U (mV)", "I (mA)", "ρₖ (Ωm)", "Độ sâu (m)"];
  const headerRow = 18;
  headers.forEach((h, i) => {
    const cell = ws1.getCell(headerRow, i + 1);
    cell.value = h;
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: `FF${INK}` } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0FDFA" } };
    cell.border = thinBorder();
  });

  const firstData = 19;
  for (let i = 0; i < rowCount; i++) {
    const r = firstData + i;
    const excelR = r;
    const row = rows[i] || {};
    const zebra = i % 2 === 1;
    const fill = zebra ? "FFECFDF5" : "FFFFFFFF";
    const base = {
      font: { name: "Arial", size: 10, color: { argb: `FF${INK}` } },
      alignment: { horizontal: "center", vertical: "middle" },
      border: thinBorder(),
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: fill } },
    };
    const red = {
      ...base,
      font: { name: "Arial", size: 10, bold: true, color: { argb: "FFDC2626" } },
    };
    const calc = {
      ...base,
      font: { name: "Arial", size: 10, color: { argb: "FF1D4ED8" } },
    };

    const apply = (col, style, value) => {
      const cell = ws1.getCell(r, col);
      cell.value = value;
      cell.font = style.font;
      cell.alignment = style.alignment;
      cell.border = style.border;
      cell.fill = style.fill;
      if (style.numFmt) cell.numFmt = style.numFmt;
    };

    apply(1, base, i + 1);
    apply(2, base, toNum(row.ab2));
    apply(3, base, toNum(row.mn));
    apply(4, { ...calc, numFmt: "0.00" }, {
      formula: `IF(OR(B${excelR}="",C${excelR}="",C${excelR}=0),"",ROUND(PI()*(B${excelR}-C${excelR}/2)*(B${excelR}+C${excelR}/2)/C${excelR},2))`,
    });
    apply(5, red, toNum(row.u_mv));
    apply(6, red, toNum(row.i_ma));
    apply(7, { ...calc, numFmt: "0.00" }, {
      formula: `IF(OR(D${excelR}="",F${excelR}="",F${excelR}=0),"",ROUND(D${excelR}*E${excelR}/F${excelR},2))`,
    });
    apply(8, { ...calc, numFmt: "0.00" }, {
      formula: `IF(B${excelR}="","",ROUND((1/3)*B${excelR},2))`,
    });
  }

  const lastData = firstData + rowCount - 1;
  let cursor = lastData + 2;

  ws1.mergeCells(cursor, 1, cursor, 8);
  ws1.getCell(cursor, 1).value = "Bố trí thiết bị đo điện trở của đất";
  ws1.getCell(cursor, 1).font = { name: "Arial", size: 10, bold: true, color: { argb: `FF${INK_MUTED}` } };
  cursor += 1;

  const boTri = images?.boTri;
  if (boTri?.bytes?.length) {
    const imgId = wb.addImage({ buffer: boTri.bytes, extension: "png" });
    const size = fitImageSize(boTri.width, boTri.height, 520, 150);
    // ExcelJS uses pixels approx; reserve ~ size.height / 1.33 points as rows
    const imgRow = cursor;
    const rowsNeeded = Math.max(6, Math.ceil(size.height / 18));
    for (let i = 0; i < rowsNeeded; i++) ws1.getRow(imgRow + i).height = 15;
    ws1.addImage(imgId, {
      tl: { col: 0.2, row: imgRow - 1 },
      ext: { width: size.width, height: size.height },
      editAs: "oneCell",
    });
    cursor += rowsNeeded + 1;
  } else {
    ws1.mergeCells(cursor, 1, cursor, 8);
    ws1.getCell(cursor, 1).value = "A ←—— M —— O —— N ——→ B   (Vị trí đặt máy tại O)";
    ws1.getCell(cursor, 1).font = { name: "Arial", size: 9, italic: true, color: { argb: `FF${INK_MUTED}` } };
    ws1.getCell(cursor, 1).alignment = { horizontal: "center" };
    cursor += 2;
  }

  const signLabRow = cursor;
  const signValRow = cursor + 1;
  ws1.mergeCells(signLabRow, 1, signLabRow, 4);
  ws1.mergeCells(signLabRow, 5, signLabRow, 8);
  ws1.mergeCells(signValRow, 1, signValRow, 4);
  ws1.mergeCells(signValRow, 5, signValRow, 8);
  ws1.getCell(signLabRow, 1).value = "Người đo và tính";
  ws1.getCell(signLabRow, 5).value = "Người kiểm tra";
  ws1.getCell(signValRow, 1).value = data?.nguoi_do || "";
  ws1.getCell(signValRow, 5).value = data?.nguoi_kiem_tra || "";
  for (const [r, c] of [
    [signLabRow, 1],
    [signLabRow, 5],
  ]) {
    ws1.getCell(r, c).font = { name: "Arial", size: 10, bold: true, color: { argb: `FF${INK_MUTED}` } };
    ws1.getCell(r, c).alignment = { horizontal: "center" };
  }
  for (const [r, c] of [
    [signValRow, 1],
    [signValRow, 5],
  ]) {
    ws1.getCell(r, c).font = { name: "Arial", size: 11, color: { argb: `FF${INK}` } };
    ws1.getCell(r, c).alignment = { horizontal: "center" };
  }

  // —— Sheet 2: Giải thích ——
  const ws2 = wb.addWorksheet("Giai thich", {
    pageSetup: {
      paperSize: 9,
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.55, right: 0.55, top: 0.7, bottom: 0.55, header: 0.3, footer: 0.3 },
    },
  });
  ws2.columns = [
    { width: 6 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
  ];
  ws2.getRow(1).height = 10;
  ws2.getRow(2).height = 10;

  ws2.mergeCells(3, 1, 3, 8);
  ws2.getCell(3, 1).value = "GIẢI THÍCH KẾT QUẢ ĐO ĐIỆN TRỞ SUẤT";
  ws2.getCell(3, 1).font = { name: "Arial", size: 14, bold: true, color: { argb: `FF${INK}` } };
  ws2.getCell(3, 1).alignment = { horizontal: "center", vertical: "middle" };
  ws2.getRow(3).height = 22;

  ws2.mergeCells(4, 1, 4, 8);
  ws2.getCell(4, 1).value = `DỰ ÁN: ${ten ? ten.toUpperCase() : "—"}`;
  ws2.getCell(4, 1).font = { name: "Arial", size: 10, bold: true, color: { argb: `FF${SKY}` } };
  ws2.getCell(4, 1).alignment = { horizontal: "center", wrapText: true };

  ws2.mergeCells(5, 1, 5, 8);
  ws2.getCell(5, 1).value = `GIAI ĐOẠN: ${gdLabel ? String(gdLabel).toUpperCase() : "—"}`;
  ws2.getCell(5, 1).font = { name: "Arial", size: 10, bold: true, color: { argb: `FF${SKY}` } };
  ws2.getCell(5, 1).alignment = { horizontal: "center", wrapText: true };

  if (data?.diem_do) {
    ws2.mergeCells(6, 1, 6, 8);
    ws2.getCell(6, 1).value = `Điểm đo: ${data.diem_do}`;
    ws2.getCell(6, 1).font = { name: "Arial", size: 10, bold: true, color: { argb: `FF${INK_MUTED}` } };
  }

  let r2 = 8;
  ws2.mergeCells(r2, 1, r2, 8);
  ws2.getCell(r2, 1).value = "Đồ thị quan hệ điện trở suất và khoảng cách AB/2";
  ws2.getCell(r2, 1).font = { name: "Arial", size: 10, bold: true, color: { argb: `FF${INK_MUTED}` } };
  r2 += 1;

  const chart = images?.chart;
  if (chart?.bytes?.length) {
    const imgId = wb.addImage({ buffer: chart.bytes, extension: "png" });
    const size = fitImageSize(chart.width, chart.height, 560, 340);
    const imgRow = r2;
    const rowsNeeded = Math.max(14, Math.ceil(size.height / 18));
    for (let i = 0; i < rowsNeeded; i++) ws2.getRow(imgRow + i).height = 15;
    ws2.addImage(imgId, {
      tl: { col: 0.15, row: imgRow - 1 },
      ext: { width: size.width, height: size.height },
      editAs: "oneCell",
    });
    r2 += rowsNeeded + 1;
  } else {
    ws2.mergeCells(r2, 1, r2, 8);
    ws2.getCell(r2, 1).value = "(Chưa chụp được đồ thị — mở tab Đo ĐTS rồi xuất lại.)";
    ws2.getCell(r2, 1).font = { name: "Arial", size: 9, italic: true, color: { argb: `FF${INK_MUTED}` } };
    r2 += 2;
  }

  r2 += 1;
  ws2.mergeCells(r2, 1, r2, 5);
  ws2.getCell(r2, 1).value = "Bảng phân tích điện trở suất";
  ws2.getCell(r2, 1).font = { name: "Arial", size: 10, bold: true, color: { argb: `FF${INK_MUTED}` } };
  r2 += 1;

  const ptHeaders = ["N", "ρ", "h", "d", "Alt"];
  ptHeaders.forEach((h, i) => {
    const cell = ws2.getCell(r2, i + 1);
    cell.value = h;
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: `FF${INK}` } };
    cell.alignment = { horizontal: "center" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0FDFA" } };
    cell.border = thinBorder();
  });
  r2 += 1;

  const phanTich = [...(data?.phan_tich || [])];
  let cum = 0;
  for (const row of phanTich) {
    const h = parseDoDtsNumber(row.h);
    if (Number.isFinite(h) && h > 0) {
      cum += h;
      row.d = String(Math.round(cum * 100) / 100);
      row.alt = String(-Math.round(cum * 100) / 100);
    }
  }
  const ptRows = phanTich.length ? phanTich : [{ rho: "", h: "", d: "", alt: "" }];
  ptRows.forEach((row, i) => {
    const zebra = i % 2 === 1;
    const fill = zebra ? "FFECFDF5" : "FFFFFFFF";
    const vals = [i + 1, toNum(row.rho), toNum(row.h), toNum(row.d), toNum(row.alt)];
    vals.forEach((v, ci) => {
      const cell = ws2.getCell(r2, ci + 1);
      cell.value = v;
      cell.font = {
        name: "Arial",
        size: 10,
        color: { argb: ci >= 3 ? "FF1D4ED8" : `FF${INK}` },
      };
      cell.alignment = { horizontal: "center" };
      cell.border = thinBorder();
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    });
    r2 += 1;
  });

  r2 += 2;
  ws2.mergeCells(r2, 1, r2, 4);
  ws2.mergeCells(r2, 5, r2, 8);
  ws2.getCell(r2, 1).value = "Người đo và tính";
  ws2.getCell(r2, 5).value = "Người kiểm tra";
  ws2.getCell(r2, 1).font = { name: "Arial", size: 10, bold: true, color: { argb: `FF${INK_MUTED}` } };
  ws2.getCell(r2, 5).font = { name: "Arial", size: 10, bold: true, color: { argb: `FF${INK_MUTED}` } };
  ws2.getCell(r2, 1).alignment = { horizontal: "center" };
  ws2.getCell(r2, 5).alignment = { horizontal: "center" };
  r2 += 1;
  ws2.mergeCells(r2, 1, r2, 4);
  ws2.mergeCells(r2, 5, r2, 8);
  ws2.getCell(r2, 1).value = data?.nguoi_do || "";
  ws2.getCell(r2, 5).value = data?.nguoi_kiem_tra || "";
  ws2.getCell(r2, 1).alignment = { horizontal: "center" };
  ws2.getCell(r2, 5).alignment = { horizontal: "center" };

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
  return filename;
}
