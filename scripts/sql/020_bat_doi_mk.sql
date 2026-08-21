-- OUTSRC 020: bắt đổi mật khẩu lần đầu / sau khi admin đặt lại MK
alter table nguoi_dung
  add column if not exists bat_doi_mk int not null default 1;

-- User hiện có: bắt đổi khi đăng nhập lần sau (sau khi deploy tính năng)
update nguoi_dung set bat_doi_mk = 1 where bat_doi_mk is distinct from 0;
