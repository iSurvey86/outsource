/**
 * Xuất Excel hạng mục Địa chất FormBCKS.
 * Cơ lý đất dùng xlsx-js-style (header đa tầng, chữ dọc, viền).
 *
 * Nguyên tắc xuất file:
 * - Không dùng màu xám/ghi (chữ/nền) — dùng teal/đậm thương hiệu (#134E4A, #0F766E…).
 * - Tên file có timestamp yyyyMMdd-HHmmss để xuất liên tiếp không trùng.
 */

import * as XLSX from "xlsx";
import {
  BCKS_DIA_CHAT_FORMS,
  CO_LY_DAT_HAT_COLS,
  CO_LY_DAT_2_HAT_COLS,
  BAO_CAO_DTS_DEFAULT_LOP,
} from "./bcksFormRegistry";
import { formatGiaiDoanFullName } from "./giaiDoanOrder";

/** Chữ nội dung xuất — teal đậm, không xám/ghi */
const INK = "134E4A";
const INK_MUTED = "0F766E";

function safeName(s) {
  return String(s || "BCKS")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** yyyyMMdd-HHmmss — chống trùng khi xuất liên tiếp */
export function buildExportTimestamp(d = new Date()) {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}

/** Chân trang chữ ký: Hà Nội, ngày…tháng…năm… (chữ thường; in nghiêng khi style) */
export function formatHaNoiDateLine(isoDate) {
  const blank = "Hà Nội, ngày.........tháng............năm...........";
  if (!isoDate) return blank;
  const m = String(isoDate).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return blank;
  const day = String(Number(m[3]));
  const month = String(Number(m[2]));
  const year = m[1];
  return `Hà Nội, ngày ${day} tháng ${month} năm ${year}`;
}

function sheetFromAoa(aoa, sheetName) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  return wb;
}

const BORDER = {
  top: { style: "thin", color: { rgb: "0F766E" } },
  bottom: { style: "thin", color: { rgb: "0F766E" } },
  left: { style: "thin", color: { rgb: "0D9488" } },
  right: { style: "thin", color: { rgb: "0D9488" } },
};

function ensureCell(ws, addr, value) {
  if (!ws[addr]) ws[addr] = { t: "s", v: value ?? "" };
  else if (value !== undefined && ws[addr].v === undefined) ws[addr].v = value;
  return ws[addr];
}

function styleCell(ws, r, c, value, style) {
  const addr = XLSX.utils.encode_cell({ r, c });
  const cell = ensureCell(ws, addr, value ?? "");
  if (value !== undefined && value !== null && value !== "") {
    if (typeof value === "number") {
      cell.t = "n";
      cell.v = value;
    } else {
      cell.t = "s";
      cell.v = String(value);
    }
  }
  cell.s = style;
  return cell;
}

function headStyle({ vertical = false, fill = "F0FDFA", bold = true, sz = 10 } = {}) {
  return {
    font: { name: "Arial", sz, bold, color: { rgb: "134E4A" } },
    alignment: {
      horizontal: "center",
      vertical: "center",
      wrapText: true,
      textRotation: vertical ? 90 : 0,
    },
    border: BORDER,
    fill: { patternType: "solid", fgColor: { rgb: fill } },
  };
}

