/**
 * Số liệu thực hiện HĐ + sự kiện xuất hóa đơn (sau sổ pháp lý).
 */

import { formatGiaTriHopDong, parseGiaTriHopDong } from "./hopDong";

export const HOP_DONG_THUC_HIEN_COLUMNS =
  "id, hop_dong_id, ma_du_an, hien_trang, thang_pd_du_kien, thang_pd_thuc_te, thang_nt_du_kien, thang_nt_thuc_te, nam_nt, gia_tri_hd, gia_tri_ks, gia_tri_ks_dia_hinh, gia_tri_ks_dia_chat, gia_tri_ks_khac, gia_tri_lap_hs, gia_tri_ctdt, gia_tri_tong_phan_ra, san_luong_du_kien, da_xuat_hd, con_lai, tinh_hinh_xuat_hd, hsnt_trang_thai, bb_ks_ht, bb_nt, ton_tai_nt, ton_tai_kt, ghi_chu, created_at, updated_at";

export const HOP_DONG_XUAT_HD_COLUMNS =
  "id, hop_dong_id, ma_du_an, loai, so_tien, ngay_xuat, nam_xuat, so_hoa_don, ghi_chu, created_at, updated_at";

export const HOP_DONG_XUAT_LOAI = {
  THUONG: "thuong",
  DIEU_CHINH: "dieu_chinh",
};

export function numOrNull(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  return parseGiaTriHopDong(raw);
}

export function computeConLai(giaTriHd, daXuatHd) {
  const g = numOrNull(giaTriHd);
  const x = numOrNull(daXuatHd) ?? 0;
  if (g === null) return null;
  return g - x;
}

/** Hiện trạng mặc định khi đã có xuất HĐ + ngày xuất. */
export const HIEN_TRANG_DA_HOAN_THANH = "Đã hoàn thành";

export function hasDaXuatHdValue(daXuatHd) {
  const n = numOrNull(daXuatHd);
  return n != null && Math.abs(n) > 0;
}

/** Có tín hiệu ngày xuất (sự kiện hoặc chuỗi hiển thị trên sổ). */
export function hasNgayXuatHdSignal(xuatList = [], ngayDisplay = "") {
  if (String(ngayDisplay || "").trim()) return true;
  return (xuatList || []).some((x) => {
    const d = String(x?.ngay_xuat || "").trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(d)) return true;
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(d)) return true;
    return Number(x?.nam_xuat) > 0;
  });
}

/**
 * Quy tắc: có Đã xuất HĐ + Ngày xuất HĐ → Hiện trạng = «Đã hoàn thành».
 * Không có đủ tín hiệu thì giữ giá trị đang lưu.
 */
export function resolveHienTrangHopDong({
  hienTrang,
  daXuatHd,
  xuatList = [],
  ngayDisplay = "",
} = {}) {
  if (hasDaXuatHdValue(daXuatHd) && hasNgayXuatHdSignal(xuatList, ngayDisplay)) {
    return HIEN_TRANG_DA_HOAN_THANH;
  }
  return String(hienTrang || "").trim();
}

export async function fetchThucHienByHopDongIds(supabase, hopDongIds) {
  const ids = (hopDongIds || []).filter(Boolean);
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("HOP_DONG_THUC_HIEN")
    .select(HOP_DONG_THUC_HIEN_COLUMNS)
    .in("hop_dong_id", ids);
  if (error) throw error;
  return data || [];
}

export async function fetchThucHienForPair(supabase, hopDongId, maDuAn) {
  if (!hopDongId || !maDuAn) return null;
  const { data, error } = await supabase
    .from("HOP_DONG_THUC_HIEN")
    .select(HOP_DONG_THUC_HIEN_COLUMNS)
    .eq("hop_dong_id", hopDongId)
    .eq("ma_du_an", maDuAn)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function fetchXuatHdByHopDongIds(supabase, hopDongIds) {
  const ids = (hopDongIds || []).filter(Boolean);
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("HOP_DONG_XUAT_HD")
    .select(HOP_DONG_XUAT_HD_COLUMNS)
    .in("hop_dong_id", ids)
    .order("ngay_xuat", { ascending: true });
  if (error) throw error;
  return data || [];
}

/** SUM xuất HĐ theo cặp HĐ × giai đoạn (ma_du_an null = mọi GD của HĐ đó). */
export async function sumXuatHd(supabase, hopDongId, maDuAn = null) {
  if (!hopDongId) return 0;
  let q = supabase.from("HOP_DONG_XUAT_HD").select("so_tien").eq("hop_dong_id", hopDongId);
  if (maDuAn) q = q.eq("ma_du_an", maDuAn);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).reduce((s, r) => s + (Number(r.so_tien) || 0), 0);
}

