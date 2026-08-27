# Quản lý hệ thống

## Ai vào
User có `q_admin` hoặc `q_system_log` (thường admin Bên B).

## Chức năng MVP
- **Tài khoản:** danh sách user, phe A/B, role, bật/tắt quyền cơ bản.
- **Nhật ký:** LOGIN / thao tác chính (lưu `lich_su` / local); **Hide Admin** mặc định bật.

## Demo seed (`src/lib/seedUsers.js`)
| User | Phe | Role |
|------|-----|------|
| phuongdm | B | admin |
| tinhtv | B | pm |
| hienth | A | xem DA gắn mình (`u-mem`) |
| chulm | A | xem (demo DA) |
