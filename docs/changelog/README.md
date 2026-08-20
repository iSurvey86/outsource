# Changelog — hướng dẫn duy trì

## Mục đích

Ghi **có gì mới theo từng phiên bản phần mềm**.

| Tài liệu | Vai trò |
|----------|---------|
| `src/lib/appChangelog.js` | **Nguồn UI** — cập nhật khi bump `package.json` |
| `docs/changelog/CHANGELOG.md` | Bản Markdown song song |
| HANDOFF / HDSD | Không thay changelog |

## Khi nào ghi

Khi bump `version` trong `package.json` vì user thấy thay đổi rõ (tính năng / UX).

## Cách viết

- Tiếng Việt, mô tả **nghiệp vụ**.
- Nhóm: **Mới** / **Cải thiện** / **Sửa lỗi**.
- Không ghi route, tên hàm, secret.
- Mới nhất ở **đầu**.

## Cuối phiên đầy đủ

Thêm bước: cập nhật `appChangelog.js` + `CHANGELOG.md` cho số version vừa bump.
