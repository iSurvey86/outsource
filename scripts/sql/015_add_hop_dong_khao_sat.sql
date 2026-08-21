-- Tách giá trị khảo sát theo Địa hình / Địa chất / Khác-thỏa thuận.
-- Chạy một lần trong Supabase SQL Editor sau create-hop-dong-thuc-hien.sql.

ALTER TABLE public."HOP_DONG_THUC_HIEN"
  ADD COLUMN IF NOT EXISTS "gia_tri_ks_dia_hinh" numeric,
  ADD COLUMN IF NOT EXISTS "gia_tri_ks_dia_chat" numeric,
  ADD COLUMN IF NOT EXISTS "gia_tri_ks_khac" numeric;

COMMENT ON COLUMN public."HOP_DONG_THUC_HIEN"."gia_tri_ks"
  IS 'Tổng giá trị khảo sát = địa hình + địa chất + khác/thỏa thuận';
COMMENT ON COLUMN public."HOP_DONG_THUC_HIEN"."gia_tri_ks_dia_hinh"
  IS 'Giá trị khảo sát địa hình trước VAT';
COMMENT ON COLUMN public."HOP_DONG_THUC_HIEN"."gia_tri_ks_dia_chat"
  IS 'Giá trị khảo sát địa chất trước VAT';
COMMENT ON COLUMN public."HOP_DONG_THUC_HIEN"."gia_tri_ks_khac"
  IS 'Giá trị khảo sát khác, thỏa thuận và thu thập số liệu trước VAT';
