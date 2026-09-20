/**
 * Dữ liệu + xuất Word NKKS (Nhật ký khảo sát).
 */
import { saveAs } from "file-saver";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import {
  buildNkksExportFileNames,
  buildNkksExportStoragePath,
  uploadNkksExportBlob,
} from "./nkksExportStorage";
import { formatThoiTietForExport, normalizeGiamSatField, normalizeKhongField } from "./nkksThoiTiet";

const NKKS_TEMPLATE_CANDIDATES = ["/templates/templates_nkks/Template_NKKS.docx"];

/** Làm sạch text trước khi đổ Word (bỏ dự kiến, hết …: / ::). */
export function sanitizeNkksExportText(raw) {
  return String(raw ?? "")
    .replace(/\s*dự\s*kiến\s*/gi, " ")
    .replace(/\s*du\s*kien\s*/gi, " ")
    .replace(/…\s*:/g, ":")
    .replace(/\.\.\.\s*:/g, ":")
    .replace(/:{2,}/g, ":")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[^\S\n]{2,}/g, " ")
    .trim();
}

/** dd/mm/yyyy từ ISO date hoặc chuỗi có sẵn */
export function formatNkksNgayDisplay(value) {
  if (!value) return "";
  const s = String(value).trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) return s;
  const iso = s.slice(0, 10);
  const parts = iso.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return s;
}

