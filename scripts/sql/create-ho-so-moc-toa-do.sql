-- Module: Quản lý mốc tọa độ (khai thác điểm tọa độ nhà nước VN-2000)
-- Chạy một lần trong Supabase SQL Editor.
-- Sau đó: rls-ho-so-moc-toa-do.sql + storage-moc-toa-do.sql

CREATE TABLE IF NOT EXISTS "HO_SO_MOC_TOA_DO" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "loai_moc" text NOT NULL DEFAULT 'toa_do'
    CHECK ("loai_moc" IN ('toa_do', 'do_cao')),

  -- Định danh lần khai thác
  "so_phieu_cung_cap" text,
  "so_hoa_don" text,
  "ngay_cap" date,
  "so_phieu_yeu_cau" text,
  "ngay_yeu_cau" date,

  -- Người nhận / GGT
  "nguoi_nhan" text,
  "don_vi_nhan" text,
  "cccd_nguoi_nhan" text,
  "so_ggt" text,
  "ngay_ggt" date,
  "han_ggt" date,

  -- Cơ sở toán học (phiếu cung cấp)
  "ellipsoid" text,
  "phep_chieu" text,
  "mui_chieu" text,
  "he_so_k0" text,
  "kinh_tuyen_truc" text,

  "don_vi_cap" text,
  "nguoi_cap" text,
  "thu_truong_cap" text,

  -- File tài liệu chính
  "link_file_yeu_cau" text,
  "path_file_yeu_cau" text,
  "link_file_cung_cap" text,
  "path_file_cung_cap" text,

  -- Phụ lục: [{ loai, ten, link, path, so_chung_tu, ngay, so_tien, ghi_chu }]
  "phu_luc_files" jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- nhap | co_yeu_cau | co_cung_cap | du_phu_luc
  "trang_thai" text NOT NULL DEFAULT 'nhap',

  "ghi_chu" text,
  "nguoi_nhap" text,
  "email_nguoi_nhap" text,

  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "HO_SO_MOC_TOA_DO_ngay_cap_idx"
  ON "HO_SO_MOC_TOA_DO" ("ngay_cap" DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS "HO_SO_MOC_TOA_DO_trang_thai_idx"
  ON "HO_SO_MOC_TOA_DO" ("trang_thai");

CREATE INDEX IF NOT EXISTS "HO_SO_MOC_TOA_DO_so_phieu_cung_cap_idx"
  ON "HO_SO_MOC_TOA_DO" ("so_phieu_cung_cap");

COMMENT ON TABLE "HO_SO_MOC_TOA_DO" IS
  '1 dòng = 1 lần khai thác mốc; 2 slot chính (yêu cầu + cung cấp) + phụ lục';

CREATE TABLE IF NOT EXISTS "HO_SO_MOC_TOA_DO_DIEM" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ho_so_id" uuid NOT NULL REFERENCES "HO_SO_MOC_TOA_DO"("id") ON DELETE CASCADE,

  "stt" integer NOT NULL DEFAULT 1,
  "loai_diem" text NOT NULL DEFAULT 'toa_do'
    CHECK ("loai_diem" IN ('toa_do', 'do_cao')),
  "ten_diem" text,
  "so_hieu" text,
  "tuyen_do" text,
  "cap_hang" text,
  "x" numeric,
  "y" numeric,
  "h" numeric,
  "ghi_chu" text,
  "khu_vuc" text,
  "dia_diem" text,
  "muc_dich_text" text,
  "ma_du_an" text,
  "mui_chieu" text,
  "kinh_tuyen_truc" text,
  "x_tm_tinh" numeric,
  "y_tm_tinh" numeric,
  "kinh_tuyen_truc_tinh" text,
  "tinh_tm" text,

  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "HO_SO_MOC_TOA_DO_DIEM_ho_so_id_idx"
  ON "HO_SO_MOC_TOA_DO_DIEM" ("ho_so_id");

CREATE INDEX IF NOT EXISTS "HO_SO_MOC_TOA_DO_DIEM_so_hieu_idx"
  ON "HO_SO_MOC_TOA_DO_DIEM" ("so_hieu");

CREATE INDEX IF NOT EXISTS "HO_SO_MOC_TOA_DO_DIEM_ma_du_an_idx"
  ON "HO_SO_MOC_TOA_DO_DIEM" ("ma_du_an");

COMMENT ON TABLE "HO_SO_MOC_TOA_DO_DIEM" IS
  'Chi tiết điểm tọa độ thuộc 1 hồ sơ khai thác mốc';
