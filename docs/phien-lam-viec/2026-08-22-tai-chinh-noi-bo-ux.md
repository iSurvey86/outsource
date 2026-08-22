## 2026-08-22 — Tài chính nội bộ + UX login/DA (0.4.3)

**Máy / ngữ cảnh:** Cursor — tiếp 0.4.2; App **0.4.3**.

### Đã chốt / đã làm

- **Login:** màn hình mới (`LoginScreen.js`), nền `public/login-bg.png`, card trắng giữa.
- **Danh mục DA:** tách **Tìm tên** và **Bộ lọc** thành 2 ô trên một hàng (lg+).
- **Header workspace:** Bên A chỉ tên, cách nhau `;` (bỏ username / nhãn thừa).
- **Hồ sơ:** hàng upload gọn; nút View bỏ đậm.
- **Tài chính nội bộ — góp vốn B↔B:** SQL `025`–`026`; nhập số → Ghi nhận → popup ngày + bill (giống A↔B); layout **2 cột** (góp vốn | chia %).
- **Quyền nội bộ:** chỉ **Admin + PM** vào menu; **PM chỉ xem** (Admin sửa); SQL `027`.
- **UI chia/góp:** ẩn user **Member** (`filterBenBNoiBoUi`); lịch sử góp vẫn hiện tên Member nếu có dữ liệu.
- Bỏ các dòng ghi chú «Bạn chỉ có quyền xem» / hướng dẫn flow góp vốn; thu cột Ghi chú bảng chia.

### File chính

| Khu vực | File |
|---------|------|
| Login | `LoginScreen.js`, `AppLayout.js`, `brand.js`, `globals.css`, `public/login-bg.png` |
| DA list | `du-an/page.js` |
| Bên A label | `benAUsers.js`, `DuAnWorkspaceHeader.js` |
| Nội bộ | `GopVonNoiBoSection.js`, `tai-chinh-noi-bo/*`, `finance.js`, `menuAccess.js`, `pdfGiaoAStorage.js`, `store.js` |
| SQL | `025`, `026`, `027`; cập nhật `001_schema`, `019` |
| Docs | `Phan_quyen_OUTSRC.md`, workflows `01_auth`, `03_tai_chinh`, HDSD `00`, `02` |

### Việc tiếp

- [ ] Chạy SQL **025**–**027** trên Supabase (nếu chưa).
- [ ] Form KS thật thay stub.
- [ ] Siết RLS Supabase.
- [ ] Sau này: mở Member góp quỹ (filter UI, không xóa user).

### Câu mở phiên sau

```text
Đọc HANDOFF (0.4.3). Góp vốn B↔B + bill, PM xem nội bộ, Member ẩn trên UI chia. Chạy SQL 025–027 nếu thiếu; tiếp form KS.
```
