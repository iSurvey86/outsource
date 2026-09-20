/**
 * Tính KL & build ds_khoi_luong cho xuất Word NVKS/PAKTKS (logic tách từ FormNVKS).
 */
import {
  getEffectiveDonVi,
  isOptionalCapDhItem,
  shouldShowCapDhCell,
  isForceHideCapDhItem,
} from "./nvksCustomCongViec";
import {
  DEFAULT_CAP_DH,
  buildDoVeTramTyLeDongChinh,
  getDoVeTramPhamViText,
  isDoVeTramTyLeItem,
} from "./nvksDoVeTramTyLe";
import {
  MAU_NUOC_PARENT_ID,
  isMauNuocChiTieuId,
  mauNuocChildKlFromParent,
} from "./nvksLoaiHinh";
import { splitNoiDungVaGhiChu } from "./nvksWordExport";
import { dedupeCatalogRowsByContent } from "./legalCatalog";
import { DEFAULT_CNKS_NAME, DEFAULT_LANH_DAO_NAME } from "./hoSoPersonnelDefaults";
import {
  NVKS_BAO_CAO_CV_ID,
  NVKS_BAO_CAO_SECTION_TITLE,
  NVKS_V_BAO_CAO_DVT,
  NVKS_V_BAO_CAO_ID,
  NVKS_V_BAO_CAO_KL_DEFAULT,
  NVKS_V_BAO_CAO_NOI_DUNG,
  buildNvksVBaoCaoDetailExportRow,
  computeNextMainRomanFromExportRows,
  findNvksBaoCaoSectionIndex,
  isNvksBaoCaoSectionHeader,
  stripNvksVBaoCaoDetailRows,
} from "./nvksBaoCaoSection";

