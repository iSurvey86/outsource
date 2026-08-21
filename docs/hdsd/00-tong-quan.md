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
| Danh mục DA, workspace | Có (theo gắn Bên A) | Có |
| Sổ hợp đồng | Xem / theo quyền sửa DA | Xem / sửa nếu có quyền |
| Hồ sơ khảo sát / thiết kế | Xem | Xem + upload + folder tùy chọn |
| Lập / xuất bản khảo sát | Không | Có (nếu được cấp quyền) |
| Tài chính A↔B (menu) | Có | Có |
| Tài chính nội bộ | Không | Có (nếu được cấp quyền) |
| Quản lý hệ thống | Theo quyền | Theo quyền |

## Menu chính
- **Dự án** — danh sách và workspace từng DA (login thường vào đây)
- **Tài chính** — sổ chung A↔B
- **Tài chính nội bộ** — chỉ Bên B
- **Quản lý hệ thống** — tài khoản + nhật ký (admin)
