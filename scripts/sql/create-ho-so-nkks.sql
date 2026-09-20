-- Module 06: Nhật ký khảo sát (NKKS)
-- Chạy một lần trong Supabase SQL Editor.
-- Tiền đề: bảng HO_SO_NVKS đã tồn tại.

CREATE TABLE IF NOT EXISTS "HO_SO_NKKS" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  "ma_du_an" text NOT NULL,
  "nvks_id" uuid NOT NULL REFERENCES "HO_SO_NVKS"("id") ON DELETE RESTRICT,

  -- Header (kế thừa DA/NVKS + nhập trên form NKKS)
  "ten_du_an" text,
  "dia_diem" text,
  "loai_hinh" text,
  "nha_thau_ks" text,
  "goi_thau" text,
  "chu_dau_tu" text,
  "nha_thau_tvgs" text,
  "hang_muc" text,
  "ngay_bat_dau" date,
  "ngay_ket_thuc" date,

  -- Bảng khối lượng NKKS (snapshot khi Lưu) + vết tham chiếu NVKS
  "bang_khoi_luong" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "nvks_kl_source_id" uuid,
  "nvks_kl_source_label" text,

  -- Chi tiết nhật ký theo ngày KS (mảng JSON)
  "chi_tiet_nhat_ky" jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Mỗi phần tử:
  -- {
  --   "ngay_khao_sat": "2026-07-01",
  --   "thoi_tiet": "...",
  --   "nhan_luc": "...",
  --   "cong_viec_thuc_hien": "...",
  --   "may_moc_thiet_bi": "...",
  --   "khoi_luong_thuc_hien": "...",
  --   "y_kien_chu_dau_tu": "...",
  --   "y_kien_giam_sat": "...",
  --   "cac_van_de_dac_biet": "..."
  -- }

  "trang_thai_nkks" text NOT NULL DEFAULT 'dang_lap',
  -- dang_lap | da_chot (mở rộng sau)

  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "HO_SO_NKKS_ma_du_an_unique"
  ON "HO_SO_NKKS" ("ma_du_an");

CREATE INDEX IF NOT EXISTS "HO_SO_NKKS_nvks_id_idx"
  ON "HO_SO_NKKS" ("nvks_id");

COMMENT ON TABLE "HO_SO_NKKS" IS 'Nhật ký khảo sát hiện trường — kế thừa metadata từ HO_SO_NVKS';
COMMENT ON COLUMN "HO_SO_NKKS"."chi_tiet_nhat_ky" IS 'Mảng JSON các dòng nhật ký theo ngày (map → nkks_ngays khi xuất Word)';

-- Sau khi tạo bảng:
--   1. scripts/sql/rls-ho-so-nkks.sql  (bắt buộc — tránh lỗi RLS khi Lưu)
--   2. add-nkks-bang-kl-columns.sql, add-nkks-export-storage.sql, add-nkks-nhan-luc-may-moc.sql (nếu chưa có)
-- Hoặc chạy lại enable-rls-phase1-anon-policies.sql (đã gồm HO_SO_NKKS)