function normalizeNvksVBaoCaoExportRow(rows) {
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

const DUONG_CHUYEN_CAP_1_ID = "CV_008";
const DUONG_CHUYEN_CAP_2_ID = "CV_009";
const DO_VE_BD_TUYEN_ID = "CV_016a";

function isDuongChuyenCapItem(id) {
  return id === DUONG_CHUYEN_CAP_1_ID || id === DUONG_CHUYEN_CAP_2_ID;
}

function getRouteLengthKm(quantities) {
  const overhead = parseFloat(quantities["CV_005a_tong"]) || 0;
  const underground = parseFloat(quantities["CV_005b_tong"]) || 0;
  const sum = overhead + underground;
  if (sum > 0) return sum;
  return parseFloat(quantities["CV_005_tong"]) || 0;
}

function getRouteLengthMeters(quantities) {
  const routeKm = getRouteLengthKm(quantities);
  return routeKm > 0 ? routeKm * 1000 : 0;
}

function calcDoVeBdWidth(quantities, itemId, defaultWidth = 60) {
  const br = parseFloat(quantities[`${itemId}_br`]);
  return Number.isNaN(br) ? defaultWidth : br;
}

function calcDoVeBdLength(quantities, itemId, defaultLength = 80) {
  const cdRaw = quantities[`${itemId}_cd`];
  if (cdRaw !== undefined && cdRaw !== "") {
    return parseFloat(cdRaw) || 0;
  }
  return defaultLength;
}

function calcDoVeBdTotal(quantities, itemId) {
  const sl = parseFloat(quantities[`${itemId}_sl`]) || 0;
  const width = calcDoVeBdWidth(quantities, itemId, 60);
  const cdM = calcDoVeBdLength(quantities, itemId, 80);
  return parseFloat(((sl * width * cdM) / 10000).toFixed(4));
}

function calcDoVeBdTuyenTotal(quantities, itemId = DO_VE_BD_TUYEN_ID) {
  const sl = parseFloat(quantities[`${itemId}_sl`]) || 0;
  const width = calcDoVeBdWidth(quantities, itemId, 60);
  const cdRaw = quantities[`${itemId}_cd`];
  const cdM =
    cdRaw !== undefined && cdRaw !== ""
      ? parseFloat(cdRaw) || 0
      : getRouteLengthMeters(quantities);
  return parseFloat(((sl * width * cdM) / 10000).toFixed(4));
}

function formatViDecimal(value, maxFractionDigits = 2) {
  const n = parseFloat(value);
  if (Number.isNaN(n)) return "0";
  const rounded =
    maxFractionDigits === 0 || Number.isInteger(n)
      ? String(Math.round(n))
      : String(parseFloat(n.toFixed(maxFractionDigits)));
  return rounded.replace(".", ",");
}

/** Ghi chú ha đo vẽ bản đồ — mẫu 1: có đơn vị m, tránh nhầm với ha. */
function buildDoVeBdHaGhiChu(quantities, itemId, klHa, { useRouteLengthFallback = false } = {}) {
  const sl = parseFloat(quantities[`${itemId}_sl`]) || 0;
  const width = calcDoVeBdWidth(quantities, itemId, 60);
  let cdM;
  if (useRouteLengthFallback) {
    const cdRaw = quantities[`${itemId}_cd`];
    cdM =
      cdRaw !== undefined && cdRaw !== ""
        ? parseFloat(cdRaw) || 0
        : getRouteLengthMeters(quantities);
  } else {
    cdM = calcDoVeBdLength(quantities, itemId, 80);
  }
  return `Dự kiến: ${formatViDecimal(sl, 0)} vị trí × ${formatViDecimal(width, 0)} m (rộng) × ${formatViDecimal(cdM, 0)} m (chiều dài) = ${formatViDecimal(klHa)} ha`;
}

function isTieuDeItem(item) {
  return (item.loai_dong || "").trim().toLowerCase() === "tieu_de";
}

function isSubTitleItem(item) {
  return isTieuDeItem(item) && (item.tt || "").trim().includes(".");
}

function sectionScopeEnd(items, startIdx) {
  const titleIsSub = isSubTitleItem(items[startIdx]);
  for (let j = startIdx + 1; j < items.length; j++) {
    if (!isTieuDeItem(items[j])) continue;
    const nextIsSub = isSubTitleItem(items[j]);
    if (!titleIsSub && !nextIsSub) return j;
    if (titleIsSub && nextIsSub) return j;
    if (titleIsSub && !nextIsSub) return j;
  }
  return items.length;
}

function sectionHasPositiveKl(items, startIdx, positiveKlIds) {
  if (isNvksBaoCaoSectionHeader(items[startIdx])) return true;
  const end = sectionScopeEnd(items, startIdx);
  for (let j = startIdx + 1; j < end; j++) {
    if (isTieuDeItem(items[j])) {
      if (sectionHasPositiveKl(items, j, positiveKlIds)) return true;
    } else if (positiveKlIds.has(items[j].id_cong_viec)) {
      return true;
    }
  }
  return false;
}

/** Cha không nhập KL (vd. mục 2, 3 đường dây TKBVTC) — chỉ hiện khi có con KL > 0 */
function isKlGroupParentItem(item) {
  const loaiDong = (item.loai_dong || "").trim().toLowerCase();
  const loaiNhap = (item.loai_nhap_lieu || "").trim().toLowerCase();
  return loaiNhap === "khong_nhap" && loaiDong === "cong_viec";
}

function groupParentScopeEnd(items, startIdx) {
  for (let j = startIdx + 1; j < items.length; j++) {
    const loaiDong = (items[j].loai_dong || "").trim().toLowerCase();
    if (loaiDong === "tieu_de" || loaiDong === "cong_viec") return j;
  }
  return items.length;
}

function groupParentHasPositiveKl(items, startIdx, positiveKlIds) {
  const end = groupParentScopeEnd(items, startIdx);
  for (let j = startIdx + 1; j < end; j++) {
    if (positiveKlIds.has(items[j].id_cong_viec)) return true;
  }
  return false;
}

function buildPositiveKlIdSet(filteredWorkItems, quantities) {
  const evalFn = (formula) => evaluateFormula(quantities, formula);
  const set = new Set([NVKS_V_BAO_CAO_ID]);
  filteredWorkItems.forEach((item) => {
    const { kl, isTitle } = computeRowKhoiLuong(item, filteredWorkItems, quantities, evalFn);
    if (!isTitle && kl !== "" && parseFloat(kl) > 0) {
      set.add(item.id_cong_viec);
    }
  });
  return set;
}

export function evaluateFormula(quantities, formulaStr) {
  if (!formulaStr) return "";
  try {
    let parsedStr = formulaStr.toString().replace(/^'?=?/i, "").trim();

    // Tham chiếu đơn giản =CV_xxx: nếu cha trống → trả rỗng (autodel chỉ tiêu theo mẫu nước / nguyên trạng)
    const simpleRef = parsedStr.match(/^(CV_\d+[a-zA-Z]*)$/i);
    if (simpleRef) {
      const id = simpleRef[1];
      const stateKey = `${id}_tong`;
      const raw = quantities[stateKey];
      if (raw === undefined || raw === null || String(raw).trim() === "") return "";
      const val = parseFloat(raw);
      if (Number.isNaN(val)) return "";
      return Number.isInteger(val) ? val : val.toFixed(2);
    }

    parsedStr = parsedStr.replace(/INT\(([^)]+)\)/gi, "Math.floor($1)");

    parsedStr = parsedStr.replace(/CV_\d+[a-zA-Z]*(_[a-z]+)?/g, (match) => {
      let stateKey = match;
      if (
        !match.includes("_tong") &&
        !match.includes("_sau") &&
        !match.includes("_ho") &&
        !match.includes("_sl") &&
        !match.includes("_br") &&
        !match.includes("_ds") &&
        !match.includes("_cd") &&
        !match.includes("_tram") &&
        !match.includes("_duong")
      ) {
        stateKey = `${match}_tong`;
      }
      const val = parseFloat(quantities[stateKey]);
      return Number.isNaN(val) ? 0 : val;
    });
    const result = new Function("return " + parsedStr)();
    return Number.isNaN(result) ? 0 : Number.isInteger(result) ? result : result.toFixed(2);
  } catch {
    return "-";
  }
}

export function evaluateCapDh(capDhValues, capDhStr) {
  if (!capDhStr) return "";
  const str = capDhStr.toString().trim();
  if (str.startsWith("'=") || str.startsWith("=")) {
    const refId = str.replace(/^'?=?/i, "").trim();
    return capDhValues[refId] || "";
  }
  return str;
}

export function computeRowKhoiLuong(item, filteredWorkItems, quantities, evaluateFormulaFn) {
  const loaiDongCheck = (item.loai_dong || "").trim().toLowerCase();
  const isTitle = loaiDongCheck === "tieu_de";
  const isKhongNhap =
    (item.loai_nhap_lieu || "").trim().toLowerCase() === "khong_nhap" || item.id_cong_viec === "CV_012";

  let loaiNhap = (item.loai_nhap_lieu || "").trim().toLowerCase();
  if (item.id_cong_viec === "CV_012") loaiNhap = "khong_nhap";
  else if (loaiNhap === "nan" || loaiNhap === "") loaiNhap = "nhap_tay";
  else if (loaiNhap === "nhap_tay_plus") loaiNhap = "nhap_tay";
  if (isDoVeTramTyLeItem(item)) loaiNhap = "do_ve_tram_ty_le";

  // Chỉ tiêu mẫu nước: luôn = số mẫu CV_043 (không tin cong_thuc cứng "3" / quantities cũ)
  if (isMauNuocChiTieuId(item.id_cong_viec)) {
    const klMau = mauNuocChildKlFromParent(quantities[`${MAU_NUOC_PARENT_ID}_tong`]);
    return {
      kl: klMau,
      loaiNhap: "cong_thuc",
      isTitle,
      isKhongNhap,
      loaiDongCheck,
    };
  }

  let kl = quantities[`${item.id_cong_viec}_tong`] !== undefined ? quantities[`${item.id_cong_viec}_tong`] : "";

  if (loaiNhap === "cong_thuc") {
    if (isDuongChuyenCapItem(item.id_cong_viec)) {
      kl = quantities[`${item.id_cong_viec}_tong`] !== undefined ? quantities[`${item.id_cong_viec}_tong`] : "";
    } else {
      // Ép =CV_043 nếu công thức lệch (DM cũ)
      const formula =
        String(item.cong_thuc || "").replace(/^'?=?/i, "").trim().toUpperCase() === MAU_NUOC_PARENT_ID ||
        isMauNuocChiTieuId(item.id_cong_viec)
          ? `=${MAU_NUOC_PARENT_ID}`
          : item.cong_thuc;
      kl = evaluateFormulaFn(formula);
    }
  } else if (loaiNhap === "khoan") {
    kl = parseFloat(
      ((parseFloat(quantities[`${item.id_cong_viec}_sau`]) || 0) * (parseFloat(quantities[`${item.id_cong_viec}_ho`]) || 0)).toFixed(2)
    );
  } else if (loaiNhap === "mcn_trong_db") {
    kl = parseFloat(
      (
        (parseFloat(quantities[`${item.id_cong_viec}_sl`]) || 0) *
        (parseFloat(quantities[`${item.id_cong_viec}_br`]) || 0) *
        (quantities[`${item.id_cong_viec}_ds`] !== undefined ? parseFloat(quantities[`${item.id_cong_viec}_ds`]) : 5)
      ).toFixed(2)
    );
  } else if (loaiNhap === "mcn_ngoai_db") {
    kl = parseFloat(((parseFloat(quantities[`${item.id_cong_viec}_sl`]) || 0) * 20 * 5).toFixed(2));
  } else if (loaiNhap === "mcn_rtk") {
    kl = parseFloat(
      ((parseFloat(quantities[`${item.id_cong_viec}_sl`]) || 0) * (parseFloat(quantities[`${item.id_cong_viec}_br`]) || 0)).toFixed(2)
    );
  } else if (loaiNhap === "do_ve_bd_cap_ngam") {
    kl = parseFloat(((parseFloat(quantities["CV_007_tong"]) || 0) * 1000 * 30) / 10000).toFixed(4);
  } else if (loaiNhap === "do_ve_bd") {
    kl = calcDoVeBdTotal(quantities, item.id_cong_viec);
  } else if (loaiNhap === "do_ve_bd_tuyen") {
    kl = calcDoVeBdTuyenTotal(quantities, item.id_cong_viec);
  } else if (loaiNhap === "do_ve_tram") {
    kl = parseFloat(
      (
        ((parseFloat(quantities[`${item.id_cong_viec}_tram`]) || 0) + (parseFloat(quantities[`${item.id_cong_viec}_duong`]) || 0)) /
        10000
      ).toFixed(4)
    );
  } else if (item.ten_cong_viec.toLowerCase().includes("điện trở suất")) {
    let totalHo = 0;
    filteredWorkItems.forEach((i) => {
      if ((i.loai_nhap_lieu || "").trim().toLowerCase() === "khoan") {
        totalHo += parseFloat(quantities[`${i.id_cong_viec}_ho`]) || 0;
      }
    });
    kl = totalHo;
  }

  if (isTitle || isKhongNhap) kl = "";

  return { kl, loaiNhap, isTitle, isKhongNhap, loaiDongCheck };
}

/** Build mảng ds_khoi_luong — chỉ hàng KL > 0 (và tiêu đề section có con) */
export function buildDsKhoiLuong({
  filteredWorkItems,
  quantities,
  capDhValues = {},
  donViOverrides = {},
}) {
  const evalFn = (formula) => evaluateFormula(quantities, formula);
  const positiveKlIds = buildPositiveKlIdSet(filteredWorkItems, quantities);
  const ds_khoi_luong = [];
  let mainCounter = 0;
  let subCounter = 0;

  filteredWorkItems.forEach((item, idx) => {
    const { kl, loaiNhap, isTitle, isKhongNhap, loaiDongCheck } = computeRowKhoiLuong(
      item,
      filteredWorkItems,
      quantities,
      evalFn
    );
    const isCongViecCon = loaiDongCheck === "cong_viec_con";
    const isGroupParent = isKlGroupParentItem(item);

    if (isTitle && !sectionHasPositiveKl(filteredWorkItems, idx, positiveKlIds)) return;
    if (isGroupParent && !groupParentHasPositiveKl(filteredWorkItems, idx, positiveKlIds)) return;
    if (!isTitle && !isGroupParent && (kl === "" || parseFloat(kl) <= 0)) return;

    let newSTT = "";
    if (isTitle) {
      mainCounter = 0;
      subCounter = 0;
      newSTT = item.dynamicTT;
    } else if (isGroupParent) {
      const ttRaw = (item.tt || "").trim();
      const ttNum = parseInt(ttRaw, 10);
      mainCounter = !Number.isNaN(ttNum) ? ttNum : mainCounter + 1;
      subCounter = 0;
      newSTT = ttRaw || mainCounter.toString();
    } else if (isCongViecCon) {
      subCounter++;
      const ttRaw = (item.tt || "").trim();
      newSTT = /^\d+\.\d+/.test(ttRaw) ? ttRaw : `${mainCounter}.${subCounter}`;
    } else {
      mainCounter++;
      subCounter = 0;
      newSTT = mainCounter.toString();
    }

    let capDhIn = evaluateCapDh(capDhValues, item.cap_dh);
    const capRaw = (item.cap_dh ?? "").toString().trim();
    const isCapDhFormula = capRaw.startsWith("=") || capRaw.startsWith("'=");
    if (isDoVeTramTyLeItem(item)) {
      capDhIn = capDhValues[item.id_cong_viec] || DEFAULT_CAP_DH;
    } else if (isOptionalCapDhItem(item)) {
      capDhIn = capDhValues[item.id_cong_viec] || "";
    } else if (!isCapDhFormula) {
      // Cấp ĐH cố định dạng I–V: ưu tiên giá trị user chọn trên form
      capDhIn = capDhValues[item.id_cong_viec] || capRaw || DEFAULT_CAP_DH;
    }
    const isForceHideCapDh = isForceHideCapDhItem(item);
    if (isForceHideCapDh || isKhongNhap || isTitle || isGroupParent) capDhIn = "";
    else if (!shouldShowCapDhCell(item, isTitle, isKhongNhap)) capDhIn = "";

    let currentNoiDung = item.ten_cong_viec;
    let ghiChu = "";
    if (isNvksBaoCaoSectionHeader(item)) {
      currentNoiDung = NVKS_BAO_CAO_SECTION_TITLE;
    } else if (loaiNhap === "khoan") {
      let sauVal = quantities[`${item.id_cong_viec}_sau`] || "___";
      let hoVal = quantities[`${item.id_cong_viec}_ho`] || "___";
      sauVal = sauVal.toString().replace(".", ",");
      hoVal = hoVal.toString().replace(".", ",");
      currentNoiDung = `Khoan thủ công thăm dò địa chất ở trên cạn, chiều sâu hố khoan đến ${sauVal} m/hố, (${hoVal} hố) dự kiến:`;
    } else if (loaiNhap === "do_ve_bd") {
      const klNum = calcDoVeBdTotal(quantities, item.id_cong_viec);
      ghiChu = buildDoVeBdHaGhiChu(quantities, item.id_cong_viec, klNum);
    } else if (loaiNhap === "do_ve_bd_tuyen") {
      const klNum = calcDoVeBdTuyenTotal(quantities, item.id_cong_viec);
      ghiChu = buildDoVeBdHaGhiChu(quantities, item.id_cong_viec, klNum, { useRouteLengthFallback: true });
    } else if (loaiNhap === "do_ve_tram_ty_le") {
      currentNoiDung = buildDoVeTramTyLeDongChinh(item, quantities);
      ghiChu = getDoVeTramPhamViText(item);
    }

    if (!ghiChu) {
      const split = splitNoiDungVaGhiChu(currentNoiDung);
      currentNoiDung = split.noi_dung;
      ghiChu = split.ghi_chu;
    } else {
      currentNoiDung = currentNoiDung.replace(/\n[\s\S]*$/, "").trim() || currentNoiDung;
    }

    let klOut = kl;
    if (klOut !== "" && !Number.isNaN(klOut)) {
      klOut = klOut.toString().replace(".", ",");
    }

    ds_khoi_luong.push({
      id_cong_viec: item.id_cong_viec,
      stt: newSTT,
      noi_dung: currentNoiDung,
      ...(ghiChu ? { ghi_chu: ghiChu } : {}),
      cap_dh: capDhIn,
      don_vi: !isKhongNhap && !isTitle && !isGroupParent ? getEffectiveDonVi(item, donViOverrides) : "",
      khoi_luong: klOut,
      is_header: isTitle,
    });
  });

  return normalizeNvksVBaoCaoExportRow(ds_khoi_luong);
}

export function countPositiveKlRows(dsKhoiLuong) {
  return (dsKhoiLuong || []).filter((r) => !r.is_header && r.khoi_luong && parseFloat(String(r.khoi_luong).replace(",", ".")) > 0).length;
}

export function formatThoiDiemLapWord(dateStr) {
  if (!dateStr) return "tháng ..... năm 20...";
  const parts = String(dateStr).slice(0, 10).split("-");
  if (parts.length === 3) return `tháng ${parts[1]} năm ${parts[0]}`;
  return "tháng ..... năm 20...";
}

export function mapGiaiDoanInHoa(giaiDoan) {
  let g = giaiDoan || "";
  if (g === "BCNCKT") return "BÁO CÁO NGHIÊN CỨU KHẢ THI";
  if (g === "BCKTKT") return "BÁO CÁO KINH TẾ KỸ THUẬT";
  if (g === "TKBVTC" || g === "TKKT-TKBVTC") return "THIẾT KẾ BẢN VẼ THI CÔNG";
  return g;
}

/** docData scalar + lists cho Docxtemplater (NVKS & PAKTKS dùng chung) */
export function buildSurveyDocData(formData, ds_khoi_luong, { csplData = [], tcData = [], isDieuChinh = false } = {}) {
  const uniqueCspl = dedupeCatalogRowsByContent(csplData, "cspl");
  const uniqueTc = dedupeCatalogRowsByContent(tcData, "tc");

  const danh_sach_phap_ly = [];
  if (uniqueCspl?.length) {
    uniqueCspl.forEach((item) => {
      danh_sach_phap_ly.push({ noi_dung: `${item.ten_cspl.trim()};` });
    });
  }
  if (formData.quyet_dinh_giao_a) {
    danh_sach_phap_ly.push({ noi_dung: `${formData.quyet_dinh_giao_a.trim()};` });
  }
  danh_sach_phap_ly.push({ noi_dung: "Các quy trình, quy phạm hiện hành." });

  const danh_sach_quy_mo = [];
  if (formData.quy_mo) {
    formData.quy_mo.split("\n").forEach((line) => {
      if (line.trim()) danh_sach_quy_mo.push({ noi_dung: line.trim() });
    });
  }

  const ds_tieu_chuan = (uniqueTc || []).map((tc, idx) => ({
    stt: idx + 1,
    ky_hieu: tc.ky_hieu,
    ten_tai_lieu: tc.ten_tai_lieu,
  }));

  return {
    ma_du_an: formData.ma_du_an || "...",
    giai_doan: formData.giai_doan,
    giai_doan_in_hoa: mapGiaiDoanInHoa(formData.giai_doan),
    ten_du_an: formData.ten_du_an,
    ten_du_an_viet_thuong: (formData.ten_du_an || "").toLowerCase(),
    ten_du_an_bia: (formData.ten_du_an || "").replace(/,\s*(tỉnh|thành phố|tp\.)/gi, ",\n$1"),
    chu_nhiem_ks: formData.chu_nhiem_ks || DEFAULT_CNKS_NAME,
    nguoi_lap: formData.nguoi_lap,
    lanh_dao_duyet: formData.lanh_dao_duyet || DEFAULT_LANH_DAO_NAME,
    /** Không ghi chữ ký vào Word — stamp ảnh trên PDF lúc trình ký */
    ky_chinh: "",
    ky_nhay: "",
    thoi_diem_lap: formatThoiDiemLapWord(formData.thoi_diem_lap),
    thoi_gian_ks_lap_pa: formData.thoi_gian_ks_lap_pa || "...",
    thoi_gian_ks_lap_bcks: formData.thoi_gian_ks_lap_bcks || "...",
    thoi_gian_hoan_thien_ho_so: formData.thoi_gian_hoan_thien_ho_so || "...",
    thoi_gian_thuc_hien_tong: formData.thoi_gian_thuc_hien_tong || "...",
    is_dieu_chinh: Boolean(isDieuChinh),
    tieu_de_phu: isDieuChinh ? "ĐIỀU CHỈNH" : "",
    danh_sach_phap_ly,
    danh_sach_quy_mo,
    ds_tieu_chuan,
    ds_khoi_luong,
  };
}