function dataStyle({ fill = "FFFFFF", bold = false } = {}) {
  return {
    font: { name: "Arial", sz: 9, bold, color: { rgb: INK } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: BORDER,
    fill: { patternType: "solid", fgColor: { rgb: fill } },
  };
}

/**
 * Xuất Cơ lý đất — khớp mẫu HT-2026-FS-…_update.xlsx
 * Header 5 tầng + hàng số cột + chữ dọc + viền teal / nền F0FDFA / số cột E0E7FF / zebra FDEADA
 * 36 cột: TT…Lớp | Từ/Đến | 13 hạt | chỉ tiêu VL | Độ ẩm | Ip | B | φ | C | a1-2 | Phân loại
 */
async function exportCoLyDat2Styled(data, formMeta, filename) {
  const XLSXS = (await import("xlsx-js-style")).default;
  const COLS = 36;
  const lastCol = COLS - 1;
  // rows 5–9 header (0-index 4–8), row 10 = số cột, data từ row 11
  const HR0 = 4;
  const HR1 = 5;
  const HR2 = 6;
  const HR3 = 7;
  const HR4 = 8;
  const NUMR = 9;
  const DATA0 = 10;

  const FILL_HEAD = "F0FDFA";
  const FILL_NUM = "E0E7FF"; // hàng số cột — indigo, tách biệt header teal / zebra cam
  const FILL_ZEBRA = "FDEADA"; // accent6 #F79646 tint≈0.8
  const FILL_AVG = "ECFEFF";

  const title = "BẢNG TỔNG HỢP CHỈ TIÊU CƠ LÝ CÁC LỚP ĐẤT";
  const gdRaw = formMeta.giai_doan || data?.giai_doan || "";
  const gdLabel = formatGiaiDoanFullName(gdRaw) || gdRaw;
  const metaLine = `Dự án: ${formMeta.ten_du_an || data?.du_an || ""}          Giai đoạn: ${gdLabel}`;

  const rows = (data?.rows || []).filter((r) => r?.type !== "lop");
  const aoa = [
    [title],
    [metaLine],
    [],
    [],
    Array(COLS).fill(""),
    Array(COLS).fill(""),
    Array(COLS).fill(""),
    Array(COLS).fill(""),
    Array(COLS).fill(""),
    Array.from({ length: COLS }, (_, i) => i + 1),
  ];

  let mauStt = 0;
  for (const row of rows) {
    const type = row.type || "mau";
    const isAvg = type === "trung_binh";
    if (!isAvg) mauStt += 1;
    aoa.push([
      isAvg ? "TB" : mauStt,
      isAvg ? "Trung bình lớp" : row.ho_khoan || "",
      isAvg ? "" : row.so_hieu_mau || "",
      row.lop || "",
      isAvg ? "" : row.do_sau_tu || "",
      isAvg ? "" : row.do_sau_den || "",
      ...CO_LY_DAT_2_HAT_COLS.map((c) => row[c.key] ?? ""),
      row.w ?? "",
      row.gamma_w ?? "",
      row.gamma_bh ?? "",
      row.gamma_k ?? "",
      row.delta ?? "",
      row.e0 ?? "",
      row.n ?? "",
      row.g ?? "",
      row.wch ?? "",
      row.wd ?? "",
      row.ip ?? "",
      row.b ?? "",
      row.phi_do ?? "",
      row.phi_phut ?? "",
      row.c ?? "",
      row.a12 ?? "",
      row.phan_loai ?? "",
    ]);
  }

  const footerStart = aoa.length;
  const midCol = Math.floor(COLS / 2); // 18 — nửa phải cho Ngày / Người kiểm tra
  aoa.push(Array(COLS).fill(""));
  const ngayRow = Array(COLS).fill("");
  ngayRow[midCol] = formatHaNoiDateLine(data?.ngay);
  aoa.push(ngayRow);
  const signRow = Array(COLS).fill("");
  signRow[0] = `Người lập: ${data?.nguoi_lap || ""}`;
  signRow[midCol] = `Người kiểm tra: ${data?.nguoi_kiem_tra || ""}`;
  aoa.push(signRow);

  const ws = XLSXS.utils.aoa_to_sheet(aoa);
  const rNgay = footerStart + 1;
  const rSign = footerStart + 2;
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: lastCol } },
    // TT / Hố / Số / Lớp — 5 hàng header
    { s: { r: HR0, c: 0 }, e: { r: HR4, c: 0 } },
    { s: { r: HR0, c: 1 }, e: { r: HR4, c: 1 } },
    { s: { r: HR0, c: 2 }, e: { r: HR4, c: 2 } },
    { s: { r: HR0, c: 3 }, e: { r: HR4, c: 3 } },
    // Độ sâu (m) HR0–HR1
    { s: { r: HR0, c: 4 }, e: { r: HR1, c: 5 } },
    // Cuội – dăm / Sỏi – sạn
    { s: { r: HR0, c: 6 }, e: { r: HR1, c: 8 } },
    { s: { r: HR0, c: 9 }, e: { r: HR1, c: 10 } },
    // Cát + phân thô/vừa/mịn
    { s: { r: HR0, c: 11 }, e: { r: HR0, c: 15 } },
    { s: { r: HR1, c: 11 }, e: { r: HR1, c: 12 } },
    { s: { r: HR1, c: 14 }, e: { r: HR1, c: 15 } },
    // Bụi
    { s: { r: HR0, c: 16 }, e: { r: HR0, c: 18 } },
    // Chỉ tiêu vật lý
    { s: { r: HR0, c: 19 }, e: { r: HR1, c: 26 } },
    // Độ ẩm (2 cột)
    { s: { r: HR0, c: 27 }, e: { r: HR1, c: 28 } },
    // Chỉ số dẻo / Độ sệt / Hệ số nén — HR0–HR2
    { s: { r: HR0, c: 29 }, e: { r: HR2, c: 29 } },
    { s: { r: HR0, c: 30 }, e: { r: HR2, c: 30 } },
    { s: { r: HR0, c: 34 }, e: { r: HR2, c: 34 } },
    // Cắt phẳng
    { s: { r: HR0, c: 31 }, e: { r: HR1, c: 33 } },
    // Phân loại
    { s: { r: HR0, c: 35 }, e: { r: HR4, c: 35 } },
    // Từ / Đến — HR2–HR4
    { s: { r: HR2, c: 4 }, e: { r: HR4, c: 4 } },
    { s: { r: HR2, c: 5 }, e: { r: HR4, c: 5 } },
    // Thành phần hạt P (%)
    { s: { r: HR3, c: 6 }, e: { r: HR3, c: 18 } },
    // φ° gộp độ + phút
    { s: { r: HR3, c: 31 }, e: { r: HR3, c: 32 } },
    // Chân trang: Ngày phải | Người lập trái + Người kiểm tra phải
    { s: { r: rNgay, c: midCol }, e: { r: rNgay, c: lastCol } },
    { s: { r: rSign, c: 0 }, e: { r: rSign, c: midCol - 1 } },
    { s: { r: rSign, c: midCol }, e: { r: rSign, c: lastCol } },
  ];

  for (let c = 0; c <= lastCol; c++) {
    styleCell(ws, 0, c, c === 0 ? title : "", {
      font: { name: "Arial", sz: 14, bold: true, color: { rgb: "0F766E" } },
      alignment: { horizontal: "center", vertical: "center" },
    });
    styleCell(ws, 1, c, c === 0 ? metaLine : "", {
      font: { name: "Arial", sz: 10, bold: true, color: { rgb: "134E4A" } },
      alignment: { horizontal: "center", vertical: "center" },
    });
  }

  const v = headStyle({ vertical: true, fill: FILL_HEAD, sz: 10 });
  const h = headStyle({ vertical: false, fill: FILL_HEAD, sz: 10 });

  // —— HR0 nhóm ——
  styleCell(ws, HR0, 0, "TT", v);
  styleCell(ws, HR0, 1, "Hố khoan", v);
  styleCell(ws, HR0, 2, "Số hiệu mẫu", v);
  styleCell(ws, HR0, 3, "Lớp", v);
  styleCell(ws, HR0, 4, "Độ sâu (m)", h);
  styleCell(ws, HR0, 6, "Cuội – dăm", h);
  styleCell(ws, HR0, 9, "Sỏi – sạn", h);
  styleCell(ws, HR0, 11, "Cát", h);
  styleCell(ws, HR0, 16, "Bụi", h);
  styleCell(ws, HR0, 19, "Chỉ tiêu vật lý", h);
  styleCell(ws, HR0, 27, "Độ ẩm", h);
  styleCell(ws, HR0, 29, "Chỉ số dẻo", v);
  styleCell(ws, HR0, 30, "Độ sệt", v);
  styleCell(ws, HR0, 31, "Cắt phẳng", h);
  styleCell(ws, HR0, 34, "Hệ số nén lún", v);
  styleCell(ws, HR0, 35, "Phân loại\n(Theo TCVN 9362:2012)", h);

  // —— HR1 phân nhóm cát/bụi ——
  styleCell(ws, HR1, 11, "Thô", h);
  styleCell(ws, HR1, 13, "Vừa", h);
  styleCell(ws, HR1, 14, "Mịn", h);
  styleCell(ws, HR1, 16, "To", h);
  styleCell(ws, HR1, 17, "Nhỏ", h);
  styleCell(ws, HR1, 18, "Sét", h);

  // —— HR2 cỡ hạt + tên chỉ tiêu ——
  styleCell(ws, HR2, 4, "Từ", v);
  styleCell(ws, HR2, 5, "Đến", v);
  CO_LY_DAT_2_HAT_COLS.forEach((col, i) => {
    styleCell(ws, HR2, 6 + i, `${col.label} (mm)`, v);
  });
  const propNames = [
    [19, "Độ ẩm tự nhiên"],
    [20, "Dung trọng tự nhiên"],
    [21, "Dung trọng bão hòa"],
    [22, "Dung trọng khô"],
    [23, "Khối lượng riêng"],
    [24, "Hệ số rỗng tự nhiên"],
    [25, "Độ lỗ rỗng"],
    [26, "Độ bão hòa"],
    [27, "Giới hạn chảy"],
    [28, "Giới hạn dẻo"],
    [31, "Góc ma sát trong"],
    [32, "Góc ma sát (′)"],
    [33, "Lực dính kết"],
  ];
  for (const [c, label] of propNames) styleCell(ws, HR2, c, label, v);

  // Chiều cao hàng tên dọc — vừa chuỗi dài nhất (Arial 10, xoay 90°; không dư)
  const vertLabelsHr2 = [
    "Từ",
    "Đến",
    ...CO_LY_DAT_2_HAT_COLS.map((col) => `${col.label} (mm)`),
    ...propNames.map(([, label]) => label),
  ];
  const maxVertChars = vertLabelsHr2.reduce((m, s) => Math.max(m, String(s).length), 0);
  const hr2Hpt = Math.max(78, Math.ceil(maxVertChars * 4.5) + 6);

  // —— HR3 ký hiệu ——
  styleCell(ws, HR3, 6, "Thành phần hạt P (%)", h);
  const symbols = [
    [19, "W"],
    [20, "gw"],
    [21, "gc"],
    [22, "γk"],
    [23, "ρ"],
    [24, "ε₀"],
    [25, "h"],
    [26, "G"],
    [27, "Wch"],
    [28, "Wd"],
    [29, "Ip"],
    [30, "B"],
    [31, "φ°"],
    [33, "C"],
    [34, "a1-2"],
  ];
  for (const [c, label] of symbols) styleCell(ws, HR3, c, label, h);

  // —— HR4 đơn vị ——
  for (let c = 6; c <= 19; c++) styleCell(ws, HR4, c, "%", h);
  const units = [
    [20, "g/cm³"],
    [21, "g/cm³"],
    [22, "g/cm³"],
    [23, "g/cm³"],
    [24, "—"],
    [25, "%"],
    [26, "%"],
    [27, "%"],
    [28, "%"],
    [29, "%"],
    [30, "—"],
    [31, "độ"],
    [32, "phút"],
    [33, "kG/cm²"],
    [34, "kG/cm²"],
  ];
  for (const [c, label] of units) styleCell(ws, HR4, c, label, h);

  // Ô gộp còn trống — tô nền/viền
  for (let r = HR0; r <= HR4; r++) {
    for (let c = 0; c < COLS; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) styleCell(ws, r, c, "", h);
      else if (!ws[addr].s) ws[addr].s = h;
    }
  }

  // Hàng số cột (ngang, nền indigo — tách biệt header / dữ liệu)
  const numStyle = headStyle({ vertical: false, fill: FILL_NUM, sz: 9, bold: true });
  for (let c = 0; c < COLS; c++) styleCell(ws, NUMR, c, c + 1, numStyle);

  // Data
  rows.forEach((row, i) => {
    const r = DATA0 + i;
    const isAvg = (row.type || "mau") === "trung_binh";
    const fill = isAvg ? FILL_AVG : i % 2 === 0 ? "FFFFFF" : FILL_ZEBRA;
    const st = dataStyle({ fill, bold: isAvg });
    for (let c = 0; c < COLS; c++) {
      const addr = XLSXS.utils.encode_cell({ r, c });
      const cell = ws[addr] || { t: "s", v: "" };
      cell.s = st;
      ws[addr] = cell;
    }
  });

  ws["!cols"] = Array.from({ length: COLS }, (_, c) => {
    if (c <= 1) return { wch: 5 };
    if (c === 2) return { wch: 5 };
    if (c === 3) return { wch: 5 };
    if (c === 4 || c === 5) return { wch: 5.8 };
    if (c >= 6 && c <= 18) return { wch: 5 };
    // Cột 34–35 (C, a1-2): vừa "kG/cm²"; cột 36 Phân loại giữ rộng
    if (c === 33 || c === 34) return { wch: 8.5 };
    if (c === 35) return { wch: 16 };
    return { wch: 6 };
  });

  ws["!rows"] = [
    { hpt: 24 },
    { hpt: 18 },
    { hpt: 10 },
    { hpt: 10 },
    { hpt: 21 }, // HR0 (+1 chút)
    { hpt: 23 }, // HR1
    { hpt: hr2Hpt }, // HR2 tên dọc — cao theo chuỗi dài nhất
    { hpt: 23 }, // HR3 ký hiệu
    { hpt: 25 }, // HR4 đơn vị
    { hpt: 20 }, // số cột (hàng 6)
    ...rows.map(() => ({ hpt: 18 })),
    { hpt: 10 },
    { hpt: 18 },
    { hpt: 20 },
  ];

  const footerLeft = {
    font: { name: "Arial", sz: 10, italic: false, color: { rgb: INK } },
    alignment: { horizontal: "left", vertical: "center" },
  };
  const footerRight = {
    font: { name: "Arial", sz: 10, italic: false, color: { rgb: INK } },
    alignment: { horizontal: "right", vertical: "center" },
  };
  const footerNgay = {
    font: { name: "Arial", sz: 10, italic: true, bold: false, color: { rgb: INK } },
    alignment: { horizontal: "right", vertical: "center" },
  };
  for (let r = footerStart; r < aoa.length; r++) {
    for (let c = 0; c < COLS; c++) {
      const addr = XLSXS.utils.encode_cell({ r, c });
      if (!ws[addr]) continue;
      if (r === rNgay) ws[addr].s = footerNgay;
      else if (r === rSign && c >= midCol) ws[addr].s = footerRight;
      else ws[addr].s = footerLeft;
    }
  }

  const wb = XLSXS.utils.book_new();
  XLSXS.utils.book_append_sheet(wb, ws, "Co ly dat");
  XLSXS.writeFile(wb, filename, { compression: true });
  return filename;
}

