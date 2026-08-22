-- OUTSRC 023: đồng bộ seed user với DB thật
-- hienth (u-mem) = Bên A; xóa binhnv thừa (tạo nhầm từ seed cũ)

-- hienth → Bên A (giữ id u-mem như trên Supabase)
update nguoi_dung
set
  phe = 'ben_a',
  phan_quyen = 'ben_a_viewer',
  ho_ten = coalesce(nullif(trim(ho_ten), ''), 'Hiền TH')
where lower(username) = 'hienth';

-- chulm Bên A (seed demo)
insert into nguoi_dung (id, username, mat_khau, ho_ten, phe, phan_quyen, trang_thai, bat_doi_mk)
values ('u-a1', 'chulm', 'a123', 'Chu LM (Bên A)', 'ben_a', 'ben_a_viewer', 'active', 1)
on conflict (username) do update set
  phe = excluded.phe,
  phan_quyen = excluded.phan_quyen,
  ho_ten = excluded.ho_ten,
  trang_thai = excluded.trang_thai;

-- Gỡ tham chiếu trước khi xóa binhnv
update chia_noi_bo set nguoi_dung_id = 'u-pm' where nguoi_dung_id = 'u-binhnv';
update du_an set ben_a_user_id = null where ben_a_user_id = 'u-binhnv';
update du_an set phu_trach_id = null where phu_trach_id = 'u-binhnv';
update giao_dich set nguoi_tao_id = null where nguoi_tao_id = 'u-binhnv';
update tai_lieu set nguoi_up_id = null where nguoi_up_id = 'u-binhnv';

delete from nguoi_dung where lower(username) = 'binhnv';
