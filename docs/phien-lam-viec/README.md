# Phiên làm việc — Handoff giữa các máy

Mục đích: đồng bộ **tóm tắt trao đổi** qua git khi đổi máy (Cursor không mang theo lịch sử chat).

## File

| File | Vai trò |
|------|---------|
| [HANDOFF.md](./HANDOFF.md) | **Đọc đầu tiên** — block mới nhất ở trên |
| `YYYY-MM-DD-*.md` | Lưu trữ theo ngày (copy từ block HANDOFF khi phiên đáng nhớ) |

## Quy trình

**Máy A (cuối phiên) — khuyến nghị:**

```
làm cuối phiên đầy đủ
```

= HANDOFF (+ file ngày nếu cần) → **bump version + workflow + HDSD + changelog** (khi đổi nghiệp vụ/UX) → commit + push.

| Lệnh ngắn | Phạm vi |
|-----------|---------|
| `làm cuối phiên đầy đủ` | HANDOFF + bump version + workflow + HDSD + changelog + commit + push |
| `cập nhật HANDOFF → commit + push` | Chỉ HANDOFF + commit + push |
| `cập nhật HANDOFF` | Chỉ sửa HANDOFF (không commit trừ khi nhờ thêm) |

**Bump version** (trong bước đầy đủ):

| Phiên bản | File | Khi nào |
|-----------|------|---------|
| `HDSD_VERSION` | `src/lib/hdsdMeta.js` | Đã sửa `docs/hdsd/` → đặt = ngày phiên |
| `package.json` → `APP_VERSION` | `package.json` | User thấy đổi phần mềm rõ (tính năng/UX); không bump nếu chỉ sửa docs |
| Changelog «Có gì mới» | `src/lib/appChangelog.js` + `docs/changelog/CHANGELOG.md` | **Khi** đã bump `package.json` — ghi Mới / Cải thiện / Sửa lỗi |

**Máy B (đầu phiên):** `git pull` → chat *「Đọc HANDOFF.md, tiếp tục …」*.

Chi tiết rule: `.cursor/rules/session-handoff.mdc`.
