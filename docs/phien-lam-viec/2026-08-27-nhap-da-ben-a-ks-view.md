# 2026-08-27 — Nhập DA UX + Bên A chỉ xem KS (0.4.6)

## Đã làm

- **Gán Bên A:** dropdown đa chọn + ô tìm kiếm (bỏ list checkbox + ghi chú phụ).
- **Nhập DA:** 4 ô master đồng bộ kích thước; **Cấp điện áp chung \*** bắt buộc, không mặc định; danh sách: 220kV → 110kV → Trung áp (22kV-35kV) → Hạ áp (0.4kV) → Trung Hạ áp (0.4kV-35kV).
- **Nhật ký hệ thống:** checkbox **Hide Admin** mặc định bật.
- **Workspace KS:** Bên A thấy khối Khảo sát & NT ở chế độ **chỉ xem** (không Lập/XB); badge «Chỉ xem».

## File chính

| Khu vực | File |
|---------|------|
| Bên A select | `BenAUserSelect.js` |
| Nhập DA | `NhapDuAnClient.js`, `duAnMeta.js` |
| KS view | `DuAnWorkspaceClient.js`, `duAnWorkspace.js` |
| Nhật ký | `NhatKyHoatDongPanel.js` |

## Việc tiếp

- [ ] SQL **025**–**027**; form KS thật; RLS.

## Câu mở phiên sau

```text
Đọc HANDOFF (0.4.6). Nhập DA: dropdown Bên A + cấp điện áp bắt buộc; KS Bên A chỉ xem; Hide Admin mặc định. Tiếp form KS / SQL nếu thiếu.
```
