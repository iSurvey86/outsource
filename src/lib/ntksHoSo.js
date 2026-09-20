export const NTKS_COLUMNS =
  "id, ma_du_an, nvks_id, nkks_id, ten_du_an, dia_diem, giai_doan, chu_dau_tu, nha_thau_ks, nha_thau_tvgs, chi_tiet_ntks, trang_thai_ntks, link_docx_xuat, exported_at, created_at, updated_at";

export async function fetchNtksByMaDuAn(supabase, maDuAn, columns = NTKS_COLUMNS) {
  if (!maDuAn) return null;
  const { data, error } = await supabase
    .from("HO_SO_NTKS")
    .select(columns)
    .eq("ma_du_an", maDuAn)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveNtksToDb(supabase, { payload, recordId, maDuAn }) {
  const conflictKey = maDuAn || payload.ma_du_an;
  if (!conflictKey) throw new Error("Thiếu mã dự án");

  const existedBefore =
    recordId || (await fetchNtksByMaDuAn(supabase, conflictKey, "id"))?.id;

  const upsertPayload = { ...payload, ma_du_an: conflictKey };
  if (recordId) upsertPayload.id = recordId;

  const { data, error } = await supabase
    .from("HO_SO_NTKS")
    .upsert(upsertPayload, { onConflict: "ma_du_an" })
    .select("id")
    .single();

  if (error) throw error;
  return { id: data.id, created: !existedBefore };
}

export function getNtksTrangThaiMeta(record) {
  if (!record) return null;
  const key = record.trang_thai_ntks || "dang_lap";
  const map = {
    dang_lap: { label: "Đang lập", className: "bg-green-50 text-green-700 border-green-200" },
    da_chot: { label: "Đã chốt", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  };
  return map[key] || map.dang_lap;
}

export function buildNtksDocumentList(ntksRecord) {
  if (!ntksRecord) return [];
  const forms = ntksRecord.chi_tiet_ntks || {};
  const formCount = Object.keys(forms).filter((k) => forms[k]).length;

  return [
    {
      id: `ntks-form-${ntksRecord.id}`,
      ten: "Hồ sơ NTKS",
      loai_tep: "metadata",
      phien_ban: "GOC",
      ngay: ntksRecord.updated_at || ntksRecord.created_at,
      mo_ta: [
        ntksRecord.giai_doan && `Giai đoạn: ${ntksRecord.giai_doan}`,
        formCount > 0 && `${formCount} biểu mẫu`,
        getNtksTrangThaiMeta(ntksRecord)?.label,
      ]
        .filter(Boolean)
        .join(" · "),
      action: "view_metadata",
    },
    ...(ntksRecord.link_docx_xuat
      ? [
          {
            id: `ntks-docx-${ntksRecord.id}`,
            ten: "Bản Word xuất gần nhất",
            loai_tep: "docx",
            phien_ban: "GOC",
            ngay: ntksRecord.exported_at || ntksRecord.updated_at,
            mo_ta: "File Word NTKS từ lần xuất gần nhất",
            link: ntksRecord.link_docx_xuat,
            action: "view_file",
          },
        ]
      : []),
  ];
}

export async function updateNtksExportLinks(supabase, recordId, { link_docx_xuat, exported_at } = {}) {
  if (!recordId) throw new Error("Thiếu id hồ sơ NTKS");
  const { data, error } = await supabase
    .from("HO_SO_NTKS")
    .update({ link_docx_xuat, exported_at })
    .eq("id", recordId)
    .select("link_docx_xuat, exported_at")
    .single();
  if (error) throw new Error(`Không cập nhật được link file xuất: ${error.message}`);
  return data;
}
