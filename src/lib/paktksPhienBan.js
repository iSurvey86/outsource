/**
 * PAKTKS — phiên bản GOC / ĐIỀU CHỈNH (PAK-DC).
 */
import { snapshotBangTinhFromNvks, buildInitialFormFromSources } from "./paktksInit";
import { isPhienBanDieuChinh as isNvksDieuChinh } from "./nvksPhienBan";

export const PHIEN_BAN_GOC = "GOC";
export const PHIEN_BAN_DC = "DC";

export function isPhienBanGocPak(phienBan) {
  const p = (phienBan || "").trim().toUpperCase();
  return !p || p === "GOC" || p === "GỐC";
}

export function isPhienBanDcPak(phienBan) {
  const p = (phienBan || "").trim().toUpperCase();
  return p === "DC" || p.includes("DIEU") || p.includes("ĐIỀU");
}

export function formatPaktkPhienBanLabel(record) {
  if (!record) return "—";
  if (isPhienBanGocPak(record.phien_ban) && (Number(record.so_lan_dc) || 0) === 0) return PHIEN_BAN_GOC;
  const n = Number(record.so_lan_dc) || 0;
  return n > 0 ? `DC-${n}` : PHIEN_BAN_DC;
}

export function sortPaktkVersions(records) {
  return [...(records || [])].sort((a, b) => {
    const da = Number(a.so_lan_dc) || 0;
    const db = Number(b.so_lan_dc) || 0;
    if (da !== db) return da - db;
    const ta = a.updated_at ? new Date(a.updated_at).getTime() : 0;
    const tb = b.updated_at ? new Date(b.updated_at).getTime() : 0;
    return ta - tb;
  });
}

const VERSION_COLUMNS =
  "id, ma_du_an, nvks_id, phien_ban, so_lan_dc, parent_paktks_id, root_paktks_id, is_active, trang_thai_paktks, thoi_diem_lap, nvks_snapshot_at, updated_at, link_docx_xuat, link_pdf_xuat, link_pdf_da_ky, link_pdf_ky_dau, exported_at, trang_thai_ky_noi_bo, trinh_ky_id, nguoi_lap_ma_nv, chu_nhiem_ks_ma_nv, lanh_dao_duyet_ma_nv, quyet_dinh_phe_duyet_paktks, quyet_dinh_phe_duyet_paktks_day_du, link_pdf_phe_duyet_paktks, ngay_qd_phe_duyet, nguoi_lap, chu_nhiem_ks, lanh_dao_duyet, loai_hinh";

/** Có bản GỐC PAKTKS đã lưu */
export function hasPaktkGocRecord(versions) {
  return (versions || []).some((v) => isPhienBanGocPak(v.phien_ban) && (Number(v.so_lan_dc) || 0) === 0);
}

/** E4: chặn DC mới khi có bản PAK DC chưa chốt */
export function findUnchotPaktkDieuChinh(versions) {
  return (versions || []).find(
    (v) =>
      isPhienBanDcPak(v.phien_ban) &&
      (Number(v.so_lan_dc) || 0) > 0 &&
      v.trang_thai_paktks !== "da_chot"
  );
}

export function canCreatePaktkDieuChinh(versions) {
  if (!hasPaktkGocRecord(versions)) {
    return { ok: false, reason: "Cần lưu bản GỐC PAKTKS trước khi tạo ĐIỀU CHỈNH." };
  }
  const unchot = findUnchotPaktkDieuChinh(versions);
  if (unchot) {
    return {
      ok: false,
      reason: `Bản ${formatPaktkPhienBanLabel(unchot)} chưa chốt — hoàn tất hoặc chốt trước khi tạo điều chỉnh mới.`,
    };
  }
  return { ok: true };
}

function pickPakCopyFields(source) {
  return {
    ma_du_an: source.ma_du_an,
    ten_du_an: source.ten_du_an,
    giai_doan: source.giai_doan,
    loai_hinh: source.loai_hinh,
    chu_dau_tu: source.chu_dau_tu,
    dia_diem: source.dia_diem,
    quyet_dinh_giao_a: source.quyet_dinh_giao_a,
    quy_mo: source.quy_mo,
    cap_dien_ap: source.cap_dien_ap,
    nguoi_lap: source.nguoi_lap,
    email_nguoi_lap: source.email_nguoi_lap,
    chu_nhiem_ks: source.chu_nhiem_ks,
    lanh_dao_duyet: source.lanh_dao_duyet,
    thoi_gian_ks_lap_pa: source.thoi_gian_ks_lap_pa || "",
    thoi_gian_ks_lap_bcks: source.thoi_gian_ks_lap_bcks,
    thoi_gian_hoan_thien_ho_so: source.thoi_gian_hoan_thien_ho_so || "",
    thoi_gian_thuc_hien_tong: source.thoi_gian_thuc_hien_tong || "",
    du_lieu_paktks: source.du_lieu_paktks || {},
  };
}

