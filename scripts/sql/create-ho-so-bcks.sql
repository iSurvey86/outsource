-- Module BCKS: Báo cáo khảo sát (hub Địa chất + BCKS)
-- Chạy một lần trong Supabase SQL Editor.
-- Tiền đề: HO_SO_NVKS đã tồn tại.

CREATE TABLE IF NOT EXISTS "HO_SO_BCKS" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  "ma_du_an" text NOT NULL,
  "nvks_id" uuid NOT NULL REFERENCES "HO_SO_NVKS"("id") ON DELETE RESTRICT,
  "paktks_id" uuid REFERENCES "HO_SO_PAKTKS"("id") ON DELETE SET NULL,

  -- Header kế thừa DA / NVKS
  "ten_du_an" text,
  "dia_diem" text,
  "giai_doan" text,
  "chu_dau_tu" text,

  -- Hub: dia_chat (co_ly_dat | tn_nuoc | tn_da | do_dts) + bcks
  "chi_tiet_bcks" jsonb NOT NULL DEFAULT '{}'::jsonb,

  "trang_thai_bcks" text NOT NULL DEFAULT 'dang_lap',
  -- dang_lap | da_chot

  "link_docx_xuat" text,
  "exported_at" timestamptz,

  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "HO_SO_BCKS_ma_du_an_unique"
  ON "HO_SO_BCKS" ("ma_du_an");

CREATE INDEX IF NOT EXISTS "HO_SO_BCKS_nvks_id_idx"
  ON "HO_SO_BCKS" ("nvks_id");

COMMENT ON TABLE "HO_SO_BCKS" IS 'Báo cáo khảo sát — hub Địa chất + BCKS (chi_tiet_bcks jsonb)';
COMMENT ON COLUMN "HO_SO_BCKS"."chi_tiet_bcks" IS 'JSON: dia_chat.{co_ly_dat,tn_nuoc,co_ly_dat_2,tn_da,do_dts} + bcks';

-- Sau khi tạo bảng: scripts/sql/rls-ho-so-bcks.sql
