/**
 * Sổ Hợp đồng — Lát 0–4 (HĐ chính, PL/ĐC, thầu phụ, cầu nối TÚ/TT đọc sổ).
 */

import { bgdGroupKeyForProject, normalizeTenDuAn } from "./giaoViecInbox";
import { formatGiaiDoanBadge, sortProjectsByGiaiDoan } from "./giaiDoanOrder";
import { formatHopDongShort, normalizeSoHopDongKey, resolveHopDongSoVaNgay } from "./formatHopDong";
import { normalizeChietGiamTnctttForDb } from "./hopDongTncttt";
import { syncKhnQdNgayKyFromHopDong } from "./khnGiaoACode";
import { detectHopDongPhaseHints } from "./hopDongPhaseScan";

export {
  detectHopDongPhaseHints,
  findMaDuAnsOutsidePhaseSuggestion,
  formatSuggestedPhaseKeysLabel,
  isNarrowPhaseSuggestion,
  normalizeHopDongPhaseKey,
  normalizeHopDongScopeText,
  phaseBadgeMatchesSuggestion,
  refineMaDuAnsAfterHopDongScan,
  resolveSuggestedPhaseBadges,
} from "./hopDongPhaseScan";

export const HOP_DONG_LOAI = {
  CHINH: "chinh",
  PHU_LUC_DC: "phu_luc_dc",
  THAU_PHU: "thau_phu",
};

export const HOP_DONG_TRANG_THAI = {
  HIEU_LUC: "hieu_luc",
  HET_HIEU_LUC: "het_hieu_luc",
  THAY_THE: "thay_the",
};

/** Số HĐ placeholder từ Excel/import (không phải HĐ pháp lý). */
export function isPlaceholderSoHopDong(so) {
  const s = String(so || "")
    .trim()
    .toLocaleLowerCase("vi")
    .replace(/\s+/g, " ");
  if (!s) return false;
  return (
    /^chưa\s*ký(\s*hđ|\s*hợp\s*đồng)?$/.test(s) ||
    /^chua\s*ky(\s*hd|\s*hop\s*dong)?$/.test(s) ||
    /^chưa\s*có(\s*hđ|\s*hợp\s*đồng)?$/.test(s) ||
    /^chua\s*co(\s*hd|\s*hop\s*dong)?$/.test(s) ||
    s === "n/a" ||
    s === "-"
  );
}

/** Loại dịch vụ thầu phụ (Lát 3) */
export const HOP_DONG_LOAI_THAU_PHU = {
  DIA_CHAT: "dia_chat",
  DIA_HINH: "dia_hinh",
  KHAC: "khac",
};

export const HOP_DONG_LY_DO_KY_LAI = {
  DOI_PHAP_NHAN: "doi_phap_nhan",
  SAP_NHAP: "sap_nhap",
  CHUYEN_CHU_DAU_TU: "chuyen_chu_dau_tu",
  KHAC: "khac",
};

export const HOP_DONG_COLUMNS =
  "id, ten_cong_trinh, nhom_cong_trinh_key, loai, so_hop_dong, hop_dong_day_du, ngay_ky, ben_a, ben_b, gia_tri, link_pdf, trang_thai, hop_dong_goc_id, loai_thau_phu, ghi_chu, created_at, updated_at";

export const HOP_DONG_LIFECYCLE_COLUMNS =
  HOP_DONG_COLUMNS.replace(", created_at, updated_at", "") +
  ", ky_lai_tu_id, ly_do_ky_lai, created_at, updated_at";

/** Cột mở rộng (sau create-hop-dong-thuc-hien.sql) — dùng khi import / form số liệu */
export const HOP_DONG_EXTENDED_COLUMNS =
  HOP_DONG_COLUMNS.replace(", created_at, updated_at", "") +
  ", thoi_han_ngay, dich_vu_tu_van, pl_gia_han, ngay_ky_pl, thoi_gian_gia_han, created_at, updated_at";

/** Cột thời hạn/cảnh báo (sau add-hop-dong-thoi-han-nhan-su.sql). */
export const HOP_DONG_MANAGEMENT_COLUMNS =
  HOP_DONG_LIFECYCLE_COLUMNS.replace(", created_at, updated_at", "") +
  ", thoi_han_ngay, moc_bat_dau, ngay_bat_dau, ngay_het_han_du_kien, canh_bao_truoc_ngay, nguon_trang_tien_do, chi_phi_chung, chiet_giam_tncttt, created_at, updated_at";

export function loaiThauPhuLabel(loaiThauPhu) {
  if (loaiThauPhu === HOP_DONG_LOAI_THAU_PHU.DIA_CHAT) return "Địa chất";
  if (loaiThauPhu === HOP_DONG_LOAI_THAU_PHU.DIA_HINH) return "Địa hình";
  if (loaiThauPhu === HOP_DONG_LOAI_THAU_PHU.KHAC) return "Khác";
  return loaiThauPhu || "—";
}

export function lyDoKyLaiLabel(value) {
  if (value === HOP_DONG_LY_DO_KY_LAI.DOI_PHAP_NHAN) return "Đổi pháp nhân";
  if (value === HOP_DONG_LY_DO_KY_LAI.SAP_NHAP) return "Sáp nhập";
  if (value === HOP_DONG_LY_DO_KY_LAI.CHUYEN_CHU_DAU_TU) return "Chuyển chủ đầu tư";
  if (value === HOP_DONG_LY_DO_KY_LAI.KHAC) return "Lý do khác";
  return value || "Ký lại hợp đồng";
}

