-- Nhiều tài khoản Bên A trên một DA
-- Chạy trên Supabase sau 020.

alter table du_an
  add column if not exists ben_a_user_ids jsonb not null default '[]'::jsonb;

-- Migrate từ cột cũ (1 người)
update du_an
set ben_a_user_ids = jsonb_build_array(ben_a_user_id)
where ben_a_user_id is not null
  and ben_a_user_id <> ''
  and (
    ben_a_user_ids is null
    or ben_a_user_ids = '[]'::jsonb
    or jsonb_typeof(ben_a_user_ids) <> 'array'
    or jsonb_array_length(ben_a_user_ids) = 0
  );

comment on column du_an.ben_a_user_ids is 'Mảng nguoi_dung.id (phe=ben_a); nhiều người / nhóm cùng xem DA';
comment on column du_an.ben_a_user_id is 'Legacy: người A đầu tiên (đồng bộ = ben_a_user_ids[0])';
