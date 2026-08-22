-- Góp vốn / tạm ứng nội bộ B↔B (quỹ chung, chuyển cho 1 thành viên giữ)

create table if not exists gop_von_noi_bo (
  id text primary key,
  du_an_id text references du_an(id) on delete cascade,
  nguoi_gop_id text references nguoi_dung(id),
  nguoi_giu_id text references nguoi_dung(id),
  so_tien numeric not null default 0,
  ngay date,
  ghi_chu text,
  link_bill text,
  nguoi_tao_id text references nguoi_dung(id),
  created_at timestamptz default now()
);

create index if not exists idx_gop_von_noi_bo_da on gop_von_noi_bo(du_an_id);

comment on table gop_von_noi_bo is 'Góp vốn nội bộ B: thành viên góp tiền triển khai DA, chuyển cho thành viên khác giữ quỹ';

alter table gop_von_noi_bo enable row level security;

drop policy if exists outsrc_all on gop_von_noi_bo;
create policy outsrc_all on gop_von_noi_bo for all using (true) with check (true);
