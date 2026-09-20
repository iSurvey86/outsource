-- Danh mục công việc KS — Form NVKS / PAKTKS / NKKS đọc bảng này.
-- OUTSRC thường chưa có (khác ksnpsc). Chạy nếu Table Editor không thấy DM_CONG_VIEC.
-- Sau đó cần seed dữ liệu từ ksnpsc (export CSV Table Editor → Import) hoặc nhập tay.

CREATE TABLE IF NOT EXISTS "DM_CONG_VIEC" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "id_cong_viec" text NOT NULL,
  "ten_cong_viec" text,
  "don_vi" text,
  "cap_dh" text,
  "loai_nhap_lieu" text,
  "phan_loai_hang_muc" text,
  "giai_doan" text,
  "thu_tu" integer,
  "ghi_chu" text,
  "nguon" text DEFAULT 'HE_THONG',
  "trang_thai_dm" text DEFAULT 'MAC_DINH',
  "tao_boi_email" text,
  "tao_luc" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "DM_CONG_VIEC_id_cong_viec_unique"
  ON "DM_CONG_VIEC" ("id_cong_viec");

CREATE INDEX IF NOT EXISTS "DM_CONG_VIEC_phan_loai_idx"
  ON "DM_CONG_VIEC" ("phan_loai_hang_muc");

COMMENT ON TABLE "DM_CONG_VIEC" IS 'Danh mục công việc khảo sát — nguồn bảng KL NVKS';

ALTER TABLE "DM_CONG_VIEC" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dm_cong_viec_select_anon" ON "DM_CONG_VIEC";
DROP POLICY IF EXISTS "dm_cong_viec_insert_anon" ON "DM_CONG_VIEC";
DROP POLICY IF EXISTS "dm_cong_viec_update_anon" ON "DM_CONG_VIEC";
DROP POLICY IF EXISTS "dm_cong_viec_delete_anon" ON "DM_CONG_VIEC";

CREATE POLICY "dm_cong_viec_select_anon"
  ON "DM_CONG_VIEC" FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "dm_cong_viec_insert_anon"
  ON "DM_CONG_VIEC" FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "dm_cong_viec_update_anon"
  ON "DM_CONG_VIEC" FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "dm_cong_viec_delete_anon"
  ON "DM_CONG_VIEC" FOR DELETE TO anon, authenticated USING (true);
