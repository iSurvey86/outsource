## 2026-08-22 — Upload hồ sơ + siết quyền Member / xóa file

**Máy / ngữ cảnh:** Cursor — tiếp 0.4.1; App **0.4.2**.

### Đã chốt / đã làm

- **Member B** không xem menu / sổ **Tài chính A↔B** (`q_xem_tai_chinh_ab`; SQL `022`).
- **Seed user** gom `src/lib/seedUsers.js`: `hienth` = Bên A (`u-mem`); bỏ `binhnv` thừa (SQL `023`).
- **Upload hồ sơ KS|TK:** bucket `ho_so` (SQL `024`); kéo-thả / nhiều file; mở file từ danh sách; local = IndexedDB.
- **Xóa file upload:** Admin mọi file; PM/Member **chỉ file mình up** (`canXoaHoSoFile`); không xóa xuất bản.

### File chính

| Khu vực | File |
|---------|------|
| Upload | `hoSoStorage.js`, `HoSoKhoPanel.js`, `DuAnWorkspaceClient.js` |
| Quyền | `menuAccess.js`, `seedUsers.js` |
| SQL | `022`–`024` |

### Việc tiếp

- [ ] Chạy SQL **022**, **023**, **024** trên Supabase (nếu chưa).
- [ ] Form KS thật; ứng nội bộ B; RLS.

### Câu mở phiên sau

```text
Đọc HANDOFF block 0.4.2. Upload hồ sơ + quyền Member/xóa file. Tiếp: form KS; SQL 022–024 nếu thiếu.
```
