-- RLS cho HO_SO_BCKS — chạy SAU create-ho-so-bcks.sql

ALTER TABLE "HO_SO_BCKS" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ho_so_bcks_select_anon" ON "HO_SO_BCKS";
DROP POLICY IF EXISTS "ho_so_bcks_insert_anon" ON "HO_SO_BCKS";
DROP POLICY IF EXISTS "ho_so_bcks_update_anon" ON "HO_SO_BCKS";
DROP POLICY IF EXISTS "ho_so_bcks_delete_anon" ON "HO_SO_BCKS";

CREATE POLICY "ho_so_bcks_select_anon"
  ON "HO_SO_BCKS"
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "ho_so_bcks_insert_anon"
  ON "HO_SO_BCKS"
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "ho_so_bcks_update_anon"
  ON "HO_SO_BCKS"
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "ho_so_bcks_delete_anon"
  ON "HO_SO_BCKS"
  FOR DELETE
  TO anon, authenticated
  USING (true);
