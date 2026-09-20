export const BCKS_COLUMNS =
  "id, ma_du_an, nvks_id, paktks_id, ten_du_an, dia_diem, giai_doan, chu_dau_tu, chi_tiet_bcks, trang_thai_bcks, link_docx_xuat, exported_at, created_at, updated_at";

export async function fetchBcksByMaDuAn(supabase, maDuAn, columns = BCKS_COLUMNS) {
  if (!maDuAn) return null;
  const { data, error } = await supabase
    .from("HO_SO_BCKS")
    .select(columns)
    .eq("ma_du_an", maDuAn)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveBcksToDb(supabase, { payload, recordId, maDuAn }) {
  const conflictKey = maDuAn || payload.ma_du_an;
  if (!conflictKey) throw new Error("Thiếu mã dự án");

  const existedBefore =
    recordId || (await fetchBcksByMaDuAn(supabase, conflictKey, "id"))?.id;

  const upsertPayload = { ...payload, ma_du_an: conflictKey };
  if (recordId) upsertPayload.id = recordId;

  const { data, error } = await supabase
    .from("HO_SO_BCKS")
    .upsert(upsertPayload, { onConflict: "ma_du_an" })
    .select("id")
    .single();

  if (error) throw error;
  return { id: data.id, created: !existedBefore };
}

export function getBcksTrangThaiMeta(record) {
  if (!record) return null;
  const key = record.trang_thai_bcks || "dang_lap";
  const map = {
    dang_lap: { label: "Đang lập", className: "bg-amber-50 text-amber-800 border-amber-200" },
    da_chot: { label: "Đã chốt", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  };
  return map[key] || map.dang_lap;
}
