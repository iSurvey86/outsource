-- Quản lý thời hạn + nhân sự tham gia thực hiện hợp đồng.
-- Chạy một lần trong Supabase SQL Editor, sau create-hop-dong.sql.

-- 1) Thời hạn hợp đồng
ALTER TABLE public."HOP_DONG"
  ADD COLUMN IF NOT EXISTS "moc_bat_dau" text,
  ADD COLUMN IF NOT EXISTS "ngay_bat_dau" date,
  ADD COLUMN IF NOT EXISTS "ngay_het_han_du_kien" date,
  ADD COLUMN IF NOT EXISTS "canh_bao_truoc_ngay" integer DEFAULT 15,
  ADD COLUMN IF NOT EXISTS "nguon_trang_tien_do" integer;

-- create-hop-dong-thuc-hien.sql đã có cột này; giữ idempotent khi chạy độc lập.
ALTER TABLE public."HOP_DONG"
  ADD COLUMN IF NOT EXISTS "thoi_han_ngay" integer;

-- Đảm bảo DB đã chạy bản script cũ cũng được cập nhật mặc định mới.
ALTER TABLE public."HOP_DONG"
  ALTER COLUMN "canh_bao_truoc_ngay" SET DEFAULT 15;

-- Chuyển dữ liệu mặc định 30 ngày của bản cũ sang mặc định nghiệp vụ mới.
UPDATE public."HOP_DONG"
SET "canh_bao_truoc_ngay" = 15
WHERE "canh_bao_truoc_ngay" IS NULL
   OR "canh_bao_truoc_ngay" = 30;

ALTER TABLE public."HOP_DONG"
  DROP CONSTRAINT IF EXISTS "HOP_DONG_thoi_han_ngay_check",
  ADD CONSTRAINT "HOP_DONG_thoi_han_ngay_check"
    CHECK ("thoi_han_ngay" IS NULL OR "thoi_han_ngay" >= 0),
  DROP CONSTRAINT IF EXISTS "HOP_DONG_canh_bao_truoc_ngay_check",
  ADD CONSTRAINT "HOP_DONG_canh_bao_truoc_ngay_check"
    CHECK ("canh_bao_truoc_ngay" IS NULL OR "canh_bao_truoc_ngay" >= 0),
  DROP CONSTRAINT IF EXISTS "HOP_DONG_nguon_trang_tien_do_check",
  ADD CONSTRAINT "HOP_DONG_nguon_trang_tien_do_check"
    CHECK ("nguon_trang_tien_do" IS NULL OR "nguon_trang_tien_do" > 0);

COMMENT ON COLUMN public."HOP_DONG"."thoi_han_ngay"
  IS 'Tổng thời hạn thực hiện hợp đồng (ngày), đọc từ điều khoản/bảng tiến độ';
COMMENT ON COLUMN public."HOP_DONG"."moc_bat_dau"
  IS 'Điều kiện/mốc bắt đầu tính thời hạn theo hợp đồng';
COMMENT ON COLUMN public."HOP_DONG"."ngay_bat_dau"
  IS 'Ngày bắt đầu thực tế đã được xác nhận';
COMMENT ON COLUMN public."HOP_DONG"."ngay_het_han_du_kien"
  IS 'Ngày hết hạn dự kiến dùng cho cảnh báo';
COMMENT ON COLUMN public."HOP_DONG"."canh_bao_truoc_ngay"
  IS 'Số ngày cảnh báo trước ngày hết hạn; mặc định 15';
COMMENT ON COLUMN public."HOP_DONG"."nguon_trang_tien_do"
  IS 'Số trang in chứa bảng tiến độ/thời hạn trong PDF hợp đồng';

CREATE INDEX IF NOT EXISTS "HOP_DONG_ngay_het_han_idx"
  ON public."HOP_DONG" ("ngay_het_han_du_kien")
  WHERE "ngay_het_han_du_kien" IS NOT NULL;