export function parseGiaTriHopDong(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const s = String(raw)
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .replace(/[^\d.-]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseNonNegativeInt(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function hopDongManagementPayload(form) {
  return {
    thoi_han_ngay: parseNonNegativeInt(form?.thoi_han_ngay),
    moc_bat_dau: String(form?.moc_bat_dau || "").trim() || null,
    ngay_bat_dau: form?.ngay_bat_dau || null,
    ngay_het_han_du_kien: form?.ngay_het_han_du_kien || null,
    canh_bao_truoc_ngay: parseNonNegativeInt(form?.canh_bao_truoc_ngay) ?? 15,
    nguon_trang_tien_do: parseNonNegativeInt(form?.nguon_trang_tien_do),
    chi_phi_chung: normalizeChiPhiChungForDb(form?.chi_phi_chung),
    chiet_giam_tncttt: normalizeChietGiamTnctttForDb(form?.chiet_giam_tncttt),
  };
}

/** Chuẩn hoá mảng chi phí chung trước khi ghi DB (jsonb). */
export function normalizeChiPhiChungForDb(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const out = list
    .map((r) => {
      const mo_ta = String(r?.mo_ta || "").trim();
      const gia = parseGiaTriHopDong(r?.gia_tri);
      const loai = String(r?.loai || "khac").trim() || "khac";
      if (!mo_ta && (gia == null || gia === 0)) return null;
      return { mo_ta: mo_ta || "Chi phí chung", gia_tri: gia, loai };
    })
    .filter(Boolean);
  return out;
}

export function formatGiaTriHopDong(giaTri) {
  const n = typeof giaTri === "number" ? giaTri : parseGiaTriHopDong(giaTri);
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  try {
    return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(n)} đ`;
  } catch {
    return `${n} đ`;
  }
}

/** Id HĐ gốc trong chuỗi CĐT (chính hoặc PL trỏ về gốc) */
export function resolveHopDongGocId(hd) {
  if (!hd) return null;
  if (hd.loai === HOP_DONG_LOAI.CHINH) return hd.id;
  return hd.hop_dong_goc_id || hd.id;
}

/** Các bản ghi cùng chuỗi (gốc + PL/ĐC) */
export function filterHopDongChain(rows, gocId) {
  if (!gocId) return [];
  return (rows || []).filter((h) => {
    if (h.loai === HOP_DONG_LOAI.THAU_PHU) return false;
    if (h.id === gocId) return true;
    return h.hop_dong_goc_id === gocId;
  });
}

/** Bản đang hiệu lực trong chuỗi CĐT (ưu tiên PL mới, rồi chính) */
export function getCdtHieuLucInChain(chainRows) {
  const list = chainRows || [];
  const pl = list
    .filter((h) => h.loai === HOP_DONG_LOAI.PHU_LUC_DC && h.trang_thai === HOP_DONG_TRANG_THAI.HIEU_LUC)
    .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
  if (pl[0]) return pl[0];
  return (
    list.find((h) => h.loai === HOP_DONG_LOAI.CHINH && h.trang_thai === HOP_DONG_TRANG_THAI.HIEU_LUC) || null
  );
}

/**
 * Gom các chuỗi CĐT trùng số HĐ (import / lưu tách theo giai đoạn) → một ô trên sổ.
 * Giữ bản «đại diện» để sửa/PL; hợp nhất mã DA + id HĐ để đọc số liệu thực hiện.
 */
export function mergeCdtHopDongChainsForDisplay(chains = [], linksByHd = {}, focusMaDuAn = "") {
  const focusMa = String(focusMaDuAn || "").trim();

  const scoreChain = (c) => {
    let s = 0;
    const mas = linksByHd[c.hieuLuc?.id] || linksByHd[c.gocId] || [];
    if (focusMa && mas.includes(focusMa)) s += 100;
    if (c.hieuLuc?.trang_thai === HOP_DONG_TRANG_THAI.HIEU_LUC) s += 50;
    if (c.hieuLuc?.ngay_ky || c.goc?.ngay_ky) s += 20;
    if (c.hieuLuc?.hop_dong_day_du || c.goc?.hop_dong_day_du) s += 15;
    if (c.hieuLuc?.link_pdf || c.goc?.link_pdf) s += 10;
    s += mas.length;
    s += (c.plList || []).length;
    return s;
  };

  const groups = new Map();
  for (const chain of chains) {
    const rawSo = chain.hieuLuc?.so_hop_dong || chain.goc?.so_hop_dong || "";
    const key = normalizeSoHopDongKey(rawSo) || `id:${chain.gocId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(chain);
  }

  return [...groups.values()].map((group) => {
    if (group.length === 1) {
      const only = group[0];
      const mas = linksByHd[only.hieuLuc?.id] || linksByHd[only.gocId] || [];
      return {
        ...only,
        mergedMaDuAns: mas,
        relatedHopDongs: [only.hieuLuc, only.goc].filter(Boolean),
      };
    }

    const ranked = [...group].sort((a, b) => scoreChain(b) - scoreChain(a));
    const primary = ranked[0];
    const mas = new Set();
    const relatedById = new Map();
    const plById = new Map();
    const historyById = new Map();

    for (const c of ranked) {
      for (const ma of linksByHd[c.hieuLuc?.id] || linksByHd[c.gocId] || []) {
        if (ma) mas.add(ma);
      }
      for (const hd of [c.hieuLuc, c.goc, ...(c.chain || [])]) {
        if (hd?.id) relatedById.set(hd.id, hd);
      }
      for (const p of c.plList || []) {
        if (p?.id) plById.set(p.id, p);
      }
      for (const h of c.history || []) {
        if (h?.id) historyById.set(h.id, h);
      }
    }

    const primaryHieuLucId = primary.hieuLuc?.id;
    if (primaryHieuLucId) historyById.delete(primaryHieuLucId);

    const history = [...historyById.values()].sort((a, b) =>
      String(b.updated_at || "").localeCompare(String(a.updated_at || ""))
    );
    const plList = [...plById.values()].sort((a, b) =>
      String(b.updated_at || "").localeCompare(String(a.updated_at || ""))
    );

    return {
      ...primary,
      plList,
      history,
      mergedMaDuAns: [...mas],
      relatedHopDongs: [...relatedById.values()],
    };
  });
}

export function trangThaiHopDongLabel(trangThai) {
  if (trangThai === HOP_DONG_TRANG_THAI.THAY_THE) return "Đã thay thế";
  if (trangThai === HOP_DONG_TRANG_THAI.HET_HIEU_LUC) return "Hết hiệu lực";
  return "Hiệu lực";
}

/**
 * Dò gợi ý giai đoạn từ nội dung gói thầu / HĐ đầy đủ (sau quét AI).
 * - Có BCNCKT/FS + (TKKT | BCKTKT | TKBVTC) → nhiều giai đoạn
 * - Chỉ một phía → một giai đoạn
 */
// detectHopDongPhaseHints — xem hopDongPhaseScan.js (re-export ở đầu file)

/**
 * Gợi ý danh sách ma_du_an cần tích sau quét AI.
 * @returns {{ maDuAns: string[], hintLabel: string } | null} null = không đủ tín hiệu, giữ lựa chọn cũ
 */
export function suggestMaDuAnFromHopDongScan(text, siblingProjects = []) {
  const siblings = siblingProjects || [];
  if (!siblings.length) return null;

  const hints = detectHopDongPhaseHints(text);
  if (!hints.hasFs && !hints.hasThietKe) return null;

  const wantFs = hints.hasFs;
  const wantBcktkt = hints.hasThietKe && (hints.hasBcktkt || (!hints.hasTkbvtc && hints.hasTkkt));
  const wantTkbvtc =
    hints.hasThietKe && (hints.hasTkbvtc || hints.hasTkkt || (!hints.hasBcktkt && hints.hasThietKe));

  // Nếu chỉ nêu TKKT + TKBVTC (không BCKTKT rõ) → ưu tiên gắn dòng TKBVTC (và BCKTKT nếu có trong nhóm)
  const selected = [];
  for (const p of siblings) {
    const badge = formatGiaiDoanBadge(p.giai_doan_chuan || p.giai_doan);
    if (wantFs && (badge === "FS" || badge === "BCNCKT")) {
      selected.push(p.ma_du_an);
      continue;
    }
    if (wantBcktkt && badge === "BCKTKT") {
      selected.push(p.ma_du_an);
      continue;
    }
    if (wantTkbvtc && badge === "TKBVTC") {
      selected.push(p.ma_du_an);
    }
  }

  // Fallback: có tín hiệu thiết kế nhưng không khớp BCKTKT/TKBVTC riêng → lấy mọi GD không phải FS
  if (hints.hasThietKe && !selected.some((ma) => {
    const p = siblings.find((x) => x.ma_du_an === ma);
    const b = formatGiaiDoanBadge(p?.giai_doan_chuan || p?.giai_doan);
    return b === "BCKTKT" || b === "TKBVTC";
  })) {
    for (const p of siblings) {
      const badge = formatGiaiDoanBadge(p.giai_doan_chuan || p.giai_doan);
      if (badge !== "FS" && badge !== "BCNCKT" && !selected.includes(p.ma_du_an)) {
        selected.push(p.ma_du_an);
      }
    }
  }

  const unique = [...new Set(selected.filter(Boolean))];
  if (!unique.length) return null;

  let hintLabel = "";
  if (hints.hasFs && hints.hasThietKe) {
    hintLabel = "Gói thầu gợi ý nhiều giai đoạn (FS/BCNCKT + thiết kế) — vui lòng kiểm tra lại.";
  } else if (hints.hasFs) {
    hintLabel = "Gói thầu gợi ý giai đoạn FS/BCNCKT — vui lòng kiểm tra lại.";
  } else {
    hintLabel = "Gói thầu gợi ý giai đoạn thiết kế (TKKT/BCKTKT/TKBVTC) — vui lòng kiểm tra lại.";
  }

  return { maDuAns: unique, hintLabel, hints };
}

/** Chuỗi so sánh HĐ — dùng phát hiện xung đột giữa các giai đoạn */
export function hopDongFingerprint(soHopDong, hopDongDayDu = "", linkPdf = "") {
  return [
    String(soHopDong || "").trim().toLowerCase(),
    String(hopDongDayDu || "").trim().toLowerCase(),
    String(linkPdf || "").trim(),
  ].join("|");
}

export function isEmptyHopDongCache(project) {
  if (!project) return true;
  return (
    !String(project.hop_dong || "").trim() &&
    !String(project.hop_dong_day_du || "").trim() &&
    !String(project.link_pdf_hop_dong || "").trim()
  );
}

/**
 * Xung đột khi lưu HĐ chính lên tập giai đoạn đã chọn:
 * - ≥2 giá trị HĐ cache khác nhau giữa các giai đoạn, hoặc
 * - đã có HĐ khác với bản đang nhập (cần forceOverwrite / C2).
 * Dòng trống không tính.
 */
export function detectHopDongPhaseConflict(phaseProjects, nextFingerprint = null) {
  const map = new Map();
  for (const p of phaseProjects || []) {
    if (isEmptyHopDongCache(p)) continue;
    const fp = hopDongFingerprint(p.hop_dong, p.hop_dong_day_du, p.link_pdf_hop_dong);
    if (!fp || fp === "||") continue;
    if (!map.has(fp)) map.set(fp, []);
    map.get(fp).push(p);
  }

  const distinct = [...map.entries()];
  const groups = distinct.map(([fp, projects]) => ({
    fingerprint: fp,
    label: projects[0]?.hop_dong || projects[0]?.hop_dong_day_du || "(HĐ khác)",
    projects,
  }));

  if (distinct.length === 0) return { hasConflict: false, groups: [] };
  if (distinct.length > 1) return { hasConflict: true, groups };

  const onlyFp = distinct[0][0];
  if (nextFingerprint && nextFingerprint !== "||" && onlyFp !== nextFingerprint) {
    return { hasConflict: true, groups };
  }
  return { hasConflict: false, groups: [] };
}

export function formatConflictMessage(conflict, { forAlert = false } = {}) {
  if (!conflict?.hasConflict) return "";
  const groups = conflict.groups || [];
  const totalPhases = groups.reduce((s, g) => s + (g.projects?.length || 0), 0);

  if (forAlert) {
    return [
      "Các giai đoạn / công trình đã chọn đang gắn Hợp đồng khác với nội dung đang nhập (hoặc khác nhau giữa các giai đoạn).",
      `${groups.length} nhóm HĐ · ${totalPhases} giai đoạn bị ảnh hưởng.`,
      "",
      "Đóng hộp này → kéo xuống khung vàng trong form → bấm «Ghi đè tất cả bằng nội dung đang nhập» nếu đúng ý bạn.",
    ].join("\n");
  }

  const maxNames = 4;
  const lines = groups.map((g) => {
    const projects = g.projects || [];
    const names = projects.map((p) => {
      const badge = formatGiaiDoanBadge(p.giai_doan_chuan || p.giai_doan) || p.ma_du_an;
      const ten = String((p.ten_du_an || p.ten) || "").trim();
      const shortTen = ten.length > 48 ? `${ten.slice(0, 46)}…` : ten;
      return shortTen ? `${shortTen} · ${badge}` : badge;
    });
    const shown = names.slice(0, maxNames).join("; ");
    const more = names.length > maxNames ? ` … và ${names.length - maxNames} giai đoạn nữa` : "";
    const label = String(g.label || "(HĐ khác)").trim();
    const shortLabel = label.length > 72 ? `${label.slice(0, 70)}…` : label;
    return `• ${shortLabel} (${projects.length}): ${shown}${more}`;
  });

  return [
    "Các giai đoạn / công trình đã chọn đang có Hợp đồng khác nhau.",
    "Không thể áp dụng hàng loạt cho đến khi bạn xác nhận ghi đè.",
    "",
    ...lines,
    "",
    "Sửa từng giai đoạn, hoặc dùng «Ghi đè tất cả bằng nội dung đang nhập» (xác nhận).",
  ].join("\n");
}

export function siblingPhasesForProject(allProjects, project) {
  if (!project) return [];
  const key = bgdGroupKeyForProject(project);
  const list = (allProjects || []).filter((p) => bgdGroupKeyForProject(p) === key);
  return sortProjectsByGiaiDoan(list);
}

/** Lấy dự án theo danh sách mã — không giới hạn cùng công trình. */
export function projectsByMaDuAns(allProjects, maList) {
  const want = new Set((maList || []).map((m) => String(m || "").trim()).filter(Boolean));
  if (!want.size) return [];
  const found = (allProjects || []).filter((p) => want.has(String(p?.ma_du_an || "").trim()));
  const byMa = new Map(found.map((p) => [p.ma_du_an, p]));
  // Giữ thứ tự maList; stub tối thiểu nếu thiếu trong danh mục
  return [...want].map((ma) => byMa.get(ma) || { ma_du_an: ma, giai_doan: "", ten_du_an: "" });
}

/** Khóa gom theo số / tiêu đề Giao A (cùng QĐ → nhiều công trình). */
export function giaoAGroupKeyForProject(project) {
  const short = String(project?.qd_giao_a || "").trim().toLowerCase();
  if (short) return short;
  const full = String(project?.qd_giao_a_day_du || "").trim().toLowerCase();
  if (full) return full.slice(0, 160);
  return "";
}

export function projectMatchesHopDongScopeQuery(project, query) {
  const q = String(query || "").trim().toLowerCase();
  if (q.length < 2) return false;
  const hay = [
    project?.qd_giao_a,
    project?.qd_giao_a_day_du,
    project?.ten_du_an || project?.ten,
    project?.ma_du_an,
    project?.nam_giao_a,
  ]
    .map((x) => String(x || "").toLowerCase())
    .join(" ");
  return hay.includes(q);
}

/**
 * Cây tìm phạm vi HĐ khung: Giao A → công trình → giai đoạn (1 hoặc 2 mã DA).
 * Khớp số/tiêu đề Giao A, tên CT, mã DA. Bỏ mã thuộc công trình đang mở (excludeMaSet).
 */
export function buildHopDongOtherCtTree(allProjects, { query, excludeMaSet } = {}) {
  const q = String(query || "").trim();
  if (q.length < 2) return [];

  const excluded = excludeMaSet instanceof Set ? excludeMaSet : new Set(excludeMaSet || []);
  const candidates = (allProjects || []).filter(
    (p) => p?.ma_du_an && !excluded.has(p.ma_du_an)
  );

  const byGiaoA = new Map();
  for (const p of candidates) {
    const gaKey =
      giaoAGroupKeyForProject(p) || `__no_ga__:${bgdGroupKeyForProject(p) || p.ma_du_an}`;
    if (!byGiaoA.has(gaKey)) byGiaoA.set(gaKey, []);
    byGiaoA.get(gaKey).push(p);
  }

  const trees = [];
  for (const [gaKey, projects] of byGiaoA) {
    if (!projects.some((p) => projectMatchesHopDongScopeQuery(p, q))) continue;

    const byCt = new Map();
    for (const p of projects) {
      const ctKey = bgdGroupKeyForProject(p) || p.ma_du_an;
      if (!byCt.has(ctKey)) byCt.set(ctKey, []);
      byCt.get(ctKey).push(p);
    }

    const congTrinhs = [...byCt.values()]
      .map((phases) => {
        const sorted = sortProjectsByGiaiDoan(phases);
        const sample = sorted[0];
        return {
          key: bgdGroupKeyForProject(sample) || sample.ma_du_an,
          ten_du_an: sample?.ten_du_an || sample?.ten || "",
          phases: sorted,
          maDuAns: sorted.map((p) => p.ma_du_an),
        };
      })
      .sort((a, b) => String(a.ten_du_an).localeCompare(String(b.ten_du_an), "vi"));

    const sample = projects[0];
    trees.push({
      key: gaKey,
      qd_giao_a: sample?.qd_giao_a || "",
      qd_giao_a_day_du: sample?.qd_giao_a_day_du || "",
      congTrinhCount: congTrinhs.length,
      maCount: projects.length,
      maDuAns: projects.map((p) => p.ma_du_an),
      congTrinhs,
    });
  }

  trees.sort((a, b) =>
    String(a.qd_giao_a || a.key).localeCompare(String(b.qd_giao_a || b.key), "vi")
  );
  return trees.slice(0, 10);
}

/**
 * Sổ HĐ cho workspace: HĐ theo nhom công trình đang mở
 * + HĐ đã gắn mã DA này (hoặc sibling) kể cả khi neo nhom ở công trình khác (HĐ khung đa CT).
 */
export async function fetchHopDongBookForProject(supabase, project, allProjects = []) {
  if (!project?.ma_du_an) return [];

  const siblings = siblingPhasesForProject(
    allProjects?.length ? allProjects : [project],
    project
  );
  const maScope = [
    ...new Set(
      [project.ma_du_an, ...siblings.map((p) => p.ma_du_an)].map((m) => String(m || "").trim()).filter(Boolean)
    ),
  ];

  // Chỉ mở rộng neo cùng công trình đang mở — tránh kéo cả sổ dự án khác khi link lệch.
  const allowedNhoms = new Set();
  for (const p of [project, ...siblings]) {
    const k = bgdGroupKeyForProject(p);
    if (k) allowedNhoms.add(k);
  }
  const projectNhom = bgdGroupKeyForProject(project);
  if (projectNhom) allowedNhoms.add(projectNhom);

  const nhomKeys = new Set(allowedNhoms);
  const linkedIds = new Set();

  if (maScope.length) {
    const { data: links, error: linkErr } = await supabase
      .from("HOP_DONG_GIAI_DOAN")
      .select("hop_dong_id")
      .in("ma_du_an", maScope);
    if (linkErr) throw linkErr;
    for (const l of links || []) {
      if (l?.hop_dong_id) linkedIds.add(l.hop_dong_id);
    }
    if (linkedIds.size) {
      const { data: linkedHd, error: hdErr } = await supabase
        .from("HOP_DONG")
        .select("id, nhom_cong_trinh_key")
        .in("id", [...linkedIds]);
      if (hdErr) throw hdErr;
      for (const h of linkedHd || []) {
        // Chỉ nhận neo trùng công trình; neo lạ (HĐ gắn nhầm) không được kéo cả nhóm.
        if (h.nhom_cong_trinh_key && allowedNhoms.has(h.nhom_cong_trinh_key)) {
          nhomKeys.add(h.nhom_cong_trinh_key);
        }
      }
    }
  }

  const byId = new Map();
  for (const key of nhomKeys) {
    const rows = await fetchHopDongByNhomKey(supabase, key);
    for (const h of rows) {
      if (h?.id) byId.set(h.id, h);
    }
  }

  // HĐ gắn trực tiếp mã giai đoạn vẫn hiện (để user thấy và gỡ), kể cả khi neo tên lệch.
  if (linkedIds.size) {
    const missing = [...linkedIds].filter((id) => !byId.has(id));
    if (missing.length) {
      const { data: directHd, error: directErr } = await supabase
        .from("HOP_DONG")
        .select(HOP_DONG_MANAGEMENT_COLUMNS)
        .in("id", missing);
      if (directErr) {
        const { data: fallbackHd, error: fbErr } = await supabase
          .from("HOP_DONG")
          .select(HOP_DONG_COLUMNS)
          .in("id", missing);
        if (fbErr) throw fbErr;
        for (const h of fallbackHd || []) {
          if (h?.id) byId.set(h.id, h);
        }
      } else {
        for (const h of directHd || []) {
          if (h?.id) byId.set(h.id, h);
        }
      }
    }
  }

  return [...byId.values()].sort((a, b) =>
    String(b.created_at || "").localeCompare(String(a.created_at || ""))
  );
}

/**
 * Gỡ HĐ khỏi sổ công trình đang mở: xóa liên kết giai đoạn (+ số liệu THUC/XUAT của các mã đó trên HĐ).
 * Không xóa bản ghi HOP_DONG — HĐ vẫn có thể thuộc dự án khác.
 */
export async function unlinkHopDongFromCongTrinh(supabase, { hopDongId, project, allProjects = [] }) {
  const hdId = String(hopDongId || "").trim();
  if (!hdId) throw new Error("Thiếu hợp đồng.");
  if (!project?.ma_du_an) throw new Error("Thiếu dự án đang mở.");

  const siblings = siblingPhasesForProject(
    allProjects?.length ? allProjects : [project],
    project
  );
  const maScope = [
    ...new Set(
      [project.ma_du_an, ...siblings.map((p) => p.ma_du_an)]
        .map((m) => String(m || "").trim())
        .filter(Boolean)
    ),
  ];
  if (!maScope.length) throw new Error("Không xác định được giai đoạn công trình.");

  const { error: linkErr } = await supabase
    .from("HOP_DONG_GIAI_DOAN")
    .delete()
    .eq("hop_dong_id", hdId)
    .in("ma_du_an", maScope);
  if (linkErr) throw linkErr;

  const { error: xuatErr } = await supabase
    .from("HOP_DONG_XUAT_HD")
    .delete()
    .eq("hop_dong_id", hdId)
    .in("ma_du_an", maScope);
  if (xuatErr && !/does not exist|Could not find|PGRST/i.test(String(xuatErr.message || ""))) {
    throw xuatErr;
  }

  const { error: thErr } = await supabase
    .from("HOP_DONG_THUC_HIEN")
    .delete()
    .eq("hop_dong_id", hdId)
    .in("ma_du_an", maScope);
  if (thErr && !/does not exist|Could not find|PGRST/i.test(String(thErr.message || ""))) {
    throw thErr;
  }

  // Cache danh mục: xóa nếu đang khớp HĐ vừa gỡ, rồi gắn lại nếu còn HĐ CĐT khác trên sổ
  const { data: hdRow } = await supabase
    .from("HOP_DONG")
    .select("so_hop_dong, hop_dong_day_du, link_pdf")
    .eq("id", hdId)
    .maybeSingle();
  const prevFp = hopDongFingerprint(hdRow?.so_hop_dong, hdRow?.hop_dong_day_du, hdRow?.link_pdf);
  await syncHopDongCacheToDanhMuc(supabase, {
    hopDong: null,
    maDuAns: [],
    clearMaDuAns: maScope,
    previousFingerprint: prevFp && prevFp !== "||" ? prevFp : null,
  });
  for (const ma of maScope) {
    await ensureHopDongCacheFromSo(supabase, ma, { force: true });
  }

  // Placeholder «Chưa ký HĐ»: nếu không còn gắn giai đoạn nào → xóa hẳn (tránh báo cáo vẫn hiện qua neo nhom).
  if (isPlaceholderSoHopDong(hdRow?.so_hop_dong)) {
    const { data: leftLinks } = await supabase
      .from("HOP_DONG_GIAI_DOAN")
      .select("id")
      .eq("hop_dong_id", hdId)
      .limit(1);
    if (!(leftLinks || []).length) {
      await supabase.from("HOP_DONG").delete().eq("id", hdId);
    } else {
      // Còn gắn CT khác — bỏ neo nhom trùng công trình đang mở để báo cáo không đúp dòng
      const nhom = bgdGroupKeyForProject(project);
      if (nhom) {
        const { data: cur } = await supabase
          .from("HOP_DONG")
          .select("nhom_cong_trinh_key")
          .eq("id", hdId)
          .maybeSingle();
        if (cur?.nhom_cong_trinh_key === nhom) {
          await supabase.from("HOP_DONG").update({ nhom_cong_trinh_key: null }).eq("id", hdId);
        }
      }
    }
  }

  return { ok: true, hopDongId: hdId, maScope };
}

/**
 * Sau khi lưu HĐ thật: gỡ / xóa các bản ghi placeholder «Chưa ký HĐ» trên cùng công trình.
 */
export async function cleanupPlaceholderHopDongOnCongTrinh(
  supabase,
  { project, allProjects = [], keepHopDongId = null, maDuAns = [] } = {}
) {
  if (!project?.ma_du_an) return { cleaned: 0 };

  const siblings = siblingPhasesForProject(
    allProjects?.length ? allProjects : [project],
    project
  );
  const maScope = [
    ...new Set(
      [...(maDuAns || []), project.ma_du_an, ...siblings.map((p) => p.ma_du_an)]
        .map((m) => String(m || "").trim())
        .filter(Boolean)
    ),
  ];
  const nhom = bgdGroupKeyForProject(project);
  const keepId = keepHopDongId ? String(keepHopDongId) : "";

  const candidateIds = new Set();
  if (maScope.length) {
    const { data: links } = await supabase
      .from("HOP_DONG_GIAI_DOAN")
      .select("hop_dong_id")
      .in("ma_du_an", maScope);
    for (const l of links || []) {
      if (l?.hop_dong_id) candidateIds.add(l.hop_dong_id);
    }
  }
  if (nhom) {
    const { data: byNhom } = await supabase
      .from("HOP_DONG")
      .select("id, so_hop_dong")
      .eq("nhom_cong_trinh_key", nhom);
    for (const h of byNhom || []) {
      if (h?.id && isPlaceholderSoHopDong(h.so_hop_dong)) candidateIds.add(h.id);
    }
  }

  if (!candidateIds.size) return { cleaned: 0 };

  const { data: rows } = await supabase
    .from("HOP_DONG")
    .select("id, so_hop_dong")
    .in("id", [...candidateIds]);

  let cleaned = 0;
  for (const h of rows || []) {
    if (!h?.id || h.id === keepId) continue;
    if (!isPlaceholderSoHopDong(h.so_hop_dong)) continue;
    await unlinkHopDongFromCongTrinh(supabase, {
      hopDongId: h.id,
      project,
      allProjects: allProjects?.length ? allProjects : [project],
    });
    cleaned += 1;
  }
  return { cleaned };
}

export async function fetchHopDongByNhomKey(supabase, nhomKey) {
  if (!nhomKey) return [];
  const management = await supabase
    .from("HOP_DONG")
    .select(HOP_DONG_MANAGEMENT_COLUMNS)
    .eq("nhom_cong_trinh_key", nhomKey)
    .order("created_at", { ascending: false });
  if (!management.error) return management.data || [];

  const extended = await supabase
    .from("HOP_DONG")
    .select(HOP_DONG_LIFECYCLE_COLUMNS)
    .eq("nhom_cong_trinh_key", nhomKey)
    .order("created_at", { ascending: false });
  if (!extended.error) return extended.data || [];

  // Cho phép đọc sổ cũ trong thời gian chưa chạy migration ký lại.
  const fallback = await supabase
    .from("HOP_DONG")
    .select(HOP_DONG_COLUMNS)
    .eq("nhom_cong_trinh_key", nhomKey)
    .order("created_at", { ascending: false });
  if (fallback.error) throw fallback.error;
  return fallback.data || [];
}

export async function fetchGiaiDoanLinks(supabase, hopDongIds) {
  const ids = (hopDongIds || []).filter(Boolean);
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("HOP_DONG_GIAI_DOAN")
    .select("id, hop_dong_id, ma_du_an, created_at")
    .in("hop_dong_id", ids);
  if (error) throw error;
  return data || [];
}

export async function fetchHopDongCdtHieuLucForMaDuAn(supabase, maDuAn) {
  if (!maDuAn) return null;
  const { data: links, error: linkErr } = await supabase
    .from("HOP_DONG_GIAI_DOAN")
    .select("hop_dong_id")
    .eq("ma_du_an", maDuAn);
  if (linkErr) throw linkErr;
  const ids = (links || []).map((l) => l.hop_dong_id);
  if (!ids.length) return null;

  const { data, error } = await supabase
    .from("HOP_DONG")
    .select(HOP_DONG_COLUMNS)
    .in("id", ids)
    .in("loai", [HOP_DONG_LOAI.CHINH, HOP_DONG_LOAI.PHU_LUC_DC])
    .eq("trang_thai", HOP_DONG_TRANG_THAI.HIEU_LUC)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const rows = data || [];
  const pl = rows.find((h) => h.loai === HOP_DONG_LOAI.PHU_LUC_DC);
  return pl || rows.find((h) => h.loai === HOP_DONG_LOAI.CHINH) || null;
}

/** @deprecated dùng fetchHopDongCdtHieuLucForMaDuAn */
export async function fetchHopDongChinhHieuLucForMaDuAn(supabase, maDuAn) {
  return fetchHopDongCdtHieuLucForMaDuAn(supabase, maDuAn);
}

/**
 * Đánh dấu các bản hiệu lực khác trong chuỗi CĐT thành «đã thay thế».
 */
async function markChainReplaced(supabase, gocId, exceptId) {
  const { data: chain, error } = await supabase
    .from("HOP_DONG")
    .select("id, loai, hop_dong_goc_id, trang_thai")
    .or(`id.eq.${gocId},hop_dong_goc_id.eq.${gocId}`);
  if (error) throw error;

  const toReplace = (chain || [])
    .filter(
      (h) =>
        h.id !== exceptId &&
        h.trang_thai === HOP_DONG_TRANG_THAI.HIEU_LUC &&
        (h.loai === HOP_DONG_LOAI.CHINH || h.loai === HOP_DONG_LOAI.PHU_LUC_DC)
    )
    .map((h) => h.id);

  if (!toReplace.length) return;

  const { error: updErr } = await supabase
    .from("HOP_DONG")
    .update({
      trang_thai: HOP_DONG_TRANG_THAI.THAY_THE,
      updated_at: new Date().toISOString(),
    })
    .in("id", toReplace);
  if (updErr) throw updErr;
}

/**
 * Đồng bộ cache du_an từ HĐ CĐT hiệu lực cho các ma_du_an.
 * clearMaDuAns: xóa cache nếu đang khớp HĐ cũ (khi bỏ liên kết).
 */
export async function syncHopDongCacheToDanhMuc(supabase, { hopDong, maDuAns, clearMaDuAns = [], previousFingerprint = null }) {
  const patch = {
    hop_dong: hopDong?.so_hop_dong || null,
    hop_dong_day_du: hopDong?.hop_dong_day_du || null,
    link_pdf_hop_dong: hopDong?.link_pdf || null,
  };

  for (const ma of maDuAns || []) {
    const { error } = await supabase.from("du_an").update(patch).eq("ma_du_an", ma);
    if (error) throw error;
  }

  if (clearMaDuAns?.length) {
    for (const ma of clearMaDuAns) {
      if (previousFingerprint) {
        const { data: row } = await supabase
          .from("du_an")
          .select("hop_dong, hop_dong_day_du, link_pdf_hop_dong")
          .eq("ma_du_an", ma)
          .maybeSingle();
        const fp = hopDongFingerprint(row?.hop_dong, row?.hop_dong_day_du, row?.link_pdf_hop_dong);
        if (fp !== previousFingerprint) continue;
      }
      const { error } = await supabase
        .from("du_an")
        .update({ hop_dong: null, hop_dong_day_du: null, link_pdf_hop_dong: null })
        .eq("ma_du_an", ma);
      if (error) throw error;
    }
  }
}

/**
 * Nếu danh mục trống / lệch cột HĐ so với sổ → ghi lại cache từ HĐ CĐT hiệu lực.
 * (Tổng quan workspace + danh sách DA đọc hop_dong từ du_an).
 * @param {{ force?: boolean }} [options] force=true luôn ghi đè theo sổ
 * @returns {Promise<object|null>} bản patch hop_dong* hoặc null nếu không đổi
 */
export async function ensureHopDongCacheFromSo(supabase, maDuAn, options = {}) {
  const ma = String(maDuAn || "").trim();
  if (!ma) return null;
  const force = Boolean(options.force);

  const { data: dm, error } = await supabase
    .from("du_an")
    .select("ma_du_an, hop_dong, hop_dong_day_du, link_pdf_hop_dong")
    .eq("ma_du_an", ma)
    .maybeSingle();
  if (error) throw error;
  if (!dm) return null;

  const pick = await fetchHopDongCdtHieuLucForMaDuAn(supabase, ma);
  if (!pick) {
    // Không còn HĐ CĐT trên sổ — xóa cache nếu đang có
    if (
      String(dm.hop_dong || "").trim() ||
      String(dm.hop_dong_day_du || "").trim() ||
      String(dm.link_pdf_hop_dong || "").trim()
    ) {
      await syncHopDongCacheToDanhMuc(supabase, {
        hopDong: { so_hop_dong: null, hop_dong_day_du: null, link_pdf: null },
        maDuAns: [ma],
      });
      return { hop_dong: null, hop_dong_day_du: null, link_pdf_hop_dong: null };
    }
    return null;
  }

  const next = {
    hop_dong: pick.so_hop_dong || null,
    hop_dong_day_du: pick.hop_dong_day_du || null,
    link_pdf_hop_dong: pick.link_pdf || null,
  };
  const curFp = hopDongFingerprint(dm.hop_dong, dm.hop_dong_day_du, dm.link_pdf_hop_dong);
  const nextFp = hopDongFingerprint(next.hop_dong, next.hop_dong_day_du, next.link_pdf_hop_dong);
  const empty =
    !String(dm.hop_dong || "").trim() &&
    !String(dm.hop_dong_day_du || "").trim() &&
    !String(dm.link_pdf_hop_dong || "").trim();

  if (!force && !empty && curFp === nextFp) return null;

  await syncHopDongCacheToDanhMuc(supabase, { hopDong: pick, maDuAns: [ma] });
  return next;
}

/**
 * Quét toàn bộ mã có liên kết sổ → đồng bộ cache du_an.
 * @returns {{ checked: number, updated: number, cleared: number, samples: string[] }}
 */
export async function repairHopDongCacheForAllLinkedMas(supabase, { force = false } = {}) {
  const { data: links, error: linkErr } = await supabase
    .from("HOP_DONG_GIAI_DOAN")
    .select("ma_du_an");
  if (linkErr) throw linkErr;
  const mas = [...new Set((links || []).map((l) => String(l.ma_du_an || "").trim()).filter(Boolean))];

  let updated = 0;
  let cleared = 0;
  const samples = [];
  for (const ma of mas) {
    const patch = await ensureHopDongCacheFromSo(supabase, ma, { force });
    if (!patch) continue;
    if (patch.hop_dong == null && patch.hop_dong_day_du == null && patch.link_pdf_hop_dong == null) {
      cleared += 1;
    } else {
      updated += 1;
    }
    if (samples.length < 25) samples.push(`${ma} → ${patch.hop_dong || "(xóa cache)"}`);
  }
  return { checked: mas.length, updated, cleared, samples };
}

/**
 * Lưu / cập nhật HĐ chính + liên kết giai đoạn + sync cache.
 * @returns {{ ok: true, hopDong } | { ok: false, conflict: true, conflictInfo, message }}
 */
export async function saveHopDongChinh(supabase, {
  project,
  allProjects,
  form,
  selectedMaDuAns,
  existingId = null,
  forceOverwrite = false,
  fileUrl = null,
}) {
  const short = String(form?.so_hop_dong || form?.hop_dong || "").trim();
  const full = String(form?.hop_dong_day_du || "").trim();
  const linkPdf = fileUrl || form?.link_pdf || form?.link_pdf_hop_dong || null;

  if (!short && !full && !linkPdf) {
    throw new Error("Nhập ít nhất số hợp đồng (viết tắt) hoặc tải PDF.");
  }

  const maList = [...new Set((selectedMaDuAns || []).map((m) => String(m || "").trim()).filter(Boolean))];
  if (!maList.length) {
    throw new Error("Bắt buộc chọn ít nhất một giai đoạn áp dụng (M3).");
  }

  const selectedProjects = projectsByMaDuAns(allProjects, maList);
  const nextFp = hopDongFingerprint(short, full, linkPdf || "");

  const conflictInfo = detectHopDongPhaseConflict(selectedProjects, nextFp);
  if (conflictInfo.hasConflict && !forceOverwrite) {
    return {
      ok: false,
      conflict: true,
      conflictInfo,
      message: formatConflictMessage(conflictInfo),
      alertMessage: formatConflictMessage(conflictInfo, { forAlert: true }),
    };
  }

  const tenCongTrinh = (project?.ten_du_an || project?.ten || "").trim() || project?.ma_du_an || "";
  const nhomKey = normalizeTenDuAn(tenCongTrinh) || project?.ma_du_an || "";

  let hopDong;
  let previousFingerprint = null;
  let oldMaList = [];

  if (existingId) {
    const { data: old } = await supabase
      .from("HOP_DONG")
      .select(HOP_DONG_COLUMNS)
      .eq("id", existingId)
      .maybeSingle();
    if (old) {
      previousFingerprint = hopDongFingerprint(old.so_hop_dong, old.hop_dong_day_du, old.link_pdf);
    }
    const { data: oldLinks } = await supabase
      .from("HOP_DONG_GIAI_DOAN")
      .select("ma_du_an")
      .eq("hop_dong_id", existingId);
    oldMaList = (oldLinks || []).map((l) => l.ma_du_an);

    // Giữ neo nhom/tên khi sửa (tránh nhảy neo nếu mở từ CT phụ của HĐ khung).
    const payload = {
      ten_cong_trinh: old?.ten_cong_trinh || tenCongTrinh,
      nhom_cong_trinh_key: old?.nhom_cong_trinh_key || nhomKey,
      loai: HOP_DONG_LOAI.CHINH,
      so_hop_dong: short || null,
      hop_dong_day_du: full || null,
      ngay_ky: form?.ngay_ky || null,
      ben_a: String(form?.ben_a || "").trim() || null,
      ben_b: String(form?.ben_b || "").trim() || null,
      link_pdf: linkPdf || null,
      gia_tri: parseGiaTriHopDong(form?.gia_tri),
      ...hopDongManagementPayload(form),
      trang_thai: HOP_DONG_TRANG_THAI.HIEU_LUC,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("HOP_DONG")
      .update(payload)
      .eq("id", existingId)
      .select(HOP_DONG_COLUMNS)
      .single();
    if (error) throw error;
    hopDong = data;
  } else {
    const payload = {
      ten_cong_trinh: tenCongTrinh,
      nhom_cong_trinh_key: nhomKey,
      loai: HOP_DONG_LOAI.CHINH,
      so_hop_dong: short || null,
      hop_dong_day_du: full || null,
      ngay_ky: form?.ngay_ky || null,
      ben_a: String(form?.ben_a || "").trim() || null,
      ben_b: String(form?.ben_b || "").trim() || null,
      link_pdf: linkPdf || null,
      gia_tri: parseGiaTriHopDong(form?.gia_tri),
      ...hopDongManagementPayload(form),
      trang_thai: HOP_DONG_TRANG_THAI.HIEU_LUC,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("HOP_DONG")
      .insert(payload)
      .select(HOP_DONG_COLUMNS)
      .single();
    if (error) throw error;
    hopDong = data;
  }

  // HĐ chính mới/sửa thành hiệu lực → PL/ĐC (và chính cũ khác) trong chuỗi thành «đã thay thế»
  await markChainReplaced(supabase, hopDong.id, hopDong.id);

  // Mỗi giai đoạn chỉ một HĐ chính hiệu lực: gỡ link HĐ chính khác khỏi các ma đang gắn
  const { data: otherLinks } = await supabase
    .from("HOP_DONG_GIAI_DOAN")
    .select("id, hop_dong_id, ma_du_an")
    .in("ma_du_an", maList);
  const otherHdIds = [...new Set((otherLinks || []).map((l) => l.hop_dong_id).filter((id) => id !== hopDong.id))];
  if (otherHdIds.length) {
    const { data: otherHd } = await supabase
      .from("HOP_DONG")
      .select("id")
      .in("id", otherHdIds)
      .eq("loai", HOP_DONG_LOAI.CHINH)
      .eq("trang_thai", HOP_DONG_TRANG_THAI.HIEU_LUC);
    const chinhIds = new Set((otherHd || []).map((h) => h.id));
    const toDelete = (otherLinks || []).filter((l) => chinhIds.has(l.hop_dong_id) && l.hop_dong_id !== hopDong.id);
    if (toDelete.length) {
      const { error: delOtherErr } = await supabase
        .from("HOP_DONG_GIAI_DOAN")
        .delete()
        .in(
          "id",
          toDelete.map((l) => l.id)
        );
      if (delOtherErr) throw delOtherErr;
    }
  }

  const { error: delLinkErr } = await supabase.from("HOP_DONG_GIAI_DOAN").delete().eq("hop_dong_id", hopDong.id);
  if (delLinkErr) throw delLinkErr;

  const linkRows = maList.map((ma_du_an) => ({ hop_dong_id: hopDong.id, ma_du_an }));
  const { error: insLinkErr } = await supabase.from("HOP_DONG_GIAI_DOAN").insert(linkRows);
  if (insLinkErr) throw insLinkErr;

  const clearMaDuAns = oldMaList.filter((ma) => !maList.includes(ma));
  await syncHopDongCacheToDanhMuc(supabase, {
    hopDong,
    maDuAns: maList,
    clearMaDuAns,
    previousFingerprint,
  });

  // Có HĐ thật → dọn placeholder «Chưa ký HĐ» còn neo trên cùng công trình
  if (!isPlaceholderSoHopDong(hopDong.so_hop_dong)) {
    await cleanupPlaceholderHopDongOnCongTrinh(supabase, {
      project,
      allProjects,
      keepHopDongId: hopDong.id,
      maDuAns: maList,
    });
  }

  try {
    const fromSo = resolveHopDongSoVaNgay(hopDong.so_hop_dong, hopDong.hop_dong_day_du);
    const ngayKy =
      hopDong.ngay_ky ||
      form?.ngay_ky ||
      (fromSo.ngay
        ? (() => {
            const m = String(fromSo.ngay).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
          })()
        : "");
    await syncKhnQdNgayKyFromHopDong(supabase, {
      maDuAns: maList,
      ngayKy,
      tenDuAnHint: project?.ten_du_an || project?.ten || "",
    });
  } catch (khnErr) {
    console.warn("Đồng bộ mã KHN từ ngày ký HĐ:", khnErr?.message || khnErr);
  }

  return { ok: true, hopDong, maDuAns: maList };
}

/**
 * Ký lại HĐ chính do đổi pháp nhân / sáp nhập / chuyển CĐT.
 * HĐ mới là một gốc pháp lý mới; HĐ trước và PL/ĐC của nó chuyển vào lịch sử.
 */
export async function saveHopDongKyLai(supabase, {
  project,
  form,
  selectedMaDuAns,
  hopDongTruocId,
  fileUrl = null,
}) {
  if (!hopDongTruocId) throw new Error("Thiếu hợp đồng trước để ký lại.");

  const short = String(form?.so_hop_dong || form?.hop_dong || "").trim();
  const full = String(form?.hop_dong_day_du || "").trim();
  const linkPdf = fileUrl || form?.link_pdf || form?.link_pdf_hop_dong || null;
  const ngayKy = String(form?.ngay_ky || "").trim() || null;
  if (!short && !full && !linkPdf) {
    throw new Error("Nhập ít nhất số hợp đồng ký lại hoặc tải PDF.");
  }
  if (!ngayKy) {
    throw new Error("Hợp đồng ký lại bắt buộc có ngày ký để phân biệt pháp nhân và lần ký.");
  }

  const { data: previous, error: previousErr } = await supabase
    .from("HOP_DONG")
    .select(HOP_DONG_COLUMNS)
    .eq("id", hopDongTruocId)
    .maybeSingle();
  if (previousErr) throw previousErr;
  if (!previous || previous.loai !== HOP_DONG_LOAI.CHINH) {
    throw new Error("Hợp đồng trước phải là HĐ chính.");
  }

  let maList = [...new Set((selectedMaDuAns || []).map((m) => String(m || "").trim()).filter(Boolean))];
  if (!maList.length) {
    const { data: oldLinks, error: oldLinkErr } = await supabase
      .from("HOP_DONG_GIAI_DOAN")
      .select("ma_du_an")
      .eq("hop_dong_id", hopDongTruocId);
    if (oldLinkErr) throw oldLinkErr;
    maList = (oldLinks || []).map((l) => l.ma_du_an).filter(Boolean);
  }
  if (!maList.length) throw new Error("Bắt buộc chọn ít nhất một giai đoạn áp dụng.");

  const tenCongTrinh = previous.ten_cong_trinh || (project?.ten_du_an || project?.ten || "").trim() || project?.ma_du_an || "";
  const payload = {
    ten_cong_trinh: tenCongTrinh,
    nhom_cong_trinh_key:
      previous.nhom_cong_trinh_key ||
      normalizeTenDuAn(tenCongTrinh) ||
      project?.ma_du_an ||
      "",
    loai: HOP_DONG_LOAI.CHINH,
    so_hop_dong: short || null,
    hop_dong_day_du: full || null,
    ngay_ky: ngayKy,
    ben_a: String(form?.ben_a || "").trim() || null,
    ben_b: String(form?.ben_b || "").trim() || null,
    gia_tri: parseGiaTriHopDong(form?.gia_tri),
    ...hopDongManagementPayload(form),
    link_pdf: linkPdf || null,
    trang_thai: HOP_DONG_TRANG_THAI.HIEU_LUC,
    ky_lai_tu_id: hopDongTruocId,
    ly_do_ky_lai:
      String(form?.ly_do_ky_lai || HOP_DONG_LY_DO_KY_LAI.DOI_PHAP_NHAN).trim(),
    ghi_chu: String(form?.ghi_chu || "").trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { data: hopDong, error: insertErr } = await supabase
    .from("HOP_DONG")
    .insert(payload)
    .select(HOP_DONG_LIFECYCLE_COLUMNS)
    .single();
  if (insertErr) {
    if (/ky_lai_tu_id|ly_do_ky_lai/i.test(insertErr.message || "")) {
      throw new Error("Chưa chạy scripts/sql/add-hop-dong-ky-lai.sql trên Supabase.");
    }
    throw insertErr;
  }

  // Khép toàn bộ chuỗi pháp lý cũ (HĐ trước + PL/ĐC) nhưng giữ nguyên link lịch sử.
  const { error: replaceErr } = await supabase
    .from("HOP_DONG")
    .update({
      trang_thai: HOP_DONG_TRANG_THAI.THAY_THE,
      updated_at: new Date().toISOString(),
    })
    .or(`id.eq.${hopDongTruocId},hop_dong_goc_id.eq.${hopDongTruocId}`);
  if (replaceErr) throw replaceErr;

  const linkRows = maList.map((ma_du_an) => ({ hop_dong_id: hopDong.id, ma_du_an }));
  const { error: linkErr } = await supabase.from("HOP_DONG_GIAI_DOAN").insert(linkRows);
  if (linkErr) throw linkErr;

  await syncHopDongCacheToDanhMuc(supabase, { hopDong, maDuAns: maList });

  try {
    const fromSo = resolveHopDongSoVaNgay(hopDong.so_hop_dong, hopDong.hop_dong_day_du);
    const ngayKy =
      hopDong.ngay_ky ||
      form?.ngay_ky ||
      (fromSo.ngay
        ? (() => {
            const m = String(fromSo.ngay).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
          })()
        : "");
    await syncKhnQdNgayKyFromHopDong(supabase, {
      maDuAns: maList,
      ngayKy,
      tenDuAnHint: project?.ten_du_an || project?.ten || "",
    });
  } catch (khnErr) {
    console.warn("Đồng bộ mã KHN từ ngày ký HĐ (ký lại):", khnErr?.message || khnErr);
  }

  return { ok: true, hopDong, maDuAns: maList, hopDongTruocId };
}

/**
 * Lưu / cập nhật phụ lục / điều chỉnh.
 * - Gắn hop_dong_goc_id → HĐ chính gốc
 * - Bản mới = hiệu lực; các bản hiệu lực khác trong chuỗi → đã thay thế
 * - Sync cache du_an từ PL (bản hiệu lực)
 * @returns {{ ok: true, hopDong } | { ok: false, conflict: true, conflictInfo, message }}
 */
export async function saveHopDongPhuLucDc(supabase, {
  project,
  allProjects,
  form,
  selectedMaDuAns,
  hopDongGocId,
  existingId = null,
  forceOverwrite = false,
  fileUrl = null,
}) {
  const gocId = hopDongGocId || null;
  if (!gocId && !existingId) {
    throw new Error("Thiếu hợp đồng gốc để gắn phụ lục / điều chỉnh.");
  }

  const short = String(form?.so_hop_dong || form?.hop_dong || "").trim();
  const full = String(form?.hop_dong_day_du || "").trim();
  const linkPdf = fileUrl || form?.link_pdf || form?.link_pdf_hop_dong || null;

  if (!short && !full && !linkPdf) {
    throw new Error("Nhập ít nhất số phụ lục / ĐC (viết tắt) hoặc tải PDF.");
  }

  let resolvedGocId = gocId;
  let previousFingerprint = null;
  let oldMaList = [];

  if (existingId) {
    const { data: old, error: oldErr } = await supabase
      .from("HOP_DONG")
      .select(HOP_DONG_COLUMNS)
      .eq("id", existingId)
      .maybeSingle();
    if (oldErr) throw oldErr;
    if (!old || old.loai !== HOP_DONG_LOAI.PHU_LUC_DC) {
      throw new Error("Bản ghi không phải phụ lục / điều chỉnh.");
    }
    resolvedGocId = old.hop_dong_goc_id || gocId;
    previousFingerprint = hopDongFingerprint(old.so_hop_dong, old.hop_dong_day_du, old.link_pdf);
    const { data: oldLinks } = await supabase
      .from("HOP_DONG_GIAI_DOAN")
      .select("ma_du_an")
      .eq("hop_dong_id", existingId);
    oldMaList = (oldLinks || []).map((l) => l.ma_du_an);
  }

  if (!resolvedGocId) {
    throw new Error("Không xác định được hợp đồng gốc của phụ lục.");
  }

  const { data: goc, error: gocErr } = await supabase
    .from("HOP_DONG")
    .select(HOP_DONG_COLUMNS)
    .eq("id", resolvedGocId)
    .maybeSingle();
  if (gocErr) throw gocErr;
  if (!goc || goc.loai !== HOP_DONG_LOAI.CHINH) {
    throw new Error("Hợp đồng gốc phải là HĐ chính.");
  }

  let maList = [...new Set((selectedMaDuAns || []).map((m) => String(m || "").trim()).filter(Boolean))];
  if (!maList.length) {
    const { data: gocLinks } = await supabase
      .from("HOP_DONG_GIAI_DOAN")
      .select("ma_du_an")
      .eq("hop_dong_id", resolvedGocId);
    maList = (gocLinks || []).map((l) => l.ma_du_an).filter(Boolean);
  }
  if (!maList.length) {
    throw new Error("Bắt buộc chọn ít nhất một giai đoạn áp dụng (M3).");
  }

  const selectedProjects = projectsByMaDuAns(allProjects, maList);
  const nextFp = hopDongFingerprint(short, full, linkPdf || "");
  const conflictInfo = detectHopDongPhaseConflict(selectedProjects, nextFp);
  if (conflictInfo.hasConflict && !forceOverwrite) {
    return {
      ok: false,
      conflict: true,
      conflictInfo,
      message: formatConflictMessage(conflictInfo),
      alertMessage: formatConflictMessage(conflictInfo, { forAlert: true }),
    };
  }

  // Neo theo HĐ gốc; khi sửa giữ key cũ (bên dưới).
  const tenCongTrinh =
    goc.ten_cong_trinh || (project?.ten_du_an || project?.ten || "").trim() || project?.ma_du_an || "";
  const nhomKey =
    goc.nhom_cong_trinh_key ||
    normalizeTenDuAn(tenCongTrinh) ||
    project?.ma_du_an ||
    "";

  const payload = {
    ten_cong_trinh: tenCongTrinh,
    nhom_cong_trinh_key: nhomKey,
    loai: HOP_DONG_LOAI.PHU_LUC_DC,
    so_hop_dong: short || null,
    hop_dong_day_du: full || null,
    ngay_ky: form?.ngay_ky || null,
    ben_a: String(form?.ben_a || "").trim() || null,
    ben_b: String(form?.ben_b || "").trim() || null,
    link_pdf: linkPdf || null,
    gia_tri: parseGiaTriHopDong(form?.gia_tri),
    ...hopDongManagementPayload(form),
    trang_thai: HOP_DONG_TRANG_THAI.HIEU_LUC,
    hop_dong_goc_id: resolvedGocId,
    updated_at: new Date().toISOString(),
  };

  let hopDong;
  if (existingId) {
    const { data: oldRow } = await supabase
      .from("HOP_DONG")
      .select("ten_cong_trinh, nhom_cong_trinh_key")
      .eq("id", existingId)
      .maybeSingle();
    payload.ten_cong_trinh = oldRow?.ten_cong_trinh || payload.ten_cong_trinh;
    payload.nhom_cong_trinh_key = oldRow?.nhom_cong_trinh_key || payload.nhom_cong_trinh_key;

    const { data, error } = await supabase
      .from("HOP_DONG")
      .update(payload)
      .eq("id", existingId)
      .select(HOP_DONG_COLUMNS)
      .single();
    if (error) throw error;
    hopDong = data;
  } else {
    const { data, error } = await supabase
      .from("HOP_DONG")
      .insert(payload)
      .select(HOP_DONG_COLUMNS)
      .single();
    if (error) throw error;
    hopDong = data;
  }

  await markChainReplaced(supabase, resolvedGocId, hopDong.id);

  const { error: delLinkErr } = await supabase.from("HOP_DONG_GIAI_DOAN").delete().eq("hop_dong_id", hopDong.id);
  if (delLinkErr) throw delLinkErr;

  const linkRows = maList.map((ma_du_an) => ({ hop_dong_id: hopDong.id, ma_du_an }));
  const { error: insLinkErr } = await supabase.from("HOP_DONG_GIAI_DOAN").insert(linkRows);
  if (insLinkErr) throw insLinkErr;

  const clearMaDuAns = oldMaList.filter((ma) => !maList.includes(ma));
  await syncHopDongCacheToDanhMuc(supabase, {
    hopDong,
    maDuAns: maList,
    clearMaDuAns,
    previousFingerprint,
  });

  return { ok: true, hopDong, maDuAns: maList, hopDongGocId: resolvedGocId };
}

/**
 * Lưu / cập nhật HĐ thầu phụ (Lát 3).
 * - KHÔNG ghi đè cache cột Hợp đồng trên danh mục (chỉ HĐ CĐT hiệu lực).
 * - Có thể gắn hop_dong_goc_id → HĐ chính CĐT (tuỳ chọn).
 */
export async function saveHopDongThauPhu(supabase, {
  project,
  allProjects,
  form,
  selectedMaDuAns,
  hopDongGocId = null,
  existingId = null,
  fileUrl = null,
}) {
  const short = String(form?.so_hop_dong || form?.hop_dong || "").trim();
  const full = String(form?.hop_dong_day_du || "").trim();
  const linkPdf = fileUrl || form?.link_pdf || form?.link_pdf_hop_dong || null;
  const loaiDv = String(form?.loai_thau_phu || HOP_DONG_LOAI_THAU_PHU.KHAC).trim();
  const benB = String(form?.ben_b || "").trim();

  if (!short && !full && !linkPdf) {
    throw new Error("Nhập ít nhất số HĐ thầu phụ (viết tắt) hoặc tải PDF.");
  }

  const maList = [...new Set((selectedMaDuAns || []).map((m) => String(m || "").trim()).filter(Boolean))];
  if (!maList.length) {
    throw new Error("Bắt buộc chọn ít nhất một giai đoạn áp dụng (M3).");
  }

  let resolvedGocId = hopDongGocId || null;
  if (existingId) {
    const { data: old, error: oldErr } = await supabase
      .from("HOP_DONG")
      .select(HOP_DONG_COLUMNS)
      .eq("id", existingId)
      .maybeSingle();
    if (oldErr) throw oldErr;
    if (!old || old.loai !== HOP_DONG_LOAI.THAU_PHU) {
      throw new Error("Bản ghi không phải hợp đồng thầu phụ.");
    }
    if (!resolvedGocId) resolvedGocId = old.hop_dong_goc_id || null;
  }

  if (resolvedGocId) {
    const { data: goc, error: gocErr } = await supabase
      .from("HOP_DONG")
      .select("id, loai")
      .eq("id", resolvedGocId)
      .maybeSingle();
    if (gocErr) throw gocErr;
    if (!goc || goc.loai !== HOP_DONG_LOAI.CHINH) {
      throw new Error("Hợp đồng gốc gắn thầu phụ phải là HĐ chính.");
    }
  }

  const tenCongTrinh = (project?.ten_du_an || project?.ten || "").trim() || project?.ma_du_an || "";
  const nhomKey = normalizeTenDuAn(tenCongTrinh) || project?.ma_du_an || "";

  const payload = {
    ten_cong_trinh: tenCongTrinh,
    nhom_cong_trinh_key: nhomKey,
    loai: HOP_DONG_LOAI.THAU_PHU,
    so_hop_dong: short || null,
    hop_dong_day_du: full || null,
    link_pdf: linkPdf || null,
    ben_b: benB || null,
    gia_tri: parseGiaTriHopDong(form?.gia_tri),
    ...hopDongManagementPayload(form),
    loai_thau_phu: loaiDv || HOP_DONG_LOAI_THAU_PHU.KHAC,
    hop_dong_goc_id: resolvedGocId || null,
    trang_thai: HOP_DONG_TRANG_THAI.HIEU_LUC,
    updated_at: new Date().toISOString(),
  };

  let hopDong;
  if (existingId) {
    const { data, error } = await supabase
      .from("HOP_DONG")
      .update(payload)
      .eq("id", existingId)
      .select(HOP_DONG_COLUMNS)
      .single();
    if (error) throw error;
    hopDong = data;
  } else {
    const { data, error } = await supabase
      .from("HOP_DONG")
      .insert(payload)
      .select(HOP_DONG_COLUMNS)
      .single();
    if (error) throw error;
    hopDong = data;
  }

  const { error: delLinkErr } = await supabase.from("HOP_DONG_GIAI_DOAN").delete().eq("hop_dong_id", hopDong.id);
  if (delLinkErr) throw delLinkErr;

  const linkRows = maList.map((ma_du_an) => ({ hop_dong_id: hopDong.id, ma_du_an }));
  const { error: insLinkErr } = await supabase.from("HOP_DONG_GIAI_DOAN").insert(linkRows);
  if (insLinkErr) throw insLinkErr;

  // Không sync cache du_an — cột list chỉ phản ánh HĐ CĐT hiệu lực
  return { ok: true, hopDong, maDuAns: maList, hopDongGocId: resolvedGocId };
}

/**
 * Danh sách HĐ căn cứ cho TÚ/TT (Lát 4) theo mã dự án.
 * Gồm: bản CĐT hiệu lực + các HĐ thầu phụ hiệu lực gắn giai đoạn.
 */
export async function listHopDongCanCuForMaDuAn(supabase, maDuAn) {
  if (!maDuAn) return [];
  const { data: links, error: linkErr } = await supabase
    .from("HOP_DONG_GIAI_DOAN")
    .select("hop_dong_id")
    .eq("ma_du_an", maDuAn);
  if (linkErr) throw linkErr;
  const ids = [...new Set((links || []).map((l) => l.hop_dong_id).filter(Boolean))];
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from("HOP_DONG")
    .select(HOP_DONG_COLUMNS)
    .in("id", ids)
    .eq("trang_thai", HOP_DONG_TRANG_THAI.HIEU_LUC)
    .order("updated_at", { ascending: false });
  if (error) throw error;

  const rows = data || [];
  const cdt = rows.filter((h) => h.loai === HOP_DONG_LOAI.CHINH || h.loai === HOP_DONG_LOAI.PHU_LUC_DC);
  const thau = rows.filter((h) => h.loai === HOP_DONG_LOAI.THAU_PHU);
  // Ưu tiên PL CĐT trước chính, rồi thầu phụ
  const pl = cdt.find((h) => h.loai === HOP_DONG_LOAI.PHU_LUC_DC);
  const chinh = cdt.find((h) => h.loai === HOP_DONG_LOAI.CHINH);
  const ordered = [];
  if (pl) ordered.push(pl);
  else if (chinh) ordered.push(chinh);
  ordered.push(...thau);
  return ordered;
}

/** Nhãn chọn HĐ trên form TÚ/TT */
export function formatHopDongCanCuOption(hd) {
  if (!hd) return "";
  const short = formatHopDongShort(hd.so_hop_dong, hd.hop_dong_day_du);
  const loai = loaiHopDongLabel(hd.loai);
  const dv = hd.loai === HOP_DONG_LOAI.THAU_PHU ? ` · ${loaiThauPhuLabel(hd.loai_thau_phu)}` : "";
  const gia = hd.gia_tri != null ? ` · ${formatGiaTriHopDong(hd.gia_tri)}` : "";
  return `${loai}${dv}: ${short}${gia}`;
}

/**
 * Tóm tắt tài chính từ sổ (hiển thị Kết thúc & TT / hub TC trước khi có phiếu chi).
 */
export async function summarizeHopDongTaiChinhForMaDuAn(supabase, maDuAn) {
  const list = await listHopDongCanCuForMaDuAn(supabase, maDuAn);
  const cdt = list.find((h) => h.loai === HOP_DONG_LOAI.CHINH || h.loai === HOP_DONG_LOAI.PHU_LUC_DC) || null;
  const thauPhu = list.filter((h) => h.loai === HOP_DONG_LOAI.THAU_PHU);
  const tongThauPhu = thauPhu.reduce((s, h) => s + (Number(h.gia_tri) || 0), 0);
  return {
    canCuCdt: cdt,
    thauPhu,
    giaTriCdt: cdt?.gia_tri != null ? Number(cdt.gia_tri) : null,
    tongGiaTriThauPhu: tongThauPhu || null,
    options: list,
  };
}

export function loaiHopDongLabel(loai) {
  if (loai === HOP_DONG_LOAI.PHU_LUC_DC) return "Phụ lục / ĐC";
  if (loai === HOP_DONG_LOAI.THAU_PHU) return "Thầu phụ";
  return "HĐ chính";
}
