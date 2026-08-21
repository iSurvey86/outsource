-- RLS cho HOP_DONG + HOP_DONG_GIAI_DOAN
-- Chạy trong Supabase SQL Editor SAU create-hop-dong.sql
--
-- Lỗi thường gặp khi Lưu HĐ:
--   "new row violates row-level security policy for table HOP_DONG"
-- → RLS đã BẬT (mặc định / dashboard) nhưng chưa có policy cho role anon
--   (client Next.js dùng anon key). Auth thật nằm ở UI + localStorage.

ALTER TABLE "HOP_DONG" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HOP_DONG_GIAI_DOAN" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hop_dong_select_anon" ON "HOP_DONG";
DROP POLICY IF EXISTS "hop_dong_insert_anon" ON "HOP_DONG";
DROP POLICY IF EXISTS "hop_dong_update_anon" ON "HOP_DONG";
DROP POLICY IF EXISTS "hop_dong_delete_anon" ON "HOP_DONG";

DROP POLICY IF EXISTS "hop_dong_gd_select_anon" ON "HOP_DONG_GIAI_DOAN";
DROP POLICY IF EXISTS "hop_dong_gd_insert_anon" ON "HOP_DONG_GIAI_DOAN";
DROP POLICY IF EXISTS "hop_dong_gd_update_anon" ON "HOP_DONG_GIAI_DOAN";
DROP POLICY IF EXISTS "hop_dong_gd_delete_anon" ON "HOP_DONG_GIAI_DOAN";

CREATE POLICY "hop_dong_select_anon"
  ON "HOP_DONG"
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "hop_dong_insert_anon"
  ON "HOP_DONG"
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "hop_dong_update_anon"
  ON "HOP_DONG"
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "hop_dong_delete_anon"
  ON "HOP_DONG"
  FOR DELETE
  TO anon, authenticated
  USING (true);

CREATE POLICY "hop_dong_gd_select_anon"
  ON "HOP_DONG_GIAI_DOAN"
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "hop_dong_gd_insert_anon"
  ON "HOP_DONG_GIAI_DOAN"
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "hop_dong_gd_update_anon"
  ON "HOP_DONG_GIAI_DOAN"
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "hop_dong_gd_delete_anon"
  ON "HOP_DONG_GIAI_DOAN"
  FOR DELETE
  TO anon, authenticated
  USING (true);

COMMENT ON TABLE "HOP_DONG" IS
  'Sổ hợp đồng — RLS bật; policy anon Phase 1 (mirror hồ sơ KS)';
COMMENT ON TABLE "HOP_DONG_GIAI_DOAN" IS
  'HĐ × giai đoạn — RLS bật; policy anon Phase 1';
