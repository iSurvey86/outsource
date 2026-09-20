/**
 * Mục «Báo cáo khảo sát» — tiêu đề section + dòng «Lập hồ sơ báo cáo khảo sát» (KL Trọn bộ).
 * STT la mã theo thứ tự thực tế (III trên TKBVTC, V trên FS…) — không gắn cứng V.
 */

export const NVKS_BAO_CAO_CV_ID = "CV_087";
export const NVKS_BAO_CAO_SECTION_TITLE = "Báo cáo khảo sát";
export const NVKS_V_BAO_CAO_ID = "__V_BAO_CAO_KS__";
export const NVKS_V_BAO_CAO_NOI_DUNG = "Lập hồ sơ báo cáo khảo sát";
export const NVKS_V_BAO_CAO_KL_DEFAULT = "Trọn bộ";
export const NVKS_V_BAO_CAO_DVT = "bộ";

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

function toRoman(num) {
  return ROMAN[num] || String(num);
}

function isMainSectionTitle(item) {
  const loai = String(item?.loai_dong || "").trim().toLowerCase();
  if (loai !== "tieu_de") return false;
  return !(item?.tt || "").trim().includes(".");
}

function isExportHeader(row) {
  return Boolean(row?.is_header);
}

/** Tiêu đề mục Báo cáo khảo sát (CV_087 hoặc tên tương đương). */
export function isNvksBaoCaoSectionHeader(item) {
  if (!item) return false;
  if (item.id_cong_viec === NVKS_BAO_CAO_CV_ID) {
    if (isExportHeader(item)) return true;
    return String(item.loai_dong || "").trim().toLowerCase() === "tieu_de";
  }
  const loai = String(item.loai_dong || "").trim().toLowerCase();
  if (loai !== "tieu_de" && !isExportHeader(item)) return false;
  const t = String(item.ten_cong_viec || item.noi_dung || "").trim().toLowerCase();
  return (
    t === "báo cáo khảo sát" ||
    t === "lập báo cáo khảo sát" ||
    t.includes("báo cáo khảo sát")
  );
}

/** Dòng chi tiết con (không gồm tiêu đề mục). */
export function matchesNvksVBaoCaoDetailNoiDung(noiDung) {
  const s = String(noiDung || "").toLowerCase();
  return (
    s.includes("lập hồ sơ báo cáo") ||
    s.includes("lập báo cáo khảo sát") ||
    s.includes("lap ho so bao cao") ||
    s.includes("lap bao cao khao sat")
  );
}

export function isNvksVBaoCaoDetailRow(itemOrRow) {
  if (!itemOrRow) return false;
  if (itemOrRow.id_cong_viec === NVKS_V_BAO_CAO_ID) return true;
  const loai = String(itemOrRow.loai_dong || "").trim().toLowerCase();
  if (loai === "tieu_de" || itemOrRow.is_header) return false;
  return matchesNvksVBaoCaoDetailNoiDung(itemOrRow.ten_cong_viec || itemOrRow.noi_dung);
}

export function findNvksBaoCaoSectionIndex(items) {
  return (items || []).findIndex(isNvksBaoCaoSectionHeader);
}

export function computeNextMainRomanFromWorkItems(items) {
  let count = 0;
  (items || []).forEach((item) => {
    if (isMainSectionTitle(item)) count += 1;
  });
  return toRoman(count + 1);
}

export function computeNextMainRomanFromExportRows(rows) {
  let count = 0;
  (rows || []).forEach((row) => {
    if (!row?.is_header) return;
    const stt = String(row.stt || "").trim();
    if (stt && !stt.includes(".")) count += 1;
  });
  return toRoman(count + 1);
}

/** Xóa các dòng chi tiết báo cáo ngay sau tiêu đề mục (đến mục la mã kế). */
export function stripNvksVBaoCaoDetailRows(list, headerIdx) {
  let i = headerIdx + 1;
  while (i < list.length) {
    const row = list[i];
    const isNextHeader =
      String(row?.loai_dong || "").trim().toLowerCase() === "tieu_de" ||
      (row?.is_header && i > headerIdx);
    if (isNextHeader) break;
    if (isNvksVBaoCaoDetailRow(row)) {
      list.splice(i, 1);
    } else {
      i += 1;
    }
  }
}

export function buildNvksVBaoCaoDetailWorkItem(anchor = {}) {
  return {
    id_cong_viec: NVKS_V_BAO_CAO_ID,
    ten_cong_viec: NVKS_V_BAO_CAO_NOI_DUNG,
    loai_dong: "cong_viec",
    loai_nhap_lieu: "khong_nhap",
    don_vi: NVKS_V_BAO_CAO_DVT,
    don_vi_tinh: NVKS_V_BAO_CAO_DVT,
    cap_dh: "",
    tt: "1",
    dynamicTT: "1",
    giai_doan: anchor?.giai_doan,
    loai_hinh: anchor?.loai_hinh,
    is_v_bao_cao: true,
  };
}

export function buildNvksVBaoCaoSectionWorkItem(items) {
  const roman = computeNextMainRomanFromWorkItems(items);
  return {
    id_cong_viec: NVKS_BAO_CAO_CV_ID,
    ten_cong_viec: NVKS_BAO_CAO_SECTION_TITLE,
    loai_dong: "tieu_de",
    loai_nhap_lieu: "khong_nhap",
    don_vi: "",
    cap_dh: "",
    tt: roman,
    dynamicTT: roman,
  };
}

export function buildNvksVBaoCaoDetailExportRow(stt = "1") {
  return {
    id_cong_viec: NVKS_V_BAO_CAO_ID,
    stt,
    noi_dung: NVKS_V_BAO_CAO_NOI_DUNG,
    cap_dh: "",
    don_vi: NVKS_V_BAO_CAO_DVT,
    khoi_luong: NVKS_V_BAO_CAO_KL_DEFAULT,
    is_header: false,
  };
}

export function renumberWorkItemsAfterBaoCaoSection(list, headerIdx) {
  let n = 1;
  for (let j = headerIdx + 1; j < list.length; j++) {
    const loai = String(list[j].loai_dong || "").trim().toLowerCase();
    if (loai === "tieu_de") break;
    if (loai === "cong_viec_con") continue;
    list[j] = { ...list[j], dynamicTT: String(n), tt: String(n) };
    n += 1;
  }
}
