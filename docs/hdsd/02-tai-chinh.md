# Tài chính

## Sổ A↔B
Menu **Tài chính** (ẩn với **Member Bên B**; Admin, PM và Bên A vẫn xem được):

| Cột | Ý nghĩa |
|-----|---------|
| TMĐT | Tổng mức đầu tư |
| PAĐT / Hợp đồng | **Giá trị Tư vấn (Gtv)** — PAĐT tạm tính; HĐ ưu tiên khi đã có |
| Tổng phần B | **(25%Gtv)** |
| Tạm ứng lần 1…3 / Thanh toán | Nhập số → **Nhận** → popup **ngày + bill** (không nhập lại số; không quét AI) |
| Ghi chú | Ghi chú tài chính công trình |

**Luồng nhận tiền**
1. Nhập số tiền trên ô → bấm **Nhận** → chọn **ngày nhận** + đính kèm bill → lưu (khóa).
2. Sau khi khóa: số tiền có **link bill** (bấm mở xem); bấm **ngày** để sửa số / ngày / bill.
3. Có thể nhận L1 trước khi có GTV; sau điền PAĐT/HĐ, phần B = 25% Gtv, các đợt **cấn trừ dần**.
4. Có GTV: ô L1 gợi ý 30% phần B (vẫn sửa trước khi Nhận).

Ngày tháng trên màn hình: **dd/mm/yyyy**. Ứng dụng **không** xuất hóa đơn.

## Tài chính nội bộ
Menu **Tài chính nội bộ** (chỉ **Admin + PM** Bên B; Member không vào):

1. **Danh sách dự án** — đã nhận từ A, góp nội bộ, trạng thái chia.
2. Bấm vào DA → trang **2 cột**:
   - **Trái — Góp vốn B↔B:** chọn người góp / người giữ quỹ → nhập số → **Ghi nhận** → popup **ngày + bill** (giống sổ A↔B). Số tiền link bill; bấm ngày để sửa (Admin). Bảng cột **STT**; thẻ tổng: nhãn trái, số phải.
   - **Phải — Chia trên tiền nhận từ A:** một lần trên **tổng đã nhận** (đọc sổ A↔B): **tỷ lệ %** hoặc **số cứng**; bảng chỉ hiện Admin + PM (Member ẩn trên UI — PM đại diện nhóm).
3. **Admin** sửa góp vốn và lưu bảng chia; **PM chỉ xem** (không form nhập, không nút Lưu).

Chạy SQL `025`–`027` trên Supabase trước khi dùng góp vốn + bill. Bên A không thấy mục này.