/** Chuẩn hóa khối công việc khi xuất: dấu cách sau +; mỗi dòng một ý. */
export function formatCongViecForExport(raw) {
  let s = sanitizeNkksExportText(raw);
  if (!s) return "";
  s = s
    .split(/\r?\n/)
    .map((line) => {
      const t = line.trimEnd();
      // "  +foo" / "+foo" / "+  foo" → giữ thụt nhóm, chuẩn hóa "+ "
      const m = t.match(/^(\s*)\+\s*(.*)$/);
      if (m) {
        const indent = m[1].startsWith("  ") ? "  " : "";
        return `${indent}+ ${m[2]}`.trimEnd();
      }
      return t;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return s;
}

/** Header + mảng nkks_ngays cho Docxtemplater */
export function buildNkksDocData(formData = {}) {
  const tenCongTrinh = formData.ten_cong_trinh || formData.ten_du_an || "";
  const hangMuc = formData.hang_muc || formData.loai_hinh || "";

  const nhanLuc = sanitizeNkksExportText(formData.nhan_luc || "");
  const mayMocThietBi = sanitizeNkksExportText(formData.may_moc_thiet_bi || "");

  const nkks_ngays = (formData.nkks_ngays || formData.chi_tiet_nhat_ky || []).map((row) => ({
    thoi_tiet: formatThoiTietForExport(row.thoi_tiet),
    ngay_khao_sat: formatNkksNgayDisplay(row.ngay_khao_sat || row.ngay),
    nhan_luc: nhanLuc,
    cong_viec_thuc_hien: formatCongViecForExport(row.cong_viec_thuc_hien || ""),
    may_moc_thiet_bi: mayMocThietBi,
    khoi_luong_thuc_hien: sanitizeNkksExportText(row.khoi_luong_thuc_hien || ""),
    y_kien_chu_dau_tu: normalizeKhongField(row.y_kien_chu_dau_tu),
    y_kien_giam_sat: normalizeGiamSatField(row.y_kien_giam_sat),
    cac_van_de_dac_biet: normalizeKhongField(row.cac_van_de_dac_biet),
  }));

  return {
    ten_cong_trinh: tenCongTrinh,
    giai_doan: formData.giai_doan || "",
    chu_dau_tu: formData.chu_dau_tu || "",
    nha_thau_tvgs: formData.nha_thau_tvgs || "",
    ngay_bat_dau: formatNkksNgayDisplay(formData.ngay_bat_dau),
    ngay_ket_thuc: formatNkksNgayDisplay(formData.ngay_ket_thuc),
    dia_diem: formData.dia_diem || "",
    nha_thau_ks: formData.nha_thau_ks || "",
    goi_thau: formData.goi_thau || "",
    hang_muc: hangMuc,
    nvks_kl_source_label: formData.nvks_kl_source_label || "",
    /** Bảng KL chỉ tham chiếu trên form — không in ra Word/PDF */
    bang_khoi_luong: [],
    nkks_ngays,
  };
}

/**
 * Ước giãn dòng (twips) — ưu tiên 1 trang/ngày.
 * Nhân lực + máy móc đã chiếm phần lớn trang → mặc định siết hơn trước.
 */
export function estimateNkksLineTwips(formData = {}) {
  const days = formData.nkks_ngays || formData.chi_tiet_nhat_ky || [];
  const nhan = String(formData.nhan_luc || "").length;
  const may = String(formData.may_moc_thiet_bi || "").length;
  let maxWork = 0;
  for (const d of days) {
    maxWork = Math.max(maxWork, String(d.cong_viec_thuc_hien || "").length);
  }
  const pressure = maxWork + Math.floor(nhan * 0.5) + Math.floor(may * 0.5);
  if (pressure > 1800) return 230;
  if (pressure > 1400) return 240;
  if (pressure > 1000) return 256;
  return 276;
}

/**
 * Giữ khối chữ ký (bảng 2 cột, mỗi ô 1 đoạn có w:br) không tách trang giữa các dòng.
 */
function ensureNkksSignatureKeepTogether(xml) {
  return xml.replace(/<w:tbl\b[\s\S]*?<\/w:tbl>/g, (tbl) => {
    if (!/ĐẠI DIỆN NHÀ THẦU|ĐẠI DIỆN GIÁM SÁT/.test(tbl)) return tbl;

    let t = tbl.replace(
      /<w:tr\b([^>]*)>(\s*)(?:<w:trPr>([\s\S]*?)<\/w:trPr>)?/g,
      (_, attrs, sp, inner = "") => {
        if (/cantSplit/.test(inner)) {
          return `<w:tr${attrs}>${sp}<w:trPr>${inner}</w:trPr>`;
        }
        return `<w:tr${attrs}>${sp}<w:trPr><w:cantSplit/>${inner}</w:trPr>`;
      }
    );

    t = t.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (para) => {
      const plain = plainTextFromPara(para);
      if (!/ĐẠI DIỆN|Ký và ghi rõ họ tên/.test(plain)) return para;
      if (/<w:keepLines\b/.test(para)) return para;
      if (/<w:pPr>/.test(para)) {
        return para.replace(/<w:pPr>/, "<w:pPr><w:keepLines/>");
      }
      return para.replace(
        /<w:p\b([^>]*)>/,
        '<w:p$1><w:pPr><w:keepLines/><w:jc w:val="center"/></w:pPr>'
      );
    });

    return t;
  });
}

/** Chỉ tiêu đề nhật ký ngày (không khớp tiêu đề bìa «… XÂY DỰNG»). */
function isNkksDayTitlePlain(plain) {
  return /^NHẬT KÝ KHẢO SÁT$/.test(String(plain || "").trim());
}

/**
 * Ngắt trang trước mỗi ngày (trừ ngày đầu), giữ tiêu đề dính với «Ngày:».
 * Dùng pageBreakBefore + keepNext — tránh orphan tiêu đề một mình một trang.
 */
function ensureNkksDayPageBreaks(xml) {
  let dayTitleIndex = 0;
  return xml.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (para) => {
    const plain = plainTextFromPara(para).trim();
    if (!isNkksDayTitlePlain(plain)) return para;

    dayTitleIndex += 1;
    let next = para;

    // Bỏ br page lẻ trong đoạn tiêu đề (nếu có)
    next = next.replace(/<w:r[^>]*>\s*<w:br w:type="page"\s*\/>\s*<\/w:r>/g, "");

    const inject = [];
    if (dayTitleIndex > 1) inject.push("<w:pageBreakBefore/>");
    inject.push("<w:keepNext/>", "<w:keepLines/>");

    if (/<w:pPr>/.test(next)) {
      // gỡ pageBreakBefore/keep cũ rồi gắn lại
      next = next.replace(/<w:pageBreakBefore\s*\/>/g, "");
      if (!/<w:keepNext\b/.test(next)) {
        next = next.replace(/<w:pPr>/, `<w:pPr>${inject.join("")}`);
      } else if (dayTitleIndex > 1 && !/<w:pageBreakBefore\b/.test(next)) {
        next = next.replace(/<w:pPr>/, "<w:pPr><w:pageBreakBefore/>");
      }
    } else {
      next = next.replace(
        /<w:p\b([^>]*)>/,
        `<w:p$1><w:pPr>${inject.join("")}<w:jc w:val="center"/></w:pPr>`
      );
    }
    return next;
  });
}

