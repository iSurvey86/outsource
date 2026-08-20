# OUTSRC

Quản lý dự án ngoài (da đen): Bên A & Bên B dùng chung app.

## Stack
- Next.js 16 + Tailwind 4 + Supabase (Postgres)
- Deploy: **Vercel**

## 1. Tạo Supabase project
1. Vào https://supabase.com → New project
2. SQL Editor → dán & Run file [`scripts/sql/001_schema.sql`](scripts/sql/001_schema.sql)
3. Settings → API → copy **Project URL** + **anon public** key

## 2. Env local
Tạo `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

```bash
npm install
npm run dev
```

Không có env → app chạy **localStorage** (dev). Có env → dùng **Supabase**.

### Tài khoản seed
| User | MK | Vai |
|------|-----|-----|
| phuongdm | admin123 | Bên B admin |
| tinhtv | pm123 | Bên B pm |
| hienth | mem123 | Bên B member |
| chulm | a123 | Bên A |

## 3. Deploy Vercel
1. Push repo lên GitHub / GitLab / Bitbucket
2. https://vercel.com/new → Import project
3. Environment Variables (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy → mở URL

Hoặc CLI:

```bash
npx vercel
npx vercel env add NEXT_PUBLIC_SUPABASE_URL
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
npx vercel --prod
```

## Style
Teal / blue / emerald. Không dùng xám/ghi trên UI.

## Phiên làm việc (handoff)
- Đọc: [`docs/phien-lam-viec/HANDOFF.md`](docs/phien-lam-viec/HANDOFF.md)
- Cuối phiên: chat *「làm cuối phiên đầy đủ」* (= HANDOFF + bump + workflow + HDSD + changelog → commit + push)
- Rule: `.cursor/rules/session-handoff.mdc`
