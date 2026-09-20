-- Bucket xuất Word/PDF form KS (NVKS / PAKTKS / NKKS / BCKS / NT)
-- Chạy trên Supabase SQL Editor (project outsource).
-- App upload tự động khi xuất — chỉ cần tạo bucket + policy một lần.

insert into storage.buckets (id, name, public)
values ('exports_nvks', 'exports_nvks', true)
on conflict (id) do nothing;

drop policy if exists "exports_nvks_public_read" on storage.objects;
create policy "exports_nvks_public_read"
  on storage.objects for select
  using (bucket_id = 'exports_nvks');

drop policy if exists "exports_nvks_anon_write" on storage.objects;
create policy "exports_nvks_anon_write"
  on storage.objects for insert
  with check (bucket_id = 'exports_nvks');

drop policy if exists "exports_nvks_anon_update" on storage.objects;
create policy "exports_nvks_anon_update"
  on storage.objects for update
  using (bucket_id = 'exports_nvks');

drop policy if exists "exports_nvks_anon_delete" on storage.objects;
create policy "exports_nvks_anon_delete"
  on storage.objects for delete
  using (bucket_id = 'exports_nvks');

-- Tuỳ chọn: PDF QĐ phê duyệt NVKS (FormNVKS upload tay)
insert into storage.buckets (id, name, public)
values ('pdfs_phe_duyet_nvks', 'pdfs_phe_duyet_nvks', true)
on conflict (id) do nothing;

drop policy if exists "pdfs_pd_nvks_public_read" on storage.objects;
create policy "pdfs_pd_nvks_public_read"
  on storage.objects for select
  using (bucket_id = 'pdfs_phe_duyet_nvks');

drop policy if exists "pdfs_pd_nvks_anon_write" on storage.objects;
create policy "pdfs_pd_nvks_anon_write"
  on storage.objects for insert
  with check (bucket_id = 'pdfs_phe_duyet_nvks');

drop policy if exists "pdfs_pd_nvks_anon_update" on storage.objects;
create policy "pdfs_pd_nvks_anon_update"
  on storage.objects for update
  using (bucket_id = 'pdfs_phe_duyet_nvks');

drop policy if exists "pdfs_pd_nvks_anon_delete" on storage.objects;
create policy "pdfs_pd_nvks_anon_delete"
  on storage.objects for delete
  using (bucket_id = 'pdfs_phe_duyet_nvks');
