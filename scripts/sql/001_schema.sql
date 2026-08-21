-- OUTSRC — schema + seed cho Supabase
-- Chạy toàn bộ trong SQL Editor (một lần).

-- ========== TABLES ==========
create table if not exists phan_quyen (
  phan_quyen text primary key,
  q_admin int default 0,
  q_sua_du_an int default 0,
  q_xoa_du_an int default 0,
  q_lap_ks int default 0,
  q_xuat_ban int default 0,
  q_chia_noi_bo int default 0,
  q_sua_chia_noi_bo int default 0,
  q_system_log int default 0
);

create table if not exists nguoi_dung (
  id text primary key,
  username text unique not null,
  mat_khau text not null,
  ho_ten text not null,
  phe text not null check (phe in ('ben_a', 'ben_b')),
  phan_quyen text references phan_quyen(phan_quyen),
  trang_thai text not null default 'active'
);

create table if not exists du_an (
  id text primary key,
  ma_du_an text unique not null,
  ten text not null,
  ben_a_user_id text references nguoi_dung(id),
  phu_trach_id text references nguoi_dung(id),
  chu_dau_tu text,
  quy_mo text,
  dia_diem text,
  giai_doan text,
  cap_dien_ap text,
  qd_giao_a text,
  qd_giao_a_day_du text,
  nam_giao_a text,
  ngay_giao_a date,
  hop_dong text,
  hop_dong_day_du text,
  link_pdf_giao_a_goc text,
  tmdt numeric default 0,
  trang_thai text default 'moi',
  nguon_gia_tri text check (nguon_gia_tri in ('hop_dong', 'padt_tam_tinh')),
  gia_tri_tu_van numeric default 0,
  gia_tri_padt numeric default 0,
  gia_tri_hop_dong numeric default 0,
  ghi_chu_tai_chinh text,
  tam_ung_lan1_khoa boolean default false,
  ty_le_ben_b numeric default 0.25,
  ty_le_tam_ung numeric default 0.30,
  mo_ta text,
  ngay_bat_dau date,
  ngay_ket_thuc_dk date,
  hoso_folders jsonb default '{"khao_sat":[],"thiet_ke":[]}'::jsonb,
  link_pdf_hop_dong text
);

create table if not exists moc_tien_do (
  id text primary key,
  du_an_id text references du_an(id) on delete cascade,
  ma text,
  ten text not null,
  thu_tu int default 1,
  trang_thai text default 'chua_lam',
  han date
);

create table if not exists ks_module (
  id text primary key,
  du_an_id text references du_an(id) on delete cascade,
  loai text not null,
  trang_thai text default 'chua_lam'
);

create table if not exists giao_dich (
  id text primary key,
  du_an_id text references du_an(id) on delete cascade,
  loai text check (loai in ('tam_ung', 'thanh_toan', 'chi_phi')),
  so_tien numeric not null,
  ngay date,
  noi_dung text,
  dot text,
  link_bill text,
  nguoi_tao_id text references nguoi_dung(id)
);

create table if not exists tai_lieu (
  id text primary key,
  du_an_id text references du_an(id) on delete cascade,
  loai_kho text check (loai_kho in ('khao_sat', 'thiet_ke')),
  nguon text check (nguon in ('xuat_ban', 'upload')),
  ten_file text not null,
  storage_path text,
  ghi_chu text,
  module_loai text,
  nguoi_up_id text references nguoi_dung(id),
  thoi_gian timestamptz default now()
);

create table if not exists chia_noi_bo (
  id text primary key,
  du_an_id text references du_an(id) on delete cascade,
  nguoi_dung_id text references nguoi_dung(id),
  ty_le numeric not null,
  ghi_chu text,
  unique (du_an_id, nguoi_dung_id)
);

create table if not exists lich_su_hoat_dong (
  id text primary key,
  username text,
  email text,
  ho_ten text,
  phan_he text,
  hanh_dong text,
  chi_tiet text,
  trang_thai text default 'Thành công',
  du_lieu_dong jsonb,
  thoi_gian timestamptz default now()
);

-- Auth kiểu ksnpsc (session client, không dùng Supabase Auth) → mở anon CRUD
alter table phan_quyen enable row level security;
alter table nguoi_dung enable row level security;
alter table du_an enable row level security;
alter table moc_tien_do enable row level security;
alter table ks_module enable row level security;
alter table giao_dich enable row level security;
alter table tai_lieu enable row level security;
alter table chia_noi_bo enable row level security;
alter table lich_su_hoat_dong enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'phan_quyen','nguoi_dung','du_an','moc_tien_do','ks_module',
    'giao_dich','tai_lieu','chia_noi_bo','lich_su_hoat_dong'
  ]
  loop
    execute format('drop policy if exists outsrc_all on %I', t);
    execute format(
      'create policy outsrc_all on %I for all using (true) with check (true)',
      t
    );
  end loop;
end $$;

