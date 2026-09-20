# HANDOFF — Phiên làm việc (mới nhất ở trên)

> **Máy khác:** `git pull` → đọc block **đầu tiên** dưới đây → tiếp tục chat.  
> **Cuối phiên:** `làm cuối phiên đầy đủ` (= HANDOFF → bump version + workflow + HDSD + changelog → commit + push). Chi tiết: [README](./README.md).

---

## 2026-09-20 — Supabase KS sẵn sàng + tiêu đề TC nội bộ (0.5.2)

**Máy / ngữ cảnh:** Cursor — sau 0.5.1; App **0.5.2**.

### Đã chốt / đã làm

- **Supabase outsource — schema KS:** `create-ho-so-nvks` + RLS; `create-dm-cong-viec`; `028` alters PAKTKS/NKKS; buckets `029` (`exports_nvks`, `pdfs_phe_duyet_nvks`) + `024` (`ho_so`); `030`/`031` cột DM (`loai_dong`, `apdung_*`, `tt` text).
- **Seed `DM_CONG_VIEC`:** đồng bộ API từ ksnpsc → outsource (**103** dòng, đủ lọc giai đoạn).
- **Kiểm tra live:** `HO_SO_*` + cột quan trọng OK; upload bucket OK.
- **UX:** Tài chính nội bộ — tiêu đề cột bảng `text-center`.
- **Docs:** `docs/ks-port-README.md` checklist SQL đầy đủ; workflow `02_du_an` / HDSD dự án ghi môi trường KS.

### File chính

| Khu vực | File |
|---------|------|
| SQL | `create-ho-so-nvks.sql`, `rls-ho-so-nvks.sql`, `create-dm-cong-viec.sql`, `028`–`031_*.sql`, `029_storage_exports_nvks.sql` |
| UI | `src/app/tai-chinh-noi-bo/page.js` |
| Docs | `docs/ks-port-README.md`, `workflows/02_du_an.md`, `docs/hdsd/01-du-an.md` |

### Việc tiếp

- [ ] QA Lập / Lưu / Xuất Word: NVKS → PAKTKS → NKKS → BCKS → NT trên DA thật.
- [ ] Trình ký OTP (`TRINH_KY*`) nếu cần — chưa tạo trên outsource.
- [ ] SQL **025**–**027** góp vốn nếu chưa chạy.

### Câu mở phiên sau

```text
Đọc HANDOFF (0.5.2). Supabase KS đã sẵn (HO_SO_*, DM 103 dòng, bucket exports_nvks). Tiếp: QA + Lập NVKS trên workspace.
```

**Lưu trữ ngày:** [2026-09-20-supabase-ks-ready.md](./2026-09-20-supabase-ks-ready.md)

---

## 2026-09-20 — Hotfix build Vercel sau port KS (0.5.1)

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

**Lưu trữ ngày:** [2026-09-20-vercel-build-hotfix.md](./2026-09-20-vercel-build-hotfix.md)

---

## 2026-09-20 — Port form KS từ ksnpsc + sổ TC (0.5.0)

**Máy / ngữ cảnh:** Cursor — tiếp 0.4.6; App **0.5.0**.

### Đã chốt / đã làm

- **Port KS (ksnpsc → OUTSRC):** Form NVKS / PAKTKS / NKKS / BCKS / NTKS + lib xuất Word/PDF + template `public/templates/templates_*` + SQL `scripts/sql/*ho-so*`.
- **Workspace:** `+ Lập` / `Xem` mở form thật (`?action=nvks|…`); `toKsProject` map `du_an`; fetch `HO_SO_*` qua Supabase.
- **Tài chính (trước đó cùng nhánh):** Ghi chú wrap/justify/middle; cột Ghi chú nội bộ; xóa tạm ứng trên modal Sửa; đồng bộ STT A↔B ↔ nội bộ (`sortDuAnTaiChinh`).
- **Deps:** docxtemplater, pizzip, file-saver, pdf-lib, …

### File chính

| Khu vực | File |
|---------|------|
| Form | `FormNVKS.js`, `FormPAKTKS.js`, `FormNKKS.js`, `FormBCKS.js`, `FormNTKS.js` |
| Wire | `DuAnWorkspaceClient.js`, `ksProjectAdapter.js`, `hoSoKhaoSat.js` |
| Template / SQL | `public/templates/templates_*`, `scripts/sql/create-ho-so-*.sql` |
| Hướng dẫn port | `docs/ks-port-README.md` |
| Tài chính | `tai-chinh/page.js`, `tai-chinh-noi-bo/page.js`, `NoteCell.js`, `finance.js` |

### Việc tiếp

- [ ] Chạy SQL **HO_SO_*** (+ DM_CONG_VIEC nếu thiếu) trên Supabase; bucket `exports_nvks`.
- [ ] QA lập/lưu/xuất Word từng module; trình ký OTP (nếu cần) còn thiếu API phụ.
- [ ] SQL **025**–**027** góp vốn nếu chưa chạy.

