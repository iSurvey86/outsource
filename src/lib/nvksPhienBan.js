/**
 * NVKS — phiên bản GỐC / ĐIỀU CHỈNH (NVKS-3).
 */

export const PHIEN_BAN_GOC = "GỐC";
export const PHIEN_BAN_DC = "ĐIỀU CHỈNH";

export function isPhienBanGoc(phienBan) {
  const p = (phienBan || "").trim();
  return !p || p === PHIEN_BAN_GOC || p.toUpperCase() === "GOC";
}

export function isPhienBanDieuChinh(phienBan) {
  const p = (phienBan || "").trim().toUpperCase();
  return p === PHIEN_BAN_DC.toUpperCase() || p === "DC" || p.startsWith("ĐIỀU CHỈNH");
}

/** Nhãn hiển thị: GỐC | ĐC-1 | ĐC-2 */
export function formatNvksPhienBanLabel(record) {
  if (!record) return "—";
  if (isPhienBanGoc(record.phien_ban)) return PHIEN_BAN_GOC;
  const n = Number(record.so_lan_dc) || 0;
  return n > 0 ? `ĐC-${n}` : PHIEN_BAN_DC;
}

export function sortNvksVersions(records) {
  return [...(records || [])].sort((a, b) => {
    const da = Number(a.so_lan_dc) || 0;
    const db = Number(b.so_lan_dc) || 0;
    if (da !== db) return da - db;
    const ta = a.thoi_diem_lap ? new Date(a.thoi_diem_lap).getTime() : 0;
    const tb = b.thoi_diem_lap ? new Date(b.thoi_diem_lap).getTime() : 0;
    return ta - tb;
  });
}

const VERSION_COLUMNS =
  "id, ma_du_an, ten_du_an, phien_ban, so_lan_dc, parent_nvks_id, root_nvks_id, is_active, trang_thai_nvks, thoi_diem_lap, link_docx_xuat, link_pdf_xuat, link_pdf_da_ky, link_pdf_ky_dau, quyet_dinh_phe_duyet_nvks";

/** Tất cả phiên bản của một dự án */
export async function fetchNvksVersions(supabase, maDuAn, columns = VERSION_COLUMNS) {
  if (!maDuAn) return [];
  const { data, error } = await supabase
    .from("HO_SO_NVKS")
    .select(columns)
    .eq("ma_du_an", maDuAn);
  if (error) throw error;
  return sortNvksVersions(data || []);
}

/** Bản active; fallback bản GỐC hoặc mới nhất */
export async function fetchActiveNvksByMaDuAn(supabase, maDuAn, columns = "*") {
  if (!maDuAn) return null;

  const { data: active, error: activeErr } = await supabase
    .from("HO_SO_NVKS")
    .select(columns)
    .eq("ma_du_an", maDuAn)
    .eq("is_active", true)
    .maybeSingle();

  if (!activeErr && active) return active;

  const { data: rows, error: rowsErr } = await supabase
    .from("HO_SO_NVKS")
    .select(columns)
    .eq("ma_du_an", maDuAn)
    .order("so_lan_dc", { ascending: false, nullsFirst: false })
    .order("thoi_diem_lap", { ascending: false, nullsFirst: false });

  if (rowsErr) throw rowsErr;
  if (!rows?.length) return null;

  const goc = rows.find((v) => isPhienBanGoc(v.phien_ban) && (Number(v.so_lan_dc) || 0) === 0);
  return goc || rows[0];
}

/** Bản GỐC (so_lan_dc = 0) */
export function pickNvksGocRecord(versions) {
  return (
    (versions || []).find((v) => isPhienBanGoc(v.phien_ban) && (Number(v.so_lan_dc) || 0) === 0) || null
  );
}

/** Bản ĐIỀU CHỈNH mới nhất theo so_lan_dc */
export function pickLatestNvksDcRecord(versions) {
  const dcs = (versions || []).filter((v) => (Number(v.so_lan_dc) || 0) > 0);
  if (!dcs.length) return null;
  return dcs.sort((a, b) => (Number(b.so_lan_dc) || 0) - (Number(a.so_lan_dc) || 0))[0];
}

/** Có bản GỐC đã lưu (điều kiện tạo ĐIỀU CHỈNH) */
export function hasNvksGocRecord(versions) {
  return (versions || []).some((v) => isPhienBanGoc(v.phien_ban) && (Number(v.so_lan_dc) || 0) === 0);
}

/** E4: chặn DC mới khi có bản DC chưa chốt KL */
export function findUnchotDieuChinh(versions) {
  return (versions || []).find(
    (v) =>
      isPhienBanDieuChinh(v.phien_ban) &&
      (Number(v.so_lan_dc) || 0) > 0 &&
      v.trang_thai_nvks !== "da_chot_kl"
  );
}

