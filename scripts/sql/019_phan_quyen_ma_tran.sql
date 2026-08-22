-- OUTSRC 019: siết phan_quyen theo ma trận docs/Phan_quyen_OUTSRC.md
-- PM/Member: không tạo/sửa/xóa metadata DA
-- Member: giống PM về KS; không tài chính nội bộ
-- PM: xem nội bộ; chỉ Admin sửa (q_sua_chia_noi_bo)
-- Admin: giữ toàn quyền

insert into phan_quyen (
  phan_quyen, q_admin, q_sua_du_an, q_xoa_du_an,
  q_lap_ks, q_xuat_ban, q_xem_tai_chinh_ab, q_chia_noi_bo, q_sua_chia_noi_bo, q_system_log
) values
  ('admin', 1, 1, 1, 1, 1, 1, 1, 1, 1),
  ('pm', 0, 0, 0, 1, 1, 1, 1, 0, 0),
  ('member', 0, 0, 0, 1, 1, 0, 0, 0, 0),
  ('ben_a_viewer', 0, 0, 0, 0, 0, 1, 0, 0, 0)
on conflict (phan_quyen) do update set
  q_admin = excluded.q_admin,
  q_sua_du_an = excluded.q_sua_du_an,
  q_xoa_du_an = excluded.q_xoa_du_an,
  q_lap_ks = excluded.q_lap_ks,
  q_xuat_ban = excluded.q_xuat_ban,
  q_xem_tai_chinh_ab = excluded.q_xem_tai_chinh_ab,
  q_chia_noi_bo = excluded.q_chia_noi_bo,
  q_sua_chia_noi_bo = excluded.q_sua_chia_noi_bo,
  q_system_log = excluded.q_system_log;
