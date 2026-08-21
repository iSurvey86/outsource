# Tổng quan OUTSRC

OUTSRC quản lý dự án ngoài (da đen) giữa **Bên A** (giao việc) và **Bên B** (làm việc) trên **cùng một app**.

## Đăng nhập & mật khẩu
1. Mở trang đăng nhập, nhập User và mật khẩu.
2. **Lần đầu đăng nhập** (hoặc sau khi Admin đặt lại mật khẩu): hệ thống bắt buộc vào **Tài khoản** để đặt mật khẩu mới (≥ 6 ký tự), rồi đăng nhập lại.
3. Đổi mật khẩu sau này: sidebar → **Đổi mật khẩu**.
4. Góc dưới sidebar: tài khoản và **Đăng xuất**.

Nếu báo lỗi kết nối: liên hệ quản trị viên (không tự xử lý cấu hình kỹ thuật).

## Vai trò (tóm tắt)
| Vai trò | Được làm |
|---------|----------|
| **Admin (B)** | Toàn quyền: QLHT, tạo/sửa/xóa DA, sổ HĐ, sửa sổ A↔B, nội bộ, KS, hồ sơ |
| **PM (B)** | Lập/XB KS, upload hồ sơ, xem A↔B, có nội bộ — **không** tạo/sửa/xóa DA, **không** sửa sổ A↔B |
| **Member (B)** | Giống PM; **không** tài chính nội bộ |
| **Bên A** | Chỉ DA gắn tài khoản mình (có thể nhiều người / nhóm trên một DA); xem TT + HĐ + hồ sơ + A↔B; ẩn KS; không sửa; không thấy cột gán Bên A |

Chi tiết: `docs/Phan_quyen_OUTSRC.md`.

## Menu chính
- **Dự án** — danh sách và workspace từng DA
- **Tài chính** — sổ chung A↔B
- **Tài chính nội bộ** — chỉ Admin/PM Bên B
- **Quản lý hệ thống** — tài khoản + nhật ký (admin)
