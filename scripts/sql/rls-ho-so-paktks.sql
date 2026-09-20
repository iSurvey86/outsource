-- RLS cho HO_SO_PAKTKS
-- Chạy trong Supabase SQL Editor SAU create-ho-so-paktks.sql
--
-- Lỗi thường gặp khi Lưu PAKTKS:
--   "new row violates row-level security policy for table HO_SO_PAKTKS"
-- → RLS đã BẬT nhưng chưa có policy cho role anon (client Next.js dùng anon key).
--
-- KHÔNG khuyến nghị tắt RLS. Thêm policy giống HO_SO_NVKS (hoặc như script dưới).

ALTER TABLE "HO_SO_PAKTKS" ENABLE ROW LEVEL SECURITY;

-- Xóa policy cũ nếu chạy lại script
DROP POLICY IF EXISTS "ho_so_paktks_select_anon" ON "HO_SO_PAKTKS";
DROP POLICY IF EXISTS "ho_so_paktks_insert_anon" ON "HO_SO_PAKTKS";
DROP POLICY IF EXISTS "ho_so_paktks_update_anon" ON "HO_SO_PAKTKS";
DROP POLICY IF EXISTS "ho_so_paktks_delete_anon" ON "HO_SO_PAKTKS";

-- Cho phép app (anon + authenticated) đọc/ghi — cùng mô hình HO_SO_NVKS Phase 1
-- (Auth thật nằm ở localStorage + quyền UI; RLS mở cho client Supabase anon)

CREATE POLICY "ho_so_paktks_select_anon"
  ON "HO_SO_PAKTKS"
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "ho_so_paktks_insert_anon"
  ON "HO_SO_PAKTKS"
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "ho_so_paktks_update_anon"
  ON "HO_SO_PAKTKS"
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "ho_so_paktks_delete_anon"
  ON "HO_SO_PAKTKS"
  FOR DELETE
  TO anon, authenticated
  USING (true);

COMMENT ON TABLE "HO_SO_PAKTKS" IS
  'Hồ sơ PAKTKS — RLS bật; policy anon mirror HO_SO_NVKS Phase 1';
