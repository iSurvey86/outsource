# 2026-08-20 — MVP OUTSRC + Supabase/Vercel + handoff

**Máy / ngữ cảnh:** Cursor — scaffold MVP quản lý da đen tại `D:\AIPoject\outsource`; deploy GitHub + Vercel; gắn Supabase.

### Đã chốt / đã làm

- **Nghiệp vụ:** App dùng chung Bên A + Bên B; chỉ **Tài chính nội bộ** riêng B. Tiền A→B: phần B = 25% GT tư vấn; tạm ứng = 30% phần B; TT nốt khi giao tuyến. Không xuất HĐ.
- **UI:** Brand **HỆ THỐNG / OUTSRC**; teal/blue/emerald; **không xám**. Sidebar có khối tài khoản + đăng xuất.
- **Modules MVP:** Dashboard, danh mục/workspace DA (thông tin chung, KS status/XB stub, hồ sơ KS+TK upload, tài chính A↔B), sổ tài chính, tài chính nội bộ (B), QLHT (user + nhật ký). Bỏ menu danh mục Bên A riêng (`phe=ben_a` trên user).
- **Data:** `store.js` → Supabase nếu có env; không thì localStorage. SQL seed `scripts/sql/001_schema.sql`.
- **Deploy:** GitHub `iSurvey86/outsource`; Vercel production. Env cần URL + anon JWT (`eyJ…`).
- **Sửa lỗi phiên:** chuẩn hóa anon key; thông báo login rõ khi Invalid API key.
- **Quy trình:** handoff giống ksnpsc. **App 0.2.0**; HDSD **2026-08-20**.

### Việc tiếp

- [ ] Xác nhận Vercel env + redeploy nếu còn Invalid API key.
- [ ] Chạy / xác nhận SQL seed trên Supabase.
- [ ] Form KS thật; Storage binary; siết RLS.
