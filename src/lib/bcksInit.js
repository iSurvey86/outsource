/**
 * Init / patch FormBCKS (sườn — chưa lưu Supabase).
 */

import {
  BCKS_DIA_CHAT_DATA_KEYS,
  createEmptyBcksChiTiet,
  createEmptyDiaChatDetail,
  emptyCoLyDatRow,
  emptyCoLyDat2SampleRow,
  emptyCoLyDat2AvgRow,
  emptyCoLyDat2DefaultRows,
  emptyDoDtsRow,
  emptyBaoCaoDtsRow,
  emptyBaoCaoDtsDefaultRows,
  emptyTnDaRow,
  emptyTnDaDefaultRows,
  computeDoDtsRow,
  emptyDoDtsPhanTichRow,
  emptyDoDtsPhanTichDefaultRows,
  computeDoDtsPhanTichRows,
  normalizeBaoCaoDtsLayers,
  BAO_CAO_DTS_DEFAULT_LOP,
} from "./bcksFormRegistry";
import { normalizeBcksReport } from "./bcksReportSchema";

export { computeDoDtsRow, computeDoDtsPhanTichRows } from "./bcksFormRegistry";

/** Dòng trống / sườn cũ (< 10 dòng, chưa có HK+U) → seed mẫu 10 dòng */
export function needsCoLyDat2DefaultSeed(rows) {
  const list = (rows || []).filter((r) => r?.type !== "lop");
  if (list.length === 0) return true;
  const hasSeededPattern = list.some((r) => {
    const hk = String(r.ho_khoan || "").trim().toUpperCase();
    const mau = String(r.so_hieu_mau || "").trim().toUpperCase();
    return /^HK\d+$/.test(hk) && /^U\d+$/.test(mau);
  });
  if (hasSeededPattern) return false;
  // Chưa có cặp HK/U — nếu chưa nhập chỉ tiêu gì thì seed lại mẫu
  const hasAnyValue = list.some((r) =>
    Boolean(
      String(r.ho_khoan || "").trim() ||
        String(r.so_hieu_mau || "").trim() ||
        String(r.lop || "").trim() ||
        String(r.do_sau_tu || "").trim() ||
        String(r.do_sau_den || "").trim() ||
        String(r.w || "").trim() ||
        String(r.phan_loai || "").trim()
    )
  );
  return !hasAnyValue;
}

/** Gắn mẫu 10 dòng HK×U nếu đang trống / sườn cũ */
export function ensureCoLyDat2DefaultRows(formData) {
  const rows = formData?.chi_tiet_bcks?.dia_chat?.co_ly_dat_2?.rows;
  if (!needsCoLyDat2DefaultSeed(rows)) return formData;
  const next = structuredClone(formData);
  if (!next.chi_tiet_bcks?.dia_chat?.co_ly_dat_2) return formData;
  next.chi_tiet_bcks.dia_chat.co_ly_dat_2.rows = emptyCoLyDat2DefaultRows();
  return next;
}

/** TN đá: sườn trống / < 6 dòng chưa nhập → seed 6 dòng */
export function needsTnDaDefaultSeed(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return true;
  if (rows.length >= 6) return false;
  return rows.every((row) => {
    if (!row || typeof row !== "object") return true;
    return Object.values(row).every((v) => v === null || v === undefined || String(v).trim() === "");
  });
}

export function ensureTnDaDefaultRows(formData) {
  const rows = formData?.chi_tiet_bcks?.dia_chat?.tn_da?.rows;
  if (!needsTnDaDefaultSeed(rows)) return formData;
  const next = structuredClone(formData);
  if (!next.chi_tiet_bcks?.dia_chat?.tn_da) return formData;
  next.chi_tiet_bcks.dia_chat.tn_da.rows = emptyTnDaDefaultRows();
  return next;
}

/** Tính lại k, ρₖ, độ sâu cho mọi dòng Đo ĐTS (draft cũ / seed mặc định) */
export function ensureDoDtsComputedRows(formData) {
  const rows = formData?.chi_tiet_bcks?.dia_chat?.do_dts?.rows;
  if (!Array.isArray(rows) || rows.length === 0) return formData;
  const next = structuredClone(formData);
  next.chi_tiet_bcks.dia_chat.do_dts.rows = rows.map((row) => computeDoDtsRow(row || {}));
  return next;
}

/**
 * Báo cáo DTS: draft/DB cũ có thể thiếu khối `bao_cao_dts` hoặc `rows` không phải mảng
 * → nút thêm dòng / tăng lớp no-op. Đảm bảo khối + seed 5 vị trí khi trống.
 */
