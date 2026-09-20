import { fetchActiveNvksByMaDuAn } from "./nvksPhienBan";
import { fetchActivePaktkByMaDuAn, fetchPaktkForNvks, formatPaktkPhienBanLabel } from "./paktksPhienBan";

export const LOAI_HO_SO_CONFIG = {
  nvks: {
    slug: "nvks",
    label: "Hồ sơ NVKS",
    shortLabel: "NVKS",
    description: "Tra cứu bản ghi NVKS và PDF quyết định phê duyệt",
    icon: "📋",
    color: "emerald",
    phase1Ready: true,
  },
  paktks: {
    slug: "paktks",
    label: "Hồ sơ PAKTKS",
    shortLabel: "PAKTKS",
    description: "Phương án kỹ thuật khảo sát",
    icon: "📑",
    color: "indigo",
    phase1Ready: true,
  },
  bcks: {
    slug: "bcks",
    label: "Hồ sơ BCKS",
    shortLabel: "BCKS",
    description: "Báo cáo khảo sát thực điện",
    icon: "📊",
    color: "amber",
    phase1Ready: false,
  },
  nkks: {
    slug: "nkks",
    label: "Hồ sơ NKKS",
    shortLabel: "NKKS",
    description: "Tra cứu nhật ký khảo sát hiện trường",
    icon: "📝",
    color: "sky",
    phase1Ready: true,
  },
  ntks: {
    slug: "ntks",
    label: "Hồ sơ NTKS",
    shortLabel: "NTKS",
    description: "Tra cứu biên bản nghiệm thu khảo sát",
    icon: "✅",
    color: "green",
    phase1Ready: true,
  },
};

export const LOAI_HO_SO_SLUGS = Object.keys(LOAI_HO_SO_CONFIG);

export function encodeMaDuAn(maDuAn) {
  return encodeURIComponent(maDuAn || "");
}

/** Deep link mở workspace dự án — action nvks mở FormNVKS */
export function buildQuanLyDuAnNvksUrl(maDuAn) {
  if (!maDuAn) return "/";
  return `/du-an/${encodeMaDuAn(maDuAn)}?action=nvks`;
}

/** Deep link mở workspace dự án — action paktks mở FormPAKTKS */
export function buildQuanLyDuAnPaktkUrl(maDuAn) {
  if (!maDuAn) return "/";
  return `/du-an/${encodeMaDuAn(maDuAn)}?action=paktks`;
}

/** Deep link mở workspace dự án — action nkks mở FormNKKS */
export function buildQuanLyDuAnNkksUrl(maDuAn) {
  if (!maDuAn) return "/";
  return `/du-an/${encodeMaDuAn(maDuAn)}?action=nkks`;
}

/** Deep link mở workspace dự án — action nghiem_thu mở FormNTKS */
export function buildQuanLyDuAnNtksUrl(maDuAn) {
  if (!maDuAn) return "/";
  return `/du-an/${encodeMaDuAn(maDuAn)}?action=nghiem_thu`;
}

export function decodeMaDuAn(encoded) {
  try {
    return decodeURIComponent(encoded || "");
  } catch {
    return encoded || "";
  }
}

export function getLoaiHoSoConfig(slug) {
  return LOAI_HO_SO_CONFIG[slug] || null;
}

export function getGiaiDoanChuan(project) {
  if (!project) return "";
  return project.giai_doan === "FS" ? "BCNCKT" : project.giai_doan || "";
}

const TRANG_THAI_NVKS_LABELS = {
  dang_lap: { label: "Đang lập", className: "bg-blue-50 text-blue-700 border-blue-200" },
  co_qd_pd: { label: "Đã có QĐ phê duyệt", className: "bg-green-50 text-green-700 border-green-200" },
  da_chot_kl: { label: "Đã chốt khối lượng", className: "bg-red-50 text-red-700 border-red-200" },
};

export function getNvksTrangThaiMeta(record) {
  if (!record) return null;
  let key = record.trang_thai_nvks;
  if (!key) {
    key = (record.quyet_dinh_phe_duyet_nvks || "").trim() ? "co_qd_pd" : "dang_lap";
  }
  return TRANG_THAI_NVKS_LABELS[key] || TRANG_THAI_NVKS_LABELS.dang_lap;
}

export function formatNgayHienThi(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("vi-VN");
}