### Câu mở phiên sau

```text
Đọc HANDOFF (0.5.0). Form KS đã port từ ksnpsc — chạy SQL HO_SO_* rồi QA + Lập NVKS. Sổ TC: ghi chú wrap, xóa tạm ứng, STT đồng bộ. Tiếp: QA KS / trình ký nếu cần.
```

**Lưu trữ ngày:** [2026-09-20-port-ks-ksnpsc.md](./2026-09-20-port-ks-ksnpsc.md)

---

## 2026-08-27 — Nhập DA UX + Bên A chỉ xem KS (0.4.6)

**Máy / ngữ cảnh:** Cursor — tiếp 0.4.5; App **0.4.6**.

### Đã chốt / đã làm

- **Gán Bên A:** dropdown đa chọn + ô tìm kiếm (bỏ list checkbox + ghi chú phụ).
- **Nhập DA:** 4 ô master đồng bộ kích thước; **Cấp điện áp chung \*** bắt buộc, không mặc định; danh sách: 220kV → 110kV → Trung áp (22kV-35kV) → Hạ áp (0.4kV) → Trung Hạ áp (0.4kV-35kV).
- **Nhật ký hệ thống:** checkbox **Hide Admin** mặc định bật.
- **Workspace KS:** Bên A thấy khối Khảo sát & NT ở chế độ **chỉ xem** (không Lập/XB); badge «Chỉ xem».

### File chính

| Khu vực | File |
|---------|------|
| Bên A select | `BenAUserSelect.js` |
| Nhập DA | `NhapDuAnClient.js`, `duAnMeta.js` |
| KS view | `DuAnWorkspaceClient.js`, `duAnWorkspace.js` |
| Nhật ký | `NhatKyHoatDongPanel.js` |

### Việc tiếp

- [ ] SQL **025**–**027**; form KS thật; RLS.

### Câu mở phiên sau

```text
Đọc HANDOFF (0.4.6). Nhập DA: dropdown Bên A + cấp điện áp bắt buộc; KS Bên A chỉ xem; Hide Admin mặc định. Tiếp form KS / SQL nếu thiếu.
```

**Lưu trữ ngày:** [2026-08-27-nhap-da-ben-a-ks-view.md](./2026-08-27-nhap-da-ben-a-ks-view.md)

---

## 2026-08-22 — Tối ưu mobile toàn app (0.4.5)

**Máy / ngữ cảnh:** Cursor — tiếp 0.4.4; App **0.4.5**.

### Đã chốt / đã làm

- **Nhật ký hoạt động:** thẻ mobile; bảng desktop; lọc responsive.
- **QLHT, nội bộ, hồ sơ, sổ HĐ:** thẻ hoặc cuộn ngang trên mobile.
- `useMediaQuery`, `MobileTableScroll`.

### File chính

| Khu vực | File |
|---------|------|
| Core | `NhatKyHoatDongPanel.js`, `MobileTableScroll.js`, `useMediaQuery.js` |
| Trang | `quan-ly-he-thong`, `tai-chinh*`, `du-an`, `GopVonNoiBoSection` |

### Việc tiếp

- [ ] SQL **025**–**027**; form KS; RLS.

### Câu mở phiên sau

```text
Đọc HANDOFF (0.4.5). Mobile UX ổn; tiếp form KS / SQL nếu thiếu.
```

**Lưu trữ ngày:** [2026-08-22-mobile-responsive.md](./2026-08-22-mobile-responsive.md)

---

## 2026-08-22 — Sidebar mobile + tinh chỉnh góp vốn (0.4.4)

**Máy / ngữ cảnh:** Cursor — tiếp 0.4.3; App **0.4.4**.

### Đã chốt / đã làm

- **Sidebar mobile:** drawer auto-hide; ☰ mở menu; full width nội dung khi đóng.
- **Desktop:** ghim góc phải header; bỏ ghim → thu icon (`useAppSidebar`).
- **Góp vốn:** nhãn trái / số phải; cột STT.

### File chính

| Khu vực | File |
|---------|------|
| Sidebar | `hooks/useAppSidebar.js`, `AppLayout.js` |
| Nội bộ | `GopVonNoiBoSection.js` |

### Việc tiếp

- [ ] SQL **025**–**027** trên Supabase.
- [ ] Form KS thật; RLS.

### Câu mở phiên sau

```text
Đọc HANDOFF (0.4.4). Sidebar mobile + ghim desktop. SQL 025–027 nếu thiếu; tiếp form KS.
```

**Lưu trữ ngày:** [2026-08-22-sidebar-mobile-ux.md](./2026-08-22-sidebar-mobile-ux.md)

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