export function ensureBaoCaoDtsBlock(formData) {
  if (!formData?.chi_tiet_bcks) return formData;
  const existing = formData.chi_tiet_bcks?.dia_chat?.bao_cao_dts;
  const needsCreate = !existing || typeof existing !== "object";
  const rowsOk = Array.isArray(existing?.rows) && existing.rows.length > 0;
  const soLopOk = Number(existing?.so_lop) >= 1;
  if (!needsCreate && rowsOk && soLopOk) {
    // vẫn chuẩn hóa layers theo so_lop (an toàn, rẻ)
    const soLop = Number(existing.so_lop) || BAO_CAO_DTS_DEFAULT_LOP;
    const needsNorm = existing.rows.some(
      (r) => !Array.isArray(r?.layers) || r.layers.length !== soLop
    );
    if (!needsNorm) return formData;
  }

  const next = structuredClone(formData);
  if (!next.chi_tiet_bcks.dia_chat) next.chi_tiet_bcks.dia_chat = {};
  if (!next.chi_tiet_bcks.dia_chat.bao_cao_dts || typeof next.chi_tiet_bcks.dia_chat.bao_cao_dts !== "object") {
    next.chi_tiet_bcks.dia_chat.bao_cao_dts = createEmptyDiaChatDetail("bao_cao_dts");
  }
  const block = next.chi_tiet_bcks.dia_chat.bao_cao_dts;
  const soLop = Math.max(1, Number(block.so_lop) || BAO_CAO_DTS_DEFAULT_LOP);
  block.so_lop = soLop;
  if (!Array.isArray(block.rows) || !block.rows.length) {
    block.rows = emptyBaoCaoDtsDefaultRows(soLop);
  } else {
    block.rows = block.rows.map((row) => ({
      vi_tri: row?.vi_tri ?? "",
      mo_ta: row?.mo_ta ?? "",
      layers: normalizeBaoCaoDtsLayers(row?.layers, soLop),
    }));
  }
  if (!block.ten_du_an) block.ten_du_an = next.ten_du_an || "";
  if (!block.giai_doan) block.giai_doan = next.giai_doan || "";
  return next;
}

export function buildInitialBcksForm(project, nvksRecord) {
  const chi = createEmptyBcksChiTiet();
  const ten = project?.ten_du_an || nvksRecord?.ten_du_an || "";
  const giaiDoan = project?.giai_doan || nvksRecord?.giai_doan || "";
  const cdt = project?.chu_dau_tu || nvksRecord?.chu_dau_tu || "";
  const diaDiem = project?.dia_diem || nvksRecord?.dia_diem || "";

  chi.dia_chat.co_ly_dat.cong_trinh = ten;
  chi.dia_chat.co_ly_dat.don_vi_yeu_cau = "Công ty Tư vấn điện miền Bắc";

  chi.dia_chat.tn_nuoc.cong_trinh = ten;
  chi.dia_chat.tn_nuoc.don_vi_yeu_cau =
    chi.dia_chat.tn_nuoc.don_vi_yeu_cau || "Xí nghiệp Tư vấn - Công ty Dịch vụ Điện lực miền Bắc";

  chi.dia_chat.co_ly_dat_2.du_an = ten;
  chi.dia_chat.co_ly_dat_2.giai_doan = giaiDoan;

  chi.dia_chat.tn_da.du_an = ten;
  chi.dia_chat.tn_da.don_vi_yeu_cau =
    chi.dia_chat.tn_da.don_vi_yeu_cau || "Xí nghiệp Tư vấn - Công ty Dịch vụ Điện lực miền Bắc";

  chi.dia_chat.do_dts.ten_du_an = ten;
  chi.dia_chat.do_dts.giai_doan = giaiDoan;

  chi.dia_chat.bao_cao_dts.ten_du_an = ten;
  chi.dia_chat.bao_cao_dts.giai_doan = giaiDoan;

  return {
    ma_du_an: project?.ma_du_an || nvksRecord?.ma_du_an || "",
    ten_du_an: ten,
    giai_doan: giaiDoan,
    chu_dau_tu: cdt,
    dia_diem: diaDiem,
    trang_thai_bcks: "dang_lap",
    chi_tiet_bcks: chi,
  };
}

