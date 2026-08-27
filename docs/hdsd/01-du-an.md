# Dự án & workspace

## Danh mục dự án
Vào **Dự án** để xem danh sách.

- **Admin:** cột **Bên A** (ai được gắn xem DA); tạo/sửa/xóa; **Nhập dự án**.
- **Bên A:** chỉ thấy DA gắn tài khoản mình (có thể nhiều người cùng một DA); **không** thấy cột Bên A, không sửa/xóa.
- **Tìm & lọc:** ô **Tìm tên** (mã/tên) và khối **Bộ lọc** (giai đoạn, trạng thái, sắp xếp…) tách riêng trên một hàng (màn rộng).
- Sửa / nhập DA: **bắt buộc** chọn ≥1 tài khoản Bên A (dropdown tìm kiếm — tick nhiều người / nhóm).
- **Nhập dự án:** **Cấp điện áp chung** bắt buộc chọn (không mặc định): 220kV, 110kV, Trung áp (22kV-35kV), Hạ áp (0.4kV), Trung Hạ áp (0.4kV-35kV).

## Trong một dự án
1. **Thông tin chung (header)** — chủ đầu tư, địa điểm, hợp đồng, Giao A / quy mô, TMĐT, **Giá trị tư vấn**; tên Bên A đã gán (nếu có).
2. **Hợp đồng** — bấm số HĐ hoặc «Nhấn để mở sổ hợp đồng» để mở **Sổ hợp đồng**. Cần Supabase.
3. **Khảo sát** — Bên B: cập nhật / xuất bản các bước KS (stub). **Bên A:** thấy khối này ở chế độ **chỉ xem** (không lập mới / xuất bản).
4. **Hồ sơ khảo sát / thiết kế** — thư mục chuẩn + tùy chọn; View Lưới / Danh sách / Chi tiết.
   - Mở thư mục → **kéo thả** hoặc **chọn nhiều file** (pdf, doc, xls, dwg, zip, ảnh…).
   - Bấm **tên file** (gạch chân) để mở.
   - **Xóa** (nút thùng rác): Admin xóa mọi file upload; PM/Member chỉ xóa file **do mình** tải lên.
5. **Tài chính** — menu **Tài chính** (A↔B, trừ Member B) hoặc **Tài chính nội bộ** (Admin/PM B).
