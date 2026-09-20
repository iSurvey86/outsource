-- RLS cho HO_SO_NVKS — chạy SAU create-ho-so-nvks.sql
-- Mirror policy Phase 1 (anon + authenticated) như các bảng HO_SO_* khác trên OUTSRC.

ALTER TABLE "HO_SO_NVKS" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ho_so_nvks_select_anon" ON "HO_SO_NVKS";
DROP POLICY IF EXISTS "ho_so_nvks_insert_anon" ON "HO_SO_NVKS";
DROP POLICY IF EXISTS "ho_so_nvks_update_anon" ON "HO_SO_NVKS";
DROP POLICY IF EXISTS "ho_so_nvks_delete_anon" ON "HO_SO_NVKS";

CREATE POLICY "ho_so_nvks_select_anon"
  ON "HO_SO_NVKS"
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "ho_so_nvks_insert_anon"
  ON "HO_SO_NVKS"
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "ho_so_nvks_update_anon"
  ON "HO_SO_NVKS"
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "ho_so_nvks_delete_anon"
  ON "HO_SO_NVKS"
  FOR DELETE
  TO anon, authenticated
  USING (true);

COMMENT ON TABLE "HO_SO_NVKS" IS
  'Hồ sơ NVKS — RLS bật; policy anon Phase 1 (OUTSRC)';
