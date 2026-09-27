# 2026-09-27 — Quét HĐ ổn định + Gtv đồng bộ Tài chính (0.5.3)

**Máy / ngữ cảnh:** Cursor — tiếp 0.5.2; App **0.5.3**.

### Đã chốt / đã làm

- **Bug form HĐ trống sau «Đóng» alert quét AI:** init effect phụ thuộc object `project` mới mỗi lần `showAlert` → reset form; đổi deps → `project?.ma_du_an` (không `useMemo` sau early return).
- **HĐ khung nhiều CT:** ksnpsc/OUTSRC đã có (`HOP_DONG_GIAI_DOAN`, khối Công trình khác) — không cần nút «Gom» CT; gắn phạm vi khi nhập/quét HĐ.
- **`hop_dong_day_du`:** bỏ `(theo Quyết định…)`; QĐ → `qd_giao_a_tham_chieu`; sau «Giữa» dùng «và» + viết hoa bình thường (`normalizeHopDongDayDu`).
- **Tài chính A↔B:** lưu GTHĐ (trước VAT) → `du_an.gia_tri_hop_dong`; khi Gtv > 0 khóa PAĐT + cột Hợp đồng (hover đồng bộ từ HĐ); sửa Gtv chỉ trên sổ HĐ/PL.

### File chính

| Khu vực | File |
|---------|------|
| Quét / chuẩn hoá | `src/app/api/parse-hop-dong/route.js`, `src/lib/formatHopDong.js`, `UpdateHopDongModal.js` |
| Sync + khóa Gtv | `src/lib/finance.js`, `src/lib/hopDongThucHien.js`, `src/app/tai-chinh/page.js` |
| Docs | `docs/hdsd/02-tai-chinh.md`, `04-hop-dong.md`, `workflows/03_tai_chinh.md`, `05_hop_dong.md` |

### Việc tiếp

- [ ] QA Lập / Lưu / Xuất Word KS trên DA thật.
- [ ] QA HĐ khung 3 CT (Gói 3 Thanh Hóa) + sync Gtv từng mã.
- [ ] Trình ký OTP nếu cần; SQL **025**–**027** góp vốn nếu chưa chạy.

### Câu mở phiên sau

```text
Đọc HANDOFF (0.5.3). Quét HĐ + Gtv A↔B đã ổn. Tiếp: QA KS / HĐ khung nhiều CT hoặc trình ký.
```