function buildCoLyDatAoa(data) {
  const hatLabels = CO_LY_DAT_HAT_COLS.map((c) => c.label);
  const header = [
    "STT",
    "Vị trí khoan mẫu",
    "Số hiệu mẫu khoan",
    "Lớp",
    "Độ sâu lấy mẫu",
    ...hatLabels,
    "W %",
    "γw",
    "γc",
    "Δ",
    "e0",
    "n %",
    "G %",
    "WL",
    "Wp",
    "Ip",
    "B",
    "Góc nghỉ khô",
    "Góc nghỉ ướt",
    "C",
    "φ",
    "a1-2",
    "R0",
    "E0",
    "Tên đất theo quy phạm",
  ];
  const aoa = [
    ["BẢNG TỔNG HỢP CHỈ TIÊU CƠ LÝ CỦA MẪU ĐẤT NGUYÊN DẠNG"],
    [`Công trình: ${data?.cong_trinh || ""}`],
    [`Đơn vị yêu cầu: ${data?.don_vi_yeu_cau || ""}`],
    [],
    header,
  ];
  (data?.rows || []).forEach((row, i) => {
    aoa.push([
      i + 1,
      row.vi_tri_khoan,
      row.so_hieu_mau,
      row.lop,
      row.do_sau,
      ...CO_LY_DAT_HAT_COLS.map((c) => row[c.key]),
      row.w,
      row.gw,
      row.gc,
      row.r,
      row.e0,
      row.n,
      row.g,
      row.wl,
      row.wp,
      row.ip,
      row.b,
      row.goc_nghi_kho,
      row.goc_nghi_uot,
      row.c,
      row.phi,
      row.a12,
      row.r0,
      row.e0_modun,
      row.ten_dat,
    ]);
  });
  aoa.push([]);
  aoa.push([`Ngày: ${data?.ngay || ""}`]);
  aoa.push([
    `Người tổng hợp: ${data?.nguoi_tong_hop || ""}`,
    `Phòng TN: ${data?.phong_thi_nghiem || ""}`,
    `P.GĐ: ${data?.pho_giam_doc || ""}`,
  ]);
  return aoa;
}

