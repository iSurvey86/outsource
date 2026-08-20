"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Wallet,
  PieChart,
  Settings,
  LogOut,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  APP_NAME,
  APP_SYSTEM_LABEL,
  APP_VERSION_LABEL,
  POST_LOGIN_ROUTE,
} from "../lib/brand";
import {
  clearAuthSession,
  loadAuthSession,
  setAuthSession,
} from "../lib/authSession";
import { canSeeChiaNoiBo, canSeeQlht, checkPathAccess } from "../lib/menuAccess";
import { loginLocal, logActivity, fetchDb, hasSupabase } from "../lib/store";

const navItemClass = (active) =>
  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
    active
      ? "bg-white/20 text-white shadow-sm"
      : "text-sky-100 hover:bg-white/10 hover:text-white"
  }`;

function getUserInitials(hoTen) {
  const parts = String(hoTen || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) {
    return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0]?.[0]?.toUpperCase() || "?";
}

export default function AppLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [perms, setPerms] = useState(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { user: u, perms: p } = loadAuthSession();
    setUser(u);
    setPerms(p);
    setLoading(false);
    if (typeof window !== "undefined" && !u && !hasSupabase) {
      fetchDb().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user && pathname !== "/login") {
      router.replace("/login");
      return;
    }
    if (user && pathname === "/login") {
      router.replace(POST_LOGIN_ROUTE);
      return;
    }
    if (user) {
      const redirect = checkPathAccess(pathname, user, perms);
      if (redirect && redirect !== pathname) router.replace(redirect);
    }
  }, [loading, user, perms, pathname, router]);

  async function handleLogin(e) {
    e.preventDefault();
    setBusy(true);
    setLoginError("");
    try {
      const res = await loginLocal(username, password);
      if (!res.ok) {
        let msg = res.error || "Đăng nhập thất bại.";
        if (/invalid api key/i.test(msg)) {
          msg =
            "Supabase API key sai. Vào Dashboard → Settings → API, copy lại anon (public) key vào .env.local (và Vercel env), rồi restart/redeploy.";
        }
        setLoginError(msg);
        setBusy(false);
        return;
      }
      setAuthSession(res.user, res.perms);
      setUser(res.user);
      setPerms(res.perms);
      await logActivity({
        username: res.user.username,
        ho_ten: res.user.ho_ten,
        phan_he: "auth",
        hanh_dong: "LOGIN",
        chi_tiet: `Phe ${res.user.phe}`,
      });
      setBusy(false);
      router.replace(POST_LOGIN_ROUTE);
    } catch (err) {
      let msg = err.message || "Lỗi đăng nhập / kết nối DB.";
      if (/invalid api key/i.test(msg)) {
        msg =
          "Supabase API key sai. Copy lại anon (public) key từ Supabase → Settings → API.";
      }
      setLoginError(msg);
      setBusy(false);
    }
  }

  async function handleLogout() {
    if (user) {
      await logActivity({
        username: user.username,
        ho_ten: user.ho_ten,
        phan_he: "auth",
        hanh_dong: "LOGOUT",
        chi_tiet: "",
      });
    }
    clearAuthSession();
    setUser(null);
    setPerms(null);
    router.replace("/login");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 via-teal-50 to-emerald-50">
        <p className="text-sm font-bold text-teal-800">Đang tải…</p>
      </div>
    );
  }

  if (user && pathname === "/login") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 via-teal-50 to-emerald-50">
        <p className="text-sm font-bold text-teal-800">Đang chuyển…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-100 via-teal-50 to-blue-100 px-4">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-md rounded-2xl border border-sky-200 bg-white p-8 shadow-xl shadow-sky-200/60"
        >
          <div className="mb-6 text-center">
            <p className="text-base font-black tracking-[0.15em] text-teal-600">
              {APP_SYSTEM_LABEL}
            </p>
            <h1 className="mt-1 text-3xl font-black text-blue-900">{APP_NAME}</h1>
          </div>
          <label className="mb-1 block text-xs font-bold text-blue-900">User</label>
          <input
            className="mb-3 w-full rounded-xl border border-sky-300 bg-sky-50 px-3 py-2.5 text-sm font-medium text-blue-950 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/\s/g, "").toLowerCase())}
            autoComplete="username"
            placeholder="phuongdm"
          />
          <label className="mb-1 block text-xs font-bold text-blue-900">Mật khẩu</label>
          <div className="relative mb-4">
            <input
              type={showPw ? "text" : "password"}
              className="w-full rounded-xl border border-sky-300 bg-sky-50 px-3 py-2.5 pr-10 text-sm font-medium text-blue-950 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-teal-700 hover:bg-teal-50"
              onClick={() => setShowPw((v) => !v)}
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {loginError ? (
            <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
              {loginError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-teal-600 py-2.5 text-sm font-black text-white shadow-md shadow-teal-300/50 transition hover:from-blue-700 hover:to-teal-700 disabled:opacity-60"
          >
            {busy ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
          <p className="mt-4 text-center text-[11px] font-medium text-blue-700">
            {APP_VERSION_LABEL}
          </p>
        </form>
      </div>
    );
  }

  const showChia = canSeeChiaNoiBo(user, perms);
  const showQlht = canSeeQlht(user, perms);

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-sky-50 via-teal-50/80 to-emerald-50">
      <aside className="flex w-56 shrink-0 flex-col bg-gradient-to-b from-blue-800 via-blue-700 to-teal-700 text-white shadow-xl shadow-blue-300/40">
        <div className="border-b border-white/15 px-4 py-4">
          <p className="text-sm font-black tracking-[0.12em] text-sky-200">
            {APP_SYSTEM_LABEL}
          </p>
          <p className="text-lg font-black tracking-tight">{APP_NAME}</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          <Link href="/" className={navItemClass(pathname === "/")}>
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            Dashboard
          </Link>
          <Link href="/du-an" className={navItemClass(pathname.startsWith("/du-an"))}>
            <FolderKanban className="h-4 w-4 shrink-0" />
            Dự án
          </Link>
          <Link href="/tai-chinh" className={navItemClass(pathname.startsWith("/tai-chinh"))}>
            <Wallet className="h-4 w-4 shrink-0" />
            Tài chính A↔B
          </Link>
          {showChia ? (
            <Link
              href="/tai-chinh-noi-bo"
              className={navItemClass(pathname.startsWith("/tai-chinh-noi-bo"))}
            >
              <PieChart className="h-4 w-4 shrink-0" />
              Tài chính nội bộ
            </Link>
          ) : null}
          {showQlht ? (
            <Link
              href="/quan-ly-he-thong"
              className={navItemClass(pathname.startsWith("/quan-ly-he-thong"))}
            >
              <Settings className="h-4 w-4 shrink-0" />
              Quản trị HT
            </Link>
          ) : null}
        </nav>
        {/* Tài khoản — cuối sidebar (kiểu ksnpsc) */}
        <div className="shrink-0 border-t border-white/15">
          <div className="flex items-center gap-2.5 px-3 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-teal-400 text-xs font-black text-blue-950 shadow-sm">
              {getUserInitials(user.ho_ten)}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-xs font-black leading-snug text-white">
                {user.ho_ten}
              </p>
              <p className="truncate text-[10px] font-semibold leading-snug text-sky-200">
                {user.phe === "ben_a" ? "Bên A" : "Bên B"}
                {user.username ? ` · ${user.username}` : ""}
              </p>
            </div>
          </div>
          <div className="px-3 pb-3">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-sky-100 hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Đăng xuất
            </button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
