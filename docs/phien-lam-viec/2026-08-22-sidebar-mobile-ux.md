## 2026-08-22 — Sidebar mobile + tinh chỉnh góp vốn (0.4.4)

**Máy / ngữ cảnh:** Cursor — tiếp 0.4.3; App **0.4.4**.

### Đã chốt / đã làm

- **Sidebar mobile:** drawer auto-hide (`useAppSidebar`); nút ☰ trên header; đóng khi chọn menu / đổi trang / chạm nền.
- **Desktop:** ghim góc phải header sidebar; bỏ ghim → thu icon; nhớ `localStorage`.
- **Góp vốn UI:** nhãn căn trái, số tiền căn phải; cột **STT** (thay `#`).

### File chính

| Khu vực | File |
|---------|------|
| Sidebar | `useAppSidebar.js`, `AppLayout.js` |
| Nội bộ | `GopVonNoiBoSection.js` |

### Việc tiếp

- [ ] SQL **025**–**027** trên Supabase (nếu chưa).
- [ ] Form KS thật; RLS.

### Câu mở phiên sau

```text
Đọc HANDOFF (0.4.4). Sidebar mobile drawer + ghim desktop. SQL 025–027 nếu thiếu; tiếp form KS.
```
