/**
 * Khối lượng NVKS Điều chỉnh — cột (01) Gốc, (02) chỉnh tay, (03) chênh.
 * NKKS tham chiếu: ưu tiên (02) nếu có, không thì KL Gốc.
 */
import { buildFilteredWorkItems } from "./nvksFilteredWorkItems";
import { buildDsKhoiLuong, computeRowKhoiLuong, evaluateFormula } from "./nvksKhoiLuongExport";
import {
  filterMauNuocChiTieuWhenParentZero,
  pruneEmptyNkksKlSectionHeaders,
  syncMauNuocQuantities,
} from "./nvksLoaiHinh";
import {
  NVKS_BAO_CAO_CV_ID,
  NVKS_BAO_CAO_SECTION_TITLE,
  NVKS_V_BAO_CAO_ID,
  NVKS_V_BAO_CAO_DVT,
  NVKS_V_BAO_CAO_KL_DEFAULT,
  NVKS_V_BAO_CAO_NOI_DUNG,
  buildNvksVBaoCaoDetailExportRow,
  buildNvksVBaoCaoDetailWorkItem,
  buildNvksVBaoCaoSectionWorkItem,
  computeNextMainRomanFromExportRows,
  findNvksBaoCaoSectionIndex,
  isNvksVBaoCaoDetailRow,
  renumberWorkItemsAfterBaoCaoSection,
  stripNvksVBaoCaoDetailRows,
} from "./nvksBaoCaoSection";
import { mapGiaiDoan } from "./paktksInit";
import { formatKlNumber, parseKlNumber } from "./klTableUtils";

function buildDsFromNvksRecord(nvksRecord, templateData, project) {
  if (!nvksRecord?.du_lieu_bang_tinh || !templateData?.length) return [];

  const giaiDoan = mapGiaiDoan(project) || nvksRecord.giai_doan;
  const loaiHinh = nvksRecord.loai_hinh;
  if (!giaiDoan || !loaiHinh) return [];

  const bang = nvksRecord.du_lieu_bang_tinh;
  const hiddenItems = new Set(bang.hiddenItems || []);
  const filteredWorkItems = buildFilteredWorkItems(templateData, { giaiDoan, loaiHinh }, hiddenItems);
  // Hồ sơ cũ: chỉ tiêu mẫu nước còn cứng 3 trong quantities → bám số mẫu cha trước khi xuất/NKKS
  const quantities = syncMauNuocQuantities(bang.quantities || {});

  return buildDsKhoiLuong({
    filteredWorkItems,
    quantities,
    capDhValues: bang.capDhValues || {},
    donViOverrides: bang.donViOverrides || {},
  });
}

/** KL phê duyệt (01) từ NVKS Gốc — mọi hàng, kể cả KL = 0. */
export function buildGocKlApprovedById(gocRecord, templateData, project) {
  if (!gocRecord?.du_lieu_bang_tinh || !templateData?.length) return {};

  const giaiDoan = mapGiaiDoan(project) || gocRecord.giai_doan;
  const loaiHinh = gocRecord.loai_hinh;
  if (!giaiDoan || !loaiHinh) return {};

  const bang = gocRecord.du_lieu_bang_tinh;
  const quantities = syncMauNuocQuantities(bang.quantities || {});
  const hiddenItems = new Set(bang.hiddenItems || []);
  const filtered = buildFilteredWorkItems(templateData, { giaiDoan, loaiHinh }, hiddenItems);
  const evalFn = (formula) => evaluateFormula(quantities, formula);
  const map = {};

  for (const item of filtered) {
    if ((item.loai_dong || "").trim().toLowerCase() === "tieu_de") continue;
    if (isNvksVBaoCaoWorkItem(item)) {
      map[item.id_cong_viec] = NVKS_V_BAO_CAO_KL_DEFAULT;
      continue;
    }
    const { kl } = computeRowKhoiLuong(item, filtered, quantities, evalFn);
    map[item.id_cong_viec] = kl === "" || kl === undefined || kl === null ? "" : kl;
  }

  for (const tg of NVKS_THOI_GIAN_FIELDS) {
    map[tg.field] = gocRecord[tg.field] ?? "";
  }

  return map;
}

export function buildGocKlById(gocRecord, templateData, project) {
  const approved = buildGocKlApprovedById(gocRecord, templateData, project);
  const map = {};
  for (const [id, kl] of Object.entries(approved)) {
    if (kl === "" || kl === undefined || kl === null) continue;
    if (parseKlNumber(kl) > 0 || (typeof kl === "string" && kl.trim() && Number.isNaN(parseKlNumber(kl)))) {
      map[id] = kl;
    }
  }
  return map;
}

