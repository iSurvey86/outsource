/**
 * Xuất Word BCKS — mẫu RTK (Docxtemplater).
 */
import { saveAs } from "file-saver";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { formatGiaiDoanBadge, formatGiaiDoanFullName } from "./giaiDoanOrder";
import { sanitizeNkksExportText } from "./nkksWordExport";
import {
  BCKS_PHU_LUC_SLOTS,
  BCKS_REPORT_BODY_KEYS,
  BCKS_WORD_PARA_KEYS,
  formatBcksKlRowsForWord,
  formatBcksPhuLucForWord,
  formatBcksTcRowsForWord,
  normalizeBcksReport,
  toBcksDsKlForWord,
  toBcksDsTieuChuan,
  toBcksWordParas,
} from "./bcksReportSchema";

export const BCKS_WORD_TEMPLATES = {
  rtk: "/templates/templates_bcks/bcks_rtk.docx",
};

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** Footer: «tháng MM năm YYYY» hoặc giữ chuỗi user nhập / ISO date */
export function formatBcksThoiDiemLap(raw) {
  const s = String(raw || "").trim();
  if (!s) {
    const d = new Date();
    return `tháng ${pad2(d.getMonth() + 1)} năm ${d.getFullYear()}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m] = s.slice(0, 10).split("-");
    return `tháng ${m} năm ${y}`;
  }
  return sanitizeNkksExportText(s);
}

export function buildBcksDownloadFileName(formData) {
  const ma = String(formData?.ma_du_an || "BCKS").replace(/[^\w\-]+/g, "_");
  const now = new Date();
  const ts = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}-${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
  return `${ma}_BCKS_RTK_${ts}.docx`;
}

export function buildBcksDocData(formData) {
  const report = normalizeBcksReport(formData?.chi_tiet_bcks?.bcks || {});
  const ten = sanitizeNkksExportText(formData?.ten_du_an || "");
  const gdBadge =
    formatGiaiDoanBadge(formData?.giai_doan) || sanitizeNkksExportText(formData?.giai_doan || "");
  const gdFull = formatGiaiDoanFullName(formData?.giai_doan) || gdBadge;

  const body = {};
  for (const k of BCKS_REPORT_BODY_KEYS) {
    body[k] = sanitizeNkksExportText(report[k] || "");
  }
  body.muc3_1_tieu_chuan = sanitizeNkksExportText(
    formatBcksTcRowsForWord(report.muc3_1_rows) || report.muc3_1_tieu_chuan || ""
  );
  for (const slot of BCKS_PHU_LUC_SLOTS) {
    body[slot.textKey] = sanitizeNkksExportText(
      formatBcksPhuLucForWord(report[slot.textKey], report[slot.filesKey])
    );
  }

  const quyTrinh = [report.muc3_3a_dia_hinh, report.muc3_3b_dia_chat]
    .map((s) => String(s || "").trim())
    .filter(Boolean)
    .join("\n\n");

  const ds_tieu_chuan = toBcksDsTieuChuan(report.muc3_1_rows).map((r) => ({
    stt: r.stt,
    ky_hieu: sanitizeNkksExportText(r.ky_hieu),
    ten_tai_lieu: sanitizeNkksExportText(r.ten_tai_lieu),
  }));

  const ds_bcks_kl = toBcksDsKlForWord(report.muc4_1_rows).map((r) => ({
    ...r,
    stt: sanitizeNkksExportText(r.stt),
    noi_dung: sanitizeNkksExportText(r.noi_dung),
    don_vi: sanitizeNkksExportText(r.don_vi),
    kl_thuc_hien: sanitizeNkksExportText(r.kl_thuc_hien),
    kl_phe_duyet: sanitizeNkksExportText(r.kl_phe_duyet),
    chenh_lech: sanitizeNkksExportText(r.chenh_lech),
  }));

  /** Mỗi dòng / gạch đầu dòng → đoạn Word riêng (tránh soft-break + căn đều) */
  const paraLoops = {};
  for (const k of BCKS_WORD_PARA_KEYS) {
    paraLoops[`${k}_paras`] = toBcksWordParas(body[k]).map((p) => {
      const rawBody = String(p.body ?? p.text ?? "");
      const lead = rawBody.match(/^\s*/)?.[0] ?? "";
      return {
        text: sanitizeNkksExportText(p.text),
        is_bullet: p.is_bullet,
        dash: p.dash ?? "",
        body: lead + sanitizeNkksExportText(rawBody),
      };
    });
  }

  return {
    ma_du_an: sanitizeNkksExportText(formData?.ma_du_an || ""),
    ten_du_an: ten,
    ten_du_an_bia: ten,
    giai_doan: gdFull || gdBadge,
    giai_doan_in_hoa: String(gdFull || gdBadge || "").toUpperCase(),
    is_dieu_chinh: Boolean(report.is_dieu_chinh),
    nguoi_lap: sanitizeNkksExportText(report.nguoi_lap || ""),
    chu_nhiem_ks: sanitizeNkksExportText(report.chu_nhiem_ks || ""),
    lanh_dao_duyet: sanitizeNkksExportText(report.lanh_dao_duyet || ""),
    thoi_diem_lap: formatBcksThoiDiemLap(report.thoi_diem_lap),
    ...body,
    ...paraLoops,
    muc3_3_quy_trinh: sanitizeNkksExportText(quyTrinh),
    muc4_1_khoi_luong: sanitizeNkksExportText(formatBcksKlRowsForWord(report.muc4_1_rows)),
    ds_tieu_chuan,
    ds_bcks_kl,
  };
}

async function loadRtkTemplate() {
  const path = BCKS_WORD_TEMPLATES.rtk;
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Không tải được mẫu Word: ${path}`);
  return res.arrayBuffer();
}

export async function generateBcksWordBlob(formData) {
  const buf = await loadRtkTemplate();
  const zip = new PizZip(buf);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });
  doc.render(buildBcksDocData(formData));
  return doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

export async function exportBcksWord(formData, { download = true } = {}) {
  const blob = await generateBcksWordBlob(formData);
  const fileName = buildBcksDownloadFileName(formData);
  if (download) saveAs(blob, fileName);
  return { blob, fileName };
}
