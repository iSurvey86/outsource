-- Hợp đồng: bản đầy đủ + link PDF trên du_an (OUTSRC — không dùng DANH_MUC_DA)
-- Chạy một lần trong Supabase SQL Editor (idempotent)
ALTER TABLE du_an ADD COLUMN IF NOT EXISTS hop_dong text;
ALTER TABLE du_an ADD COLUMN IF NOT EXISTS hop_dong_day_du text;
ALTER TABLE du_an ADD COLUMN IF NOT EXISTS link_pdf_hop_dong text;

COMMENT ON COLUMN du_an.hop_dong IS 'Hợp đồng viết tắt — vd: 308/2020/HĐTV… ngày 07/12/2020';
COMMENT ON COLUMN du_an.hop_dong_day_du IS 'Hợp đồng đầy đủ — số, ngày, bên A/B hoặc gói thầu';
COMMENT ON COLUMN du_an.link_pdf_hop_dong IS 'URL PDF hợp đồng gốc (Storage)';