function plainTextFromPara(paraXml) {
  return [...paraXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("");
}

function justifyBodyParagraphProps(pPrInner) {
  let inner = pPrInner;
  if (/w:jc w:val="center"/.test(inner) || /w:jc w:val="right"/.test(inner)) return inner;
  if (/w:jc w:val="left"/.test(inner)) {
    return inner.replace(/<w:jc\b[^/]*\/>/, '<w:jc w:val="both"/>');
  }
  if (/<w:jc\b/.test(inner)) {
    return inner.replace(/<w:jc\b[^/]*\/>/, '<w:jc w:val="both"/>');
  }
  return `${inner}<w:jc w:val="both"/>`;
}

function shouldLeftAlignNkksPara(plain) {
  const t = String(plain || "");
  if (/Điều kiện thời tiết|Buổi sáng|Buổi chiều|☐|☑/.test(t)) return true;
  // Nhãn công việc ngắn (không có nội dung +) — giữ trái
  if (/Công việc thực hiện trong ngày:\s*$/.test(t.trim())) return true;
  // Danh sách "+ …" (công việc): không căn đều — tránh giãn chữ từng dòng
  if (/(?:^|\n)\s*\+/.test(t) && !/Nhân lực:|Máy móc/.test(t)) return true;
  return false;
}

function shouldJustifyNkksPara(plain) {
  const t = String(plain || "").trim();
  if (!t) return false;
  if (shouldLeftAlignNkksPara(t)) return false;
  if (isNkksDayTitlePlain(t)) return false;
  if (/^Ngày\s*:/.test(t)) return false;
  if (/^(\d+\.\s|ĐẠI DIỆN|2\.\s|3\.\s)/.test(t) && t.length < 100) return false;
  // Nhân lực / máy móc (đoạn văn) — căn đều
  if (/Nhân lực:|Máy móc/.test(t) && t.length >= 40) return true;
  return t.length >= 120;
}

/** Nếu mẫu cũ còn dính nhãn + nội dung cùng đoạn → tách sau «trong ngày:». */
function splitCongViecLabelParagraphs(xml) {
  return xml.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (para) => {
    const plain = plainTextFromPara(para);
    const marker = "trong ngày:";
    const idx = plain.indexOf(marker);
    if (idx < 0) return para;
    const after = plain.slice(idx + marker.length).trim();
    if (!after) return para; // đã tách sẵn

    // Tách XML: giữ nguyên đoạn đến hết «trong ngày:», đổ phần còn lại sang p mới
    // Cách an toàn: cắt theo text runs — đơn giản hóa bằng rebuild 2 paragraph từ plain
    const pPrMatch = para.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
    const pPr = pPrMatch ? pPrMatch[0] : "<w:pPr><w:spacing w:after=\"120\" w:line=\"276\" w:lineRule=\"auto\"/></w:pPr>";
    const open = para.match(/^<w:p\b[^>]*>/)?.[0] || "<w:p>";
    const labelPlain = plain.slice(0, idx + marker.length).trimEnd();
    const bodyPlain = after;
    const mkRuns = (text) =>
      String(text)
        .split("\n")
        .map((line, i) => {
          const esc = line
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
          const br = i > 0 ? "<w:br/>" : "";
          return `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr>${br}<w:t xml:space="preserve">${esc}</w:t></w:r>`;
        })
        .join("");
    return `${open}${pPr}${mkRuns(labelPlain)}</w:p>${open}${pPr}${mkRuns(bodyPlain)}</w:p>`;
  });
}