-- ========== SEED ==========
insert into phan_quyen (phan_quyen, q_admin, q_sua_du_an, q_xoa_du_an, q_lap_ks, q_xuat_ban, q_chia_noi_bo, q_sua_chia_noi_bo, q_system_log) values
  ('admin', 1, 1, 1, 1, 1, 1, 1, 1),
  ('pm', 0, 1, 0, 1, 1, 1, 1, 0),
  ('member', 0, 0, 0, 1, 0, 1, 0, 0),
  ('ben_a_viewer', 0, 0, 0, 0, 0, 0, 0, 0)
on conflict (phan_quyen) do update set
  q_admin = excluded.q_admin,
  q_sua_du_an = excluded.q_sua_du_an,
  q_xoa_du_an = excluded.q_xoa_du_an,
  q_lap_ks = excluded.q_lap_ks,
  q_xuat_ban = excluded.q_xuat_ban,
  q_chia_noi_bo = excluded.q_chia_noi_bo,
  q_sua_chia_noi_bo = excluded.q_sua_chia_noi_bo,
  q_system_log = excluded.q_system_log;

insert into nguoi_dung (id, username, mat_khau, ho_ten, phe, phan_quyen, trang_thai) values
  ('u-admin', 'phuongdm', 'admin123', 'Phương DM', 'ben_b', 'admin', 'active'),
  ('u-pm', 'tinhtv', 'pm123', 'Tình TV', 'ben_b', 'pm', 'active'),
  ('u-mem', 'hienth', 'mem123', 'Hiền TH', 'ben_b', 'member', 'active'),
  ('u-a1', 'chulm', 'a123', 'Chu LM (Bên A)', 'ben_a', 'ben_a_viewer', 'active')
on conflict (id) do update set
  username = excluded.username,
  mat_khau = excluded.mat_khau,
  ho_ten = excluded.ho_ten,
  phe = excluded.phe,
  phan_quyen = excluded.phan_quyen,
  trang_thai = excluded.trang_thai;

insert into du_an (
  id, ma_du_an, ten, ben_a_user_id, phu_trach_id, chu_dau_tu, quy_mo, dia_diem, giai_doan,
  cap_dien_ap, qd_giao_a, qd_giao_a_day_du, nam_giao_a, ngay_giao_a, hop_dong, hop_dong_day_du, tmdt,
  trang_thai, nguon_gia_tri, gia_tri_tu_van, ty_le_ben_b, ty_le_tam_ung, mo_ta, ngay_bat_dau, ngay_ket_thuc_dk
) values (
  'da-1', 'QN-2026-BCNCKT-DEMO01',
  'Xây dựng đường dây 110kV từ TBA 110kV Vân Đồn 2 đến vị trí 63',
  'u-a1', 'u-pm',
  'Công ty Điện lực Quảng Ninh',
  'Xây mới ĐZ 110kV ~16,48 km; cáp ngầm 22kV đoạn đấu nối.',
  'Quảng Ninh', 'BCNCKT', '110kV',
  '1593/QĐ-EVNNPC', '1593/QĐ-EVNNPC ngày 19/8/2026', '2026', '2026-08-19',
  '', '', 103725000000,
  'dang_lam', 'padt_tam_tinh', 1000000000, 0.25, 0.30,
  'DA demo — tạm tính PAĐT', '2026-08-01', '2026-12-31'
) on conflict (id) do nothing;

insert into moc_tien_do (id, du_an_id, ma, ten, thu_tu, trang_thai, han) values
  ('m-1', 'da-1', 'trien_khai', 'Triển khai', 1, 'hoan_thanh', '2026-08-15'),
  ('m-2', 'da-1', 'giao_tuyen', 'Giao tuyến', 2, 'dang_lam', '2026-10-30')
on conflict (id) do nothing;

insert into ks_module (id, du_an_id, loai, trang_thai) values
  ('ks-1', 'da-1', 'nvks', 'dang_lam'),
  ('ks-2', 'da-1', 'paktks', 'chua_lam'),
  ('ks-3', 'da-1', 'nkks', 'chua_lam'),
  ('ks-4', 'da-1', 'bcks', 'chua_lam'),
  ('ks-5', 'da-1', 'nghiem_thu', 'chua_lam')
on conflict (id) do nothing;

insert into giao_dich (id, du_an_id, loai, so_tien, ngay, noi_dung, nguoi_tao_id) values
  ('gd-1', 'da-1', 'tam_ung', 75000000, '2026-08-10', 'Tạm ứng 30% phần B — triển khai', 'u-admin')
on conflict (id) do nothing;

insert into chia_noi_bo (id, du_an_id, nguoi_dung_id, ty_le, ghi_chu) values
  ('cn-1', 'da-1', 'u-pm', 0.40, 'Lead'),
  ('cn-2', 'da-1', 'u-mem', 0.35, ''),
  ('cn-3', 'da-1', 'u-admin', 0.25, 'Hỗ trợ')
on conflict (id) do nothing;

insert into tai_lieu (id, du_an_id, loai_kho, nguon, ten_file, ghi_chu, nguoi_up_id, thoi_gian) values
  ('tl-1', 'da-1', 'thiet_ke', 'upload', 'MB-tong-the.pdf', 'Upload mẫu', 'u-pm', '2026-08-12T08:00:00Z')
on conflict (id) do nothing;
