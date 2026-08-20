# OUTSRC — Bản đồ hệ thống (đã xác nhận)

## Vai trò
- **Bên A + Bên B** cùng đăng nhập app.
- Xem chung: DA, thông tin chung (CĐT, quy mô…), tiến độ, tài chính A↔B, hồ sơ KS/TK.
- **Chỉ B:** lập KS + xuất bản, **Tài chính nội bộ**.
- **A trên thẻ KS:** chỉ status; nội dung XB xem ở Hồ sơ khảo sát.

## Tiền
- Phần B = 25% × GT tư vấn (HĐ hoặc PAĐT tạm tính)
- Tạm ứng = 30% × phần B lúc triển khai
- TT nốt khi giao tuyến
- **Không** xuất hóa đơn từ app

## Routes
| Path | Mô tả |
|------|--------|
| `/` | Dashboard |
| `/du-an`, `/du-an/[ma]` | Catalog + workspace |
| `/tai-chinh` | Sổ A↔B (chung) |
| `/tai-chinh-noi-bo` | Chỉ B (`/chia-noi-bo` redirect) |
| `/quan-ly-he-thong` | Admin |
| `/login` | Đăng nhập |

Bên A = tài khoản user (`phe=ben_a`), không còn menu danh mục riêng.

## Data
- Có `NEXT_PUBLIC_SUPABASE_*` → Postgres (Supabase)
- Không env → `localStorage` (`outsrc_db_v1`)
- SQL: [`scripts/sql/001_schema.sql`](../scripts/sql/001_schema.sql)

## Style
Teal / blue / emerald. Không dùng xám/ghi trên UI.

## Workflow liên quan
| File | Nội dung |
|------|----------|
| [01_auth](./01_auth.md) | Đăng nhập, phiên, phân quyền |
| [02_du_an](./02_du_an.md) | Danh mục + workspace |
| [03_tai_chinh](./03_tai_chinh.md) | A↔B + nội bộ B |
| [04_quan_ly_he_thong](./04_quan_ly_he_thong.md) | User + nhật ký |
