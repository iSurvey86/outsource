-- OUTSRC 022: Member không xem sổ tài chính A↔B
-- Admin/PM/Bên A: được xem; Member: không.

alter table phan_quyen
  add column if not exists q_xem_tai_chinh_ab int not null default 0;

update phan_quyen
set q_xem_tai_chinh_ab = 1
where phan_quyen in ('admin', 'pm', 'ben_a_viewer');

update phan_quyen
set q_xem_tai_chinh_ab = 0
where phan_quyen = 'member';

insert into phan_quyen (
  phan_quyen, q_admin, q_sua_du_an, q_xoa_du_an,
  q_lap_ks, q_xuat_ban, q_xem_tai_chinh_ab, q_chia_noi_bo, q_sua_chia_noi_bo, q_system_log
) values
  ('admin', 1, 1, 1, 1, 1, 1, 1, 1, 1),
  ('pm', 0, 0, 0, 1, 1, 1, 1, 1, 0),
  ('member', 0, 0, 0, 1, 1, 0, 0, 0, 0),
  ('ben_a_viewer', 0, 0, 0, 0, 0, 1, 0, 0, 0)
on conflict (phan_quyen) do update set
  q_xem_tai_chinh_ab = excluded.q_xem_tai_chinh_ab;
