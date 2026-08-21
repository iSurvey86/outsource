-- Chi phí chung HĐ khung (không phân bổ theo từng công trình)
-- Ví dụ: lập HSMT 600tr + dịch thuật HSMT 200tr
-- Chạy một lần trên Supabase SQL Editor.

ALTER TABLE "HOP_DONG"
  ADD COLUMN IF NOT EXISTS "chi_phi_chung" jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN "HOP_DONG"."chi_phi_chung" IS
  'Mảng chi phí chung của HĐ (trước VAT), không gắn mã DA. [{mo_ta, gia_tri, loai}]. loai: hsmt | dich_thuat_hsmt | khac';
