-- Module 04: Phương án kỹ thuật khảo sát (PAKTKS)
-- Chạy một lần trong Supabase SQL Editor.
-- Tiền đề: bảng HO_SO_NVKS đã tồn tại.

CREATE TABLE IF NOT EXISTS "HO_SO_PAKTKS" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Liên kết dự án / NVKS (bắt buộc có NVKS trước khi lập PAKTKS)
  "ma_du_an" text NOT NULL,
  "nvks_id" uuid NOT NULL REFERENCES "HO_SO_NVKS"("id") ON DELETE RESTRICT,

  -- I. Thông tin chung (kế thừa DA + NVKS, mirror FormNVKS)
  "ten_du_an" text,
  "giai_doan" text,
  "loai_hinh" text,
  "chu_dau_tu" text,
  "dia_diem" text,
  "quyet_dinh_giao_a" text,
  "quy_mo" text,
  "cap_dien_ap" text,

  -- II. Nhân sự
  "nguoi_lap" text,
  "email_nguoi_lap" text,
  "chu_nhiem_ks" text,
  "lanh_dao_duyet" text,
  "thoi_diem_lap" date,

  -- IV. Thời gian thực hiện (ngày) — pre-fill từ NVKS, sửa trên PAKTKS nếu cần
  "thoi_gian_ks_lap_pa" text,
  "thoi_gian_ks_lap_bcks" text,
  "thoi_gian_hoan_thien_ho_so" text,
  "thoi_gian_thuc_hien_tong" text,

  -- Snapshot khối lượng từ NVKS (chỉ hàng KL > 0 tại thời điểm tạo / đồng bộ)
  "nvks_snapshot_at" timestamptz,
  "du_lieu_bang_tinh" jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Cấu trúc gợi ý (giống HO_SO_NVKS.du_lieu_bang_tinh):
  -- {
  --   "quantities": { "CV_001_tong": "12", ... },
  --   "capDhValues": { ... },
  --   "notes": { ... },
  --   "hiddenItems": ["CV_xxx"],
  --   "donViOverrides": { ... },
  --   "cap_dien_ap": "...",
  --   "source_nvks_id": "uuid",
  --   "filtered_kl_only": true
  -- }

  -- Nội dung riêng PAKTKS (phương án KT, nhân sự PA chi tiết… — phase sau)
  "du_lieu_paktks" jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Trạng thái & phê duyệt (phase sau, mirror NVKS)
  "trang_thai_paktks" text NOT NULL DEFAULT 'dang_lap',
  -- dang_lap | co_qd_pd | da_chot (mở rộng sau)
  "phien_ban" text NOT NULL DEFAULT 'GOC',
  "quyet_dinh_phe_duyet_paktks" text,
  "quyet_dinh_phe_duyet_paktks_day_du" text,
  "link_pdf_phe_duyet_paktks" text,
  "ngay_qd_phe_duyet" date,

  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Mỗi mã dự án (giai đoạn) chỉ một hồ sơ PAKTKS
CREATE UNIQUE INDEX IF NOT EXISTS "HO_SO_PAKTKS_ma_du_an_unique"
  ON "HO_SO_PAKTKS" ("ma_du_an");

CREATE INDEX IF NOT EXISTS "HO_SO_PAKTKS_nvks_id_idx"
  ON "HO_SO_PAKTKS" ("nvks_id");

COMMENT ON TABLE "HO_SO_PAKTKS" IS 'Hồ sơ Phương án kỹ thuật khảo sát — kế thừa KL snapshot từ HO_SO_NVKS';
COMMENT ON COLUMN "HO_SO_PAKTKS"."du_lieu_bang_tinh" IS 'Snapshot bảng KL (>0) từ NVKS; read-only trên FormPAKTKS';
COMMENT ON COLUMN "HO_SO_PAKTKS"."trang_thai_paktks" IS 'dang_lap | co_qd_pd | da_chot';

-- Sau khi tạo bảng: nếu bật RLS trên Supabase, chạy thêm:
--   scripts/sql/rls-ho-so-paktks.sql
