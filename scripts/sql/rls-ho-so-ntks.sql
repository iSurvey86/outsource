-- RLS cho HO_SO_NTKS — chạy SAU create-ho-so-ntks.sql

ALTER TABLE "HO_SO_NTKS" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ho_so_ntks_select_anon" ON "HO_SO_NTKS";
DROP POLICY IF EXISTS "ho_so_ntks_insert_anon" ON "HO_SO_NTKS";
DROP POLICY IF EXISTS "ho_so_ntks_update_anon" ON "HO_SO_NTKS";
DROP POLICY IF EXISTS "ho_so_ntks_delete_anon" ON "HO_SO_NTKS";

CREATE POLICY "ho_so_ntks_select_anon"
  ON "HO_SO_NTKS"
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "ho_so_ntks_insert_anon"
  ON "HO_SO_NTKS"
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "ho_so_ntks_update_anon"
  ON "HO_SO_NTKS"
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "ho_so_ntks_delete_anon"
  ON "HO_SO_NTKS"
  FOR DELETE
  TO anon, authenticated
  USING (true);
