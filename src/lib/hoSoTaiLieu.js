export const TAI_LIEU_HO_SO_COLUMNS =
  "id, ma_du_an, loai_kho, nguon, ten_file, storage_path, ghi_chu, module_loai, nguoi_up_ma_nv, thoi_gian";

function isMissingTableError(message) {
  return /TAI_LIEU_HO_SO|does not exist|schema cache/i.test(String(message || ""));
}

/** Chuẩn hóa row DB → shape panel (nguoi_up_id cho UI outsource) */
export function mapTaiLieuHoSoRow(row) {
  if (!row) return row;
  return {
    ...row,
    nguoi_up_id: row.nguoi_up_ma_nv || row.nguoi_up_id || null,
  };
}

export async function fetchTaiLieuHoSoByMaDuAn(supabase, maDuAn) {
  const { data, error } = await supabase
    .from("TAI_LIEU_HO_SO")
    .select(TAI_LIEU_HO_SO_COLUMNS)
    .eq("ma_du_an", maDuAn)
    .order("thoi_gian", { ascending: false });
  if (error) {
    if (isMissingTableError(error.message)) return [];
    throw error;
  }
  return (data || []).map(mapTaiLieuHoSoRow);
}

export async function insertTaiLieuHoSo(supabase, payload) {
  const { data, error } = await supabase
    .from("TAI_LIEU_HO_SO")
    .insert(payload)
    .select(TAI_LIEU_HO_SO_COLUMNS)
    .single();
  if (error) throw error;
  return mapTaiLieuHoSoRow(data);
}

export async function updateTaiLieuHoSo(supabase, id, patch) {
  const { data, error } = await supabase
    .from("TAI_LIEU_HO_SO")
    .update(patch)
    .eq("id", id)
    .select(TAI_LIEU_HO_SO_COLUMNS)
    .single();
  if (error) throw error;
  return mapTaiLieuHoSoRow(data);
}

export async function deleteTaiLieuHoSo(supabase, id) {
  const { error } = await supabase.from("TAI_LIEU_HO_SO").delete().eq("id", id);
  if (error) throw error;
}

export async function updateHosoFolders(supabase, maDuAn, hosoFolders) {
  const { error } = await supabase
    .from("DANH_MUC_DA")
    .update({ hoso_folders: hosoFolders })
    .eq("ma_du_an", maDuAn);
  if (error) throw error;
}

export async function fetchNhanSuLookup(supabase) {
  const { data, error } = await supabase.from("NHAN_SU").select("ma_nv, ho_ten").order("ho_ten");
  if (error) return [];
  return (data || []).map((u) => ({ id: u.ma_nv, ho_ten: u.ho_ten }));
}

/** Ghi / thay bản theo tag (xuất bản, PDF ký, QĐ…) vào folder module */
export async function syncTaiLieuHoSoByTag(supabase, {
  maDuAn,
  moduleLoai = "nvks",
  loaiKho = "khao_sat",
  nguon = "xuat_ban",
  tag,
  storagePath,
  displayName,
  thoiGian,
  nguoiUpMaNv,
  replaceExisting = true,
}) {
  if (!maDuAn || !storagePath) return null;
  const ghiChu = String(tag || "file").toLowerCase();
  try {
    if (replaceExisting) {
      const { data: existing } = await supabase
        .from("TAI_LIEU_HO_SO")
        .select("id")
        .eq("ma_du_an", maDuAn)
        .eq("loai_kho", loaiKho)
        .eq("module_loai", moduleLoai)
        .eq("nguon", nguon)
        .eq("ghi_chu", ghiChu);
      const ids = (existing || []).map((r) => r.id).filter(Boolean);
      if (ids.length) {
        await supabase.from("TAI_LIEU_HO_SO").delete().in("id", ids);
      }
    }
    return await insertTaiLieuHoSo(supabase, {
      ma_du_an: maDuAn,
      loai_kho: loaiKho,
      nguon,
      ten_file: displayName || ghiChu,
      storage_path: storagePath,
      ghi_chu: ghiChu,
      module_loai: moduleLoai,
      nguoi_up_ma_nv: nguoiUpMaNv || null,
      thoi_gian: thoiGian || new Date().toISOString(),
    });
  } catch (err) {
    if (isMissingTableError(err?.message)) return null;
    throw err;
  }
}

/** Ghi / thay bản xuất bản mới nhất vào kho NVKS (folder nvks) */
export async function syncXuatBanTaiLieu(supabase, opts) {
  return syncTaiLieuHoSoByTag(supabase, {
    ...opts,
    nguon: "xuat_ban",
    tag: opts.kind,
    replaceExisting: true,
  });
}

/** Đã có file xuất bản trong kho (theo tag docx/pdf/…) */
export async function hasXuatBanTaiLieu(supabase, { maDuAn, moduleLoai = "nvks", kind }) {
  if (!maDuAn || !kind) return false;
  try {
    const { data, error } = await supabase
      .from("TAI_LIEU_HO_SO")
      .select("id")
      .eq("ma_du_an", maDuAn)
      .eq("module_loai", moduleLoai)
      .eq("nguon", "xuat_ban")
      .eq("ghi_chu", String(kind).toLowerCase())
      .limit(1);
    if (error) {
      if (isMissingTableError(error.message)) return false;
      throw error;
    }
    return (data || []).length > 0;
  } catch (err) {
    if (isMissingTableError(err?.message)) return false;
    throw err;
  }
}

/** Kiểm tra đã có file xuất (form HO_SO_* hoặc kho) — dùng cảnh báo trước khi xuất lại */
export async function hasExistingExportFile(supabase, {
  maDuAn,
  moduleLoai = "nvks",
  kind,
  formLink = "",
}) {
  if (String(formLink || "").trim()) return true;
  return hasXuatBanTaiLieu(supabase, { maDuAn, moduleLoai, kind });
}

export const EXPORT_REPLACE_CONFIRM_MSG =
  "Đã có file xuất lưu trước đó.\n\nXuất lại sẽ chỉ giữ bản mới nhất trong kho hồ sơ (thay bản cũ).\n\nTiếp tục?";

/** Ghi kho an toàn — lỗi schema/table không chặn xuất file */
export async function syncXuatBanTaiLieuSafe(supabase, opts) {
  try {
    return await syncXuatBanTaiLieu(supabase, opts);
  } catch (err) {
    console.warn("Không ghi kho hồ sơ:", err?.message || err);
    return null;
  }
}

export async function syncTaiLieuHoSoByTagSafe(supabase, opts) {
  try {
    return await syncTaiLieuHoSoByTag(supabase, opts);
  } catch (err) {
    console.warn("Không ghi kho hồ sơ:", err?.message || err);
    return null;
  }
}