/** Tạo bản PAKTKS ĐIỀU CHỈNH mới — không ghi đè bản cũ */
export async function createPaktkDieuChinhVersion(supabase, sourceRecord, versions, nvksRecordForSnap = null) {
  const gate = canCreatePaktkDieuChinh(versions);
  if (!gate.ok) throw new Error(gate.reason);

  const sorted = sortPaktkVersions(versions);
  const goc = sorted.find((v) => isPhienBanGocPak(v.phien_ban) && (Number(v.so_lan_dc) || 0) === 0);
  const rootId = goc?.root_paktks_id || goc?.id || sourceRecord.root_paktks_id || sourceRecord.id;
  const maxDc = sorted.reduce((m, v) => Math.max(m, Number(v.so_lan_dc) || 0), 0);
  const nextDc = maxDc + 1;
  const newId = crypto.randomUUID();
  const now = new Date().toISOString();
  const snap = nvksRecordForSnap ? snapshotBangTinhFromNvks(nvksRecordForSnap) : sourceRecord.du_lieu_bang_tinh;

  const payload = {
    id: newId,
    ...pickPakCopyFields(sourceRecord),
    nvks_id: nvksRecordForSnap?.id || sourceRecord.nvks_id,
    thoi_diem_lap: now.slice(0, 10),
    nvks_snapshot_at: now,
    du_lieu_bang_tinh: snap,
    phien_ban: PHIEN_BAN_DC,
    so_lan_dc: nextDc,
    parent_paktks_id: sourceRecord.id,
    root_paktks_id: rootId,
    is_active: true,
    trang_thai_paktks: "dang_lap",
    quyet_dinh_phe_duyet_paktks: "",
    quyet_dinh_phe_duyet_paktks_day_du: "",
    link_pdf_phe_duyet_paktks: "",
    link_docx_xuat: null,
    link_pdf_xuat: null,
    link_pdf_da_ky: null,
    link_pdf_ky_dau: null,
    exported_at: null,
    ngay_qd_phe_duyet: null,
    updated_at: now,
  };

  const maDuAn = sourceRecord.ma_du_an;
  const { error: deactivateErr } = await supabase
    .from("HO_SO_PAKTKS")
    .update({ is_active: false })
    .eq("ma_du_an", maDuAn);
  if (deactivateErr) throw deactivateErr;

  const { error: insertErr } = await supabase.from("HO_SO_PAKTKS").insert([payload]);
  if (insertErr) throw insertErr;

  return { id: newId, so_lan_dc: nextDc, payload };
}

export async function fetchPaktkVersions(supabase, maDuAn, columns = VERSION_COLUMNS) {
  if (!maDuAn) return [];
  const { data, error } = await supabase.from("HO_SO_PAKTKS").select(columns).eq("ma_du_an", maDuAn);
  if (error) throw error;
  return sortPaktkVersions(data || []);
}