export function formatKlCellDisplay(value) {
  if (value === "" || value === undefined || value === null) return "—";
  const s = String(value).trim();
  if (!s) return "—";
  const n = parseKlNumber(s);
  if (n > 0) return formatKlNumber(n);
  if (n === 0 && (s === "0" || s === "0,0")) return "0";
  return s;
}

export function computeKlDcChenhDiff(kl02, kl01) {
  if (typeof kl02 === "string" && kl02.trim() && Number.isNaN(parseKlNumber(kl02))) return null;
  if (typeof kl01 === "string" && kl01.trim() && Number.isNaN(parseKlNumber(kl01))) return null;
  return parseFloat((parseKlNumber(kl02) - parseKlNumber(kl01)).toFixed(4));
}

export function computeKlDcChenh(kl02, kl01) {
  const diff = computeKlDcChenhDiff(kl02, kl01);
  if (diff === null) return "—";
  if (diff === 0) return "0";
  const absFmt = formatKlNumber(Math.abs(diff)) || String(Math.abs(diff));
  return diff > 0 ? `+${absFmt}` : `-${absFmt}`;
}

/** (02) khác (01) — dùng tô màu ô điều chỉnh. */
export function isKlDcValueChanged(kl02, kl01) {
  const diff = computeKlDcChenhDiff(kl02, kl01);
  if (diff === null) {
    const s2 = String(kl02 ?? "").trim();
    const s1 = String(kl01 ?? "").trim();
    return s2 !== s1 && Boolean(s2 || s1);
  }
  return diff !== 0;
}

export function getKlDcChenhDisplayClass(diff) {
  if (diff === null) return "text-slate-500";
  if (diff > 0) return "text-emerald-700 font-bold";
  if (diff < 0) return "text-red-700 font-bold";
  return "text-slate-500 font-medium";
}

export function getKlDc02InputClass(changed, readOnly = false) {
  const base =
    "w-full rounded px-1.5 py-1 text-center text-sm font-semibold outline-none disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed";
  if (readOnly) return `${base} border border-gray-300 bg-gray-100 text-gray-600`;
  if (changed) {
    return `${base} border-2 border-amber-500 bg-amber-50 text-amber-950 shadow-sm focus:border-amber-600 focus:bg-white ring-1 ring-amber-200/80`;
  }
  return `${base} border border-emerald-300 bg-emerald-50 text-emerald-900 focus:border-emerald-500 focus:bg-white`;
}

export function getKlDcManual(duLieuBangTinh) {
  return duLieuBangTinh?.kl_dc_manual && typeof duLieuBangTinh.kl_dc_manual === "object"
    ? { ...duLieuBangTinh.kl_dc_manual }
    : {};
}

/** VI. Thời gian thực hiện — 4 hàng trong bảng KL (đơn vị: ngày). */
export const NVKS_THOI_GIAN_FIELDS = [
  { field: "thoi_gian_ks_lap_pa", stt: "1", noi_dung: "Lập PAKTKS" },
  { field: "thoi_gian_ks_lap_bcks", stt: "2", noi_dung: "Khảo sát hiện trường" },
  { field: "thoi_gian_hoan_thien_ho_so", stt: "3", noi_dung: "Công tác nội nghiệp" },
  { field: "thoi_gian_thuc_hien_tong", stt: "4", noi_dung: "Phê duyệt kết quả" },
];

export function isNvksThoiGianField(field) {
  return NVKS_THOI_GIAN_FIELDS.some((r) => r.field === field);
}

/** Re-export — Form NVKS / Word dùng chung. */
export {
  NVKS_BAO_CAO_CV_ID,
  NVKS_BAO_CAO_SECTION_TITLE,
  NVKS_V_BAO_CAO_ID,
  NVKS_V_BAO_CAO_KL_DEFAULT,
  NVKS_V_BAO_CAO_DVT,
  NVKS_V_BAO_CAO_NOI_DUNG,
} from "./nvksBaoCaoSection";

export function isNvksTextKlRow(id) {
  return id === NVKS_V_BAO_CAO_ID;
}

/** Nhận diện dòng chi tiết mục Báo cáo khảo sát (không gồm tiêu đề mục). */
export function isNvksVBaoCaoWorkItem(item) {
  return isNvksVBaoCaoDetailRow(item);
}

/**
 * Form NVKS: sau tiêu đề «Báo cáo khảo sát» chèn «Lập hồ sơ báo cáo khảo sát» (bộ / Trọn bộ).
 * STT la mã theo thứ tự thực tế (CV_087 hoặc chèn mục mới nếu DM thiếu).
 */