function patchParagraphAlign(paraXml) {
  const plain = plainTextFromPara(paraXml);
  const wantJustify = shouldJustifyNkksPara(plain);
  const wantLeft = shouldLeftAlignNkksPara(plain);

  if (!wantJustify && !wantLeft) {
    // «Ngày:» giữ cùng trang với tiêu đề phía trên + nội dung phía dưới
    if (/^Ngày\s*:/.test(plain.trim())) {
      if (/<w:pPr>/.test(paraXml)) {
        let next = paraXml;
        if (!/<w:keepNext\b/.test(next)) {
          next = next.replace(/<w:pPr>/, "<w:pPr><w:keepNext/><w:keepLines/>");
        }
        return next;
      }
    }
    return paraXml;
  }

  if (wantLeft) {
    // Thời tiết: căn trái tường minh (không căn đều)
    if (/<w:pPr>/.test(paraXml)) {
      return paraXml.replace(/<w:pPr>([\s\S]*?)<\/w:pPr>/, (_, inner) => {
        let next = inner.replace(/<w:jc\b[^/]*\/>/g, "");
        return `<w:pPr>${next}<w:jc w:val="left"/></w:pPr>`;
      });
    }
    return paraXml.replace(/<w:p\b([^>]*)>/, '<w:p$1><w:pPr><w:jc w:val="left"/></w:pPr>');
  }

  if (/<w:pPr>/.test(paraXml)) {
    return paraXml.replace(/<w:pPr>([\s\S]*?)<\/w:pPr>/, (_, inner) => {
      return `<w:pPr>${justifyBodyParagraphProps(inner)}</w:pPr>`;
    });
  }
  return paraXml.replace(/<w:p\b([^>]*)>/, '<w:p$1><w:pPr><w:jc w:val="both"/></w:pPr>');
}

/**
 * Sau Docxtemplater: font 13 (sz=26), căn đều có chọn lọc, giãn dòng đồng bộ, ngắt trang đúng.
 */
export function applyNkksDiaryExportLayout(zip, formData = {}) {
  const file = zip.file("word/document.xml");
  if (!file) return zip;
  let xml = file.asText();
  const line = estimateNkksLineTwips(formData);

  xml = xml.replace(/w:line="\d+"/g, `w:line="${line}"`);
  xml = xml.replace(/<w:sz w:val="28"\/>/g, '<w:sz w:val="26"/>');
  xml = xml.replace(/<w:szCs w:val="28"\/>/g, '<w:szCs w:val="26"/>');

  xml = xml.replace(/<w:rPr>([\s\S]*?)<\/w:rPr>/g, (_, inner) => {
    let next = inner;
    if (!/<w:sz\b/.test(next)) {
      next += '<w:sz w:val="26"/><w:szCs w:val="26"/>';
    }
    if (!/<w:rFonts\b/.test(next)) {
      next =
        '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman"/>' +
        next;
    }
    return `<w:rPr>${next}</w:rPr>`;
  });

  // Tách nhãn công việc nếu mẫu cũ còn dính cùng đoạn
  xml = splitCongViecLabelParagraphs(xml);

  // Căn lề theo đoạn — thời tiết trái, không căn đều
  xml = xml.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (para) => patchParagraphAlign(para));

  xml = ensureNkksDayPageBreaks(xml);
  xml = ensureNkksSignatureKeepTogether(xml);

  // Gỡ page-break paragraph trống thừa ngay trước tiêu đề ngày (tránh trang trắng)
  xml = xml.replace(
    /<w:p\b[^>]*>\s*(?:<w:pPr>[\s\S]*?<\/w:pPr>\s*)?<w:r[^>]*>\s*<w:br w:type="page"\s*\/>\s*<\/w:r>\s*<\/w:p>(\s*<w:p\b[^>]*>[\s\S]*?NHẬT KÝ KHẢO SÁT[\s\S]*?<\/w:p>)/g,
    (_, titlePara) => {
      // Giữ pageBreakBefore trên tiêu đề; bỏ p break rỗng
      if (/<w:pageBreakBefore\b/.test(titlePara)) return titlePara;
      return titlePara.replace(/<w:pPr>/, "<w:pPr><w:pageBreakBefore/>");
    }
  );

  zip.file("word/document.xml", xml);
  return zip;
}

