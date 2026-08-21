-- OUTSRC — PDF Giao A gốc trên du_an
alter table du_an add column if not exists link_pdf_giao_a_goc text;

-- Bucket Storage (chạy trên Supabase Dashboard → Storage hoặc SQL):
-- insert into storage.buckets (id, name, public) values ('pdfs_giao_a', 'pdfs_giao_a', true)
--   on conflict (id) do nothing;
