# 2026-09-20 — Hotfix build Vercel sau port KS (0.5.1)

**Máy / ngữ cảnh:** Cursor — sau release 0.5.0; App **0.5.1**.

### Đã chốt / đã làm

- **Vercel `75aca26` fail:** thiếu module/deps khi port KS chưa đủ → `next build` lỗi Module not found.
- **Bổ sung từ ksnpsc:** `doDtsVesForward`, `doDtsExportCapture`, `qcvnCatalogLookup` + JSON `src/data/bang*`, `ResizableTableFrame.jsx`.
- **Deps:** `recharts`, `libreoffice-convert`; `nvksPdfConvert` import LibreOffice linh hoạt hơn.
- **Xác nhận:** `npm run build` local pass; hotfix đã lên `main` (`8d4a7c4` rồi bump 0.5.1).
- **Không sửa** workflow / HDSD nội dung (chỉ fix build; HDSD_VERSION giữ 2026-09-20).

### File chính

| Khu vực | File |
|---------|------|
| Lib / data | `src/lib/doDts*.js`, `qcvnCatalogLookup.js`, `src/data/bang*.json` |
| UI | `src/components/table/ResizableTableFrame.jsx` |
| PDF / deps | `nvksPdfConvert.js`, `package.json` (`recharts`, `libreoffice-convert`) |

### Việc tiếp

- [ ] Xác nhận deploy Vercel **0.5.1** xanh trên production.
- [ ] Chạy SQL **HO_SO_*** (+ DM_CONG_VIEC nếu thiếu); bucket `exports_nvks`.
- [ ] QA lập/lưu/xuất Word từng module; trình ký OTP nếu cần.
- [ ] SQL **025**–**027** góp vốn nếu chưa chạy.

### Câu mở phiên sau

```text
Đọc HANDOFF (0.5.1). Build Vercel đã hotfix (module KS thiếu). Chạy SQL HO_SO_* rồi QA + Lập NVKS. Tiếp: QA KS / trình ký nếu cần.
```
