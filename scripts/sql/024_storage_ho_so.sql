-- Bucket hồ sơ KS|TK (upload workspace)
insert into storage.buckets (id, name, public)
values ('ho_so', 'ho_so', true)
on conflict (id) do nothing;

drop policy if exists "ho_so_public_read" on storage.objects;
create policy "ho_so_public_read"
  on storage.objects for select
  using (bucket_id = 'ho_so');

drop policy if exists "ho_so_anon_write" on storage.objects;
create policy "ho_so_anon_write"
  on storage.objects for insert
  with check (bucket_id = 'ho_so');

drop policy if exists "ho_so_anon_update" on storage.objects;
create policy "ho_so_anon_update"
  on storage.objects for update
  using (bucket_id = 'ho_so');

drop policy if exists "ho_so_anon_delete" on storage.objects;
create policy "ho_so_anon_delete"
  on storage.objects for delete
  using (bucket_id = 'ho_so');
