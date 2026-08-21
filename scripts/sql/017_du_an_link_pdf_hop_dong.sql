-- PDF hợp đồng trên cache dự án (đồng bộ từ sổ HOP_DONG)
alter table du_an
  add column if not exists link_pdf_hop_dong text;

comment on column du_an.link_pdf_hop_dong is
  'Link PDF HĐ CĐT hiệu lực — cache từ sổ hợp đồng';
