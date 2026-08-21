-- Sổ Hợp đồng (P2 — Lát 0/1)
-- Chạy một lần trong Supabase SQL Editor.
-- Tiền đề: bảng du_an đã có (OUTSRC). Cột cache hop_dong* thêm bên dưới / 017.
--   (xem add-hop-dong-day-du.sql nếu chưa chạy).

-- 1) Sổ hợp đồng
CREATE TABLE IF NOT EXISTS "HOP_DONG" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ten_cong_trinh" text NOT NULL,
  "nhom_cong_trinh_key" text NOT NULL,
  "loai" text NOT NULL DEFAULT 'chinh',
  -- chinh | phu_luc_dc | thau_phu  (Lát 1 chỉ dùng chinh)
  "so_hop_dong" text,
  "hop_dong_day_du" text,
  "ngay_ky" date,
  "ben_a" text,
  "ben_b" text,
  "gia_tri" numeric,
  "link_pdf" text,
  "trang_thai" text NOT NULL DEFAULT 'hieu_luc',
  -- hieu_luc | het_hieu_luc | thay_the
  "hop_dong_goc_id" uuid REFERENCES "HOP_DONG"("id") ON DELETE SET NULL,
  -- PL/ĐC trỏ HĐ chính (Lát 2)
  "ky_lai_tu_id" uuid REFERENCES "HOP_DONG"("id") ON DELETE SET NULL,
  -- HĐ chính mới trỏ HĐ chính trước khi ký lại do đổi pháp nhân
  "ly_do_ky_lai" text,
  -- doi_phap_nhan | sap_nhap | chuyen_chu_dau_tu | khac
  "loai_thau_phu" text,
  -- dia_chat | dia_hinh | ... (Lát 3)
  "ghi_chu" text,
  "chi_phi_chung" jsonb DEFAULT '[]'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "HOP_DONG_nhom_key_idx"
  ON "HOP_DONG" ("nhom_cong_trinh_key");
CREATE INDEX IF NOT EXISTS "HOP_DONG_loai_idx"
  ON "HOP_DONG" ("loai");
CREATE INDEX IF NOT EXISTS "HOP_DONG_trang_thai_idx"
  ON "HOP_DONG" ("trang_thai");
CREATE INDEX IF NOT EXISTS "HOP_DONG_goc_id_idx"
  ON "HOP_DONG" ("hop_dong_goc_id");
CREATE INDEX IF NOT EXISTS "HOP_DONG_ky_lai_tu_id_idx"
  ON "HOP_DONG" ("ky_lai_tu_id");

COMMENT ON TABLE "HOP_DONG" IS 'Sổ hợp đồng công trình — nguồn sự thật; du_an.hop_dong* là cache hiển thị HĐ chính hiệu lực';
COMMENT ON COLUMN "HOP_DONG"."loai" IS 'chinh | phu_luc_dc | thau_phu';
COMMENT ON COLUMN "HOP_DONG"."trang_thai" IS 'hieu_luc | het_hieu_luc | thay_the';
COMMENT ON COLUMN "HOP_DONG"."nhom_cong_trinh_key" IS 'Khóa nhóm theo tên công trình (lowercase trim) — cùng logic Ban lãnh đạo';
COMMENT ON COLUMN "HOP_DONG"."ky_lai_tu_id" IS 'HĐ chính trước bị thay thế khi ký lại do đổi pháp nhân / sáp nhập / chuyển CĐT';

-- 2) Áp dụng giai đoạn (N–N)
CREATE TABLE IF NOT EXISTS "HOP_DONG_GIAI_DOAN" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "hop_dong_id" uuid NOT NULL REFERENCES "HOP_DONG"("id") ON DELETE CASCADE,
  "ma_du_an" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("hop_dong_id", "ma_du_an")
);

CREATE INDEX IF NOT EXISTS "HOP_DONG_GIAI_DOAN_ma_du_an_idx"
  ON "HOP_DONG_GIAI_DOAN" ("ma_du_an");
CREATE INDEX IF NOT EXISTS "HOP_DONG_GIAI_DOAN_hop_dong_id_idx"
  ON "HOP_DONG_GIAI_DOAN" ("hop_dong_id");

COMMENT ON TABLE "HOP_DONG_GIAI_DOAN" IS 'Hợp đồng áp dụng cho các mã dự án (giai đoạn); một HĐ có thể gắn nhiều công trình (HĐ khung)';

-- 3) Đảm bảo cột cache trên du_an (idempotent)
ALTER TABLE du_an ADD COLUMN IF NOT EXISTS hop_dong text;
ALTER TABLE du_an ADD COLUMN IF NOT EXISTS hop_dong_day_du text;
ALTER TABLE du_an ADD COLUMN IF NOT EXISTS link_pdf_hop_dong text;

-- 4) Bắt buộc chạy tiếp: scripts/sql/016_rls_hop_dong.sql
--    (tránh lỗi: new row violates row-level security policy for table HOP_DONG)
-- 5) Số liệu / import Excel: scripts/sql/009_create_hop_dong_thuc_hien.sql
-- 6) PDF cache: đã gồm ở trên; hoặc chạy riêng 017_du_an_link_pdf_hop_dong.sql