export function mergeSavedBcksIntoForm(saved, project, nvksRecord) {
  const base = buildInitialBcksForm(project, nvksRecord);
  if (!saved?.chi_tiet_bcks) return base;

  const mergedChi = createEmptyBcksChiTiet();
  const src = saved.chi_tiet_bcks;

  for (const k of BCKS_DIA_CHAT_DATA_KEYS) {
    mergedChi.dia_chat[k] = {
      ...createEmptyDiaChatDetail(k),
      ...(src.dia_chat?.[k] || {}),
    };
  }
  mergedChi.bcks = normalizeBcksReport({ ...mergedChi.bcks, ...(src.bcks || {}) });

  if (needsCoLyDat2DefaultSeed(mergedChi.dia_chat.co_ly_dat_2?.rows)) {
    mergedChi.dia_chat.co_ly_dat_2.rows = emptyCoLyDat2DefaultRows();
  }
  if (needsTnDaDefaultSeed(mergedChi.dia_chat.tn_da?.rows)) {
    mergedChi.dia_chat.tn_da.rows = emptyTnDaDefaultRows();
  }
  if (Array.isArray(mergedChi.dia_chat.do_dts?.rows)) {
    mergedChi.dia_chat.do_dts.rows = mergedChi.dia_chat.do_dts.rows.map((row) =>
      computeDoDtsRow(row || {})
    );
  }
  if (!Array.isArray(mergedChi.dia_chat.do_dts?.phan_tich) || !mergedChi.dia_chat.do_dts.phan_tich.length) {
    if (mergedChi.dia_chat.do_dts) {
      mergedChi.dia_chat.do_dts.phan_tich = emptyDoDtsPhanTichDefaultRows();
    }
  } else {
    mergedChi.dia_chat.do_dts.phan_tich = computeDoDtsPhanTichRows(mergedChi.dia_chat.do_dts.phan_tich);
  }

  if (mergedChi.dia_chat.bao_cao_dts) {
    const soLop =
      Number(mergedChi.dia_chat.bao_cao_dts.so_lop) || BAO_CAO_DTS_DEFAULT_LOP;
    mergedChi.dia_chat.bao_cao_dts.so_lop = soLop;
    const rows = mergedChi.dia_chat.bao_cao_dts.rows;
    if (!Array.isArray(rows) || !rows.length) {
      mergedChi.dia_chat.bao_cao_dts.rows = emptyBaoCaoDtsDefaultRows(soLop);
    } else {
      mergedChi.dia_chat.bao_cao_dts.rows = rows.map((row) => ({
        vi_tri: row?.vi_tri ?? "",
        mo_ta: row?.mo_ta ?? "",
        layers: normalizeBaoCaoDtsLayers(row?.layers, soLop),
      }));
    }
  }

  return {
    ...base,
    ...saved,
    ma_du_an: saved.ma_du_an || base.ma_du_an,
    ten_du_an: saved.ten_du_an || base.ten_du_an,
    chi_tiet_bcks: mergedChi,
  };
}

export function draftStorageKey(maDuAn) {
  return `npsc_bcks_draft_v2_${String(maDuAn || "").trim()}`;
}

