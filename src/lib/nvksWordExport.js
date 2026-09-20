/**
 * Chuẩn hóa nội dung xuất Word NVKS (noi_dung + ghi_chu in nghiêng trong mẫu).
 *
 * Luồng xuất:
 * - Word: resolveNvksTemplateFileName → buildNvksDocData → renderNvksWordBlob (giữ nguyên mẫu)
 * - PDF:  cùng render Word → prepareNvksDocxBlobForPdf → convert server (LibreOffice / ConvertAPI) → tải A4
 */
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { saveAs } from "file-saver";
import { getLoaiHinhConfigByLabel, getWordTemplateSlugChain } from "./nvksLoaiHinh";
import { buildDsKhoiLuong, buildSurveyDocData } from "./nvksKhoiLuongExport";
import { applyKlDcManualToDsKhoiLuong } from "./nvksDcKl";
import { fetchSortedCspl, fetchSortedTieuChuan, PHAM_VI_KHAO_SAT } from "./legalCatalog";
import {
  buildNvksExportFileNames,
  buildNvksExportStoragePath,
  uploadNvksExportBlob,
} from "./nvksExportStorage";
import { isPhienBanDieuChinh } from "./nvksPhienBan";
import { repairSplitTemplateTagsInZip } from "./docxTemplateRepair";

/** Map giai_doan DB/UI → slug tên file mẫu templates_nvks */
export function resolveGiaiDoanTemplateSlug(giaiDoan) {
  let slug = (giaiDoan || "").toLowerCase();
  if (slug === "bcnckt" || slug === "fs") return "bcnckt";
  if (slug === "tkbvtc" || slug === "tkkt-tkbvtc") return "tk";
  if (slug === "bcktkt") return "bcktkt";
  return slug;
}

export function resolveNvksTemplateFileName(formData) {
  const capDienApSlug = formData.cap_dien_ap?.includes("Cao áp") ? "ca" : "tha";
  const giaiDoanSlug = resolveGiaiDoanTemplateSlug(formData.giai_doan);
  const loaiConfig = getLoaiHinhConfigByLabel(formData.loai_hinh);
  const slugChain = getWordTemplateSlugChain(loaiConfig?.slug || "");
  return { capDienApSlug, giaiDoanSlug, slugChain };
}

export async function fetchNvksTemplateBlob(formData) {
  const { capDienApSlug, giaiDoanSlug, slugChain } = resolveNvksTemplateFileName(formData);

  for (const slug of slugChain) {
    const fileName = `${capDienApSlug}_${giaiDoanSlug}_${slug}.docx`;
    const templatePath = `/templates/templates_nvks/${fileName}`;
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

export async function buildNvksDocData(formData, { filteredWorkItems, quantities, capDhValues, donViOverrides, supabase, klDcManual, gocKlById }) {
  let ds_khoi_luong = buildDsKhoiLuong({
    filteredWorkItems,
    quantities,
    capDhValues,
    donViOverrides,
  });

  const isDieuChinh = isPhienBanDieuChinh(formData.phien_ban);

  if (gocKlById && Object.keys(gocKlById).length) {
    ds_khoi_luong = applyKlDcManualToDsKhoiLuong(ds_khoi_luong, klDcManual || {}, gocKlById);
  } else if (klDcManual && Object.keys(klDcManual).length) {
    ds_khoi_luong = applyKlDcManualToDsKhoiLuong(ds_khoi_luong, klDcManual, {});
  }

  let csplData = [];
  let tcData = [];
  if (supabase) {
    csplData = await fetchSortedCspl(supabase, { activeOnly: true, phamVi: PHAM_VI_KHAO_SAT });
    tcData = await fetchSortedTieuChuan(supabase, { activeOnly: true, phamVi: PHAM_VI_KHAO_SAT });
  }

  return buildSurveyDocData(formData, ds_khoi_luong, { csplData, tcData, isDieuChinh });
}

export function renderNvksWordBlob(arrayBuffer, docData) {
  const zip = new PizZip(arrayBuffer);
  repairSplitTemplateTagsInZip(zip);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    /** Tag thiếu (vd. {ky_chinh} cũ) → để trống, không in nguyên tag ra PDF */
    nullGetter: () => "",
  });
  doc.render(docData);
  const outZip = doc.getZip();
  cleanupDocxEmptyGhiChuBreaks(outZip);
  fixKhoiLuongSttColumnAlignment(outZip);
  return outZip.generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

/**
 * Chỉ dùng trước convert PDF: LibreOffice render khác Word (viền bìa, giãn dòng trong bảng).
 * Word export không gọi — giữ nguyên cấu trúc mẫu gốc.
 */
export async function prepareNvksDocxBlobForPdf(docxBlob) {
  const zip = new PizZip(await docxBlob.arrayBuffer());
  applyPdfCoverPageBorderFix(zip);
  applyPdfTableLayoutFix(zip);
  return zip.generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    compression: "DEFLATE",
  });
}

