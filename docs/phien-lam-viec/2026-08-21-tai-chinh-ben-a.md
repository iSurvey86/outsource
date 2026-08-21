## 2026-08-21 — Tài chính gọn + nội bộ 2 tầng + gán nhóm Bên A

**Máy / ngữ cảnh:** Cursor — OUTSRC; tiếp phiên sau folder hồ sơ + sổ HĐ; App **0.4.0**.

### Đã chốt / đã làm

- **Sổ A↔B:** nhận TU gọn — ngoài nhập số → popup chỉ **ngày + bill**; số khóa gắn link bill; sửa qua ngày; bỏ AI scan bill trên UX; nhãn Gtv / (25%Gtv).
- **Ngày VN:** `formatNgayVi` dd/mm/yyyy trên UI.
- **Tài chính nội bộ:** list DA → `/tai-chinh-noi-bo/[ma]`; chia **1 lần** trên tổng nhận từ A (% hoặc số cứng). Chưa: ứng nội bộ B↔B.
- **Gán Bên A:** `ben_a_user_ids` (nhiều người/nhóm); SQL `021`; nhập/sửa DA bắt buộc ≥1; cột Bên A chỉ Admin; filter A theo mảng; sync «Xem quyền».
- Phân quyền / đổi MK (019–020), nhật ký phân hệ IN HOA.

### File chính

| Khu vực | File |
|---------|------|
| A↔B / ngày | `tai-chinh/page.js`, `finance.js`, `formatNgay.js` |
| Nội bộ | `tai-chinh-noi-bo/page.js`, `[ma]/page.js`, `workflows/03_tai_chinh.md` |
| Bên A | `benAUsers.js`, `BenAUserSelect.js`, `menuAccess.js`, `021_ben_a_user_ids.sql` |
| HDSD / changelog | `docs/hdsd/*`, `hdsdMeta.js`, `appChangelog.js` |
| Chi tiết | [2026-08-21-tai-chinh-ben-a.md](./2026-08-21-tai-chinh-ben-a.md) |

### Việc tiếp

- [ ] Chạy SQL **019**, **020**, **021** trên Supabase (nếu chưa).
- [ ] Form KS thật thay stub.
- [ ] Ứng nội bộ B↔B; Storage binary hồ sơ / PDF HĐ.
- [ ] Siết RLS Supabase.

### Câu mở phiên sau

```text
Đọc docs/phien-lam-viec/HANDOFF.md (block 2026-08-21 tài chính/Bên A). App 0.4.0. Tiếp: chạy SQL 019–021 nếu thiếu; form KS; ứng nội bộ B.
```
