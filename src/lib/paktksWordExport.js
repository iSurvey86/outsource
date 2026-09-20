/**
 * Xuất Word PAKTKS — chọn mẫu templates_paktks/ca_*.docx (cùng quy tắc NVKS).
 */
import { saveAs } from "file-saver";
import { getLoaiHinhConfigByLabel, getWordTemplateSlugChain } from "./nvksLoaiHinh";
import { buildDsKhoiLuong, buildSurveyDocData } from "./nvksKhoiLuongExport";
import { renderNvksWordBlob, resolveGiaiDoanTemplateSlug } from "./nvksWordExport";
import { fetchSortedCspl, fetchSortedTieuChuan, PHAM_VI_KHAO_SAT } from "./legalCatalog";
import {
  buildPaktkDownloadFileName,
  buildPaktkExportStoragePath,
  uploadPaktkExportBlob,
} from "./paktksExportStorage";

export function resolvePaktkTemplateFileName(formData) {
  const capDienApSlug = formData.cap_dien_ap?.includes("Cao áp") ? "ca" : "tha";
  const giaiDoanSlug = resolveGiaiDoanTemplateSlug(formData.giai_doan);

  const loaiConfig = getLoaiHinhConfigByLabel(formData.loai_hinh);
  const slugChain = getWordTemplateSlugChain(loaiConfig?.slug || "");

  return { capDienApSlug, giaiDoanSlug, slugChain };
}

export async function fetchPaktkTemplateBlob(formData) {
  const { capDienApSlug, giaiDoanSlug, slugChain } = resolvePaktkTemplateFileName(formData);

  for (const slug of slugChain) {
    const fileName = `${capDienApSlug}_${giaiDoanSlug}_${slug}.docx`;
    const templatePath = `/templates/templates_paktks/${fileName}`;
    const response = await fetch(templatePath);
    if (response.ok) {
      return { response, fileName, templatePath, tried: slugChain.map((s) => `${capDienApSlug}_${giaiDoanSlug}_${s}.docx`) };
    }
  }

  return {
    response: null,
    fileName: null,
    tried: slugChain.map((s) => `${capDienApSlug}_${giaiDoanSlug}_${s}.docx`),
  };
}

export async function buildPaktkDocData(formData, { filteredWorkItems, quantities, capDhValues, donViOverrides, supabase }) {
  const ds_khoi_luong = buildDsKhoiLuong({
    filteredWorkItems,
    quantities,
    capDhValues,
    donViOverrides,
  });

  let csplData = [];
  let tcData = [];
  if (supabase) {
    csplData = await fetchSortedCspl(supabase, { activeOnly: true, phamVi: PHAM_VI_KHAO_SAT });
    tcData = await fetchSortedTieuChuan(supabase, { activeOnly: true, phamVi: PHAM_VI_KHAO_SAT });
  }

  return buildSurveyDocData(formData, ds_khoi_luong, { csplData, tcData });
}

export async function generatePaktkWordBlob({
  formData,
  filteredWorkItems,
  quantities,
  capDhValues,
  donViOverrides,
  supabase,
}) {
  const { response, fileName: templateFileName, tried } = await fetchPaktkTemplateBlob(formData);
  if (!response?.ok) {
    throw new Error(
      `Hệ thống không tìm thấy file mẫu PAKTKS phù hợp.\n\nĐã thử:\n${(tried || []).join("\n")}\n\nKiểm tra thư mục templates_paktks.`
    );
  }

  const docData = await buildPaktkDocData(formData, {
    filteredWorkItems,
    quantities,
    capDhValues,
    donViOverrides,
    supabase,
  });

  const arrayBuffer = await (await response.blob()).arrayBuffer();
  const outBlob = renderNvksWordBlob(arrayBuffer, docData);
  const ts = Date.now();
  const downloadFileName = buildPaktkDownloadFileName(formData, { timestamp: ts });

  return { outBlob, downloadFileName, templateFileName, docData, timestamp: ts };
}

export async function exportPaktkWord({
  formData,
  filteredWorkItems,
  quantities,
  capDhValues,
  donViOverrides,
  supabase,
  saveToStorage = true,
  download = true,
}) {
  const { outBlob, downloadFileName, templateFileName, docData, timestamp } = await generatePaktkWordBlob({
    formData,
    filteredWorkItems,
    quantities,
    capDhValues,
    donViOverrides,
    supabase,
  });

  if (download) {
    saveAs(outBlob, downloadFileName);
  }

  let storagePath = "";
  let storageUrl = "";
  if (saveToStorage && supabase) {
    storagePath = buildPaktkExportStoragePath(formData, downloadFileName);
    storageUrl = await uploadPaktkExportBlob(supabase, outBlob, storagePath);
  }

  return { fileName: downloadFileName, templateFileName, docData, downloadFileName, storagePath, storageUrl, blob: outBlob, timestamp };
}