/**
 * Đồng bộ cache da_xuat_hd / con_lai từ SUM sự kiện.
 * Nếu chưa có dòng THUC_HIEN → tạo tối thiểu.
 */
export async function syncDaXuatCache(supabase, hopDongId, maDuAn, giaTriHdHint = null) {
  if (!hopDongId || !maDuAn) return null;
  const sum = await sumXuatHd(supabase, hopDongId, maDuAn);
  const existing = await fetchThucHienForPair(supabase, hopDongId, maDuAn);
  const giaTri = numOrNull(giaTriHdHint) ?? numOrNull(existing?.gia_tri_hd);
  const conLai = computeConLai(giaTri, sum);
  const payload = {
    hop_dong_id: hopDongId,
    ma_du_an: maDuAn,
    da_xuat_hd: sum,
    con_lai: conLai,
    updated_at: new Date().toISOString(),
  };
  if (giaTri != null && existing?.gia_tri_hd == null) payload.gia_tri_hd = giaTri;

  if (existing?.id) {
    const { data, error } = await supabase
      .from("HOP_DONG_THUC_HIEN")
      .update(payload)
      .eq("id", existing.id)
      .select(HOP_DONG_THUC_HIEN_COLUMNS)
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("HOP_DONG_THUC_HIEN")
    .insert(payload)
    .select(HOP_DONG_THUC_HIEN_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Upsert số liệu thực hiện. Có thể chỉ ghi cache da_xuat (không bắt buộc có sự kiện).
 */
export async function upsertThucHien(supabase, input) {
  const hopDongId = input?.hop_dong_id;
  const maDuAn = String(input?.ma_du_an || "").trim();
  if (!hopDongId || !maDuAn) throw new Error("Thiếu hop_dong_id hoặc ma_du_an.");

  const giaTriHd = numOrNull(input.gia_tri_hd);
  const giaTriKsDiaHinh = numOrNull(input.gia_tri_ks_dia_hinh);
  const giaTriKsDiaChat = numOrNull(input.gia_tri_ks_dia_chat);
  const giaTriKsKhac = numOrNull(input.gia_tri_ks_khac);
  const ksParts = [giaTriKsDiaHinh, giaTriKsDiaChat, giaTriKsKhac].filter((n) => n != null);
  const giaTriKs =
    ksParts.length > 0 ? ksParts.reduce((a, b) => a + b, 0) : numOrNull(input.gia_tri_ks);
  const giaTriLapHs = numOrNull(input.gia_tri_lap_hs);
  const giaTriCtdt = numOrNull(input.gia_tri_ctdt);
  let giaTriTong = numOrNull(input.gia_tri_tong_phan_ra);
  if (giaTriTong == null) {
    const parts = [giaTriKs, giaTriLapHs, giaTriCtdt].filter((n) => n != null);
    if (parts.length) giaTriTong = parts.reduce((a, b) => a + b, 0);
  }

  let daXuat = numOrNull(input.da_xuat_hd);
  if (input.resyncFromXuat) {
    daXuat = await sumXuatHd(supabase, hopDongId, maDuAn);
  }
  const conLai =
    input.con_lai !== undefined && input.con_lai !== null && input.con_lai !== ""
      ? numOrNull(input.con_lai)
      : computeConLai(giaTriHd, daXuat);

  const payload = {
    hop_dong_id: hopDongId,
    ma_du_an: maDuAn,
    hien_trang: input.hien_trang != null ? String(input.hien_trang).trim() || null : undefined,
    thang_pd_du_kien: numOrNull(input.thang_pd_du_kien),
    thang_pd_thuc_te: numOrNull(input.thang_pd_thuc_te),
    thang_nt_du_kien: numOrNull(input.thang_nt_du_kien),
    thang_nt_thuc_te: numOrNull(input.thang_nt_thuc_te),
    nam_nt: numOrNull(input.nam_nt),
    gia_tri_hd: giaTriHd,
    gia_tri_ks: giaTriKs,
    gia_tri_ks_dia_hinh: giaTriKsDiaHinh,
    gia_tri_ks_dia_chat: giaTriKsDiaChat,
    gia_tri_ks_khac: giaTriKsKhac,
    gia_tri_lap_hs: giaTriLapHs,
    gia_tri_ctdt: giaTriCtdt,
    gia_tri_tong_phan_ra: giaTriTong,
    san_luong_du_kien: numOrNull(input.san_luong_du_kien),
    da_xuat_hd: daXuat,
    con_lai: conLai,
    tinh_hinh_xuat_hd:
      input.tinh_hinh_xuat_hd != null ? String(input.tinh_hinh_xuat_hd).trim() || null : undefined,
    hsnt_trang_thai:
      input.hsnt_trang_thai != null ? String(input.hsnt_trang_thai).trim() || null : undefined,
    bb_ks_ht: input.bb_ks_ht != null ? String(input.bb_ks_ht).trim() || null : undefined,
    bb_nt: input.bb_nt != null ? String(input.bb_nt).trim() || null : undefined,
    ton_tai_nt: input.ton_tai_nt != null ? String(input.ton_tai_nt).trim() || null : undefined,
    ton_tai_kt: input.ton_tai_kt != null ? String(input.ton_tai_kt).trim() || null : undefined,
    ghi_chu: input.ghi_chu != null ? String(input.ghi_chu).trim() || null : undefined,
    updated_at: new Date().toISOString(),
  };

  // Bỏ undefined để không ghi đè null ngoài ý muốn khi partial update
  const clean = {};
  for (const [k, v] of Object.entries(payload)) {
    if (v !== undefined) clean[k] = v;
  }

  const existing = await fetchThucHienForPair(supabase, hopDongId, maDuAn);
  if (existing?.id) {
    const { data, error } = await supabase
      .from("HOP_DONG_THUC_HIEN")
      .update(clean)
      .eq("id", existing.id)
      .select(HOP_DONG_THUC_HIEN_COLUMNS)
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("HOP_DONG_THUC_HIEN")
    .insert(clean)
    .select(HOP_DONG_THUC_HIEN_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function insertXuatHd(supabase, input) {
  const hopDongId = input?.hop_dong_id;
  if (!hopDongId) throw new Error("Thiếu hop_dong_id.");
  const soTien = numOrNull(input.so_tien);
  if (soTien === null) throw new Error("Số tiền xuất HĐ không hợp lệ.");

  let ngayXuat = input.ngay_xuat || null;
  if (ngayXuat) {
    const iso = String(ngayXuat).match(/^(\d{4})-(\d{2})-(\d{2})/)?.[0] || "";
    const y = Number(iso.slice(0, 4));
    if (!iso || y < 1990 || y > 2100) {
      throw new Error("Ngày xuất không hợp lệ. Dùng dạng 15/01/2026.");
    }
    ngayXuat = iso;
  }

  const payload = {
    hop_dong_id: hopDongId,
    ma_du_an: input.ma_du_an ? String(input.ma_du_an).trim() : null,
    loai: input.loai === HOP_DONG_XUAT_LOAI.DIEU_CHINH ? HOP_DONG_XUAT_LOAI.DIEU_CHINH : HOP_DONG_XUAT_LOAI.THUONG,
    so_tien: soTien,
    ngay_xuat: ngayXuat,
    nam_xuat: numOrNull(input.nam_xuat) ?? (ngayXuat ? Number(ngayXuat.slice(0, 4)) : null),
    so_hoa_don: input.so_hoa_don ? String(input.so_hoa_don).trim() : null,
    ghi_chu: input.ghi_chu ? String(input.ghi_chu).trim() : null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("HOP_DONG_XUAT_HD")
    .insert(payload)
    .select(HOP_DONG_XUAT_HD_COLUMNS)
    .single();
  if (error) throw error;

  if (payload.ma_du_an) {
    await syncDaXuatCache(supabase, hopDongId, payload.ma_du_an);
  }
  return data;
}

export async function updateXuatHd(supabase, id, patch = {}) {
  if (!id) throw new Error("Thiếu id sự kiện xuất.");
  const payload = { updated_at: new Date().toISOString() };
  if (patch.ngay_xuat !== undefined) {
    const iso = String(patch.ngay_xuat || "").match(/^(\d{4})-(\d{2})-(\d{2})/)?.[0] || "";
    if (patch.ngay_xuat && (!iso || Number(iso.slice(0, 4)) < 1990 || Number(iso.slice(0, 4)) > 2100)) {
      throw new Error("Ngày xuất không hợp lệ. Dùng dạng 15/01/2026.");
    }
    payload.ngay_xuat = iso || null;
    if (iso && patch.nam_xuat === undefined) payload.nam_xuat = Number(iso.slice(0, 4));
  }
  if (patch.nam_xuat !== undefined) payload.nam_xuat = numOrNull(patch.nam_xuat);
  if (patch.so_tien !== undefined) {
    const soTien = numOrNull(patch.so_tien);
    if (soTien === null) throw new Error("Số tiền xuất HĐ không hợp lệ.");
    payload.so_tien = soTien;
  }
  if (patch.so_hoa_don !== undefined) {
    payload.so_hoa_don = patch.so_hoa_don ? String(patch.so_hoa_don).trim() : null;
  }
  if (patch.ghi_chu !== undefined) {
    payload.ghi_chu = patch.ghi_chu ? String(patch.ghi_chu).trim() : null;
  }
  if (patch.loai !== undefined) {
    payload.loai =
      patch.loai === HOP_DONG_XUAT_LOAI.DIEU_CHINH
        ? HOP_DONG_XUAT_LOAI.DIEU_CHINH
        : HOP_DONG_XUAT_LOAI.THUONG;
  }

  const { data, error } = await supabase
    .from("HOP_DONG_XUAT_HD")
    .update(payload)
    .eq("id", id)
    .select(HOP_DONG_XUAT_HD_COLUMNS)
    .single();
  if (error) throw error;

  if (data?.hop_dong_id && data?.ma_du_an) {
    await syncDaXuatCache(supabase, data.hop_dong_id, data.ma_du_an);
  }
  return data;
}

export async function deleteXuatHd(supabase, id, hopDongId, maDuAn) {
  const { error } = await supabase.from("HOP_DONG_XUAT_HD").delete().eq("id", id);
  if (error) throw error;
  if (hopDongId && maDuAn) await syncDaXuatCache(supabase, hopDongId, maDuAn);
}

/** Xóa sự kiện xuất gắn cặp HĐ×GD (dùng trước khi import lại). */
export async function clearXuatHdForPair(supabase, hopDongId, maDuAn) {
  if (!hopDongId || !maDuAn) return;
  const { error } = await supabase
    .from("HOP_DONG_XUAT_HD")
    .delete()
    .eq("hop_dong_id", hopDongId)
    .eq("ma_du_an", maDuAn);
  if (error) throw error;
}

export function formatMetricBlock(th) {
  if (!th) return null;
  return {
    giaTri: formatGiaTriHopDong(th.gia_tri_hd),
    daXuat: formatGiaTriHopDong(th.da_xuat_hd),
    conLai: formatGiaTriHopDong(th.con_lai),
    ks: formatGiaTriHopDong(th.gia_tri_ks),
    ksDiaHinh: formatGiaTriHopDong(th.gia_tri_ks_dia_hinh),
    ksDiaChat: formatGiaTriHopDong(th.gia_tri_ks_dia_chat),
    ksKhac: formatGiaTriHopDong(th.gia_tri_ks_khac),
    lapHs: formatGiaTriHopDong(th.gia_tri_lap_hs),
    ctdt: formatGiaTriHopDong(th.gia_tri_ctdt),
    hienTrang: th.hien_trang || "—",
  };
}