function renderNkksWordBlobWithLayout(arrayBuffer, docData, formData) {
  const zip = new PizZip(arrayBuffer);
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
  doc.render(docData);
  const outZip = doc.getZip();
  applyNkksDiaryExportLayout(outZip, formData);
  return outZip.generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

/** Kế thừa header từ NVKS + dự án; giữ nkks_ngays nếu đã có */
export function mergeNkksFormFromNvks(nvksRow = {}, project = {}, nkksRow = {}) {
  return {
    ma_du_an: nkksRow.ma_du_an || nvksRow.ma_du_an || project.ma_du_an || "",
    ten_du_an: nkksRow.ten_du_an || nvksRow.ten_du_an || project.ten_du_an || "",
    ten_cong_trinh: nkksRow.ten_cong_trinh || nvksRow.ten_du_an || project.ten_du_an || "",
    dia_diem: nkksRow.dia_diem || nvksRow.dia_diem || project.dia_diem || "",
    loai_hinh: nkksRow.loai_hinh || nvksRow.loai_hinh || project.loai_hinh || "",
    hang_muc: nkksRow.hang_muc || nkksRow.loai_hinh || project.loai_hinh || "",
    chu_dau_tu: nkksRow.chu_dau_tu || "",
    nha_thau_ks: nkksRow.nha_thau_ks || "",
    nha_thau_tvgs: nkksRow.nha_thau_tvgs || "",
    goi_thau: nkksRow.goi_thau || "",
    ngay_bat_dau: nkksRow.ngay_bat_dau || "",
    ngay_ket_thuc: nkksRow.ngay_ket_thuc || "",
    bang_khoi_luong: nkksRow.bang_khoi_luong || [],
    nvks_kl_source_label: nkksRow.nvks_kl_source_label || "",
    nkks_ngays: nkksRow.nkks_ngays || nkksRow.chi_tiet_nhat_ky || [],
    nvks_id: nvksRow.id || nkksRow.nvks_id,
  };
}

export async function fetchNkksTemplateBlob() {
  for (const templatePath of NKKS_TEMPLATE_CANDIDATES) {
    const response = await fetch(templatePath);
    if (response?.ok) return { response, templatePath };
  }
  throw new Error(
    `Không tìm thấy mẫu NKKS.\n\nKiểm tra file: public/templates/templates_nkks/Template_NKKS.docx`
  );
}

export async function generateNkksWordBlob(formData) {
  const { response } = await fetchNkksTemplateBlob();
  if (!response?.ok) {
    throw new Error(
      `Không tìm thấy mẫu NKKS.\n\nKiểm tra file: public/templates/templates_nkks/Template_NKKS.docx`
    );
  }

  const docData = buildNkksDocData(formData);
  const arrayBuffer = await (await response.blob()).arrayBuffer();
  const outBlob = renderNkksWordBlobWithLayout(arrayBuffer, docData, formData);
  const ts = Date.now();
  const names = buildNkksExportFileNames(formData, { timestamp: ts });

  return {
    outBlob,
    downloadFileName: names.localFileName,
    displayName: names.displayName,
    displayTime: names.displayTime,
    docData,
    timestamp: ts,
  };
}

export async function exportNkksWord({ formData, supabase, saveToStorage = false, download = true }) {
  const { outBlob, downloadFileName, displayName, displayTime, docData, timestamp } =
    await generateNkksWordBlob(formData);

  if (download) {
    saveAs(outBlob, downloadFileName);
  }

  let storagePath = "";
  let storageUrl = "";
  if (saveToStorage && supabase) {
    storagePath = buildNkksExportStoragePath(formData, downloadFileName);
    storageUrl = await uploadNkksExportBlob(supabase, outBlob, storagePath);
  }

  return {
    fileName: downloadFileName,
    docData,
    downloadFileName,
    displayName,
    displayTime,
    storagePath,
    storageUrl,
    blob: outBlob,
    timestamp,
  };
}
