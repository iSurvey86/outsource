# 2026-09-20 — Port form KS từ ksnpsc + sổ TC (0.5.0)

## Đã làm

- Port Form NVKS / PAKTKS / NKKS / BCKS / NTKS + lib + template + SQL từ ksnpsc.
- Workspace mở form thật (`?action=`); cần Supabase `HO_SO_*`.
- Tài chính: ghi chú wrap/justify/middle; cột Ghi chú nội bộ; xóa tạm ứng; STT đồng bộ A↔B ↔ nội bộ.

## File chính

| Khu vực | File |
|---------|------|
| Form | `FormNVKS.js` … `FormNTKS.js` |
| Wire | `DuAnWorkspaceClient.js`, `ksProjectAdapter.js` |
| Docs | `docs/ks-port-README.md` |

## Việc tiếp

- [ ] SQL HO_SO_* + DM_CONG_VIEC; QA xuất Word.
- [ ] Trình ký OTP nếu cần (API phụ ksnpsc).

## Câu mở phiên sau

```text
Đọc HANDOFF (0.5.0). Form KS đã port — chạy SQL HO_SO_* rồi QA + Lập NVKS.
```
