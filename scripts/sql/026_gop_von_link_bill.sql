-- Bill chuyển khoản góp vốn nội bộ (nếu đã chạy 025 trước khi có cột này)

alter table gop_von_noi_bo add column if not exists link_bill text;

comment on column gop_von_noi_bo.link_bill is 'Bill chuyển khoản nội bộ (PDF/ảnh)';