export function injectNvksVBaoCaoDetailWorkItem(items) {
  const list = [...(items || [])];
  let headerIdx = findNvksBaoCaoSectionIndex(list);

  if (headerIdx < 0) {
    list.push(buildNvksVBaoCaoSectionWorkItem(list));
    headerIdx = list.length - 1;
  } else {
    list[headerIdx] = {
      ...list[headerIdx],
      id_cong_viec: NVKS_BAO_CAO_CV_ID,
      ten_cong_viec: NVKS_BAO_CAO_SECTION_TITLE,
      loai_dong: "tieu_de",
      loai_nhap_lieu: "khong_nhap",
    };
  }

  stripNvksVBaoCaoDetailRows(list, headerIdx);
  const anchor = list[headerIdx];
  list.splice(headerIdx + 1, 0, buildNvksVBaoCaoDetailWorkItem(anchor));
  renumberWorkItemsAfterBaoCaoSection(list, headerIdx);

  return list;
}

/** Gắn mục VI. Thời gian thực hiện vào ds_khoi_luong (PAKTKS). */
export function appendThoiGianThucHienDisplayRows(rows, formData = {}, options = {}) {
  const list = [...(rows || [])];
  if (list.some((r) => r?.is_header && String(r.stt || "").trim().toUpperCase() === "VI")) {
    return list;
  }

  const fields =
    Array.isArray(options.fields) && options.fields.length > 0
      ? NVKS_THOI_GIAN_FIELDS.filter((tg) => options.fields.includes(tg.field))
      : NVKS_THOI_GIAN_FIELDS;
  if (fields.length === 0) return list;

  list.push({
    stt: "VI",
    noi_dung: "THỜI GIAN THỰC HIỆN",
    cap_dh: "",
    don_vi: "",
    khoi_luong: "",
    is_header: true,
  });

  fields.forEach((tg, idx) => {
    list.push({
      id_cong_viec: tg.field,
      field: tg.field,
      stt: String(idx + 1),
      noi_dung: tg.noi_dung,
      cap_dh: "",
      don_vi: "ngày",
      khoi_luong: formData?.[tg.field] ?? "",
      is_header: false,
      is_thoi_gian: true,
    });
  });
  return list;
}

function injectVBaoCaoKhaoSatRow(rows, klDcManual = {}) {
  const vIdx = findNvksBaoCaoSectionIndex(rows);
  if (vIdx < 0) return;
  rows[vIdx] = { ...rows[vIdx], noi_dung: NVKS_BAO_CAO_SECTION_TITLE };
  stripNvksVBaoCaoDetailRows(rows, vIdx);

  const kl01 = NVKS_V_BAO_CAO_KL_DEFAULT;
  const hasManual = Object.prototype.hasOwnProperty.call(klDcManual, NVKS_V_BAO_CAO_ID);
  const kl02 = hasManual ? String(klDcManual[NVKS_V_BAO_CAO_ID]) : kl01;

  rows.splice(vIdx + 1, 0, {
    id_cong_viec: NVKS_V_BAO_CAO_ID,
    stt: "",
    noi_dung: NVKS_V_BAO_CAO_NOI_DUNG,
    cap_dh: "",
    don_vi: NVKS_V_BAO_CAO_DVT,
    kl_01: kl01,
    kl_02: kl02,
    chenh_lech: "—",
    is_header: false,
    is_text_kl: true,
  });
}

/** Chuẩn hóa mục Báo cáo khảo sát cho export Word/PDF (ds_khoi_luong). */
export function injectNvksVBaoCaoExportRow(rows) {
  const out = [...(rows || [])];
  let headerIdx = findNvksBaoCaoSectionIndex(out);
  if (headerIdx < 0) {
    out.push({
      id_cong_viec: NVKS_BAO_CAO_CV_ID,
      stt: computeNextMainRomanFromExportRows(out),
      noi_dung: NVKS_BAO_CAO_SECTION_TITLE,
      cap_dh: "",
      don_vi: "",
      khoi_luong: "",
      is_header: true,
    });
    headerIdx = out.length - 1;
  } else {
    out[headerIdx] = { ...out[headerIdx], noi_dung: NVKS_BAO_CAO_SECTION_TITLE };
  }

  stripNvksVBaoCaoDetailRows(out, headerIdx);

  let stt = "1";
  for (let j = headerIdx + 1; j < out.length; j++) {
    if (out[j].is_header) break;
    const raw = String(out[j].stt || "").trim();
    if (raw && !raw.includes(".")) stt = raw;
  }

  out.splice(headerIdx + 1, 0, buildNvksVBaoCaoDetailExportRow(stt));
  return out;
}

