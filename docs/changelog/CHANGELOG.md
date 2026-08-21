# Changelog OUTSRC

## 0.3.0 — 2026-08-21

**Hồ sơ folder tùy chọn + Sổ hợp đồng**

### Mới
- Sổ hợp đồng trên workspace (HĐ chính, phụ lục, thầu phụ, ký lại; quét AI; số liệu)
- Thư mục hồ sơ tùy chọn trên khảo sát / thiết kế (thêm, đổi tên, xóa)
- Hướng dẫn Sổ hợp đồng trong tài liệu người dùng

### Cải thiện
- Workspace gọn hơn: bỏ khối tài chính trên trang DA (dùng menu Tài chính)
- Hiển thị Giá trị tư vấn rõ hơn trên header; màu hồ sơ KS / TK phân biệt

### Sửa lỗi
- Script SQL sổ hợp đồng dùng bảng du_an (không còn DANH_MUC_DA của hệ thống cũ)

## 0.2.0 — 2026-08-20

**MVP dùng chung Bên A & Bên B + kết nối Supabase / Vercel**

### Mới
- Đăng nhập theo phe A/B; dashboard, danh mục và workspace dự án
- Hồ sơ khảo sát / thiết kế dùng chung; tài chính A↔B theo 25% / 30% / giao tuyến
- Tài chính nội bộ chỉ Bên B; quản lý hệ thống (tài khoản + nhật ký)
- Kết nối Supabase (có env) hoặc localStorage (dev); seed SQL và tài khoản demo

### Cải thiện
- Thương hiệu HỆ THỐNG / OUTSRC; giao diện teal–blue–emerald; khối tài khoản trên sidebar

### Sửa lỗi
- Chuẩn hóa API key khi copy nhầm; thông báo rõ khi khóa Supabase không hợp lệ
