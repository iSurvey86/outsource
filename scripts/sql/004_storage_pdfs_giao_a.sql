-- Bucket PDF Giao A (public đọc; authenticated / anon upload tùy policy dự án)
insert into storage.buckets (id, name, public)
values ('pdfs_giao_a', 'pdfs_giao_a', true)
on conflict (id) do nothing;

-- Cho phép đọc công khai
drop policy if exists "pdfs_giao_a_public_read" on storage.objects;
create policy "pdfs_giao_a_public_read"
  on storage.objects for select
  using (bucket_id = 'pdfs_giao_a');

-- Cho phép upload/upsert (anon — khớp app dùng anon key; siết lại khi có auth Supabase)
drop policy if exists "pdfs_giao_a_anon_write" on storage.objects;
create policy "pdfs_giao_a_anon_write"
  on storage.objects for insert
  with check (bucket_id = 'pdfs_giao_a');

drop policy if exists "pdfs_giao_a_anon_update" on storage.objects;
create policy "pdfs_giao_a_anon_update"
  on storage.objects for update
  using (bucket_id = 'pdfs_giao_a');