function formatNgayThangNamLine(isoDate) {
  const blank = "Ngày .. tháng .. năm ....";
  if (!isoDate) return blank;
  const m = String(isoDate).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return blank;
  return `Ngày ${Number(m[3])} tháng ${Number(m[2])} năm ${m[1]}`;
}

function buildTnNuocAoa(data, formMeta = {}) {
  const gdRaw = formMeta.giai_doan || data?.giai_doan || "";
  const gdLabel = formatGiaiDoanFullName(gdRaw) || gdRaw;
  const ten = formMeta.ten_du_an || data?.cong_trinh || "";
  const empty5 = ["", "", "", "", ""];
  const aoa = [
    ["BÁO CÁO KẾT QUẢ THÍ NGHIỆM MẪU NƯỚC", "", "", "", ""],
    [`Dự án: ${ten || "—"}`, "", "", "", ""],
    [`Giai đoạn: ${gdLabel || "—"}`, "", "", "", ""],
    empty5,
    ["NGUỒN GỐC MẪU", "", "ĐƠN VỊ YÊU CẦU", "", ""],
    [data?.nguon_goc_mau || "", "", data?.don_vi_yeu_cau || "", "", ""],
    ["NGÀY GỬI MẪU", "", "NGÀY THÍ NGHIỆM", "", ""],
    [formatNgayThangNamLine(data?.ngay_gui_mau), "", formatNgayThangNamLine(data?.ngay_thi_nghiem), "", ""],
    empty5,
    ["KẾT QUẢ THÍ NGHIỆM", "", "", "", ""],
    ["STT", "Chỉ tiêu thí nghiệm", "Yêu cầu", "Kết quả", "Phương pháp thí nghiệm"],
  ];
  (data?.chi_tieu || []).forEach((row, i) => {
    aoa.push([i + 1, row.chi_tieu, row.yeu_cau, row.ket_qua, row.phuong_phap]);
  });
  aoa.push(empty5);
  aoa.push([`Ghi chú: ${data?.ghi_chu || ""}`, "", "", "", ""]);
  aoa.push(empty5);
  aoa.push(["NGƯỜI THÍ NGHIỆM", "", "PHÒNG THÍ NGHIỆM", "PHÓ GIÁM ĐỐC", ""]);
  aoa.push([data?.nguoi_thi_nghiem || "", "", data?.phong_thi_nghiem || "", data?.pho_giam_doc || "", ""]);
  return aoa;
}

