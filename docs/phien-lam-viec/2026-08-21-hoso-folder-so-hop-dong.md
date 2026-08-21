# 2026-08-21 — Hồ sơ folder tùy chọn + Sổ hợp đồng (port ksnpsc)

**Máy / ngữ cảnh:** Cursor — tiếp phiên OUTSRC sau MVP; UI workspace + port sổ HĐ.

### Đã chốt / đã làm

- **Hồ sơ workspace:** 2 cột KS | TK; folder chuẩn + **folder tùy chọn** (Bên B: `+` / đổi tên / xóa); View lưới·danh sách·chi tiết; màu viền đồng bộ cặp thư mục (KS amber, TK violet).
- **Bỏ** khối Tài chính A↔B và Tài chính nội bộ trên workspace (vẫn dùng menu Tài chính riêng).
- **Header:** nhãn «Giá trị tư vấn:» + số tiền; bỏ nền ô; vạch đứt ngăn TMĐT.
- **Sổ hợp đồng** (port ksnpsc): mở từ mục Hợp đồng trên header / `?action=hop_dong`; HĐ chính·PL/ĐC·thầu phụ·ký lại; quét AI; số liệu; import Excel (Admin). Cache trên `du_an` (không `DANH_MUC_DA`).
- **SQL:** `007` hoso_folders; `008`–`017` sổ HĐ; `018` bundle còn thiếu (đã chạy trên Supabase project).
- **Ma trận phân quyền** (doc): đã chốt trước phiên — code enforcement chưa full.

### File chính

| Khu vực | File |
|---------|------|
| Hồ sơ | `hoSoFolders.js`, `HoSoKhoPanel.js`, `du-an/[ma]/*` |
| Header | `DuAnWorkspaceHeader.js` |
| Hợp đồng | `hopDong*.js`, `UpdateHopDongModal.js`, `HopDongSoLieuSection.js`, `api/parse-hop-dong` |
| SQL | `scripts/sql/007` … `018_missing_hop_dong_bundle.sql` |

### Việc tiếp

- [ ] Siết ma trận phân quyền trên code (lọc DA Bên A theo `ben_a_user_id`; A↔B chỉ admin sửa; PM không tạo/sửa/xóa DA).
- [ ] Form KS thật (NVKS/PAKTKS/…) thay stub.
- [ ] Storage binary hồ sơ / PDF HĐ (bucket `pdfs_giao_a`).
- [ ] Redeploy Vercel sau push 0.3.0.

### Câu mở phiên sau

```text
Đọc HANDOFF block 2026-08-21. App 0.3.0 — hồ sơ folder tùy chọn + sổ HĐ. Tiếp: siết phân quyền trên code; form KS; Storage.
```
