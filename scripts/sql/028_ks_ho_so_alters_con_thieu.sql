-- OUTSRC: cột còn thiếu sau create-ho-so-* cơ bản
-- Chạy MỘT LẦN trên Supabase SQL Editor (sau khi đã có HO_SO_NVKS / PAKTKS / NKKS).
-- An toàn chạy lại (ADD COLUMN IF NOT EXISTS).

-- ═══ PAKTKS: phiên bản + xuất file + trình ký (cột) ═══
ALTER TABLE "HO_SO_PAKTKS" ADD COLUMN IF NOT EXISTS "so_lan_dc" integer DEFAULT 0;
ALTER TABLE "HO_SO_PAKTKS" ADD COLUMN IF NOT EXISTS "parent_paktks_id" uuid REFERENCES "HO_SO_PAKTKS"("id") ON DELETE SET NULL;
ALTER TABLE "HO_SO_PAKTKS" ADD COLUMN IF NOT EXISTS "root_paktks_id" uuid REFERENCES "HO_SO_PAKTKS"("id") ON DELETE SET NULL;
ALTER TABLE "HO_SO_PAKTKS" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true;
ALTER TABLE "HO_SO_PAKTKS" ADD COLUMN IF NOT EXISTS "link_docx_xuat" text;
ALTER TABLE "HO_SO_PAKTKS" ADD COLUMN IF NOT EXISTS "link_pdf_xuat" text;
ALTER TABLE "HO_SO_PAKTKS" ADD COLUMN IF NOT EXISTS "link_pdf_da_ky" text;
ALTER TABLE "HO_SO_PAKTKS" ADD COLUMN IF NOT EXISTS "link_pdf_ky_dau" text;
ALTER TABLE "HO_SO_PAKTKS" ADD COLUMN IF NOT EXISTS "exported_at" timestamptz;
ALTER TABLE "HO_SO_PAKTKS" ADD COLUMN IF NOT EXISTS "trang_thai_ky_noi_bo" text DEFAULT 'chua_trinh';
ALTER TABLE "HO_SO_PAKTKS" ADD COLUMN IF NOT EXISTS "trinh_ky_id" uuid;
ALTER TABLE "HO_SO_PAKTKS" ADD COLUMN IF NOT EXISTS "nguoi_lap_ma_nv" text;
ALTER TABLE "HO_SO_PAKTKS" ADD COLUMN IF NOT EXISTS "chu_nhiem_ks_ma_nv" text;
ALTER TABLE "HO_SO_PAKTKS" ADD COLUMN IF NOT EXISTS "lanh_dao_duyet_ma_nv" text;

-- create-ho-so-paktks có UNIQUE(ma_du_an) — cần bỏ để nhiều phiên bản
DROP INDEX IF EXISTS "HO_SO_PAKTKS_ma_du_an_unique";

UPDATE "HO_SO_PAKTKS"
SET
  phien_ban = COALESCE(NULLIF(TRIM(phien_ban), ''), 'GOC'),
  so_lan_dc = COALESCE(so_lan_dc, 0),
  is_active = COALESCE(is_active, true)
WHERE phien_ban IS NULL OR so_lan_dc IS NULL OR is_active IS NULL;

UPDATE "HO_SO_PAKTKS"
SET root_paktks_id = id
WHERE root_paktks_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_ho_so_paktks_ma_du_an_active ON "HO_SO_PAKTKS" ("ma_du_an", "is_active");
CREATE INDEX IF NOT EXISTS idx_ho_so_paktks_root ON "HO_SO_PAKTKS" ("root_paktks_id", "so_lan_dc");

-- ═══ NKKS: nhân lực + link xuất ═══
ALTER TABLE "HO_SO_NKKS" ADD COLUMN IF NOT EXISTS "nhan_luc" text;
ALTER TABLE "HO_SO_NKKS" ADD COLUMN IF NOT EXISTS "may_moc_thiet_bi" text;
ALTER TABLE "HO_SO_NKKS" ADD COLUMN IF NOT EXISTS "link_docx_xuat" text;
ALTER TABLE "HO_SO_NKKS" ADD COLUMN IF NOT EXISTS "link_pdf_xuat" text;
ALTER TABLE "HO_SO_NKKS" ADD COLUMN IF NOT EXISTS "exported_at" timestamptz;

-- ═══ BCKS / NTKS: link xuất nếu form ghi ═══
ALTER TABLE "HO_SO_BCKS" ADD COLUMN IF NOT EXISTS "link_docx_xuat" text;
ALTER TABLE "HO_SO_BCKS" ADD COLUMN IF NOT EXISTS "link_pdf_xuat" text;
ALTER TABLE "HO_SO_BCKS" ADD COLUMN IF NOT EXISTS "exported_at" timestamptz;

ALTER TABLE "HO_SO_NTKS" ADD COLUMN IF NOT EXISTS "link_docx_xuat" text;
ALTER TABLE "HO_SO_NTKS" ADD COLUMN IF NOT EXISTS "link_pdf_xuat" text;
ALTER TABLE "HO_SO_NTKS" ADD COLUMN IF NOT EXISTS "exported_at" timestamptz;
