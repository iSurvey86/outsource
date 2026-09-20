export const NKKS_COLUMNS =
  "id, ma_du_an, nvks_id, ten_du_an, dia_diem, loai_hinh, hang_muc, chu_dau_tu, nha_thau_ks, nha_thau_tvgs, goi_thau, ngay_bat_dau, ngay_ket_thuc, nhan_luc, may_moc_thiet_bi, bang_khoi_luong, nvks_kl_source_id, nvks_kl_source_label, chi_tiet_nhat_ky, trang_thai_nkks, link_docx_xuat, link_pdf_xuat, exported_at, created_at, updated_at";

export const NKKS_COLUMNS_LEGACY =
  "id, ma_du_an, nvks_id, ten_du_an, dia_diem, loai_hinh, hang_muc, chu_dau_tu, nha_thau_ks, nha_thau_tvgs, goi_thau, ngay_bat_dau, ngay_ket_thuc, bang_khoi_luong, nvks_kl_source_id, nvks_kl_source_label, chi_tiet_nhat_ky, trang_thai_nkks, link_docx_xuat, link_pdf_xuat, exported_at, created_at, updated_at";

export async function fetchNkksByMaDuAn(supabase, maDuAn, columns = NKKS_COLUMNS) {
  if (!maDuAn) return null;
  let { data, error } = await supabase
    .from("HO_SO_NKKS")
    .select(columns)
    .eq("ma_du_an", maDuAn)
    .maybeSingle();
  if (error && columns === NKKS_COLUMNS) {
    ({ data, error } = await supabase
      .from("HO_SO_NKKS")
      .select(NKKS_COLUMNS_LEGACY)
      .eq("ma_du_an", maDuAn)
      .maybeSingle());
  }
  if (error) throw error;
  return data;
}

/** Lưu NKKS — UPSERT theo ma_du_an (một dự án một hồ sơ), tránh duplicate key & race INSERT */
export async function saveNkksToDb(supabase, { payload, recordId, maDuAn }) {
  const conflictKey = maDuAn || payload.ma_du_an;
  if (!conflictKey) throw new Error("Thiếu mã dự án");

  const existedBefore =
    recordId || (await fetchNkksByMaDuAn(supabase, conflictKey, "id"))?.id;
  const created = !existedBefore;

  const upsertPayload = { ...payload, ma_du_an: conflictKey };
  if (recordId) upsertPayload.id = recordId;

  const { data, error } = await supabase
    .from("HO_SO_NKKS")
    .upsert(upsertPayload, { onConflict: "ma_du_an" })
    .select("id")
    .single();

  if (error) throw error;
  return { id: data.id, created };
}

const EXPORT_LINK_MIGRATION_HINT =
  "Chạy SQL scripts/sql/add-nkks-export-storage.sql trên Supabase (thêm cột link_docx_xuat, link_pdf_xuat, exported_at).";

function isExportLinkSchemaError(message) {
  return /schema cache|link_pdf_xuat|link_docx_xuat|exported_at/i.test(String(message || ""));
}

/** Cập nhật link file xuất — tự lùi cột nếu DB chưa migrate */
export async function updateNkksExportLinks(supabase, recordId, { link_docx_xuat, link_pdf_xuat, exported_at } = {}) {
  if (!recordId) throw new Error("Thiếu id hồ sơ NKKS");

  const attempts = [
    {
      update: { link_docx_xuat, link_pdf_xuat, exported_at },
      select: "link_docx_xuat, link_pdf_xuat, exported_at",
    },
    link_pdf_xuat
      ? {
          update: { link_docx_xuat, exported_at },
          select: "link_docx_xuat, exported_at",
        }
      : null,
    { update: { link_docx_xuat }, select: "link_docx_xuat" },
  ].filter(Boolean);

  let lastError = null;
  for (let i = 0; i < attempts.length; i += 1) {
    const { update, select } = attempts[i];
    const { data, error } = await supabase
      .from("HO_SO_NKKS")
      .update(update)
      .eq("id", recordId)
      .select(select)
      .single();

    if (!error) {
      return {
        link_docx_xuat: data?.link_docx_xuat ?? link_docx_xuat ?? "",
        link_pdf_xuat: data?.link_pdf_xuat ?? link_pdf_xuat ?? "",
        exported_at: data?.exported_at ?? exported_at ?? null,
        schemaWarning: i > 0 ? EXPORT_LINK_MIGRATION_HINT : null,
      };
    }

    if (isExportLinkSchemaError(error.message)) {
      lastError = error;
      continue;
    }
    throw new Error(`Không cập nhật được link file xuất: ${error.message}`);
  }

  throw new Error(
    `Không cập nhật được link file xuất: ${lastError?.message || "thiếu cột trên Supabase"}. ${EXPORT_LINK_MIGRATION_HINT}`
  );
}

export function getNkksTrangThaiMeta(record) {
  if (!record) return null;
  const key = record.trang_thai_nkks || "dang_lap";
  const map = {
    dang_lap: { label: "Đang lập", className: "bg-sky-50 text-sky-700 border-sky-200" },
    da_chot: { label: "Đã chốt", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  };
  return map[key] || map.dang_lap;
}

export function buildNkksDocumentList(nkksRecord) {
  if (!nkksRecord) return [];
  const dayCount = Array.isArray(nkksRecord.chi_tiet_nhat_ky) ? nkksRecord.chi_tiet_nhat_ky.length : 0;
  return [
    {
      id: `nkks-form-${nkksRecord.id}`,
      ten: "Hồ sơ NKKS",
      loai_tep: "metadata",
      phien_ban: "GOC",
      ngay: nkksRecord.updated_at || nkksRecord.created_at,
      mo_ta: [
        nkksRecord.hang_muc && `Hạng mục: ${nkksRecord.hang_muc}`,
        nkksRecord.nvks_kl_source_label && `KL: ${nkksRecord.nvks_kl_source_label}`,
        dayCount > 0 && `${dayCount} ngày ghi nhật ký`,
      ]
        .filter(Boolean)
        .join(" · "),
      action: "view_metadata",
    },
    ...(nkksRecord.link_docx_xuat
      ? [
          {
            id: `nkks-docx-${nkksRecord.id}`,
            ten: "Bản Word xuất gần nhất",
            loai_tep: "docx",
            phien_ban: "GOC",
            ngay: nkksRecord.exported_at || nkksRecord.updated_at,
            mo_ta: "File Word NKKS từ lần xuất gần nhất",
            link: nkksRecord.link_docx_xuat,
            action: "view_file",
          },
        ]
      : []),
    ...(nkksRecord.link_pdf_xuat
      ? [
          {
            id: `nkks-pdf-${nkksRecord.id}`,
            ten: "Bản PDF phát hành",
            loai_tep: "pdf",
            phien_ban: "GOC",
            ngay: nkksRecord.exported_at || nkksRecord.updated_at,
            mo_ta: "PDF convert từ Word xuất",
            link: nkksRecord.link_pdf_xuat,
            action: "view_pdf",
          },
        ]
      : []),
  ];
}
