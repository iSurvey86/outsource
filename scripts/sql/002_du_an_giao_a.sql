-- OUTSRC — mở rộng du_an kiểu ksnpsc (Giao A / HĐ / TMĐT / cấp điện áp)
-- Chạy trên Supabase nếu đã có schema 001.

alter table du_an add column if not exists cap_dien_ap text;
alter table du_an add column if not exists qd_giao_a text;
alter table du_an add column if not exists qd_giao_a_day_du text;
alter table du_an add column if not exists nam_giao_a text;
alter table du_an add column if not exists ngay_giao_a date;
alter table du_an add column if not exists hop_dong text;
alter table du_an add column if not exists hop_dong_day_du text;
alter table du_an add column if not exists link_pdf_giao_a_goc text;
alter table du_an add column if not exists tmdt numeric default 0;

-- Đồng bộ loai KS: nhat_ky → nkks
update ks_module set loai = 'nkks' where loai = 'nhat_ky';
