-- Chiết giảm TNCTTT (thu nhập chịu thuế tính trước) trên HĐ
-- Ví dụ: sau «Cộng trước thuế (I+II)» trừ 6% → khớp điều khoản trước VAT.
-- Chạy một lần trên Supabase SQL Editor.

ALTER TABLE "HOP_DONG"
  ADD COLUMN IF NOT EXISTS "chiet_giam_tncttt" jsonb DEFAULT NULL;

COMMENT ON COLUMN "HOP_DONG"."chiet_giam_tncttt" IS
  'Chiết giảm TNCTTT: {ty_le, so_tien, so_tien_truoc_giam, ghi_chu}. ty_le %; số tiền trước VAT.';