function formatThoiGianKl(value) {
  if (value === "" || value == null) return "";
  const n = parseKlNumber(value);
  if (n > 0) return formatKlNumber(n);
  const s = String(value).trim();
  return s || "";
}

function pickDcThoiGianValue(dcThoiGian, field) {
  if (!dcThoiGian || typeof dcThoiGian !== "object") return "";
  const v = dcThoiGian[field];
  return v === undefined || v === null ? "" : String(v);
}

function appendNvksThoiGianDcRows(rows, gocRecord, dcThoiGian = {}) {
  rows.push({
    stt: "VI",
    noi_dung: "THỜI GIAN THỰC HIỆN",
    cap_dh: "",
    don_vi: "",
    kl_01: "",
    kl_02: "",
    chenh_lech: "",
    is_header: true,
  });

  for (const tg of NVKS_THOI_GIAN_FIELDS) {
    const kl01Raw = gocRecord?.[tg.field];
    const kl01 = parseKlNumber(kl01Raw);
    const gocDisplay = formatThoiGianKl(kl01Raw) || (kl01 === 0 ? "0" : "");
    const raw02 = pickDcThoiGianValue(dcThoiGian, tg.field);
    const display02 = raw02 !== "" ? raw02 : gocDisplay;

    rows.push({
      id_cong_viec: tg.field,
      is_thoi_gian: true,
      stt: tg.stt,
      noi_dung: tg.noi_dung,
      cap_dh: "",
      don_vi: "ngày",
      kl_01: gocDisplay,
      kl_02: display02,
      chenh_lech: computeKlDcChenh(display02, kl01Raw),
      is_header: false,
    });
  }

  return rows;
}

/** Bảng so sánh NVKS ĐC: (01) từ Gốc, (02) nhập tay, (03) = (02)−(01). */
export function buildNvksDcComparisonRows(
  gocRecord,
  templateData,
  project,
  klDcManual = {},
  dcThoiGian = {}
) {
  if (!gocRecord) return [];

  const gocDs = buildDsFromNvksRecord(gocRecord, templateData, project);
  const rows = [];

  for (const gocRow of gocDs) {
    if (gocRow.is_header) {
      rows.push({
        stt: gocRow.stt,
        noi_dung: gocRow.noi_dung,
        cap_dh: "",
        don_vi: "",
        kl_01: "",
        kl_02: "",
        chenh_lech: "",
        is_header: true,
      });
      continue;
    }

    const hasManual = Object.prototype.hasOwnProperty.call(klDcManual, gocRow.id_cong_viec);
    const kl02Raw = hasManual ? klDcManual[gocRow.id_cong_viec] : gocRow.khoi_luong;

    rows.push({
      id_cong_viec: gocRow.id_cong_viec,
      stt: gocRow.stt,
      noi_dung: gocRow.noi_dung,
      cap_dh: gocRow.cap_dh || "",
      don_vi: gocRow.don_vi || "",
      kl_01: formatKlCellDisplay(gocRow.khoi_luong),
      kl_02: hasManual ? String(klDcManual[gocRow.id_cong_viec]) : formatKlCellDisplay(gocRow.khoi_luong),
      chenh_lech: computeKlDcChenh(kl02Raw, gocRow.khoi_luong),
      is_header: false,
    });
  }

  injectVBaoCaoKhaoSatRow(rows, klDcManual);
  appendNvksThoiGianDcRows(rows, gocRecord, dcThoiGian);
  return rows;
}

