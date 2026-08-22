# HANDOFF — Phiên làm việc (mới nhất ở trên)

> **Máy khác:** `git pull` → đọc block **đầu tiên** dưới đây → tiếp tục chat.  
> **Cuối phiên:** `làm cuối phiên đầy đủ` (= HANDOFF → bump version + workflow + HDSD + changelog → commit + push). Chi tiết: [README](./README.md).

---

## 2026-08-22 — Tài chính nội bộ + UX login/DA (0.4.3)

**Máy / ngữ cảnh:** Cursor — tiếp 0.4.2; App **0.4.3**.

### Đã chốt / đã làm

- **Login:** màn hình mới (`LoginScreen.js`), nền `login-bg.png`, card trắng giữa.
- **Danh mục DA:** tách Tìm tên / Bộ lọc — 2 ô một hàng (lg+).
- **Header:** Bên A chỉ tên (`;`), bỏ username thừa.
- **Góp vốn B↔B:** SQL `025`–`026`; bill flow giống A↔B; trang chi tiết **2 cột**.
- **Quyền nội bộ:** Admin + PM vào; **PM chỉ xem**; SQL `027`.
- **UI:** ẩn Member trên bảng chia/chọn góp (`filterBenBNoiBoUi`); lịch sử góp vẫn hiện tên.

### File chính

| Khu vực | File |
|---------|------|
| Login / DA | `LoginScreen.js`, `du-an/page.js`, `brand.js` |
| Nội bộ | `GopVonNoiBoSection.js`, `tai-chinh-noi-bo/*`, `menuAccess.js`, `finance.js` |
| SQL | `025`–`027` |
| Docs | workflows, HDSD, `Phan_quyen_OUTSRC.md` |

### Việc tiếp

- [ ] SQL **025**–**027** trên Supabase.
- [ ] Form KS thật; RLS.

### Câu mở phiên sau

```text
Đọc HANDOFF (0.4.3). Góp vốn B↔B + PM xem nội bộ. SQL 025–027 nếu thiếu; tiếp form KS.
```

**Lưu trữ ngày:** [2026-08-22-tai-chinh-noi-bo-ux.md](./2026-08-22-tai-chinh-noi-bo-ux.md)

---

## 2026-08-22 — Upload hồ sơ + siết quyền Member / xóa file (0.4.2)

**Máy / ngữ cảnh:** Cursor — tiếp 0.4.1; App **0.4.2**.

### Đã chốt / đã làm

- **Member B** không xem menu / sổ **Tài chính A↔B** (`q_xem_tai_chinh_ab`; SQL `022`).
- **Seed user** gom `src/lib/seedUsers.js`: `hienth` = Bên A (`u-mem`); bỏ `binhnv` thừa (SQL `023`).
- **Upload hồ sơ KS|TK:** bucket `ho_so` (SQL `024`); kéo-thả / nhiều file; mở file từ danh sách; local = IndexedDB.
- **Xóa file upload:** Admin mọi file; PM/Member **chỉ file mình up** (`canXoaHoSoFile`); không xóa xuất bản.
- Sửa build `viewAsPermission.js` (import trùng).

### File chính

| Khu vực | File |
|---------|------|
| Upload | `hoSoStorage.js`, `HoSoKhoPanel.js`, `DuAnWorkspaceClient.js` |
| Quyền | `menuAccess.js`, `storeLocal.js`, `seedUsers.js` |
| SQL | `022`–`024` |
| Docs | workflows `01_auth`, `02_du_an`; HDSD `00`, `01`, `02` |
| Chi tiết | [2026-08-22-ho-so-upload-phan-quyen.md](./2026-08-22-ho-so-upload-phan-quyen.md) |

### Việc tiếp

- [ ] Chạy SQL **022**, **023**, **024** trên Supabase (nếu chưa).
- [ ] Form KS thật thay stub.
- [ ] Ứng nội bộ B↔B; Storage PDF HĐ.
- [ ] Siết RLS Supabase.

### Câu mở phiên sau

```text
Đọc docs/phien-lam-viec/HANDOFF.md (block 0.4.2). Upload hồ sơ + quyền Member/xóa file. Tiếp: form KS; SQL 022–024 nếu thiếu.
```