-- 2) Nhân sự tham gia thực hiện từng hợp đồng
CREATE TABLE IF NOT EXISTS public."HOP_DONG_NHAN_SU" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "hop_dong_id" uuid NOT NULL
    REFERENCES public."HOP_DONG"("id") ON DELETE CASCADE,
  "stt" integer,
  "ho_ten" text NOT NULL,
  "chuyen_mon" text,
  "chuc_danh" text,
  "nguon_trang" integer,
  "trang_thai" text NOT NULL DEFAULT 'dang_tham_gia',
  "ghi_chu" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "HOP_DONG_NHAN_SU_stt_check"
    CHECK ("stt" IS NULL OR "stt" > 0),
  CONSTRAINT "HOP_DONG_NHAN_SU_nguon_trang_check"
    CHECK ("nguon_trang" IS NULL OR "nguon_trang" > 0),
  CONSTRAINT "HOP_DONG_NHAN_SU_trang_thai_check"
    CHECK ("trang_thai" IN ('dang_tham_gia', 'ngung_tham_gia'))
);

CREATE INDEX IF NOT EXISTS "HOP_DONG_NHAN_SU_hop_dong_idx"
  ON public."HOP_DONG_NHAN_SU" ("hop_dong_id", "stt");

COMMENT ON TABLE public."HOP_DONG_NHAN_SU"
  IS 'Danh sách nhân sự cam kết/tham gia thực hiện theo từng hợp đồng';
COMMENT ON COLUMN public."HOP_DONG_NHAN_SU"."nguon_trang"
  IS 'Số trang in chứa bảng nhân sự trong PDF hợp đồng';

-- 3) RLS cùng quy ước hiện tại của sổ hợp đồng
ALTER TABLE public."HOP_DONG_NHAN_SU" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hop_dong_ns_select_anon" ON public."HOP_DONG_NHAN_SU";
DROP POLICY IF EXISTS "hop_dong_ns_insert_anon" ON public."HOP_DONG_NHAN_SU";
DROP POLICY IF EXISTS "hop_dong_ns_update_anon" ON public."HOP_DONG_NHAN_SU";
DROP POLICY IF EXISTS "hop_dong_ns_delete_anon" ON public."HOP_DONG_NHAN_SU";

CREATE POLICY "hop_dong_ns_select_anon"
  ON public."HOP_DONG_NHAN_SU"
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "hop_dong_ns_insert_anon"
  ON public."HOP_DONG_NHAN_SU"
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "hop_dong_ns_update_anon"
  ON public."HOP_DONG_NHAN_SU"
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "hop_dong_ns_delete_anon"
  ON public."HOP_DONG_NHAN_SU"
  FOR DELETE TO anon, authenticated USING (true);

-- 4) Thay toàn bộ danh sách trong một transaction, tránh xoá cũ rồi lưu mới bị dở.
CREATE OR REPLACE FUNCTION public.replace_hop_dong_nhan_su(
  p_hop_dong_id uuid,
  p_rows jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public."HOP_DONG_NHAN_SU"
  WHERE "hop_dong_id" = p_hop_dong_id;

  INSERT INTO public."HOP_DONG_NHAN_SU" (
    "hop_dong_id",
    "stt",
    "ho_ten",
    "chuyen_mon",
    "chuc_danh",
    "nguon_trang",
    "trang_thai",
    "ghi_chu"
  )
  SELECT
    p_hop_dong_id,
    NULLIF(item->>'stt', '')::integer,
    btrim(item->>'ho_ten'),
    NULLIF(btrim(item->>'chuyen_mon'), ''),
    NULLIF(btrim(item->>'chuc_danh'), ''),
    NULLIF(item->>'nguon_trang', '')::integer,
    COALESCE(NULLIF(item->>'trang_thai', ''), 'dang_tham_gia'),
    NULLIF(btrim(item->>'ghi_chu'), '')
  FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb)) AS item
  WHERE NULLIF(btrim(item->>'ho_ten'), '') IS NOT NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.replace_hop_dong_nhan_su(uuid, jsonb)
  TO anon, authenticated;
