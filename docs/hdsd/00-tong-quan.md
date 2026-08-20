# Tổng quan OUTSRC

OUTSRC quản lý dự án ngoài (da đen) giữa **Bên A** (giao việc) và **Bên B** (làm việc) trên **cùng một app**.

## Đăng nhập
1. Mở trang đăng nhập, nhập User và mật khẩu.
2. Sau khi vào: menu bên trái theo quyền; góc dưới sidebar có tài khoản và **Đăng xuất**.
3. Phiên bản hiện tại hiện dưới form đăng nhập.

Nếu báo lỗi API key: quản trị viên cần cấu hình lại khóa Supabase (anon public) trên máy/local hoặc Vercel.

## Ai thấy gì
| Nội dung | Bên A | Bên B |
|----------|-------|-------|
| Dashboard, danh mục DA, workspace | Có | Có |
| Tài chính A↔B | Có | Có |
| Hồ sơ khảo sát / thiết kế | Có | Có |
| Lập / xuất bản khảo sát | Không (chỉ xem status) | Có (nếu được cấp quyền) |
| Tài chính nội bộ | Không | Có (nếu được cấp quyền) |
| Quản lý hệ thống | Theo quyền | Theo quyền |

## Menu chính
- **Tổng quan** — dashboard
- **Dự án** — danh sách và workspace từng DA
- **Tài chính** — sổ chung A↔B
- **Tài chính nội bộ** — chỉ Bên B
- **Quản lý hệ thống** — tài khoản + nhật ký (admin)
