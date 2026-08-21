-- HĐ ký lại do đổi pháp nhân / sáp nhập / chuyển chủ đầu tư
-- Chạy một lần SAU create-hop-dong.sql.

ALTER TABLE "HOP_DONG"
  ADD COLUMN IF NOT EXISTS "ky_lai_tu_id" uuid
  REFERENCES "HOP_DONG"("id") ON DELETE SET NULL;

ALTER TABLE "HOP_DONG"
  ADD COLUMN IF NOT EXISTS "ly_do_ky_lai" text;

CREATE INDEX IF NOT EXISTS "HOP_DONG_ky_lai_tu_id_idx"
  ON "HOP_DONG" ("ky_lai_tu_id");

COMMENT ON COLUMN "HOP_DONG"."ky_lai_tu_id"
  IS 'HĐ chính trước bị thay thế khi ký lại do đổi pháp nhân / sáp nhập / chuyển CĐT';
COMMENT ON COLUMN "HOP_DONG"."ly_do_ky_lai"
  IS 'doi_phap_nhan | sap_nhap | chuyen_chu_dau_tu | khac';
