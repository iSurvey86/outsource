# HANDOFF — Phiên làm việc (mới nhất ở trên)

> **Máy khác:** `git pull` → đọc block **đầu tiên** dưới đây → tiếp tục chat.  
> **Cuối phiên:** `làm cuối phiên đầy đủ` (= HANDOFF → bump version + workflow + HDSD + changelog → commit + push). Chi tiết: [README](./README.md).

---

## 2026-08-20 — MVP OUTSRC + Supabase/Vercel + handoff

**Máy / ngữ cảnh:** Cursor — scaffold MVP quản lý da đen tại `D:\AIPoject\outsource`; deploy GitHub + Vercel; gắn Supabase.

### Đã chốt / đã làm

- **Nghiệp vụ:** App dùng chung Bên A + Bên B; chỉ **Tài chính nội bộ** riêng B. Tiền A→B: phần B = 25% GT tư vấn; tạm ứng = 30% phần B; TT nốt khi giao tuyến. Không xuất HĐ.
- **UI:** Brand **HỆ THỐNG / OUTSRC**; teal/blue/emerald; **không xám**. Sidebar có khối tài khoản + đăng xuất.
- **Modules MVP:** Dashboard, danh mục/workspace DA (thông tin chung, KS status/XB stub, hồ sơ KS+TK upload, tài chính A↔B), sổ tài chính, tài chính nội bộ (B), QLHT (user + nhật ký). Bỏ menu danh mục Bên A riêng (`phe=ben_a` trên user).
- **Data:** `store.js` → Supabase nếu có env; không thì localStorage. SQL seed [`scripts/sql/001_schema.sql`](../../scripts/sql/001_schema.sql).
- **Deploy:** GitHub `iSurvey86/outsource`; Vercel production `outsource-eosin.vercel.app`. Env cần URL + anon JWT (`eyJ…`).
- **Sửa lỗi phiên:** chuẩn hóa anon key (bỏ prefix copy nhầm); thông báo login rõ khi Invalid API key.
- **Quy trình:** thêm handoff giống ksnpsc (rule + docs + HDSD + changelog). **App 0.2.0**; HDSD **2026-08-20**.

### File chính

| Khu vực | File |
|---------|------|
| Shell / auth | `AppLayout.js`, `authSession.js`, `menuAccess.js`, `brand.js` |
| Data | `store.js`, `storeLocal.js`, `supabase.js`, `finance.js` |
| SQL | `scripts/sql/001_schema.sql` |
| Docs | `workflows/*`, `docs/hdsd/*`, `docs/changelog/*`, `docs/phien-lam-viec/*` |
| Chi tiết | [2026-08-20-mvp-supabase-vercel.md](./2026-08-20-mvp-supabase-vercel.md) |

### Việc tiếp

- [ ] Xác nhận Vercel env = anon key JWT đúng; redeploy nếu production còn Invalid API key.
- [ ] Chạy / xác nhận SQL `001_schema.sql` trên project Supabase (seed user).
- [ ] Form KS thật (NVKS/PAKTKS/BCKS…) thay stub status/XB.
- [ ] Storage binary cho hồ sơ (hiện metadata / local).
- [ ] Siết RLS Supabase (hiện policy mở cho MVP).

### Câu mở phiên sau

```text
Đọc docs/phien-lam-viec/HANDOFF.md (block đầu). App 0.2.0 — MVP OUTSRC + Supabase/Vercel. Tiếp: xác nhận env/SQL; form KS thật; Storage + RLS.
```

**Lưu trữ ngày:** [2026-08-20-mvp-supabase-vercel.md](./2026-08-20-mvp-supabase-vercel.md)

---
