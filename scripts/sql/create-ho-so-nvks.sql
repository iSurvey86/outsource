-- Hồ sơ NVKS (tiền đề mọi form KS) — OUTSRC
-- Chạy MỘT LẦN trong Supabase SQL Editor TRƯỚC create-ho-so-paktks / nkks / bcks / ntks.
--
-- Lưu ý: bảng TAI_LIEU_HO_SO / tai_lieu trên OUTSRC là hồ sơ folder workspace,
-- KHÔNG phải HO_SO_NVKS (form khảo sát port từ ksnpsc).

CREATE TABLE IF NOT EXISTS "HO_SO_NVKS" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  "ma_du_an" text NOT NULL,
  "ten_du_an" text,
  "giai_doan" text,
  "loai_hinh" text,
  "chu_dau_tu" text,
  "dia_diem" text,
  "quyet_dinh_giao_a" text,
  "quy_mo" text,

  -- Phê duyệt NVKS
  "quyet_dinh_phe_duyet_nvks" text,
  "quyet_dinh_phe_duyet_nvks_day_du" text,
  "link_pdf_phe_duyet_nvks" text,
  "ngay_qd_phe_duyet" date,
  "trang_thai_nvks" text NOT NULL DEFAULT 'dang_lap',
  -- dang_lap | co_qd_pd | da_chot_kl

  -- Phiên bản GỐC / ĐIỀU CHỈNH
  "phien_ban" text NOT NULL DEFAULT 'GỐC',
  "so_lan_dc" integer NOT NULL DEFAULT 0,
  "parent_nvks_id" uuid REFERENCES "HO_SO_NVKS"("id") ON DELETE SET NULL,
  "root_nvks_id" uuid REFERENCES "HO_SO_NVKS"("id") ON DELETE SET NULL,
  "is_active" boolean NOT NULL DEFAULT true,

  -- Thời gian thực hiện (ngày, text)
  "thoi_gian_ks_lap_pa" text,
  "thoi_gian_ks_lap_bcks" text,
  "thoi_gian_hoan_thien_ho_so" text,
  "thoi_gian_thuc_hien_tong" text,
  "thoi_diem_lap" date,

  -- Nhân sự
  "nguoi_lap" text,
  "email_nguoi_lap" text,
  "chu_nhiem_ks" text,
  "lanh_dao_duyet" text,
  "nguoi_lap_ma_nv" text,
  "chu_nhiem_ks_ma_nv" text,
  "lanh_dao_duyet_ma_nv" text,

  -- Bảng khối lượng + meta form
  "du_lieu_bang_tinh" jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Xuất Word/PDF
  "link_docx_xuat" text,
  "link_pdf_xuat" text,
  "link_pdf_da_ky" text,
  "link_pdf_ky_dau" text,
  "exported_at" timestamptz,

  -- Trình ký nội bộ (phase sau; cột sẵn để form không lỗi)
  "trang_thai_ky_noi_bo" text DEFAULT 'chua_trinh',
  "trinh_ky_id" uuid,

  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Nhiều phiên bản / ma_du_an được phép; bản đang làm việc: is_active = true
CREATE INDEX IF NOT EXISTS "HO_SO_NVKS_ma_du_an_idx"
  ON "HO_SO_NVKS" ("ma_du_an");

CREATE INDEX IF NOT EXISTS "HO_SO_NVKS_ma_du_an_active_idx"
  ON "HO_SO_NVKS" ("ma_du_an", "is_active");

CREATE INDEX IF NOT EXISTS "HO_SO_NVKS_root_idx"
  ON "HO_SO_NVKS" ("root_nvks_id", "so_lan_dc");

COMMENT ON TABLE "HO_SO_NVKS" IS 'Hồ sơ Nhiệm vụ khảo sát — hub form NVKS (OUTSRC port ksnpsc)';
COMMENT ON COLUMN "HO_SO_NVKS"."trang_thai_nvks" IS 'dang_lap | co_qd_pd | da_chot_kl';
COMMENT ON COLUMN "HO_SO_NVKS"."du_lieu_bang_tinh" IS 'JSON: quantities, capDhValues, notes, hiddenItems, donViOverrides, cap_dien_ap, …';
COMMENT ON COLUMN "HO_SO_NVKS"."is_active" IS 'Bản đang làm việc chính trên workspace (một active / ma_du_an khuyến nghị)';

-- Sau khi tạo: chạy rls-ho-so-nvks.sql
