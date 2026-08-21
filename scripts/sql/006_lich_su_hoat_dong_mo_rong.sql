-- Bổ sung cột nhật ký hoạt động (mẫu ksnpsc): email, trạng thái, dữ liệu JSON
alter table lich_su_hoat_dong
  add column if not exists email text;

alter table lich_su_hoat_dong
  add column if not exists trang_thai text default 'Thành công';

alter table lich_su_hoat_dong
  add column if not exists du_lieu_dong jsonb;

comment on column lich_su_hoat_dong.trang_thai is 'Thành công | Cảnh báo | Thất bại (hoặc tùy chỉnh)';
comment on column lich_su_hoat_dong.du_lieu_dong is 'Payload JSON bổ sung (xuất CSV, metadata…)';