/** Danh sách tài liệu hiển thị trong thư mục NVKS */
export function buildNvksDocumentList(nvksRecord) {
  if (!nvksRecord) return [];

  const pbLabel =
    nvksRecord.phien_ban_label ||
    (nvksRecord.so_lan_dc > 0 ? `ĐC-${nvksRecord.so_lan_dc}` : nvksRecord.phien_ban || "GỐC");

  const docs = [
    {
      id: `nvks-form-${nvksRecord.id}`,
      ten: `Hồ sơ NVKS — ${pbLabel}`,
      loai_tep: "metadata",
      phien_ban: pbLabel,
      ngay: nvksRecord.thoi_diem_lap,
      mo_ta: [
        nvksRecord.nguoi_lap && `Người lập: ${nvksRecord.nguoi_lap}`,
        nvksRecord.lanh_dao_duyet && `Lãnh đạo: ${nvksRecord.lanh_dao_duyet}`,
        nvksRecord.loai_hinh && `Loại hình: ${nvksRecord.loai_hinh}`,
      ]
        .filter(Boolean)
        .join(" · "),
      action: "view_metadata",
    },
  ];

  if (nvksRecord.link_docx_xuat) {
    docs.push({
      id: `nvks-docx-${nvksRecord.id}`,
      ten: `Bản Word xuất — ${pbLabel}`,
      loai_tep: "docx",
      phien_ban: pbLabel,
      ngay: nvksRecord.exported_at || nvksRecord.thoi_diem_lap,
      mo_ta: "File Word từ lần xuất gần nhất",
      link: nvksRecord.link_docx_xuat,
      action: "view_file",
    });
  }

  if (nvksRecord.link_pdf_xuat) {
    docs.push({
      id: `nvks-pdf-xuat-${nvksRecord.id}`,
      ten: `Bản PDF phát hành — ${pbLabel}`,
      loai_tep: "pdf",
      phien_ban: pbLabel,
      ngay: nvksRecord.exported_at || nvksRecord.thoi_diem_lap,
      mo_ta: "PDF convert từ Word xuất",
      link: nvksRecord.link_pdf_xuat,
      action: "view_pdf",
    });
  }

  if (nvksRecord.link_pdf_da_ky) {
    docs.push({
      id: `nvks-pdf-ky-${nvksRecord.id}`,
      ten: `PDF +ký — ${pbLabel}`,
      loai_tep: "pdf",
      phien_ban: pbLabel,
      ngay: nvksRecord.exported_at || nvksRecord.thoi_diem_lap,
      mo_ta: "Chỉ chữ ký — in / xuất bản, đóng dấu ướt",
      link: nvksRecord.link_pdf_da_ky,
      action: "view_pdf",
      accent: "ky",
    });
  }

  if (nvksRecord.link_pdf_ky_dau) {
    docs.push({
      id: `nvks-pdf-ky-dau-${nvksRecord.id}`,
      ten: `PDF +ký dấu — ${pbLabel}`,
      loai_tep: "pdf",
      phien_ban: pbLabel,
      ngay: nvksRecord.exported_at || nvksRecord.thoi_diem_lap,
      mo_ta: "Chữ ký + dấu đỏ số — gửi CĐT (không in đóng dấu ướt)",
      link: nvksRecord.link_pdf_ky_dau,
      action: "view_pdf",
      accent: "ky_dau",
    });
  }

  if ((nvksRecord.quyet_dinh_phe_duyet_nvks || "").trim()) {
    docs.push({
      id: `nvks-qd-${nvksRecord.id}`,
      ten: nvksRecord.quyet_dinh_phe_duyet_nvks.trim(),
      loai_tep: "pdf",
      phien_ban: "QĐ PD",
      ngay: nvksRecord.ngay_qd_phe_duyet || null,
      mo_ta: nvksRecord.quyet_dinh_phe_duyet_nvks_day_du || "Quyết định phê duyệt NVKS",
      link: nvksRecord.link_pdf_phe_duyet_nvks || null,
      action: nvksRecord.link_pdf_phe_duyet_nvks ? "view_pdf" : "no_file",
    });
  }

  return docs;
}

/** Gộp tài liệu từ cây phiên bản GỐC → DC-n */
export function buildNvksVersionTreeDocuments(versions) {
  if (!versions?.length) return [];
  const sorted = [...versions].sort((a, b) => (Number(a.so_lan_dc) || 0) - (Number(b.so_lan_dc) || 0));
  return sorted.flatMap((v) => {
    const label = v.so_lan_dc > 0 ? `ĐC-${v.so_lan_dc}` : v.phien_ban || "GỐC";
    return buildNvksDocumentList({ ...v, phien_ban_label: label });
  });
}

export function countNvksDocuments(nvksRecord) {
  return buildNvksDocumentList(nvksRecord).length;
}