/**
 * Tạo blob Word (dùng chung cho tải Word và làm nguồn convert PDF).
 */
export async function generateNvksWordBlob({
  formData,
  filteredWorkItems,
  quantities,
  capDhValues,
  donViOverrides,
  supabase,
  klDcManual,
  gocKlById,
  timestamp,
}) {
  const { response, fileName: templateFileName, tried } = await fetchNvksTemplateBlob(formData);
  if (!response?.ok) {
    throw new Error(
      `Hệ thống không tìm thấy file mẫu NVKS phù hợp.\n\nĐã thử:\n${(tried || []).join("\n")}\n\nKiểm tra thư mục templates_nvks.`
    );
  }

  const docData = await buildNvksDocData(formData, {
    filteredWorkItems,
    quantities,
    capDhValues,
    donViOverrides,
    supabase,
    klDcManual,
    gocKlById,
  });

  const arrayBuffer = await (await response.blob()).arrayBuffer();
  const outBlob = renderNvksWordBlob(arrayBuffer, docData);
  const ts = timestamp ?? Date.now();
  const names = buildNvksExportFileNames(formData, { timestamp: ts });

  return { outBlob, ...names, downloadFileName: names.localFileName, templateFileName, docData, timestamp: ts };
}

/**
 * Xuất Word NVKS — tải xuống trình duyệt + (tuỳ chọn) upload Storage.
 * @returns {{ fileName, templateFileName, docData, downloadFileName, storagePath, storageUrl }}
 */
export async function exportNvksWord({
  formData,
  filteredWorkItems,
  quantities,
  capDhValues,
  donViOverrides,
  supabase,
  saveToStorage = true,
  download = true,
  klDcManual,
  gocKlById,
}) {
  const { outBlob, localFileName, displayName, displayTime, templateFileName, docData, timestamp } =
    await generateNvksWordBlob({
    formData,
    filteredWorkItems,
    quantities,
    capDhValues,
    donViOverrides,
    supabase,
    klDcManual,
    gocKlById,
  });

  if (download) {
    saveAs(outBlob, localFileName);
  }

  let storagePath = "";
  let storageUrl = "";
  if (saveToStorage && supabase) {
    storagePath = buildNvksExportStoragePath(formData, localFileName);
    storageUrl = await uploadNvksExportBlob(supabase, outBlob, storagePath);
  }

  return {
    fileName: localFileName,
    templateFileName,
    docData,
    downloadFileName: localFileName,
    localFileName,
    displayName,
    displayTime,
    storagePath,
    storageUrl,
    blob: outBlob,
    timestamp,
  };
}

/** Tách dòng chính và phần ghi chú (thường bắt đầu bằng "(Phạm vi...") */
export function splitNoiDungVaGhiChu(text) {
  const raw = (text || '').trim();
  if (!raw) return { noi_dung: '', ghi_chu: '' };

  const nl = raw.indexOf('\n');
  if (nl >= 0) {
    return {
      noi_dung: raw.slice(0, nl).trim(),
      ghi_chu: raw.slice(nl + 1).trim(),
    };
  }

  const parenMatch = raw.match(/^([\s\S]+?)\s*(\([Pp]hạm vi[\s\S]*\))\s*$/);
  if (parenMatch) {
    return { noi_dung: parenMatch[1].trim(), ghi_chu: parenMatch[2].trim() };
  }

  return { noi_dung: raw, ghi_chu: '' };
}

/**
 * Mẫu Word có <w:br/> cố định trước {#ghi_chu} — khi ghi_chu rỗng vẫn tạo dòng trắng.
 * Xóa run in nghiêng chỉ còn line-break sau khi render.
 */
