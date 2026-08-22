## 2026-08-22 — Tối ưu mobile toàn app (0.4.5)

**Máy / ngữ cảnh:** Cursor — tiếp 0.4.4; App **0.4.5**.

### Đã chốt / đã làm

- **Nhật ký hoạt động:** mobile = thẻ; desktop = bảng; `fitContainer` chỉ từ `md`; lọc full width.
- **QLHT tài khoản:** thẻ mobile; bảng cuộn ngang desktop.
- **Tài chính nội bộ:** góp vốn + bảng chia = thẻ mobile; thẻ tổng số căn phải.
- **Bảng rộng** (DA, A↔B, list nội bộ, sổ HĐ): cuộn ngang `-mx-3` / `MobileTableScroll`.
- **Hồ sơ KS/TK:** lưới thư mục 2 cột trên mobile.
- Hook `useMediaQuery`; component `MobileTableScroll`.

### File chính

| Khu vực | File |
|---------|------|
| Nhật ký | `NhatKyHoatDongPanel.js` |
| Layout | `useMediaQuery.js`, `MobileTableScroll.js` |
| Trang | `quan-ly-he-thong`, `du-an`, `tai-chinh*`, `GopVonNoiBoSection`, `HopDongSoLieuSection`, `HoSoKhoPanel` |

### Việc tiếp

- [ ] SQL **025**–**027** trên Supabase.
- [ ] Form KS thật; RLS.
- [ ] Tuỳ chọn: thẻ mobile cho danh mục DA / sổ A↔B.

### Câu mở phiên sau

```text
Đọc HANDOFF (0.4.5). Mobile cards + scroll bảng rộng. SQL 025–027 nếu thiếu; tiếp form KS.
```
