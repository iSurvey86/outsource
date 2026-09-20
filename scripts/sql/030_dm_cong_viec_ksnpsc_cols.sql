-- Bổ sung cột DM_CONG_VIEC khớp ksnpsc (lọc giai đoạn / loại dòng / công thức)
-- tt trên ksnpsc là text (I, II, I.1…) — không dùng integer
ALTER TABLE "DM_CONG_VIEC" ADD COLUMN IF NOT EXISTS "tt" text;
-- Nếu đã chạy bản cũ (tt integer), đổi kiểu:
DO $$ BEGIN
  ALTER TABLE "DM_CONG_VIEC" ALTER COLUMN "tt" TYPE text USING "tt"::text;
EXCEPTION WHEN others THEN NULL;
END $$;
ALTER TABLE "DM_CONG_VIEC" ADD COLUMN IF NOT EXISTS "loai_dong" text;
ALTER TABLE "DM_CONG_VIEC" ADD COLUMN IF NOT EXISTS "apdung_bcktkt" integer;
ALTER TABLE "DM_CONG_VIEC" ADD COLUMN IF NOT EXISTS "apdung_bcnckt" integer;
ALTER TABLE "DM_CONG_VIEC" ADD COLUMN IF NOT EXISTS "apdung_tkbvtc" integer;
ALTER TABLE "DM_CONG_VIEC" ADD COLUMN IF NOT EXISTS "cong_thuc" text;