export function cleanupDocxEmptyGhiChuBreaks(zip) {
  const file = zip.file('word/document.xml');
  if (!file) return zip;

  let xml = file.asText();
  xml = xml.replace(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g, (run) => {
    if (!/<w:i\s*\/>|<w:i>/.test(run) || !/<w:br\s*\/>/.test(run)) return run;
    const texts = [...run.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
    if (texts.trim()) return run;
    return '';
  });
  zip.file('word/document.xml', xml);
  return zip;
}

const STT_CELL_TEXT_RE = /^[\dIVXLCDM.]+$/i;

function ensureTcVerticalCenter(tcXml) {
  if (/<w:vAlign\s+w:val="center"/.test(tcXml)) return tcXml;
  if (/<w:tcPr>/.test(tcXml)) {
    return tcXml.replace(/<w:tcPr>/, '<w:tcPr><w:vAlign w:val="center"/>');
  }
  return tcXml.replace(/<w:tc>/, '<w:tc><w:tcPr><w:vAlign w:val="center"/></w:tcPr>');
}

function ensureParagraphsCentered(tcXml) {
  return tcXml.replace(/<w:p\b([^>]*)>([\s\S]*?)<\/w:p>/g, (full, attrs, inner) => {
    if (/<w:jc\s+w:val="center"/.test(full)) return full;
    if (/<w:pPr>/.test(inner)) {
      if (/<w:jc\s/.test(inner)) {
        return `<w:p${attrs}>${inner.replace(/<w:jc\s+w:val="[^"]*"/, '<w:jc w:val="center"')}</w:p>`;
      }
      return `<w:p${attrs}>${inner.replace('<w:pPr>', '<w:pPr><w:jc w:val="center"/>')}</w:p>`;
    }
    return `<w:p${attrs}><w:pPr><w:jc w:val="center"/></w:pPr>${inner}</w:p>`;
  });
}

function getCellPlainText(tcXml) {
  return [...tcXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
    .map((m) => m[1])
    .join('')
    .trim();
}

/**
 * Mẫu bảng KL: cột STT có vAlign=center nhưng thiếu jc=center ở đoạn văn → lệch trái, trông khấp khểnh.
 */
export function fixKhoiLuongSttColumnAlignment(zip) {
  const file = zip.file('word/document.xml');
  if (!file) return zip;

  let xml = file.asText();
  xml = xml.replace(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g, (row) => {
    const firstTcMatch = row.match(/<w:tc>([\s\S]*?)<\/w:tc>/);
    if (!firstTcMatch) return row;

    const plain = getCellPlainText(firstTcMatch[1]);
    if (!plain || plain === 'STT' || plain.length > 12 || !STT_CELL_TEXT_RE.test(plain)) {
      return row;
    }

    const fixedTc = ensureParagraphsCentered(ensureTcVerticalCenter(firstTcMatch[0]));
    return row.replace(firstTcMatch[0], fixedTc);
  });

  zip.file('word/document.xml', xml);
  return zip;
}

/**
 * PDF-only: giữ viền trang chỉ ở bìa (LibreOffice bỏ qua pgBorders firstPage của mẫu).
 * Tách section trước CHƯƠNG 1; section nội dung không dùng footer/titlePg trang đầu.
 */
const CHAPTER_ONE_PARA_RE = /<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?<w:t[^>]*>CH[^<]*NG\s*1\s*:/i;
const PG_BORDERS_RE = /<w:pgBorders\b[^>]*>[\s\S]*?<\/w:pgBorders>|<w:pgBorders\b[^/]*\/>/;
const FINAL_SECT_RE = /<w:sectPr\b[\s\S]*?<\/w:sectPr>\s*<\/w:body>/;

function findChapterOneParagraphStart(xml) {
  const m = xml.match(CHAPTER_ONE_PARA_RE);
  return m ? m.index : -1;
}

function normalizeCoverPgBorders(pgBorders) {
  if (/w:display="allPages"/.test(pgBorders)) return pgBorders;
  if (/w:display="firstPage"/.test(pgBorders)) {
    return pgBorders.replace(/\bw:display="firstPage"/, 'w:display="allPages"');
  }
  return pgBorders.replace(/<w:pgBorders\b/, '<w:pgBorders w:display="allPages"');
}

function extractPgBordersBlock(xml) {
  const finalSect = xml.match(FINAL_SECT_RE)?.[0];
  if (!finalSect) return null;
  const m = finalSect.match(PG_BORDERS_RE);
  return m ? normalizeCoverPgBorders(m[0]) : null;
}

function removeAllPgBorders(xml) {
  return xml
    .replace(/<w:pgBorders\b[^>]*\/>/g, "")
    .replace(/<w:pgBorders\b[^>]*>[\s\S]*?<\/w:pgBorders>/g, "");
}

function cleanupBrokenInlineSectPr(xml, chapterStart) {
  const before = xml.slice(0, chapterStart);
  const after = xml.slice(chapterStart);
  const cleaned = before
    .replace(
      /<w:sectPr\b[^>]*>(?:(?!<\/w:pgBorders>)[\s\S])*?<w:type\s+w:val="nextPage"\/>[\s\S]*?<\/w:sectPr>/gi,
      ""
    )
    .replace(
      /<w:p\b[^>]*>\s*<w:pPr>\s*<w:sectPr\b[\s\S]*?<w:type\s+w:val="nextPage"\/>[\s\S]*?<\/w:sectPr>\s*<\/w:pPr>\s*<\/w:p>/gi,
      ""
    );
  return cleaned + after;
}

function extractFinalSectPrInner(xml) {
  const match = xml.match(/<w:sectPr\b[^>]*>([\s\S]*?)<\/w:sectPr>\s*<\/w:body>/);
  return match ? match[1] : "";
}

function buildCoverSectPrInner(finalSectInner, pgBorders) {
  const base = removeAllPgBorders(finalSectInner);
  return `<w:type w:val="nextPage"/>${base}${pgBorders}`;
}

/** Chỉ sửa sectPr cuối document — tránh regex replace làm hỏi file với LibreOffice. */
function sanitizeFinalSectPrInPlace(xml) {
  const bodyClose = xml.lastIndexOf("</w:body>");
  if (bodyClose < 0) return xml;

  const head = xml.slice(0, bodyClose);
  const lastSectOpen = head.lastIndexOf("<w:sectPr");
  if (lastSectOpen < 0) return xml;

  const lastSectClose = head.indexOf("</w:sectPr>", lastSectOpen);
  if (lastSectClose < 0) return xml;

  const sectXml = head.slice(lastSectOpen, lastSectClose + "</w:sectPr>".length);
  const sanitized = sectXml
    .replace(/<w:footerReference\s+w:type="first"[^>]*\/>/gi, "")
    .replace(/<w:titlePg\s*\/>/gi, "");
  if (sanitized === sectXml) return xml;

  return (
    head.slice(0, lastSectOpen) +
    sanitized +
    head.slice(lastSectClose + "</w:sectPr>".length) +
    xml.slice(bodyClose)
  );
}

function buildSectionBreakParagraph(sectPrInner) {
  return `<w:p><w:pPr><w:sectPr>${sectPrInner}</w:sectPr></w:pPr></w:p>`;
}

// Word: 1pt = 20 twips → 3pt = 60 twips
const PDF_TABLE_CELL_SPACING =
  '<w:spacing w:before="60" w:after="60" w:line="276" w:lineRule="atLeast"/>';

function isPdfLayoutTable(tblXml) {
  const hasStt = /<w:t[^>]*>STT<\/w:t>/.test(tblXml);
  const isKhoiLuong =
    hasStt &&
    /<w:t[^>]*>Nội dung công việc<\/w:t>/.test(tblXml) &&
    (/<w:t[^>]*>Khối lượng<\/w:t>/.test(tblXml) ||
      /<w:t[^>]*>Điều chỉnh \(02\)<\/w:t>/.test(tblXml) ||
      /khoi_luong_02/.test(tblXml));
  const isTieuChuan =
    hasStt &&
    /<w:t[^>]*>Ký hiệu<\/w:t>/.test(tblXml) &&
    /<w:t[^>]*>Tên tài liệu<\/w:t>/.test(tblXml);
  return isKhoiLuong || isTieuChuan;
}

function upsertPdfTableParagraphSpacing(pPrBody) {
  const cleaned = pPrBody.replace(/<w:spacing\b[^/]*\/>/g, "");
  return `${cleaned}${PDF_TABLE_CELL_SPACING}`;
}

function stripTrailingBreakRuns(paragraphInner) {
  return paragraphInner.replace(
    /(?:<w:r\b[^>]*>(?:\s*<w:rPr>[\s\S]*?<\/w:rPr>)?\s*<w:br\s*\/?>\s*<\/w:r>\s*)+$/g,
    ""
  );
}

function normalizePdfTableParagraph(paraXml, { justify = false } = {}) {
  const openTag = paraXml.match(/^<w:p\b[^>]*>/)?.[0] || "<w:p>";
  let inner = paraXml.slice(openTag.length, paraXml.length - "</w:p>".length);
  inner = stripTrailingBreakRuns(inner);

  if (/<w:pPr\b/.test(inner)) {
    inner = inner.replace(
      /(<w:pPr\b[^>]*>)([\s\S]*?)(<\/w:pPr>)/,
      (_m, open, body, close) => {
        let nextBody = upsertPdfTableParagraphSpacing(body);
        if (justify) nextBody = upsertParagraphJustify(nextBody);
        return `${open}${nextBody}${close}`;
      }
    );
  } else {
    let pPrBody = upsertPdfTableParagraphSpacing("");
    if (justify) pPrBody = upsertParagraphJustify(pPrBody);
    inner = `<w:pPr>${pPrBody}</w:pPr>${inner}`;
  }

  return `${openTag}${inner}</w:p>`;
}

function upsertParagraphJustify(pPrBody) {
  const cleaned = pPrBody.replace(/<w:jc\b[^/]*\/>/g, "");
  return `${cleaned}<w:jc w:val="both"/>`;
}

function getJustifyColumnIndices(tblXml) {
  const headerRow = tblXml.match(/<w:tr\b[\s\S]*?<\/w:tr>/);
  if (!headerRow) return new Set();

  const indices = new Set();
  const cells = [...headerRow[0].matchAll(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g)];
  cells.forEach((cell, idx) => {
    const text = [...cell[1].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
      .map((m) => m[1])
      .join("");
    if (/Nội dung công việc|Tên tài liệu/.test(text)) {
      indices.add(idx);
    }
  });
  return indices;
}

function applyTableRowParagraphLayout(tblXml, justifyCols) {
  return tblXml.replace(/<w:tr\b[\s\S]*?<\/w:tr>/g, (row) => {
    let cellIdx = 0;
    return row.replace(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g, (full, tcInner) => {
      const justify = justifyCols.has(cellIdx);
      cellIdx += 1;
      const updated = tcInner.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (para) =>
        normalizePdfTableParagraph(para, { justify })
      );
      return full.replace(tcInner, updated);
    });
  });
}

function ensureTableCellsVerticallyCentered(tblXml) {
  return tblXml.replace(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g, (full, tcInner) => {
    if (/<w:tcPr\b/.test(tcInner)) {
      const updated = tcInner.replace(
        /(<w:tcPr\b[^>]*>)([\s\S]*?)(<\/w:tcPr>)/,
        (_m, open, body, close) => {
          const cleaned = body.replace(/<w:vAlign\b[^/]*\/>/g, "");
          return `${open}${cleaned}<w:vAlign w:val="center"/>${close}`;
        }
      );
      return full.replace(tcInner, updated);
    }
    const open = full.match(/^<w:tc\b[^>]*>/)?.[0] || "<w:tc>";
    const rest = full.slice(open.length, -"</w:tc>".length);
    return `${open}<w:tcPr><w:vAlign w:val="center"/></w:tcPr>${rest}</w:tc>`;
  });
}

/** PDF-only: căn giữa ô, lề ~3pt, căn đều cột mô tả cho bảng KL và tiêu chuẩn. */
function applyPdfTableLayoutFix(zip) {
  const file = zip.file("word/document.xml");
  if (!file) return zip;

  let xml = file.asText();
  xml = xml.replace(/<w:tbl\b[\s\S]*?<\/w:tbl>/g, (tbl) => {
    if (!isPdfLayoutTable(tbl)) return tbl;

    const justifyCols = getJustifyColumnIndices(tbl);
    let next = tbl.replace(/<w:trHeight\b[^/]*\/>/g, "");
    next = applyTableRowParagraphLayout(next, justifyCols);
    next = ensureTableCellsVerticallyCentered(next);
    return next;
  });

  zip.file("word/document.xml", xml);
  return zip;
}

function applyPdfCoverPageBorderFix(zip) {
  const file = zip.file("word/document.xml");
  if (!file) return zip;

  let xml = file.asText();
  if (!xml.includes("pgBorders")) return zip;

  let chapterStart = findChapterOneParagraphStart(xml);
  if (chapterStart < 0) {
    xml = removeAllPgBorders(xml);
    zip.file("word/document.xml", xml);
    return zip;
  }

  const pgBorders = extractPgBordersBlock(xml);
  if (!pgBorders) return zip;

  const finalSectInner = extractFinalSectPrInner(xml);
  const sectPrInner = buildCoverSectPrInner(finalSectInner, pgBorders);

  xml = cleanupBrokenInlineSectPr(xml, chapterStart);
  xml = removeAllPgBorders(xml);

  chapterStart = findChapterOneParagraphStart(xml);
  if (chapterStart < 0) {
    zip.file("word/document.xml", xml);
    return zip;
  }

  const breakPara = buildSectionBreakParagraph(sectPrInner);
  xml = xml.slice(0, chapterStart) + breakPara + xml.slice(chapterStart);
  xml = sanitizeFinalSectPrInPlace(xml);

  zip.file("word/document.xml", xml);
  return zip;
}
