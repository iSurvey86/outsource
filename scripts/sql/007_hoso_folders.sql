-- Folder hồ sơ tùy chọn trên dự án (json: { khao_sat: [{key,label}], thiet_ke: [...] })
alter table du_an
  add column if not exists hoso_folders jsonb default '{"khao_sat":[],"thiet_ke":[]}'::jsonb;

comment on column du_an.hoso_folders is
  'Folder hồ sơ tùy chọn theo kho khao_sat / thiet_ke (không gồm folder chuẩn NVKS…)';
