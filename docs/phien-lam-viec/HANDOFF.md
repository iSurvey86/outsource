# HANDOFF — Phiên làm việc (mới nhất ở trên)

> **Máy khác:** `git pull` → đọc block **đầu tiên** dưới đây → tiếp tục chat.  
> **Cuối phiên:** `làm cuối phiên đầy đủ` (= HANDOFF → bump version + workflow + HDSD + changelog → commit + push). Chi tiết: [README](./README.md).

---

## 2026-08-21 — Hồ sơ folder tùy chọn + Sổ hợp đồng

**Máy / ngữ cảnh:** Cursor — workspace OUTSRC; port sổ HĐ từ ksnpsc; SQL Supabase đã chạy tới `018`.

### Đã chốt / đã làm

- Hồ sơ KS|TK: folder chuẩn + tùy chọn (Bên B tạo/đổi tên/xóa); View 3 kiểu; màu KS amber / TK violet.
- Workspace: bỏ khối tài chính A↔B & nội bộ (dùng menu riêng); header «Giá trị tư vấn:» không nền + vạch ngăn TMĐT.
- **Sổ hợp đồng** mở từ header / `?action=hop_dong` (Supabase bắt buộc); SQL `007`–`018` (đã verify `HOP_DONG_NHAN_SU`, TNCTTT, RLS).
- Ma trận phân quyền đã chốt trong `docs/Phan_quyen_OUTSRC.md` — **chưa** enforce đủ trên code.

### File chính

| Khu vực | File |
|---------|------|
| Hồ sơ / workspace | `hoSoFolders.js`, `HoSoKhoPanel.js`, `du-an/[ma]/DuAnWorkspaceClient.js` |
| Hợp đồng | `lib/hopDong*.js`, `UpdateHopDongModal.js`, `api/parse-hop-dong` |
| SQL | `scripts/sql/007` … `018_missing_hop_dong_bundle.sql` |
| Chi tiết | [2026-08-21-hoso-folder-so-hop-dong.md](./2026-08-21-hoso-folder-so-hop-dong.md) |

### Việc tiếp

- [ ] Siết phân quyền trên code (lọc DA Bên A; A↔B chỉ admin sửa; PM không CRUD DA metadata).
- [ ] Form KS thật thay stub.
- [ ] Storage binary hồ sơ / PDF HĐ.

### Câu mở phiên sau

```text
Đọc docs/phien-lam-viec/HANDOFF.md (block 2026-08-21). App 0.3.0 — folder hồ sơ + sổ HĐ. Tiếp: siết phân quyền; form KS; Storage.
```

**Lưu trữ ngày:** [2026-08-21-hoso-folder-so-hop-dong.md](./2026-08-21-hoso-folder-so-hop-dong.md)

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