/** Xuất TN nước — bố cục khớp PDF (meta 2 cột, bảng, chữ ký) */
async function exportTnNuocStyled(data, formMeta, filename) {
  const { isTnNuocKetQuaOutOfSpec } = await import("./bcksTnNuocSpec");
  const XLSXS = (await import("xlsx-js-style")).default;
  const aoa = buildTnNuocAoa(data, formMeta);
  const ws = XLSXS.utils.aoa_to_sheet(aoa);
  const COLS = 5;
  const rowCount = (data?.chi_tieu || []).length;
  const R = {
    title: 0,
    duAn: 1,
    giaiDoan: 2,
    labNguon: 4,
    valNguon: 5,
    labNgay: 6,
    valNgay: 7,
    ketQuaTitle: 9,
    th: 10,
    firstData: 11,
  };
  const ghiChuRow = R.firstData + rowCount + 1;
  const signLabRow = R.firstData + rowCount + 3;
  const signValRow = R.firstData + rowCount + 4;

  const titleStyle = {
    font: { name: "Arial", sz: 14, bold: true, color: { rgb: "134E4A" } },
    alignment: { horizontal: "center", vertical: "center" },
  };
  const duAnStyle = {
    font: { name: "Arial", sz: 11, bold: true, color: { rgb: "0F766E" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
  };
  const metaLabStyle = {
    font: { name: "Arial", sz: 10, bold: true, color: { rgb: "0F766E" } },
    alignment: { horizontal: "center", vertical: "center" },
  };
  const metaValStyle = {
    font: { name: "Arial", sz: 11, bold: false, italic: false, color: { rgb: INK } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
  };
  const dateValStyle = {
    font: { name: "Arial", sz: 11, bold: false, italic: true, color: { rgb: INK } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
  };
  const sectionStyle = {
    font: { name: "Arial", sz: 11, bold: true, color: { rgb: "134E4A" } },
    alignment: { horizontal: "center", vertical: "center" },
  };
  const thStyle = headStyle({ fill: "F0FDFA", sz: 10 });
  const okStyle = dataStyle({ fill: "FFFFFF" });
  const outStyle = {
    font: { name: "Arial", sz: 9, bold: true, color: { rgb: "E11D48" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: BORDER,
    fill: { patternType: "solid", fgColor: { rgb: "FFFFFF" } },
  };
  const leftData = {
    ...dataStyle({ fill: "FFFFFF" }),
    alignment: { horizontal: "left", vertical: "center", wrapText: true },
  };
  const ghiChuStyle = {
    font: { name: "Arial", sz: 10, color: { rgb: INK } },
    alignment: { horizontal: "left", vertical: "center", wrapText: true },
  };
  const signLabStyle = {
    font: { name: "Arial", sz: 9, bold: true, color: { rgb: INK_MUTED } },
    alignment: { horizontal: "center", vertical: "center" },
  };
  const signValStyle = {
    font: { name: "Arial", sz: 10, color: { rgb: INK } },
    alignment: { horizontal: "center", vertical: "center" },
  };

  ws["!merges"] = [
    { s: { r: R.title, c: 0 }, e: { r: R.title, c: COLS - 1 } },
    { s: { r: R.duAn, c: 0 }, e: { r: R.duAn, c: COLS - 1 } },
    { s: { r: R.giaiDoan, c: 0 }, e: { r: R.giaiDoan, c: COLS - 1 } },
    { s: { r: R.labNguon, c: 0 }, e: { r: R.labNguon, c: 1 } },
    { s: { r: R.labNguon, c: 2 }, e: { r: R.labNguon, c: 4 } },
    { s: { r: R.valNguon, c: 0 }, e: { r: R.valNguon, c: 1 } },
    { s: { r: R.valNguon, c: 2 }, e: { r: R.valNguon, c: 4 } },
    { s: { r: R.labNgay, c: 0 }, e: { r: R.labNgay, c: 1 } },
    { s: { r: R.labNgay, c: 2 }, e: { r: R.labNgay, c: 4 } },
    { s: { r: R.valNgay, c: 0 }, e: { r: R.valNgay, c: 1 } },
    { s: { r: R.valNgay, c: 2 }, e: { r: R.valNgay, c: 4 } },
    { s: { r: R.ketQuaTitle, c: 0 }, e: { r: R.ketQuaTitle, c: COLS - 1 } },
    { s: { r: ghiChuRow, c: 0 }, e: { r: ghiChuRow, c: COLS - 1 } },
    { s: { r: signLabRow, c: 0 }, e: { r: signLabRow, c: 1 } },
    { s: { r: signLabRow, c: 3 }, e: { r: signLabRow, c: 4 } },
    { s: { r: signValRow, c: 0 }, e: { r: signValRow, c: 1 } },
    { s: { r: signValRow, c: 3 }, e: { r: signValRow, c: 4 } },
  ];

  styleCell(ws, R.title, 0, aoa[R.title][0], titleStyle);
  styleCell(ws, R.duAn, 0, aoa[R.duAn][0], duAnStyle);
  styleCell(ws, R.giaiDoan, 0, aoa[R.giaiDoan][0], duAnStyle);

  styleCell(ws, R.labNguon, 0, "NGUỒN GỐC MẪU", metaLabStyle);
  styleCell(ws, R.labNguon, 2, "ĐƠN VỊ YÊU CẦU", metaLabStyle);
  styleCell(ws, R.valNguon, 0, data?.nguon_goc_mau || "", metaValStyle);
  styleCell(ws, R.valNguon, 2, data?.don_vi_yeu_cau || "", metaValStyle);

  styleCell(ws, R.labNgay, 0, "NGÀY GỬI MẪU", metaLabStyle);
  styleCell(ws, R.labNgay, 2, "NGÀY THÍ NGHIỆM", metaLabStyle);
  styleCell(ws, R.valNgay, 0, formatNgayThangNamLine(data?.ngay_gui_mau), dateValStyle);
  styleCell(ws, R.valNgay, 2, formatNgayThangNamLine(data?.ngay_thi_nghiem), dateValStyle);

  styleCell(ws, R.ketQuaTitle, 0, "KẾT QUẢ THÍ NGHIỆM", sectionStyle);

  for (let c = 0; c < COLS; c++) {
    styleCell(ws, R.th, c, aoa[R.th][c], thStyle);
  }

  (data?.chi_tieu || []).forEach((row, i) => {
    const r = R.firstData + i;
    const out = isTnNuocKetQuaOutOfSpec(row.yeu_cau, row.ket_qua);
    styleCell(ws, r, 0, i + 1, okStyle);
    styleCell(ws, r, 1, row.chi_tieu ?? "", leftData);
    styleCell(ws, r, 2, row.yeu_cau ?? "", okStyle);
    styleCell(ws, r, 3, row.ket_qua ?? "", out ? outStyle : okStyle);
    styleCell(ws, r, 4, row.phuong_phap ?? "", okStyle);
  });

  styleCell(ws, ghiChuRow, 0, `Ghi chú: ${data?.ghi_chu || ""}`, ghiChuStyle);

  styleCell(ws, signLabRow, 0, "NGƯỜI THÍ NGHIỆM", signLabStyle);
  styleCell(ws, signLabRow, 2, "PHÒNG THÍ NGHIỆM", signLabStyle);
  styleCell(ws, signLabRow, 3, "PHÓ GIÁM ĐỐC", signLabStyle);
  styleCell(ws, signValRow, 0, data?.nguoi_thi_nghiem || "", signValStyle);
  styleCell(ws, signValRow, 2, data?.phong_thi_nghiem || "", signValStyle);
  styleCell(ws, signValRow, 3, data?.pho_giam_doc || "", signValStyle);

  ws["!cols"] = [{ wch: 8 }, { wch: 30 }, { wch: 18 }, { wch: 12 }, { wch: 24 }];
  ws["!rows"] = [
    { hpt: 22 },
    { hpt: 18 },
    { hpt: 18 },
    { hpt: 12 },
    { hpt: 16 },
    { hpt: 18 },
    { hpt: 16 },
    { hpt: 18 },
    { hpt: 8 },
    { hpt: 16 },
    { hpt: 20 },
    ...Array.from({ length: Math.max(rowCount, 0) }, () => ({ hpt: 18 })),
    { hpt: 8 },
    { hpt: 18 },
    { hpt: 10 },
    { hpt: 16 },
    { hpt: 18 },
  ];

  const wb = XLSXS.utils.book_new();
  XLSXS.utils.book_append_sheet(wb, ws, "TN nuoc");
  XLSXS.writeFile(wb, filename, { compression: true });
  return filename;
}

function buildTnDaAoa(data, formMeta = {}) {
  const gdRaw = formMeta.giai_doan || data?.giai_doan || "";
  const gdLabel = formatGiaiDoanFullName(gdRaw) || gdRaw;
  const ten = formMeta.ten_du_an || data?.du_an || "";
  const empty18 = Array(18).fill("");
  const aoa = [
    ["BẢNG TỔNG HỢP KẾT QUẢ THÍ NGHIỆM MẪU ĐÁ", ...Array(17).fill("")],
    [`(ppTN: ${data?.pp_tn || "7572-10:06"})`, ...Array(17).fill("")],
    [`Dự án: ${ten || "—"}`, ...Array(17).fill("")],
    [`Giai đoạn: ${gdLabel || "—"}`, ...Array(17).fill("")],
    empty18,
    [
      "ĐƠN VỊ YÊU CẦU",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "NGÀY NHẬN MẪU",
      "",
      "",
      "",
      "NGÀY THÍ NGHIỆM",
      "",
      "",
      "",
      "",
    ],
    [
      data?.don_vi_yeu_cau || "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      formatNgayThangNamLine(data?.ngay_nhan_mau),
      "",
      "",
      "",
      formatNgayThangNamLine(data?.ngay_thi_nghiem),
      "",
      "",
      "",
      "",
    ],
    empty18,
    // HR0
    [
      "Số TT",
      "Số hiệu thí nghiệm",
      "Lớp",
      "Vị trí lấy mẫu",
      "Độ sâu\n(m)",
      "Mô tả đá",
      "Độ ẩm",
      "",
      "Tỷ trọng",
      "Khối lượng thể tích",
      "",
      "",
      "Độ rỗng",
      "Độ BH",
      "",
      "C/độ kháng nén",
      "",
      "Hệ số mềm",
    ],
    // HR1
    ["", "", "", "", "", "", "KG", "BH", "", "KG", "BH", "T/đối", "", "Tự do", "C/bức", "Khô gió", "Bão hòa", ""],
    // HR2
    ["", "", "", "", "", "", "W₀", "Ws", "ρ", "γ₀", "γs", "γc", "n", "G₀", "Gs", "δC", "δCH", "K"],
    // HR3 units
    ["", "", "", "", "", "", "%", "", "g/cm³", "", "", "", "%", "", "", "(kg/cm²)", "", "%"],
    // số cột
    Array.from({ length: 18 }, (_, i) => i + 1),
  ];
  (data?.rows || []).forEach((row, i) => {
    aoa.push([
      i + 1,
      row.so_hieu_tn,
      row.lop,
      row.vi_tri,
      row.do_sau,
      row.mo_ta_da,
      row.w0,
      row.ws,
      row.r,
      row.g0,
      row.gs,
      row.gc,
      row.n,
      row.g0_bh,
      row.gs_bh,
      row.dc,
      row.dch,
      row.k,
    ]);
  });
  aoa.push(empty18);
  aoa.push([
    "NGƯỜI THÍ NGHIỆM",
    "",
    "",
    "",
    "",
    "",
    "TRƯỞNG PHÒNG THÍ NGHIỆM",
    "",
    "",
    "",
    "",
    "",
    "PHÓ GIÁM ĐỐC",
    "",
    "",
    "",
    "",
    "",
  ]);
  aoa.push([
    data?.nguoi_thi_nghiem || "",
    "",
    "",
    "",
    "",
    "",
    data?.truong_phong_tn || "",
    "",
    "",
    "",
    "",
    "",
    data?.pho_giam_doc || "",
    "",
    "",
    "",
    "",
    "",
  ]);
  return aoa;
}

/** Xuất TN đá — header đa tầng + style khớp màn hình */
async function exportTnDaStyled(data, formMeta, filename) {
  const XLSXS = (await import("xlsx-js-style")).default;
  const aoa = buildTnDaAoa(data, formMeta);
  const ws = XLSXS.utils.aoa_to_sheet(aoa);
  const COLS = 18;
  const rowCount = (data?.rows || []).length;
  const R = {
    title: 0,
    pptn: 1,
    duAn: 2,
    giaiDoan: 3,
    labMeta: 5,
    valMeta: 6,
    hr0: 8,
    hr1: 9,
    hr2: 10,
    hr3: 11,
    num: 12,
    firstData: 13,
  };
  const signLabRow = R.firstData + rowCount + 1;
  const signValRow = R.firstData + rowCount + 2;

  const thFill = "F0FDFA";
  const numFill = "FEF3C7";
  const zebraFill = "FDEADA";
  const thStyle = headStyle({ fill: thFill, sz: 9 });
  const thSymStyle = headStyle({ fill: thFill, sz: 9 });
  const numStyle = {
    font: { name: "Arial", sz: 9, bold: true, color: { rgb: "78350F" } },
    alignment: { horizontal: "center", vertical: "center" },
    border: BORDER,
    fill: { patternType: "solid", fgColor: { rgb: numFill } },
  };
  const dataCenter = dataStyle({ fill: "FFFFFF" });
  const dataZebra = dataStyle({ fill: zebraFill });
  const titleStyle = {
    font: { name: "Arial", sz: 14, bold: true, color: { rgb: "134E4A" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
  };
  const metaCenter = {
    font: { name: "Arial", sz: 10, bold: true, color: { rgb: INK_MUTED } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
  };
  const metaLab = {
    font: { name: "Arial", sz: 9, bold: true, color: { rgb: INK_MUTED } },
    alignment: { horizontal: "center", vertical: "center" },
  };
  const metaVal = {
    font: { name: "Arial", sz: 10, color: { rgb: INK } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
  };
  const dateVal = {
    font: { name: "Arial", sz: 10, italic: true, color: { rgb: INK } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
  };
  const signLab = {
    font: { name: "Arial", sz: 9, bold: true, color: { rgb: INK_MUTED } },
    alignment: { horizontal: "center", vertical: "center" },
  };
  const signVal = {
    font: { name: "Arial", sz: 10, color: { rgb: INK } },
    alignment: { horizontal: "center", vertical: "center" },
  };

  ws["!merges"] = [
    { s: { r: R.title, c: 0 }, e: { r: R.title, c: COLS - 1 } },
    { s: { r: R.pptn, c: 0 }, e: { r: R.pptn, c: COLS - 1 } },
    { s: { r: R.duAn, c: 0 }, e: { r: R.duAn, c: COLS - 1 } },
    { s: { r: R.giaiDoan, c: 0 }, e: { r: R.giaiDoan, c: COLS - 1 } },
    { s: { r: R.labMeta, c: 0 }, e: { r: R.labMeta, c: 8 } },
    { s: { r: R.labMeta, c: 9 }, e: { r: R.labMeta, c: 12 } },
    { s: { r: R.labMeta, c: 13 }, e: { r: R.labMeta, c: 17 } },
    { s: { r: R.valMeta, c: 0 }, e: { r: R.valMeta, c: 8 } },
    { s: { r: R.valMeta, c: 9 }, e: { r: R.valMeta, c: 12 } },
    { s: { r: R.valMeta, c: 13 }, e: { r: R.valMeta, c: 17 } },
    // HR0 vertical spans
    { s: { r: R.hr0, c: 0 }, e: { r: R.hr3, c: 0 } },
    { s: { r: R.hr0, c: 1 }, e: { r: R.hr3, c: 1 } },
    { s: { r: R.hr0, c: 2 }, e: { r: R.hr3, c: 2 } },
    { s: { r: R.hr0, c: 3 }, e: { r: R.hr3, c: 3 } },
    { s: { r: R.hr0, c: 4 }, e: { r: R.hr3, c: 4 } },
    { s: { r: R.hr0, c: 5 }, e: { r: R.hr3, c: 5 } },
    { s: { r: R.hr0, c: 6 }, e: { r: R.hr0, c: 7 } }, // Độ ẩm
    { s: { r: R.hr0, c: 8 }, e: { r: R.hr1, c: 8 } }, // Tỷ trọng
    { s: { r: R.hr0, c: 9 }, e: { r: R.hr0, c: 11 } }, // KLTT
    { s: { r: R.hr0, c: 12 }, e: { r: R.hr1, c: 12 } }, // Độ rỗng
    { s: { r: R.hr0, c: 13 }, e: { r: R.hr0, c: 14 } }, // Độ BH
    { s: { r: R.hr0, c: 15 }, e: { r: R.hr0, c: 16 } }, // Cường độ
    { s: { r: R.hr0, c: 17 }, e: { r: R.hr1, c: 17 } }, // Hệ số mềm
    // HR3 unit merges
    { s: { r: R.hr3, c: 6 }, e: { r: R.hr3, c: 7 } },
    { s: { r: R.hr3, c: 8 }, e: { r: R.hr3, c: 11 } },
    { s: { r: R.hr3, c: 13 }, e: { r: R.hr3, c: 14 } },
    { s: { r: R.hr3, c: 15 }, e: { r: R.hr3, c: 16 } },
    // signs
    { s: { r: signLabRow, c: 0 }, e: { r: signLabRow, c: 5 } },
    { s: { r: signLabRow, c: 6 }, e: { r: signLabRow, c: 11 } },
    { s: { r: signLabRow, c: 12 }, e: { r: signLabRow, c: 17 } },
    { s: { r: signValRow, c: 0 }, e: { r: signValRow, c: 5 } },
    { s: { r: signValRow, c: 6 }, e: { r: signValRow, c: 11 } },
    { s: { r: signValRow, c: 12 }, e: { r: signValRow, c: 17 } },
  ];

  styleCell(ws, R.title, 0, aoa[R.title][0], titleStyle);
  styleCell(ws, R.pptn, 0, aoa[R.pptn][0], metaCenter);
  styleCell(ws, R.duAn, 0, aoa[R.duAn][0], metaCenter);
  styleCell(ws, R.giaiDoan, 0, aoa[R.giaiDoan][0], metaCenter);
  styleCell(ws, R.labMeta, 0, aoa[R.labMeta][0], metaLab);
  styleCell(ws, R.labMeta, 9, aoa[R.labMeta][9], metaLab);
  styleCell(ws, R.labMeta, 13, aoa[R.labMeta][13], metaLab);
  styleCell(ws, R.valMeta, 0, aoa[R.valMeta][0], metaVal);
  styleCell(ws, R.valMeta, 9, aoa[R.valMeta][9], dateVal);
  styleCell(ws, R.valMeta, 13, aoa[R.valMeta][13], dateVal);

  for (let c = 0; c < COLS; c++) {
    if (aoa[R.hr0][c] !== "" && aoa[R.hr0][c] != null) styleCell(ws, R.hr0, c, aoa[R.hr0][c], thStyle);
    if (aoa[R.hr1][c] !== "" && aoa[R.hr1][c] != null) styleCell(ws, R.hr1, c, aoa[R.hr1][c], thStyle);
    if (aoa[R.hr2][c] !== "" && aoa[R.hr2][c] != null) styleCell(ws, R.hr2, c, aoa[R.hr2][c], thSymStyle);
    if (aoa[R.hr3][c] !== "" && aoa[R.hr3][c] != null) styleCell(ws, R.hr3, c, aoa[R.hr3][c], thStyle);
    // fill empty header cells for borders
    for (const hr of [R.hr0, R.hr1, R.hr2, R.hr3]) {
      const addr = XLSX.utils.encode_cell({ r: hr, c });
      if (!ws[addr]) styleCell(ws, hr, c, "", thStyle);
      else if (!ws[addr].s) ws[addr].s = thStyle;
    }
    styleCell(ws, R.num, c, c + 1, numStyle);
  }

  (data?.rows || []).forEach((row, i) => {
    const r = R.firstData + i;
    const st = i % 2 === 0 ? dataCenter : dataZebra;
    const vals = [
      i + 1,
      row.so_hieu_tn,
      row.lop,
      row.vi_tri,
      row.do_sau,
      row.mo_ta_da,
      row.w0,
      row.ws,
      row.r,
      row.g0,
      row.gs,
      row.gc,
      row.n,
      row.g0_bh,
      row.gs_bh,
      row.dc,
      row.dch,
      row.k,
    ];
    vals.forEach((v, c) => styleCell(ws, r, c, v ?? "", st));
  });

  styleCell(ws, signLabRow, 0, "NGƯỜI THÍ NGHIỆM", signLab);
  styleCell(ws, signLabRow, 6, "TRƯỞNG PHÒNG THÍ NGHIỆM", signLab);
  styleCell(ws, signLabRow, 12, "PHÓ GIÁM ĐỐC", signLab);
  styleCell(ws, signValRow, 0, data?.nguoi_thi_nghiem || "", signVal);
  styleCell(ws, signValRow, 6, data?.truong_phong_tn || "", signVal);
  styleCell(ws, signValRow, 12, data?.pho_giam_doc || "", signVal);

  ws["!cols"] = [
    { wch: 5 },
    { wch: 10 },
    { wch: 5 },
    { wch: 12 },
    { wch: 6 },
    { wch: 14 },
    { wch: 5 },
    { wch: 5 },
    { wch: 6 },
    { wch: 5 },
    { wch: 5 },
    { wch: 6 },
    { wch: 5 },
    { wch: 6 },
    { wch: 6 },
    { wch: 7 },
    { wch: 7 },
    { wch: 6 },
  ];
  ws["!rows"] = [
    { hpt: 22 },
    { hpt: 14 },
    { hpt: 16 },
    { hpt: 16 },
    { hpt: 8 },
    { hpt: 14 },
    { hpt: 18 },
    { hpt: 8 },
    { hpt: 18 },
    { hpt: 16 },
    { hpt: 16 },
    { hpt: 14 },
    { hpt: 14 },
    ...Array.from({ length: Math.max(rowCount, 0) }, () => ({ hpt: 16 })),
    { hpt: 10 },
    { hpt: 16 },
    { hpt: 18 },
  ];

  const wb = XLSXS.utils.book_new();
  XLSXS.utils.book_append_sheet(wb, ws, "TN da");
  XLSXS.writeFile(wb, filename, { compression: true });
  return filename;
}

/**
 * Xuất Báo cáo DTS — Bảng thông số tiếp địa (khớp mẫu nhapthongso tiep dia.xlsx).
 */
async function exportBaoCaoDtsAoa(data, formMeta, filename) {
  const XLSXS = (await import("xlsx-js-style")).default;
  const soLop = Math.max(1, Number(data?.so_lop) || BAO_CAO_DTS_DEFAULT_LOP);
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  const gdRaw = formMeta.giai_doan || data?.giai_doan || "";
  const gdLabel = formatGiaiDoanFullName(gdRaw) || gdRaw;
  const ten = formMeta.ten_du_an || data?.ten_du_an || "";
  const colCount = 3 + soLop * 2;

  const headerLop = ["STT", "Vị trí", "Mô tả môi trường vị trí"];
  const headerSub = ["", "", ""];
  for (let i = 0; i < soLop; i++) {
    headerLop.push(`LỚP ${i + 1}`, "");
    headerSub.push("h (m)", "ρ (Ω·m)");
  }

  const aoa = [
    ["BẢNG THÔNG SỐ TIẾP ĐỊA", ...Array(colCount - 1).fill("")],
    [
      `DỰ ÁN: ${ten || "[TÊN DỰ ÁN]"}                 GIAI ĐOẠN: ${gdLabel || "[GIAI ĐOẠN]"}`,
      ...Array(colCount - 1).fill(""),
    ],
    headerLop,
    headerSub,
  ];

  rows.forEach((row, ri) => {
    const line = [ri + 1, row?.vi_tri ?? "", row?.mo_ta ?? ""];
    for (let li = 0; li < soLop; li++) {
      const layer = row?.layers?.[li] || {};
      line.push(layer.h ?? "", layer.rho ?? "");
    }
    aoa.push(line);
  });

  const ws = XLSXS.utils.aoa_to_sheet(aoa);
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 3, c: 0 } },
    { s: { r: 2, c: 1 }, e: { r: 3, c: 1 } },
    { s: { r: 2, c: 2 }, e: { r: 3, c: 2 } },
    ...Array.from({ length: soLop }, (_, i) => ({
      s: { r: 2, c: 3 + i * 2 },
      e: { r: 2, c: 4 + i * 2 },
    })),
  ];

  const titleStyle = {
    font: { name: "Arial", sz: 14, bold: true, color: { rgb: "134E4A" } },
    alignment: { horizontal: "center", vertical: "center" },
  };
  const metaStyle = {
    font: { name: "Arial", sz: 11, bold: true, color: { rgb: "0F766E" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
  };
  const thStyle = {
    font: { name: "Arial", sz: 10, bold: true, color: { rgb: "134E4A" } },
    fill: { patternType: "solid", fgColor: { rgb: "ECFEFF" } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: BORDER,
  };
  const tdStyle = {
    font: { name: "Arial", sz: 10, color: { rgb: INK } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: BORDER,
  };
  const tdLeftStyle = {
    ...tdStyle,
    alignment: { horizontal: "left", vertical: "center", wrapText: true },
  };

  const colLetter = (c) => XLSXS.utils.encode_col(c);
  for (let c = 0; c < colCount; c++) {
    ensureCell(ws, `${colLetter(c)}1`).s = titleStyle;
    ensureCell(ws, `${colLetter(c)}2`).s = metaStyle;
    ensureCell(ws, `${colLetter(c)}3`).s = thStyle;
    ensureCell(ws, `${colLetter(c)}4`).s = thStyle;
  }
  for (let r = 0; r < rows.length; r++) {
    const excelR = r + 5;
    for (let c = 0; c < colCount; c++) {
      const addr = `${colLetter(c)}${excelR}`;
      const cell = ensureCell(ws, addr);
      cell.s = c === 2 ? tdLeftStyle : tdStyle;
    }
  }

  ws["!cols"] = [
    { wch: 6 },
    { wch: 12 },
    { wch: 42 },
    ...Array.from({ length: soLop * 2 }, () => ({ wch: 10 })),
  ];
  ws["!rows"] = [{ hpt: 22 }, { hpt: 18 }, { hpt: 18 }, { hpt: 16 }];

  const wb = XLSXS.utils.book_new();
  XLSXS.utils.book_append_sheet(wb, ws, "ViTri");
  XLSXS.writeFile(wb, filename, { compression: true });
  return filename;
}

/**
 * Xuất Đo ĐTS — ủy quyền ExcelJS (có ảnh sơ đồ / đồ thị).
 */
async function exportDoDtsStyled(data, formMeta, filename, images) {
  const { exportDoDtsStyledExcelJs } = await import("./bcksDoDtsExcelExport");
  return exportDoDtsStyledExcelJs(data, formMeta, filename, images);
}

/**
 * @param {object} formData
 * @param {string} diaChatTab
 * @param {{ images?: object }} [opts]
 */
export async function exportBcksDiaChatExcel(formData, diaChatTab, opts = {}) {
  const def = BCKS_DIA_CHAT_FORMS[diaChatTab];
  if (!def) throw new Error("Tab địa chất không hợp lệ");
  const data = formData?.chi_tiet_bcks?.dia_chat?.[diaChatTab] || {};
  const ma = formData?.ma_du_an || "du_an";
  const filename = `${safeName(ma)}_${safeName(def.shortLabel)}_${buildExportTimestamp()}.xlsx`;

  if (diaChatTab === "co_ly_dat_2") {
    return exportCoLyDat2Styled(
      data,
      { ten_du_an: formData?.ten_du_an, giai_doan: formData?.giai_doan },
      filename
    );
  }

  if (diaChatTab === "tn_nuoc") {
    return exportTnNuocStyled(
      data,
      { ten_du_an: formData?.ten_du_an, giai_doan: formData?.giai_doan },
      filename
    );
  }

  if (diaChatTab === "tn_da") {
    return exportTnDaStyled(
      data,
      { ten_du_an: formData?.ten_du_an, giai_doan: formData?.giai_doan },
      filename
    );
  }

  if (diaChatTab === "do_dts") {
    return exportDoDtsStyled(
      data,
      { ten_du_an: formData?.ten_du_an, giai_doan: formData?.giai_doan },
      filename,
      opts.images || {}
    );
  }

  if (diaChatTab === "bao_cao_dts") {
    return exportBaoCaoDtsAoa(
      data,
      { ten_du_an: formData?.ten_du_an, giai_doan: formData?.giai_doan },
      filename
    );
  }

  let aoa;
  if (diaChatTab === "co_ly_dat") aoa = buildCoLyDatAoa(data);
  else throw new Error("Chưa hỗ trợ xuất tab này");

  const wb = sheetFromAoa(aoa, def.shortLabel);
  XLSX.writeFile(wb, filename, { compression: true });
  return filename;
}