**Lưu trữ ngày:** [2026-08-22-ho-so-upload-phan-quyen.md](./2026-08-22-ho-so-upload-phan-quyen.md)

---

## 2026-08-21 — Ma trận Member + slogan (0.4.1)

**Máy / ngữ cảnh:** Cursor — sau 0.4.0; App **0.4.1**.

### Đã chốt / đã làm

- **Member** (`binhnv` …): quyền đúng ma trận — giống PM, **không** nội bộ; upsert `phan_quyen` trên Supabase.
- Login / xem quyền: `resolveRolePerms` ưu tiên `SEED_ROLES` (code = nguồn sự thật).
- Slogan: «Hệ thống quản lý công việc, tiến độ dự án.»

### File chính

| Khu vực | File |
|---------|------|
| Quyền | `rolePerms.js`, `login/route.js`, `store.js`, `viewAsPermission.js` |
| Brand | `brand.js` |
| Docs | `workflows/01_auth.md`, HANDOFF, changelog |

### Việc tiếp

- [ ] Form KS thật thay stub.
- [ ] Ứng nội bộ B↔B; Storage binary hồ sơ / PDF HĐ.
- [ ] Siết RLS Supabase.
- [ ] Xác nhận SQL 020–021 đã chạy trên mọi môi trường.

### Câu mở phiên sau

```text
Đọc docs/phien-lam-viec/HANDOFF.md (block 0.4.1). App 0.4.1 — Member ma trận + slogan. Tiếp: form KS; ứng nội bộ B.
```

---

## 2026-08-21 — Tài chính gọn + nội bộ 2 tầng + gán nhóm Bên A

**Máy / ngữ cảnh:** Cursor — OUTSRC; tiếp phiên sau folder hồ sơ + sổ HĐ; App **0.4.0**.

### Đã chốt / đã làm

- **Sổ A↔B:** nhận TU gọn — ngoài nhập số → popup chỉ **ngày + bill**; số khóa gắn link bill; sửa qua ngày; bỏ AI scan bill trên UX; nhãn Gtv / (25%Gtv).
- **Ngày VN:** `formatNgayVi` dd/mm/yyyy trên UI.
- **Tài chính nội bộ:** list DA → `/tai-chinh-noi-bo/[ma]`; chia **1 lần** trên tổng nhận từ A (% hoặc số cứng). Chưa: ứng nội bộ B↔B.
- **Gán Bên A:** `ben_a_user_ids` (nhiều người/nhóm); SQL `021`; nhập/sửa DA bắt buộc ≥1; cột Bên A chỉ Admin; filter A theo mảng; sync «Xem quyền».
- Phân quyền / đổi MK (019–020), nhật ký phân hệ IN HOA.

### File chính

| Khu vực | File |
|---------|------|
| A↔B / ngày | `tai-chinh/page.js`, `finance.js`, `formatNgay.js` |
| Nội bộ | `tai-chinh-noi-bo/page.js`, `[ma]/page.js`, `workflows/03_tai_chinh.md` |
| Bên A | `benAUsers.js`, `BenAUserSelect.js`, `menuAccess.js`, `021_ben_a_user_ids.sql` |
| HDSD / changelog | `docs/hdsd/*`, `hdsdMeta.js`, `appChangelog.js` |
| Chi tiết | [2026-08-21-tai-chinh-ben-a.md](./2026-08-21-tai-chinh-ben-a.md) |

### Việc tiếp

- [ ] Chạy SQL **019**, **020**, **021** trên Supabase (nếu chưa).
- [ ] Form KS thật thay stub.
- [ ] Ứng nội bộ B↔B; Storage binary hồ sơ / PDF HĐ.
- [ ] Siết RLS Supabase.

### Câu mở phiên sau

```text
Đọc docs/phien-lam-viec/HANDOFF.md (block 2026-08-21 tài chính/Bên A). App 0.4.0. Tiếp: chạy SQL 019–021 nếu thiếu; form KS; ứng nội bộ B.
```

**Lưu trữ ngày:** [2026-08-21-tai-chinh-ben-a.md](./2026-08-21-tai-chinh-ben-a.md)

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
