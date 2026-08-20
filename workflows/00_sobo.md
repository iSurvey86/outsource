# OUTSRC — Bản đồ hệ thống (đã xác nhận)

## Vai trò
- **Bên A + Bên B** cùng đăng nhập app.
- Xem chung: DA, thông tin chung (CĐT, quy mô…), tiến độ, tài chính A↔B, hồ sơ KS/TK.
- **Chỉ B:** lập KS + xuất bản, tài chính nội bộ.
- **A trên thẻ KS:** chỉ status; nội dung XB xem ở Hồ sơ khảo sát.

## Tiền
- Phần B = 25% × GT tư vấn (HĐ hoặc PAĐT tạm tính)
- Tạm ứng = 30% × phần B lúc triển khai
- TT nốt khi giao tuyến

## Routes
| Path | Mô tả |
|------|--------|
| `/` | Dashboard |
| `/du-an`, `/du-an/[ma]` | Catalog + workspace |
| `/tai-chinh` | Sổ A↔B |
| `/tai-chinh-noi-bo` | Chỉ B |
| `/quan-ly-he-thong` | Admin |

Bên A = tài khoản user (`phe=ben_a`), không còn menu danh mục riêng.

## Data
Hiện MVP dùng **localStorage** (`outsrc_db_v1`). SQL sẵn tại `scripts/sql/001_schema.sql` khi gắn Supabase.
