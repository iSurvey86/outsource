-- Sổ HĐ — số liệu thực hiện / xuất HĐ (sau Lát 0–4 pháp lý)
-- Chạy SAU create-hop-dong.sql + rls-hop-dong.sql
-- Trong Supabase SQL Editor.

-- 1) Bổ sung field trên HOP_DONG (pháp lý mở rộng)
ALTER TABLE "HOP_DONG" ADD COLUMN IF NOT EXISTS "thoi_han_ngay" integer;
ALTER TABLE "HOP_DONG" ADD COLUMN IF NOT EXISTS "dich_vu_tu_van" text;
-- KS, TK | Thẩm tra | ...
ALTER TABLE "HOP_DONG" ADD COLUMN IF NOT EXISTS "pl_gia_han" text;
ALTER TABLE "HOP_DONG" ADD COLUMN IF NOT EXISTS "ngay_ky_pl" date;
ALTER TABLE "HOP_DONG" ADD COLUMN IF NOT EXISTS "thoi_gian_gia_han" integer;

COMMENT ON COLUMN "HOP_DONG"."thoi_han_ngay" IS 'Thời hạn hợp đồng (ngày), gồm cả gia hạn nếu đã cộng';
COMMENT ON COLUMN "HOP_DONG"."dich_vu_tu_van" IS 'KS, TK | Thẩm tra | ...';

-- 2) Thực hiện HĐ theo giai đoạn (1 dòng / HĐ × ma_du_an)
CREATE TABLE IF NOT EXISTS "HOP_DONG_THUC_HIEN" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "hop_dong_id" uuid NOT NULL REFERENCES "HOP_DONG"("id") ON DELETE CASCADE,
  "ma_du_an" text NOT NULL,
  "hien_trang" text,
  -- Đã phê duyệt | Đang trình duyệt | Tạm dừng | GSTG | ...
  "thang_pd_du_kien" integer,
  "thang_pd_thuc_te" integer,
  "thang_nt_du_kien" integer,
  "thang_nt_thuc_te" integer,
  "nam_nt" integer,
  "gia_tri_hd" numeric,
  -- Giá trị HĐ trước VAT (theo giai đoạn)
  "gia_tri_ks" numeric,
  -- Tổng khảo sát = địa hình + địa chất + khác/thỏa thuận
  "gia_tri_ks_dia_hinh" numeric,
  "gia_tri_ks_dia_chat" numeric,
  "gia_tri_ks_khac" numeric,
  "gia_tri_lap_hs" numeric,
  -- Lập BCNCKT / TKBVTC / HSMT
  "gia_tri_ctdt" numeric,
  "gia_tri_tong_phan_ra" numeric,
  "san_luong_du_kien" numeric,
  "da_xuat_hd" numeric,
  -- Cache SUM(XUAT_HD); có thể sync lại
  "con_lai" numeric,
  -- Cache = gia_tri_hd - da_xuat_hd
  "tinh_hinh_xuat_hd" text,
  "hsnt_trang_thai" text,
  "bb_ks_ht" text,
  "bb_nt" text,
  "ton_tai_nt" text,
  "ton_tai_kt" text,
  "ghi_chu" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("hop_dong_id", "ma_du_an")
);

CREATE INDEX IF NOT EXISTS "HOP_DONG_THUC_HIEN_ma_du_an_idx"
  ON "HOP_DONG_THUC_HIEN" ("ma_du_an");
CREATE INDEX IF NOT EXISTS "HOP_DONG_THUC_HIEN_hop_dong_id_idx"
  ON "HOP_DONG_THUC_HIEN" ("hop_dong_id");

-- Giữ idempotent khi bảng đã được tạo bởi phiên bản cũ.
ALTER TABLE "HOP_DONG_THUC_HIEN"
  ADD COLUMN IF NOT EXISTS "gia_tri_ks_dia_hinh" numeric,
  ADD COLUMN IF NOT EXISTS "gia_tri_ks_dia_chat" numeric,
  ADD COLUMN IF NOT EXISTS "gia_tri_ks_khac" numeric;

COMMENT ON TABLE "HOP_DONG_THUC_HIEN" IS 'Số liệu thực hiện HĐ theo giai đoạn — giá trị, phân rã KS/TK, NT, xuất HĐ';

-- 3) Sự kiện xuất hóa đơn / điều chỉnh
CREATE TABLE IF NOT EXISTS "HOP_DONG_XUAT_HD" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "hop_dong_id" uuid NOT NULL REFERENCES "HOP_DONG"("id") ON DELETE CASCADE,
  "ma_du_an" text,
  "loai" text NOT NULL DEFAULT 'thuong',
  -- thuong | dieu_chinh
  "so_tien" numeric NOT NULL,
  -- có thể âm khi điều chỉnh
  "ngay_xuat" date,
  "nam_xuat" integer,
  "so_hoa_don" text,
  "ghi_chu" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "HOP_DONG_XUAT_HD_hop_dong_id_idx"
  ON "HOP_DONG_XUAT_HD" ("hop_dong_id");
CREATE INDEX IF NOT EXISTS "HOP_DONG_XUAT_HD_ma_du_an_idx"
  ON "HOP_DONG_XUAT_HD" ("ma_du_an");
CREATE INDEX IF NOT EXISTS "HOP_DONG_XUAT_HD_ngay_xuat_idx"
  ON "HOP_DONG_XUAT_HD" ("ngay_xuat");

COMMENT ON TABLE "HOP_DONG_XUAT_HD" IS 'Sự kiện xuất hóa đơn / điều chỉnh doanh thu gắn HĐ';

-- 4) RLS (mirror Phase 1 anon)
ALTER TABLE "HOP_DONG_THUC_HIEN" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HOP_DONG_XUAT_HD" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hop_dong_th_select_anon" ON "HOP_DONG_THUC_HIEN";
DROP POLICY IF EXISTS "hop_dong_th_insert_anon" ON "HOP_DONG_THUC_HIEN";
DROP POLICY IF EXISTS "hop_dong_th_update_anon" ON "HOP_DONG_THUC_HIEN";
DROP POLICY IF EXISTS "hop_dong_th_delete_anon" ON "HOP_DONG_THUC_HIEN";

DROP POLICY IF EXISTS "hop_dong_xh_select_anon" ON "HOP_DONG_XUAT_HD";
DROP POLICY IF EXISTS "hop_dong_xh_insert_anon" ON "HOP_DONG_XUAT_HD";
DROP POLICY IF EXISTS "hop_dong_xh_update_anon" ON "HOP_DONG_XUAT_HD";
DROP POLICY IF EXISTS "hop_dong_xh_delete_anon" ON "HOP_DONG_XUAT_HD";

CREATE POLICY "hop_dong_th_select_anon" ON "HOP_DONG_THUC_HIEN"
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "hop_dong_th_insert_anon" ON "HOP_DONG_THUC_HIEN"
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "hop_dong_th_update_anon" ON "HOP_DONG_THUC_HIEN"
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "hop_dong_th_delete_anon" ON "HOP_DONG_THUC_HIEN"
  FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "hop_dong_xh_select_anon" ON "HOP_DONG_XUAT_HD"
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "hop_dong_xh_insert_anon" ON "HOP_DONG_XUAT_HD"
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "hop_dong_xh_update_anon" ON "HOP_DONG_XUAT_HD"
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "hop_dong_xh_delete_anon" ON "HOP_DONG_XUAT_HD"
  FOR DELETE TO anon, authenticated USING (true);
