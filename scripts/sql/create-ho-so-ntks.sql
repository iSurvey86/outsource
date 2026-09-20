-- Module NTKS: Nghiệm thu khảo sát (hub 3 biểu mẫu)
-- Chạy một lần trong Supabase SQL Editor.
-- Tiền đề: HO_SO_NVKS, HO_SO_NKKS đã tồn tại.

CREATE TABLE IF NOT EXISTS "HO_SO_NTKS" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  "ma_du_an" text NOT NULL,
  "nvks_id" uuid NOT NULL REFERENCES "HO_SO_NVKS"("id") ON DELETE RESTRICT,
  "nkks_id" uuid REFERENCES "HO_SO_NKKS"("id") ON DELETE SET NULL,

  -- Header kế thừa DA/NVKS/NKKS
  "ten_du_an" text,
  "dia_diem" text,
  "giai_doan" text,
  "chu_dau_tu" text,
  "nha_thau_ks" text,
  "nha_thau_tvgs" text,

  -- Hub 3 biểu mẫu — mỗi key: hien_truong | kiem_tra_nl_tb | nghiem_thu_kq
  "chi_tiet_ntks" jsonb NOT NULL DEFAULT '{}'::jsonb,

  "trang_thai_ntks" text NOT NULL DEFAULT 'dang_lap',
  -- dang_lap | da_chot

  "link_docx_xuat" text,
  "exported_at" timestamptz,

  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "HO_SO_NTKS_ma_du_an_unique"
  ON "HO_SO_NTKS" ("ma_du_an");

CREATE INDEX IF NOT EXISTS "HO_SO_NTKS_nvks_id_idx"
  ON "HO_SO_NTKS" ("nvks_id");

COMMENT ON TABLE "HO_SO_NTKS" IS 'Nghiệm thu khảo sát — hub 3 biểu mẫu (chi_tiet_ntks jsonb)';
COMMENT ON COLUMN "HO_SO_NTKS"."chi_tiet_ntks" IS 'JSON: hien_truong, kiem_tra_nl_tb, nghiem_thu_kq — mỗi form có fields + bảng + link_docx_xuat';

-- Sau khi tạo bảng: scripts/sql/rls-ho-so-ntks.sql
