# Changelog OUTSRC

## 0.4.1 — 2026-08-21

**Ma trận Member + slogan**

### Cải thiện
- Quyền login/xem quyền lấy từ ma trận code (Member = PM − nội bộ); đồng bộ `phan_quyen` trên Supabase
- Slogan: Hệ thống quản lý công việc, tiến độ dự án

### Sửa lỗi
- Member mới nhận đúng quyền — không phụ thuộc bản `phan_quyen` cũ trên DB

## 0.4.0 — 2026-08-21

**Tài chính gọn + nội bộ 2 tầng + gán nhóm Bên A**

### Mới
- Gán nhiều tài khoản Bên A trên một DA (nhóm); SQL `021_ben_a_user_ids.sql`
- Tài chính nội bộ: list DA → chi tiết; chia 1 lần trên tổng đã nhận từ A (% hoặc số cứng)
- Đổi mật khẩu / bắt đổi lần đầu; ma trận phân quyền enforce trên UI

### Cải thiện
- Nhận tạm ứng A↔B: ngoài nhập số → trong chỉ ngày + bill; số tiền gắn link bill
- Ngày hiển thị dd/mm/yyyy; ẩn cột Bên A với viewer A; đồng bộ khi «Xem quyền»

### Sửa lỗi
- Xem quyền Bên A không còn giữ filter Admin (không lộ DA chưa gán)

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
- Chuẩn hóa khóa API khi copy nhầm; thông báo rõ khi khóa Supabase không hợp lệ