export function canCreateDieuChinh(versions) {
  if (!hasNvksGocRecord(versions)) {
    return { ok: false, reason: "Cần lưu bản GỐC trước khi tạo ĐIỀU CHỈNH." };
  }
  const unchot = findUnchotDieuChinh(versions);
  if (unchot) {
    return {
      ok: false,
      reason: `Bản ${formatNvksPhienBanLabel(unchot)} chưa chốt KL — hoàn tất hoặc chốt trước khi tạo điều chỉnh mới.`,
    };
  }
  return { ok: true };
}

function pickCopyFields(source) {
  return {
    ma_du_an: source.ma_du_an,
    ten_du_an: source.ten_du_an,
    giai_doan: source.giai_doan,
    loai_hinh: source.loai_hinh,
    chu_dau_tu: source.chu_dau_tu,
    dia_diem: source.dia_diem,
    quyet_dinh_giao_a: source.quyet_dinh_giao_a,
    quy_mo: source.quy_mo,
    thoi_gian_ks_lap_pa: source.thoi_gian_ks_lap_pa,
    thoi_gian_ks_lap_bcks: source.thoi_gian_ks_lap_bcks,
    thoi_gian_hoan_thien_ho_so: source.thoi_gian_hoan_thien_ho_so,
    thoi_gian_thuc_hien_tong: source.thoi_gian_thuc_hien_tong,
    thoi_diem_lap: source.thoi_diem_lap || new Date().toISOString().slice(0, 10),
    nguoi_lap: source.nguoi_lap,
    email_nguoi_lap: source.email_nguoi_lap,
    chu_nhiem_ks: source.chu_nhiem_ks,
    lanh_dao_duyet: source.lanh_dao_duyet,
    du_lieu_bang_tinh: source.du_lieu_bang_tinh,
  };
}

/** Tạo bản ĐIỀU CHỈNH mới — không ghi đè bản cũ */
export async function createDieuChinhVersion(supabase, sourceRecord, versions) {
  const gate = canCreateDieuChinh(versions);
  if (!gate.ok) throw new Error(gate.reason);

  const sorted = sortNvksVersions(versions);
  const goc = sorted.find((v) => isPhienBanGoc(v.phien_ban) && (Number(v.so_lan_dc) || 0) === 0);
  const rootId = goc?.root_nvks_id || goc?.id || sourceRecord.root_nvks_id || sourceRecord.id;
  const maxDc = sorted.reduce((m, v) => Math.max(m, Number(v.so_lan_dc) || 0), 0);
  const nextDc = maxDc + 1;
  const newId = crypto.randomUUID();
  const today = new Date().toISOString().slice(0, 10);

  const payload = {
    id: newId,
    ...pickCopyFields(sourceRecord),
    thoi_diem_lap: today,
    phien_ban: PHIEN_BAN_DC,
    so_lan_dc: nextDc,
    parent_nvks_id: sourceRecord.id,
    root_nvks_id: rootId,
    is_active: true,
    trang_thai_nvks: "dang_lap",
    quyet_dinh_phe_duyet_nvks: "",
    quyet_dinh_phe_duyet_nvks_day_du: "",
    link_pdf_phe_duyet_nvks: "",
    ngay_qd_phe_duyet: null,
    link_docx_xuat: null,
    link_pdf_xuat: null,
    link_pdf_da_ky: null,
    link_pdf_ky_dau: null,
    exported_at: null,
    du_lieu_bang_tinh: {
      ...(sourceRecord.du_lieu_bang_tinh || {}),
      kl_dc_manual: {},
    },
  };

  const maDuAn = sourceRecord.ma_du_an;
  const { error: deactivateErr } = await supabase
    .from("HO_SO_NVKS")
    .update({ is_active: false })
    .eq("ma_du_an", maDuAn);
  if (deactivateErr) throw deactivateErr;

  const { error: insertErr } = await supabase.from("HO_SO_NVKS").insert([payload]);
  if (insertErr) throw insertErr;

  return { id: newId, so_lan_dc: nextDc, payload };
}

/** Đặt phiên bản làm active trên workspace */
export async function setActiveNvksVersion(supabase, maDuAn, recordId) {
  const { error: offErr } = await supabase.from("HO_SO_NVKS").update({ is_active: false }).eq("ma_du_an", maDuAn);
  if (offErr) throw offErr;
  const { error: onErr } = await supabase.from("HO_SO_NVKS").update({ is_active: true }).eq("id", recordId);
  if (onErr) throw onErr;
}
