# Hồ sơ khảo sát (port từ ksnpsc)

Form NVKS / PAKTKS / NKKS / BCKS / NTKS đã copy vào OUTSRC và gắn workspace (`?action=nvks|…`).

## Cần chạy trên Supabase (project **outsource**)

`TAI_LIEU_HO_SO` / `tai_lieu` **không** phải bảng form KS. Form cần các bảng tên `HO_SO_*`.

Trong `scripts/sql/`, chạy **theo thứ tự** (SQL Editor):

1. `create-ho-so-nvks.sql` + `rls-ho-so-nvks.sql`
2. `create-dm-cong-viec.sql` → rồi seed từ ksnpsc (API sync hoặc CSV) + `030_dm_cong_viec_ksnpsc_cols.sql` + `031_dm_cong_viec_tt_text.sql` (nếu `tt` còn integer)
3. `create-ho-so-paktks.sql` + `rls-ho-so-paktks.sql`
4. `create-ho-so-nkks.sql` + `rls-ho-so-nkks.sql`
5. `create-ho-so-bcks.sql` + `rls-ho-so-bcks.sql`
6. `create-ho-so-ntks.sql` + `rls-ho-so-ntks.sql`
7. `028_ks_ho_so_alters_con_thieu.sql` (phiên bản PAKTKS / link xuất / nhân lực NKKS)
8. `029_storage_exports_nvks.sql` (`exports_nvks`, `pdfs_phe_duyet_nvks`)
9. `024_storage_ho_so.sql` (bucket folder workspace)
10. (tuỳ chọn) `create-ho-so-moc-toa-do.sql`; trình ký OTP: `create-trinh-ky.sql` từ ksnpsc

**Trạng thái project outsource (2026-09-20):** bước 1–9 đã chạy; `DM_CONG_VIEC` ~103 dòng đồng bộ từ ksnpsc.

## Template Word

Đã copy vào `public/templates/templates_{nvks,paktks,nkks,ntks,bcks}/`.

## Mở form

Workspace dự án → Khảo sát & nghiệm thu → **+ Lập** / **Xem**.

Deep link: `/du-an/{ma}?action=nvks` (tương tự `paktks`, `nkks`, `bcks`, `nghiem_thu`).

## Lưu ý

- Khi port thêm từ ksnpsc: copy đủ **lib phụ** (`doDts*`, `qcvnCatalogLookup` + `src/data/bang*.json`), `components/table/ResizableTableFrame`, deps `recharts` / `libreoffice-convert` — thiếu sẽ fail `next build` trên Vercel.
- Trình ký OTP / một số API phụ trợ ksnpsc có thể chưa đủ trên OUTSRC — form lập/lưu/xuất Word là trọng tâm.
- Convert PDF qua `/api/export-nvks-pdf` (LibreOffice/ConvertAPI) — cấu hình giống ksnpsc nếu dùng xuất PDF.
- Xuất Word: app **tự upload** vào bucket đã tạo sẵn (`exports_nvks`); không tự tạo bucket.