const TRANG_THAI_PAKTKS_LABELS = {
  dang_lap: { label: "Đang lập", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  co_qd_pd: { label: "Đã có QĐ phê duyệt", className: "bg-green-50 text-green-700 border-green-200" },
  da_chot: { label: "Đã chốt", className: "bg-red-50 text-red-700 border-red-200" },
};

export function getPaktkTrangThaiMeta(record) {
  if (!record) return null;
  const key = record.trang_thai_paktks || "dang_lap";
  return TRANG_THAI_PAKTKS_LABELS[key] || TRANG_THAI_PAKTKS_LABELS.dang_lap;
}

/** Danh sách tài liệu hiển thị trong thư mục PAKTKS (Phase 1) */
export function buildPaktkDocumentList(paktksRecord) {
  if (!paktksRecord) return [];

  const pbLabel =
    paktksRecord.phien_ban_label ||
    formatPaktkPhienBanLabel(paktksRecord) ||
    paktksRecord.phien_ban ||
    "GOC";

  const docs = [
    {
      id: `paktks-form-${paktksRecord.id}`,
      ten: `Hồ sơ PAKTKS — ${pbLabel}`,
      loai_tep: "metadata",
      phien_ban: pbLabel,
      ngay: paktksRecord.thoi_diem_lap,
      mo_ta: [
        paktksRecord.nguoi_lap && `Người lập: ${paktksRecord.nguoi_lap}`,
        paktksRecord.chu_nhiem_ks && `Chủ nhiệm: ${paktksRecord.chu_nhiem_ks}`,
        paktksRecord.loai_hinh && `Loại hình: ${paktksRecord.loai_hinh}`,
      ]
        .filter(Boolean)
        .join(" · "),
      action: "view_metadata",
    },
  ];

  if (paktksRecord.link_docx_xuat) {
    docs.push({
      id: `paktks-docx-${paktksRecord.id}`,
      ten: `Bản Word xuất — ${pbLabel}`,
      loai_tep: "docx",
      phien_ban: pbLabel,
      ngay: paktksRecord.exported_at || paktksRecord.thoi_diem_lap,
      mo_ta: "File Word từ lần xuất gần nhất",
      link: paktksRecord.link_docx_xuat,
      action: "view_file",
    });
  }

  if (paktksRecord.link_pdf_xuat) {
    docs.push({
      id: `paktks-pdf-xuat-${paktksRecord.id}`,
      ten: `Bản PDF phát hành — ${pbLabel}`,
      loai_tep: "pdf",
      phien_ban: pbLabel,
      ngay: paktksRecord.exported_at || paktksRecord.thoi_diem_lap,
      mo_ta: "PDF convert từ Word xuất",
      link: paktksRecord.link_pdf_xuat,
      action: "view_pdf",
    });
  }

  if (paktksRecord.link_pdf_da_ky) {
    docs.push({
      id: `paktks-pdf-da-ky-${paktksRecord.id}`,
      ten: `PDF +ký — ${pbLabel}`,
      loai_tep: "pdf",
      phien_ban: pbLabel,
      ngay: paktksRecord.exported_at || paktksRecord.thoi_diem_lap,
      mo_ta: "Chỉ chữ ký — in / xuất bản, đóng dấu ướt",
      link: paktksRecord.link_pdf_da_ky,
      action: "view_pdf",
      accent: "ky",
    });
  }

  if (paktksRecord.link_pdf_ky_dau) {
    docs.push({
      id: `paktks-pdf-ky-dau-${paktksRecord.id}`,
      ten: `PDF +ký dấu — ${pbLabel}`,
      loai_tep: "pdf",
      phien_ban: pbLabel,
      ngay: paktksRecord.exported_at || paktksRecord.thoi_diem_lap,
      mo_ta: "Chữ ký + dấu đỏ số — gửi CĐT (không in đóng dấu ướt)",
      link: paktksRecord.link_pdf_ky_dau,
      action: "view_pdf",
      accent: "ky_dau",
    });
  }

  if ((paktksRecord.quyet_dinh_phe_duyet_paktks || "").trim()) {
    docs.push({
      id: `paktks-qd-${paktksRecord.id}`,
      ten: paktksRecord.quyet_dinh_phe_duyet_paktks.trim(),
      loai_tep: "pdf",
      phien_ban: "QĐ PD",
      ngay: paktksRecord.ngay_qd_phe_duyet || null,
      mo_ta: paktksRecord.quyet_dinh_phe_duyet_paktks_day_du || "Quyết định phê duyệt PAKTKS",
      link: paktksRecord.link_pdf_phe_duyet_paktks || null,
      action: paktksRecord.link_pdf_phe_duyet_paktks ? "view_pdf" : "no_file",
    });
  }

  return docs;
}

export function buildPaktkVersionTreeDocuments(versions) {
  if (!versions?.length) return [];
  const sorted = [...versions].sort((a, b) => (Number(a.so_lan_dc) || 0) - (Number(b.so_lan_dc) || 0));
  return sorted.flatMap((v) => {
    const label = formatPaktkPhienBanLabel(v);
    return buildPaktkDocumentList({ ...v, phien_ban_label: label });
  });
}

export function countPaktkDocuments(paktksRecord) {
  return buildPaktkDocumentList(paktksRecord).length;
}

export { fetchNkksByMaDuAn, getNkksTrangThaiMeta, buildNkksDocumentList } from "./nkksHoSo";
export { fetchNtksByMaDuAn, getNtksTrangThaiMeta, buildNtksDocumentList } from "./ntksHoSo";

/** Truy vấn bản NVKS active theo mã dự án */
export async function fetchNvksByMaDuAn(supabase, maDuAn, columns = "id, ma_du_an, quyet_dinh_phe_duyet_nvks, link_pdf_phe_duyet_nvks, phien_ban, so_lan_dc, is_active, thoi_diem_lap") {
  return fetchActiveNvksByMaDuAn(supabase, maDuAn, columns);
}

/** Truy vấn bản PAKTKS active theo mã dự án */
export async function fetchPaktkByMaDuAn(supabase, maDuAn, columns = "*") {
  return fetchActivePaktkByMaDuAn(supabase, maDuAn, columns);
}

export { fetchPaktkForNvks };
