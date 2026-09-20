# Hồ sơ khảo sát (port từ ksnpsc)

Form NVKS / PAKTKS / NKKS / BCKS / NTKS đã copy vào OUTSRC và gắn workspace (`?action=nvks|…`).

## Cần chạy trên Supabase

Trong `scripts/sql/` (đã copy từ ksnpsc), chạy theo thứ tự phù hợp môi trường:

- `create-ho-so-nvks*.sql` / các file `*ho-so-nvks*`
- `create-ho-so-paktks*` / `*ho-so-paktks*`
- `create-ho-so-nkks.sql` (+ alter nếu có)
- `create-ho-so-bcks.sql` (+ RLS nếu có)
- `create-ho-so-ntks.sql`
- DM công việc nếu form NVKS cần danh mục: file `*dm*cong*viec*`

Bucket storage (nếu xuất file): `exports_nvks` (và bucket PD nếu dùng).

## Template Word

Đã copy vào `public/templates/templates_{nvks,paktks,nkks,ntks,bcks}/`.

## Mở form

Workspace dự án → Khảo sát & nghiệm thu → **+ Lập** / **Xem**.

Deep link: `/du-an/{ma}?action=nvks` (tương tự `paktks`, `nkks`, `bcks`, `nghiem_thu`).

## Lưu ý

- Trình ký OTP / một số API phụ trợ ksnpsc có thể chưa đủ trên OUTSRC — form lập/lưu/xuất Word là trọng tâm.
- Convert PDF qua `/api/export-nvks-pdf` (LibreOffice/ConvertAPI) — cấu hình giống ksnpsc nếu dùng xuất PDF.
