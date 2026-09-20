-- RLS cho HO_SO_NKKS
-- Chạy trong Supabase SQL Editor SAU create-ho-so-nkks.sql
--
-- Lỗi thường gặp khi Lưu NKKS:
--   "new row violates row-level security policy for table HO_SO_NKKS"
-- → RLS đã BẬT nhưng chưa có policy cho role anon (client Next.js dùng anon key).
--
-- Nguyên nhân: bảng HO_SO_NKKS tạo sau enable-rls-phase1-anon-policies.sql
-- hoặc chưa chạy lại block policy cho bảng này.

ALTER TABLE "HO_SO_NKKS" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ho_so_nkks_select_anon" ON "HO_SO_NKKS";
DROP POLICY IF EXISTS "ho_so_nkks_insert_anon" ON "HO_SO_NKKS";
DROP POLICY IF EXISTS "ho_so_nkks_update_anon" ON "HO_SO_NKKS";
DROP POLICY IF EXISTS "ho_so_nkks_delete_anon" ON "HO_SO_NKKS";
DROP POLICY IF EXISTS "ho_so_nkks_anon_select" ON "HO_SO_NKKS";
DROP POLICY IF EXISTS "ho_so_nkks_anon_insert" ON "HO_SO_NKKS";
DROP POLICY IF EXISTS "ho_so_nkks_anon_update" ON "HO_SO_NKKS";
DROP POLICY IF EXISTS "ho_so_nkks_anon_delete" ON "HO_SO_NKKS";

CREATE POLICY "ho_so_nkks_select_anon"
  ON "HO_SO_NKKS"
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "ho_so_nkks_insert_anon"
  ON "HO_SO_NKKS"
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "ho_so_nkks_update_anon"
  ON "HO_SO_NKKS"
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "ho_so_nkks_delete_anon"
  ON "HO_SO_NKKS"
  FOR DELETE
  TO anon, authenticated
  USING (true);

COMMENT ON TABLE "HO_SO_NKKS" IS
  'Nhật ký khảo sát hiện trường — RLS bật; policy anon mirror HO_SO_NVKS Phase 1';
