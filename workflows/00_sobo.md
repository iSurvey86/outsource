# OUTSRC — Bản đồ hệ thống (đã xác nhận)

## Vai trò
- **Bên A + Bên B** cùng đăng nhập app.
- Xem chung: DA, thông tin chung (CĐT, quy mô, Hợp đồng / sổ HĐ), hồ sơ KS/TK, tài chính A↔B (menu).
- **Chỉ B:** lập KS + xuất bản, folder hồ sơ tùy chọn, **Tài chính nội bộ**.
- **A trên thẻ KS:** ẩn khối KS; xem hồ sơ đã XB.

## Routes
| Path | Mô tả |
|------|--------|
| `/` | Dashboard (có thể ẩn — login → `/du-an`) |
| `/du-an`, `/du-an/[ma]` | Catalog + workspace (+ sổ HĐ overlay) |
| `/du-an/[ma]?action=hop_dong` | Mở sổ hợp đồng |
| `/tai-chinh` | Sổ A↔B (chung) |
| `/tai-chinh-noi-bo` | Chỉ B (`/chia-noi-bo` redirect) |
| `/quan-ly-he-thong` | Admin |
| `/login` | Đăng nhập |

## Data
- Có `NEXT_PUBLIC_SUPABASE_*` → Postgres (Supabase)
- Không env → `localStorage` (`outsrc_db_v1`)
- SQL: `001` … `018` (sổ HĐ bắt buộc `008`–`018`)
- Chi tiết DA: [02_du_an.md](./02_du_an.md) · HĐ: [05_hop_dong.md](./05_hop_dong.md)

## Style
Teal / blue / emerald. Không dùng xám/ghi trên UI.

## Workflow liên quan
| File | Nội dung |
|------|----------|
| [01_auth](./01_auth.md) | Đăng nhập, phiên, phân quyền |
| [02_du_an](./02_du_an.md) | Danh mục + workspace |
| [05_hop_dong](./05_hop_dong.md) | Sổ hợp đồng |
| [03_tai_chinh](./03_tai_chinh.md) | A↔B + nội bộ B |
| [04_quan_ly_he_thong](./04_quan_ly_he_thong.md) | User + nhật ký |
