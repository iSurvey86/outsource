# 2026-09-20 — Supabase KS sẵn sàng + tiêu đề TC nội bộ (0.5.2)

**Máy / ngữ cảnh:** Cursor — sau 0.5.1; App **0.5.2**.

### Đã chốt / đã làm

- **Supabase outsource — schema KS:** `create-ho-so-nvks` + RLS; `create-dm-cong-viec`; `028` alters; buckets `029` + `024`; `030`/`031` cột DM.
- **Seed `DM_CONG_VIEC`:** sync API ksnpsc → outsource (103 dòng).
- **UX:** Tài chính nội bộ — tiêu đề cột căn giữa.
- **Docs:** `ks-port-README`, workflow `02_du_an`, HDSD `01-du-an`.

### Việc tiếp

- [ ] QA Lập / Lưu / Xuất Word từng module KS.
- [ ] Trình ký OTP nếu cần.
- [ ] SQL **025**–**027** nếu chưa chạy.

### Câu mở phiên sau

```text
Đọc HANDOFF (0.5.2). Supabase KS đã sẵn. Tiếp: QA + Lập NVKS trên workspace.
```