export async function fetchPaktkByNvksId(supabase, nvksId, columns = "*") {
  if (!nvksId) return null;
  const { data, error } = await supabase
    .from("HO_SO_PAKTKS")
    .select(columns)
    .eq("nvks_id", nvksId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchActivePaktkByMaDuAn(supabase, maDuAn, columns = "*") {
  if (!maDuAn) return null;

  const { data: active, error: activeErr } = await supabase
    .from("HO_SO_PAKTKS")
    .select(columns)
    .eq("ma_du_an", maDuAn)
    .eq("is_active", true)
    .maybeSingle();

  if (!activeErr && active) return active;

  const { data: rows, error: rowsErr } = await supabase
    .from("HO_SO_PAKTKS")
    .select(columns)
    .eq("ma_du_an", maDuAn)
    .order("so_lan_dc", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false, nullsFirst: false });

  if (rowsErr) throw rowsErr;
  if (!rows?.length) return null;

  const goc = rows.find((v) => isPhienBanGocPak(v.phien_ban) && (Number(v.so_lan_dc) || 0) === 0);
  return goc || rows[0];
}

/** PAK gắn nvks_id; fallback bản active */
export async function fetchPaktkForNvks(supabase, maDuAn, nvksId, columns = "*") {
  if (nvksId) {
    const linked = await fetchPaktkByNvksId(supabase, nvksId, columns);
    if (linked) return linked;
  }
  return fetchActivePaktkByMaDuAn(supabase, maDuAn, columns);
}

export function isNvksSnapshotStale(pakRecord, nvksRecord) {
  if (!pakRecord?.du_lieu_bang_tinh || !nvksRecord?.du_lieu_bang_tinh) return false;
  const fresh = snapshotBangTinhFromNvks(nvksRecord);
  const current = pakRecord.du_lieu_bang_tinh;
  return JSON.stringify(fresh.quantities || {}) !== JSON.stringify(current.quantities || {});
}

function pickPakFieldsFromNvks(nvks, project) {
  const base = buildInitialFormFromSources(project || { ma_du_an: nvks.ma_du_an, ten_du_an: nvks.ten_du_an }, nvks, null);
  return {
    ten_du_an: nvks.ten_du_an,
    giai_doan: nvks.giai_doan || base.giai_doan,
    loai_hinh: nvks.loai_hinh,
    chu_dau_tu: nvks.chu_dau_tu || base.chu_dau_tu,
    dia_diem: nvks.dia_diem || base.dia_diem,
    quyet_dinh_giao_a: nvks.quyet_dinh_giao_a || base.quyet_dinh_giao_a,
    quy_mo: nvks.quy_mo || base.quy_mo,
    cap_dien_ap: nvks.du_lieu_bang_tinh?.cap_dien_ap || base.cap_dien_ap,
    nguoi_lap: nvks.nguoi_lap,
    email_nguoi_lap: nvks.email_nguoi_lap,
    chu_nhiem_ks: nvks.chu_nhiem_ks,
    lanh_dao_duyet: nvks.lanh_dao_duyet,
    thoi_diem_lap: nvks.thoi_diem_lap || base.thoi_diem_lap,
    thoi_gian_ks_lap_bcks: nvks.thoi_gian_ks_lap_bcks || base.thoi_gian_ks_lap_bcks,
  };
}

/** Tạo PAKTKS ĐIỀU CHỈNH bám NVKS DC (không ghi đè bản cũ) */
export async function createPaktkDieuChinhFromNvks(supabase, nvksRecord, project = null) {
  if (!nvksRecord?.id || !nvksRecord.ma_du_an) {
    throw new Error("Thiếu hồ sơ NVKS để tạo PAKTKS ĐIỀU CHỈNH.");
  }

  const existing = await fetchPaktkByNvksId(supabase, nvksRecord.id, "id");
  if (existing) return existing;

  const maDuAn = nvksRecord.ma_du_an;
  const versions = await fetchPaktkVersions(supabase, maDuAn);

  let parentPak = null;
  if (nvksRecord.parent_nvks_id) {
    parentPak = await fetchPaktkByNvksId(supabase, nvksRecord.parent_nvks_id);
  }
  if (!parentPak) {
    parentPak = versions.find((v) => isPhienBanGocPak(v.phien_ban) && (Number(v.so_lan_dc) || 0) === 0);
  }

  const soLanDc = Number(nvksRecord.so_lan_dc) || 0;
  if (soLanDc < 1 && !isNvksDieuChinh(nvksRecord.phien_ban)) {
    throw new Error("Chỉ tạo PAKTKS ĐIỀU CHỈNH từ NVKS ĐIỀU CHỈNH.");
  }

  const newId = crypto.randomUUID();
  const now = new Date().toISOString();
  const snap = snapshotBangTinhFromNvks(nvksRecord);
  const rootId = parentPak?.root_paktks_id || parentPak?.id || newId;

  const payload = {
    id: newId,
    ma_du_an: maDuAn,
    nvks_id: nvksRecord.id,
    ...pickPakFieldsFromNvks(nvksRecord, project),
    thoi_gian_ks_lap_pa: "",
    thoi_gian_hoan_thien_ho_so: "",
    thoi_gian_thuc_hien_tong: "",
    nvks_snapshot_at: now,
    du_lieu_bang_tinh: snap,
    du_lieu_paktks: {},
    phien_ban: PHIEN_BAN_DC,
    so_lan_dc: soLanDc > 0 ? soLanDc : 1,
    parent_paktks_id: parentPak?.id || null,
    root_paktks_id: rootId,
    is_active: true,
    trang_thai_paktks: "dang_lap",
    quyet_dinh_phe_duyet_paktks: "",
    quyet_dinh_phe_duyet_paktks_day_du: "",
    link_pdf_phe_duyet_paktks: "",
    ngay_qd_phe_duyet: null,
    updated_at: now,
  };

  const { error: offErr } = await supabase.from("HO_SO_PAKTKS").update({ is_active: false }).eq("ma_du_an", maDuAn);
  if (offErr) throw offErr;

  const { error: insertErr } = await supabase.from("HO_SO_PAKTKS").insert([payload]);
  if (insertErr) throw insertErr;

  if (!parentPak?.id) {
    await supabase.from("HO_SO_PAKTKS").update({ root_paktks_id: newId }).eq("id", newId);
  }

  return { id: newId, so_lan_dc: payload.so_lan_dc, payload };
}

export async function setActivePaktkVersion(supabase, maDuAn, recordId) {
  const { error: offErr } = await supabase.from("HO_SO_PAKTKS").update({ is_active: false }).eq("ma_du_an", maDuAn);
  if (offErr) throw offErr;
  const { error: onErr } = await supabase.from("HO_SO_PAKTKS").update({ is_active: true }).eq("id", recordId);
  if (onErr) throw onErr;
}