export function loadBcksDraft(maDuAn) {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(draftStorageKey(maDuAn));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveBcksDraft(formData) {
  if (typeof window === "undefined") return;
  const ma = formData?.ma_du_an;
  if (!ma) return;
  localStorage.setItem(draftStorageKey(ma), JSON.stringify(formData));
}

export function patchDiaChatField(formData, formKey, field, value) {
  const next = structuredClone(formData);
  const block = next.chi_tiet_bcks.dia_chat[formKey];
  if (!block) return formData;
  block[field] = value;
  return next;
}

export function patchDiaChatTableRow(formData, formKey, tableKey, rowIndex, field, value) {
  const next = structuredClone(formData);
  const block = next.chi_tiet_bcks.dia_chat[formKey];
  if (!block || !Array.isArray(block[tableKey])) return formData;
  const row = { ...block[tableKey][rowIndex], [field]: value };
  if (formKey === "do_dts" && tableKey === "rows") {
    block[tableKey][rowIndex] = computeDoDtsRow(row);
  } else if (formKey === "do_dts" && tableKey === "phan_tich") {
    block[tableKey][rowIndex] = row;
    block[tableKey] = computeDoDtsPhanTichRows(block[tableKey]);
  } else {
    block[tableKey][rowIndex] = row;
  }
  return next;
}

export function addDiaChatTableRow(formData, formKey, tableKey, kind = "mau") {
  let base = formData;
  if (formKey === "bao_cao_dts") {
    base = ensureBaoCaoDtsBlock(formData);
  }
  const next = structuredClone(base);
  if (!next.chi_tiet_bcks?.dia_chat) return formData;
  let block = next.chi_tiet_bcks.dia_chat[formKey];
  if (!block || !Array.isArray(block[tableKey])) return formData;
  let empty;
  if (formKey === "co_ly_dat") empty = emptyCoLyDatRow();
  else if (formKey === "co_ly_dat_2") {
    if (kind === "trung_binh") empty = emptyCoLyDat2AvgRow();
    else empty = emptyCoLyDat2SampleRow();
  } else if (formKey === "tn_da") empty = emptyTnDaRow();
  else if (formKey === "do_dts") {
    empty = tableKey === "phan_tich" ? emptyDoDtsPhanTichRow() : emptyDoDtsRow();
  } else if (formKey === "bao_cao_dts") {
    empty = emptyBaoCaoDtsRow(block.so_lop || BAO_CAO_DTS_DEFAULT_LOP);
  } else if (formKey === "tn_nuoc") {
    empty = { chi_tieu: "", yeu_cau: "", ket_qua: "", phuong_phap: "" };
  } else empty = {};
  block[tableKey].push(empty);
  return next;
}

export function removeDiaChatTableRow(formData, formKey, tableKey, rowIndex) {
  const next = structuredClone(formData);
  const block = next.chi_tiet_bcks.dia_chat[formKey];
  if (!block || !Array.isArray(block[tableKey])) return formData;
  if (block[tableKey].length <= 1) return formData;
  block[tableKey].splice(rowIndex, 1);
  return next;
}

export function patchBaoCaoDtsLayer(formData, rowIndex, layerIndex, field, value) {
  const next = structuredClone(ensureBaoCaoDtsBlock(formData));
  const block = next.chi_tiet_bcks?.dia_chat?.bao_cao_dts;
  if (!block?.rows?.[rowIndex]) return formData;
  const soLop = block.so_lop || BAO_CAO_DTS_DEFAULT_LOP;
  const row = { ...block.rows[rowIndex] };
  row.layers = normalizeBaoCaoDtsLayers(row.layers, soLop);
  if (!row.layers[layerIndex]) return formData;
  row.layers[layerIndex] = { ...row.layers[layerIndex], [field]: value };
  block.rows[rowIndex] = row;
  return next;
}

export function setBaoCaoDtsSoLop(formData, soLop) {
  const next = structuredClone(ensureBaoCaoDtsBlock(formData));
  const block = next.chi_tiet_bcks?.dia_chat?.bao_cao_dts;
  if (!block) return formData;
  const n = Math.min(12, Math.max(1, Number(soLop) || BAO_CAO_DTS_DEFAULT_LOP));
  block.so_lop = n;
  if (!Array.isArray(block.rows) || !block.rows.length) {
    block.rows = emptyBaoCaoDtsDefaultRows(n);
  } else {
    block.rows = block.rows.map((row) => ({
      vi_tri: row?.vi_tri ?? "",
      mo_ta: row?.mo_ta ?? "",
      layers: normalizeBaoCaoDtsLayers(row?.layers, n),
    }));
  }
  return next;
}

export function patchBcksField(formData, field, value) {
  const next = structuredClone(formData);
  next.chi_tiet_bcks.bcks[field] = value;
  return next;
}

export function buildBcksDbPayload(formData, { nvksId, paktksId } = {}) {
  const chi = structuredClone(formData.chi_tiet_bcks || {});
  const cl2 = chi?.dia_chat?.co_ly_dat_2;
  if (cl2?.rows) {
    cl2.rows = cl2.rows
      .filter((r) => r?.type !== "lop")
      .map((r) => {
        if (r.ten_lop && !r.lop) return { ...r, lop: r.ten_lop };
        const { ten_lop: _drop, ...rest } = r;
        return rest;
      });
    cl2.du_an = formData.ten_du_an || cl2.du_an || "";
    cl2.giai_doan = formData.giai_doan || cl2.giai_doan || "";
  }

  return {
    ma_du_an: formData.ma_du_an,
    nvks_id: nvksId,
    paktks_id: paktksId || null,
    ten_du_an: formData.ten_du_an || "",
    dia_diem: formData.dia_diem || "",
    giai_doan: formData.giai_doan || "",
    chu_dau_tu: formData.chu_dau_tu || "",
    chi_tiet_bcks: chi,
    trang_thai_bcks: formData.trang_thai_bcks || "dang_lap",
    updated_at: new Date().toISOString(),
  };
}
