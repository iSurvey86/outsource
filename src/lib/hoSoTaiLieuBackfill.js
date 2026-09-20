/**
 * Backfill TAI_LIEU_HO_SO từ link xuất trên HO_SO_* (mỗi tag chỉ 1 file / dự án).
 */

import { extractFileNameFromUrl, splitExportLocalFileName } from "./exportFileNaming";
import { syncTaiLieuHoSoByTag } from "./hoSoTaiLieu";

export function exportDisplayNameFromUrl(url, exportedAt) {
  const local = extractFileNameFromUrl(url);
  if (!local) return "file";
  const parts = splitExportLocalFileName(local);
  if (parts.displayName) return parts.displayName;
  return local;
}

function pushEntry(entries, { tag, url, exportedAt, nguon = "xuat_ban" }) {
  const path = String(url || "").trim();
  if (!path) return;
  entries.push({
    tag,
    nguon,
    storagePath: path,
    displayName: exportDisplayNameFromUrl(path, exportedAt),
    thoiGian: exportedAt || new Date().toISOString(),
  });
}

/** @returns {{ tag, nguon, storagePath, displayName, thoiGian }[]} */
export function collectNvksExportEntries(row) {
  if (!row?.ma_du_an) return [];
  const at = row.exported_at || row.thoi_diem_lap || null;
  const entries = [];
  pushEntry(entries, { tag: "docx", url: row.link_docx_xuat, exportedAt: at });
  pushEntry(entries, { tag: "pdf", url: row.link_pdf_xuat, exportedAt: at });
  pushEntry(entries, { tag: "pdf_da_ky", url: row.link_pdf_da_ky, exportedAt: at, nguon: "upload" });
  pushEntry(entries, {
    tag: "qd_pd",
    url: row.link_pdf_phe_duyet_nvks,
    exportedAt: row.ngay_qd_phe_duyet || at,
    nguon: "upload",
  });
  return entries;
}

export function collectPaktkExportEntries(row) {
  if (!row?.ma_du_an) return [];
  const at = row.exported_at || row.thoi_diem_lap || null;
  const entries = [];
  pushEntry(entries, { tag: "docx", url: row.link_docx_xuat, exportedAt: at });
  pushEntry(entries, { tag: "pdf", url: row.link_pdf_xuat, exportedAt: at });
  pushEntry(entries, {
    tag: "qd_pd",
    url: row.link_pdf_phe_duyet_paktks,
    exportedAt: row.ngay_qd_phe_duyet || at,
    nguon: "upload",
  });
  return entries;
}

export function collectNkksExportEntries(row) {
  if (!row?.ma_du_an) return [];
  const at = row.exported_at || row.updated_at || null;
  const entries = [];
  pushEntry(entries, { tag: "docx", url: row.link_docx_xuat, exportedAt: at });
  pushEntry(entries, { tag: "pdf", url: row.link_pdf_xuat, exportedAt: at });
  return entries;
}

export function collectBcksExportEntries(row) {
  if (!row?.ma_du_an) return [];
  const at = row.exported_at || row.updated_at || null;
  const entries = [];
  pushEntry(entries, { tag: "docx", url: row.link_docx_xuat, exportedAt: at });
  return entries;
}

export function collectNtksExportEntries(row) {
  if (!row?.ma_du_an) return [];
  const at = row.exported_at || row.updated_at || null;
  const entries = [];
  pushEntry(entries, { tag: "docx", url: row.link_docx_xuat, exportedAt: at });
  // File theo từng biên bản (nếu có trong chi_tiet)
  let chi = row.chi_tiet_ntks;
  if (typeof chi === "string") {
    try {
      chi = JSON.parse(chi);
    } catch {
      chi = null;
    }
  }
  if (chi && typeof chi === "object") {
    for (const [formKey, detail] of Object.entries(chi)) {
      if (!detail || typeof detail !== "object") continue;
      pushEntry(entries, {
        tag: `docx_${formKey}`,
        url: detail.link_docx_xuat,
        exportedAt: detail.exported_at || at,
      });
      pushEntry(entries, {
        tag: `pdf_${formKey}`,
        url: detail.link_pdf_xuat,
        exportedAt: detail.exported_at || at,
      });
    }
  }
  return entries;
}

/**
 * Ghi các entry vào kho — mỗi tag thay bản cũ (replaceExisting).
 * @returns {Promise<number>} số dòng đã sync
 */
export async function syncExportEntriesToKho(supabase, {
  maDuAn,
  moduleLoai,
  entries = [],
  nguoiUpMaNv = null,
  loaiKho = "khao_sat",
}) {
  let n = 0;
  for (const e of entries) {
    await syncTaiLieuHoSoByTag(supabase, {
      maDuAn,
      moduleLoai,
      loaiKho,
      nguon: e.nguon,
      tag: e.tag,
      storagePath: e.storagePath,
      displayName: e.displayName,
      thoiGian: e.thoiGian,
      nguoiUpMaNv,
      replaceExisting: true,
    });
    n += 1;
  }
  return n;
}