/** NKKS — một cột KL: (02) ĐC nếu có, không thì Gốc. Chỉ giữ dòng KL > 0. */
export function buildNkksSimpleKlRows(gocRecord, latestDcRecord, templateData, project) {
  if (!gocRecord) return [];

  const quantities = syncMauNuocQuantities(gocRecord.du_lieu_bang_tinh?.quantities || {});
  const gocDs = buildDsFromNvksRecord(gocRecord, templateData, project);
  const klDcManual = getKlDcManual(latestDcRecord?.du_lieu_bang_tinh);
  const rows = [];

  for (const gocRow of gocDs) {
    if (gocRow.is_header) {
      rows.push({
        stt: gocRow.stt,
        noi_dung: gocRow.noi_dung,
        cap_dh: "",
        don_vi: "",
        khoi_luong: "",
        is_header: true,
      });
      continue;
    }

    if (isNvksVBaoCaoWorkItem(gocRow)) {
      rows.push({
        id_cong_viec: gocRow.id_cong_viec || NVKS_V_BAO_CAO_ID,
        stt: gocRow.stt,
        noi_dung: NVKS_V_BAO_CAO_NOI_DUNG,
        cap_dh: "",
        don_vi: NVKS_V_BAO_CAO_DVT,
        khoi_luong: NVKS_V_BAO_CAO_KL_DEFAULT,
        is_header: false,
      });
      continue;
    }

    const gocKl = parseKlNumber(gocRow.khoi_luong);
    const hasManual = Object.prototype.hasOwnProperty.call(klDcManual, gocRow.id_cong_viec);
    const displayKl = hasManual ? parseKlNumber(klDcManual[gocRow.id_cong_viec]) : gocKl;

    // KL ≤ 0 không đưa sang NKKS (kể cả khi ĐC còn ghi đè cũ = 0)
    if (displayKl <= 0) continue;

    rows.push({
      id_cong_viec: gocRow.id_cong_viec,
      stt: gocRow.stt,
      noi_dung: gocRow.noi_dung,
      cap_dh: gocRow.cap_dh || "",
      don_vi: gocRow.don_vi || "",
      khoi_luong: formatKlNumber(displayKl),
      is_header: false,
    });
  }

  // Cha mẫu nước = 0 → bỏ hết chỉ tiêu con (kể cả snapshot/công thức cũ còn 3)
  return pruneEmptyNkksKlSectionHeaders(filterMauNuocChiTieuWhenParentZero(rows, quantities));
}

export function countKlWorkRows(rows) {
  return (rows || []).filter((r) => !r.is_header && parseKlNumber(r.khoi_luong || r.kl_01 || r.kl_02) > 0)
    .length;
}

/** Ghi đè KL xuất Word NVKS ĐC — thêm cột (01)/(02)/(03); khoi_luong = (02) để tương thích mẫu cũ. */
export function applyKlDcManualToDsKhoiLuong(dsKhoiLuong, klDcManual = {}, gocKlById = {}) {
  return (dsKhoiLuong || [])
    .map((row) => {
      if (row.is_header || !row.id_cong_viec) {
        return {
          ...row,
          khoi_luong_01: "",
          khoi_luong_02: "",
          chenh_lech: "",
        };
      }
      if (isNvksTextKlRow(row.id_cong_viec) || isNvksVBaoCaoWorkItem(row)) {
        const hasManual = Object.prototype.hasOwnProperty.call(klDcManual, row.id_cong_viec);
        const kl01Text = row.khoi_luong || NVKS_V_BAO_CAO_KL_DEFAULT;
        const kl02Text = hasManual ? String(klDcManual[row.id_cong_viec]) : kl01Text;
        return {
          ...row,
          noi_dung: NVKS_V_BAO_CAO_NOI_DUNG,
          don_vi: NVKS_V_BAO_CAO_DVT,
          cap_dh: "",
          khoi_luong: kl02Text,
          khoi_luong_01: kl01Text,
          khoi_luong_02: kl02Text,
          chenh_lech: computeKlDcChenh(kl02Text, kl01Text),
        };
      }
      const gocRaw = gocKlById[row.id_cong_viec] ?? row.khoi_luong;
      const gocKl = parseKlNumber(gocRaw);
      const hasManual = Object.prototype.hasOwnProperty.call(klDcManual, row.id_cong_viec);
      const effective = hasManual ? parseKlNumber(klDcManual[row.id_cong_viec]) : gocKl;
      const kl01Disp = formatKlNumber(gocKl) || (gocKl === 0 ? "0" : "");
      const kl02Disp = formatKlNumber(effective) || (effective === 0 ? "0" : "");
      if (gocKl <= 0 && effective <= 0) {
        return { ...row, khoi_luong: "", khoi_luong_01: "", khoi_luong_02: "", chenh_lech: "" };
      }
      return {
        ...row,
        khoi_luong: effective > 0 ? kl02Disp : "",
        khoi_luong_01: gocKl > 0 ? kl01Disp : (gocKl === 0 ? "0" : "—"),
        khoi_luong_02: effective > 0 ? kl02Disp : (effective === 0 ? "0" : "—"),
        chenh_lech: computeKlDcChenh(effective, gocRaw),
      };
    })
    .filter((row) => {
      if (row.is_header) return true;
      if (isNvksTextKlRow(row.id_cong_viec) || isNvksVBaoCaoWorkItem(row)) {
        return Boolean(String(row.khoi_luong_02 || row.khoi_luong || "").trim());
      }
      return parseKlNumber(row.khoi_luong_01) > 0 || parseKlNumber(row.khoi_luong_02) > 0;
    });
}
