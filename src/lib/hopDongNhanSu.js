export const HOP_DONG_NHAN_SU_COLUMNS =
  "id, hop_dong_id, stt, ho_ten, chuyen_mon, chuc_danh, nguon_trang, trang_thai, ghi_chu, created_at, updated_at";

export function emptyHopDongNhanSuRow(overrides = {}) {
  return {
    id: null,
    stt: null,
    ho_ten: "",
    chuyen_mon: "",
    chuc_danh: "",
    nguon_trang: null,
    trang_thai: "dang_tham_gia",
    ghi_chu: "",
    ...overrides,
  };
}

export function normalizeHopDongNhanSuRows(rows, nguonTrang = null) {
  return (rows || [])
    .map((row, index) =>
      emptyHopDongNhanSuRow({
        ...row,
        stt: Number(row?.stt) > 0 ? Number(row.stt) : index + 1,
        ho_ten: String(row?.ho_ten || "").trim(),
        chuyen_mon: String(row?.chuyen_mon || "").trim(),
        chuc_danh: String(row?.chuc_danh || "").trim(),
        nguon_trang:
          Number(row?.nguon_trang) > 0
            ? Number(row.nguon_trang)
            : Number(nguonTrang) > 0
              ? Number(nguonTrang)
              : null,
        trang_thai:
          row?.trang_thai === "ngung_tham_gia" ? "ngung_tham_gia" : "dang_tham_gia",
        ghi_chu: String(row?.ghi_chu || "").trim(),
      })
    )
    .filter((row) => row.ho_ten);
}

export async function fetchHopDongNhanSu(supabase, hopDongId) {
  if (!hopDongId) return [];
  const { data, error } = await supabase
    .from("HOP_DONG_NHAN_SU")
    .select(HOP_DONG_NHAN_SU_COLUMNS)
    .eq("hop_dong_id", hopDongId)
    .order("stt", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    if (/HOP_DONG_NHAN_SU|does not exist|schema cache/i.test(error.message || "")) return [];
    throw error;
  }
  return data || [];
}

export async function replaceHopDongNhanSu(supabase, hopDongId, rows) {
  if (!hopDongId) throw new Error("Thiếu hợp đồng để lưu danh sách nhân sự.");
  const payload = normalizeHopDongNhanSuRows(rows).map((row) => ({
    stt: row.stt,
    ho_ten: row.ho_ten,
    chuyen_mon: row.chuyen_mon || null,
    chuc_danh: row.chuc_danh || null,
    nguon_trang: row.nguon_trang,
    trang_thai: row.trang_thai,
    ghi_chu: row.ghi_chu || null,
  }));

  const { error } = await supabase.rpc("replace_hop_dong_nhan_su", {
    p_hop_dong_id: hopDongId,
    p_rows: payload,
  });
  if (error) {
    if (/replace_hop_dong_nhan_su|HOP_DONG_NHAN_SU|schema cache|does not exist/i.test(error.message || "")) {
      throw new Error(
        "Chưa chạy scripts/sql/add-hop-dong-thoi-han-nhan-su.sql trên Supabase."
      );
    }
    throw error;
  }
}
