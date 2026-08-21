-- OUTSRC — tách cột GT tư vấn PADT / HĐ + ghi chú tài chính
alter table du_an add column if not exists gia_tri_padt numeric default 0;
alter table du_an add column if not exists gia_tri_hop_dong numeric default 0;
alter table du_an add column if not exists ghi_chu_tai_chinh text;
alter table du_an add column if not exists tam_ung_lan1_khoa boolean default false;

-- Backfill từ gia_tri_tu_van + nguon_gia_tri
update du_an
set gia_tri_hop_dong = coalesce(nullif(gia_tri_tu_van, 0), 0)
where nguon_gia_tri = 'hop_dong'
  and coalesce(gia_tri_hop_dong, 0) = 0;

update du_an
set gia_tri_padt = coalesce(nullif(gia_tri_tu_van, 0), 0)
where (nguon_gia_tri is null or nguon_gia_tri = 'padt_tam_tinh')
  and coalesce(gia_tri_padt, 0) = 0;

-- Đợt tạm ứng / thanh toán trên giao dịch (lan1 | lan2 | lan3 | thanh_toan)
alter table giao_dich add column if not exists dot text;
alter table giao_dich add column if not exists link_bill text;
