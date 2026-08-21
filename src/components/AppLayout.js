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
  SHOW_DASHBOARD,
} from "../lib/brand";
import { loadAuthSession, setAuthSession } from "../lib/authSession";
import { canSeeChiaNoiBo, canSeeQlht, checkPathAccess } from "../lib/menuAccess";
import { loginLocal, logActivity, fetchDb, hasSupabase } from "../lib/store";
import { startOnlinePresence } from "../lib/onlinePresence";
import {
  VIEW_AS_ROLE_PRESETS,
  buildViewAsUserFromPreset,
  canUseViewAsPermission,
  clearAuthSessionIncludingViewAs,
  fetchPermsForRole,
  getAuthActor,
  getViewAsMeta,
  isViewAsActive,
  roleLabel,
  startViewAsPermission,
  stopViewAsPermission,
} from "../lib/viewAsPermission";
import { ViewAsPermissionBanner } from "./ViewAsPermissionModal";

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
  const [viewAsMenuOpen, setViewAsMenuOpen] = useState(false);
  const [viewAsActive, setViewAsActive] = useState(false);
  const [viewAsSwitching, setViewAsSwitching] = useState(false);
  const [viewAsExiting, setViewAsExiting] = useState(false);

  useEffect(() => {
    const { user: u, perms: p } = loadAuthSession();
    setUser(u);
    setPerms(p);
    setViewAsActive(isViewAsActive());
    if (isViewAsActive()) setViewAsMenuOpen(true);
    setLoading(false);
    if (typeof window !== "undefined" && !u && !hasSupabase) {
      fetchDb().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onAuth = (e) => {
      const detail = e?.detail || {};
      if (detail.user !== undefined) setUser(detail.user);
      else {
        const s = loadAuthSession();
        setUser(s.user);
        setPerms(s.perms);
      }
      if (detail.perms !== undefined) setPerms(detail.perms);
      setViewAsActive(Boolean(detail.viewAs ?? isViewAsActive()));
      if (detail.viewAs) setViewAsMenuOpen(true);
    };
    window.addEventListener("outsrc-auth-session-changed", onAuth);
    return () => window.removeEventListener("outsrc-auth-session-changed", onAuth);
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
    if (user && !SHOW_DASHBOARD && (pathname === "/" || pathname === "")) {
      router.replace("/du-an");
      return;
    }
    if (user) {
      const redirect = checkPathAccess(pathname, user, perms);
      if (redirect && redirect !== pathname) router.replace(redirect);
    }
  }, [loading, user, perms, pathname, router]);

  useEffect(() => {
    if (!user) return undefined;
    return startOnlinePresence(getAuthActor() || user);
  }, [user]);

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
      setViewAsActive(false);
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
    const actor = getAuthActor() || user;
    if (actor) {
      await logActivity({
        username: actor.username,
        ho_ten: actor.ho_ten,
        phan_he: "auth",
        hanh_dong: "LOGOUT",
        chi_tiet: isViewAsActive() ? "Thoát kèm view-as" : "",
      });
    }
    clearAuthSessionIncludingViewAs();
    setUser(null);
    setPerms(null);
    setViewAsActive(false);
    router.replace("/login");
  }

  async function handleExitViewAs() {
    setViewAsExiting(true);
    try {
      const meta = getViewAsMeta();
      const actor = getAuthActor();
      const result = stopViewAsPermission();
      if (!result.ok) throw new Error(result.error);
      await logActivity({
        username: actor?.username,
        ho_ten: actor?.ho_ten,
        phan_he: "auth",
        hanh_dong: "VIEW_AS_STOP",
        chi_tiet: `Thoát xem với quyền${meta?.target_ho_ten ? ` của ${meta.target_ho_ten}` : ""}`,
      });
      const s = loadAuthSession();
      setUser(s.user);
      setPerms(s.perms);
      setViewAsActive(false);
      setViewAsMenuOpen(false);
      router.replace(POST_LOGIN_ROUTE);
    } catch (err) {
      console.error(err);
    } finally {
      setViewAsExiting(false);
    }
  }

  async function handlePickViewAsPreset(preset) {
    if (viewAsSwitching) return;
    setViewAsSwitching(true);
    try {
      const rolePerms = await fetchPermsForRole(preset.phan_quyen);
      const persona = buildViewAsUserFromPreset(preset);
      const result = startViewAsPermission(persona, rolePerms);
      if (!result.ok) throw new Error(result.error);
      const actor = getAuthActor();
      await logActivity({
        username: actor?.username,
        ho_ten: actor?.ho_ten,
        phan_he: "auth",
        hanh_dong: "VIEW_AS_START",
        chi_tiet: `Bật xem với quyền ${preset.ho_ten} (${preset.phan_quyen})`,
        du_lieu_dong: {
          persona: true,
          target_phan_quyen: preset.phan_quyen,
          target_phe: preset.phe,
        },
      });
      const s = loadAuthSession();
      setUser(s.user);
      setPerms(s.perms);
      setViewAsActive(true);
      setViewAsMenuOpen(true);
      router.replace(POST_LOGIN_ROUTE);
    } catch (err) {
      alert(err?.message || "Không chuyển được chế độ xem.");
    } finally {
      setViewAsSwitching(false);
    }
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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-100 via-teal-50 to-blue-100 px-4 py-10">
        <form
          onSubmit={handleLogin}
          className="flex w-full max-w-[20rem] flex-col rounded-2xl border border-sky-200 bg-white px-6 py-10 shadow-xl shadow-sky-200/60"
        >
          <div className="mb-8 text-center">
            <p className="text-sm font-black tracking-[0.18em] text-teal-600">
              {APP_SYSTEM_LABEL}
            </p>
            <h1 className="mt-1 text-3xl font-black leading-none text-blue-900">{APP_NAME}</h1>
          </div>
          <label className="mb-1.5 block text-xs font-bold text-blue-900">Tài khoản</label>
          <input
            className="mb-5 w-full rounded-xl border border-sky-300 bg-sky-50 px-3 py-2.5 text-sm font-medium text-blue-950 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/\s/g, "").toLowerCase())}
            autoComplete="username"
          />
          <label className="mb-1.5 block text-xs font-bold text-blue-900">Mật khẩu</label>
          <div className="relative mb-6">
            <input
              type={showPw ? "text" : "password"}
              className="w-full rounded-xl border border-sky-300 bg-sky-50 px-3 py-2.5 pr-10 text-sm font-medium text-blue-950 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-teal-700 hover:bg-teal-50"
              onClick={() => setShowPw((v) => !v)}
              tabIndex={-1}
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {loginError ? (
            <p className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
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
          <p className="mt-6 text-center text-[11px] font-medium text-blue-700">
            {APP_VERSION_LABEL}
          </p>
        </form>
      </div>
    );
  }

  const showChia = canSeeChiaNoiBo(user, perms);
  const showQlht = canSeeQlht(user, perms);
  const showViewAsEntry = canUseViewAsPermission();
  const viewAsMeta = viewAsActive ? getViewAsMeta() : null;

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-teal-50/80 to-emerald-50">
      <aside className="flex h-full w-56 shrink-0 flex-col overflow-y-auto bg-gradient-to-b from-blue-800 via-blue-700 to-teal-700 text-white shadow-xl shadow-blue-300/40">
        <div className="shrink-0 border-b border-white/15 px-4 py-4 text-center">
          <p className="text-sm font-black tracking-[0.12em] text-sky-200">
            {APP_SYSTEM_LABEL}
          </p>
          <p className="text-lg font-black tracking-tight">{APP_NAME}</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {SHOW_DASHBOARD ? (
            <Link href="/" className={navItemClass(pathname === "/")}>
              <LayoutDashboard className="h-4 w-4 shrink-0" />
              Dashboard
            </Link>
          ) : null}
          <Link
            href="/du-an"
            className={navItemClass(
              pathname.startsWith("/du-an") || pathname.startsWith("/nhap-du-an")
            )}
          >
            <FolderKanban className="h-4 w-4 shrink-0" />
            Dự án
          </Link>
          <Link
            href="/tai-chinh"
            className={navItemClass(
              pathname.startsWith("/tai-chinh") && !pathname.startsWith("/tai-chinh-noi-bo")
            )}
          >
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

          {showViewAsEntry ? (
            <div className="mt-2 border-t border-white/15 pt-2">
              <button
                type="button"
                onClick={() => setViewAsMenuOpen((prev) => !prev)}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
                  viewAsActive
                    ? "bg-amber-400/95 text-amber-950 shadow-sm"
                    : "text-amber-100 hover:bg-white/10 hover:text-white"
                }`}
                aria-expanded={viewAsMenuOpen}
                title="Xem với quyền (persona test)"
              >
                <Eye className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-left">
                  {viewAsActive && viewAsMeta?.target_ho_ten
                    ? viewAsMeta.target_ho_ten
                    : "Xem với quyền"}
                </span>
                <span className={`text-[10px] ${viewAsMenuOpen ? "rotate-90" : ""}`}>▶</span>
              </button>
              {viewAsMenuOpen ? (
                <div className="ml-2 mt-1 space-y-0.5 border-l border-amber-300/50 pl-2">
                  {VIEW_AS_ROLE_PRESETS.map((preset) => {
                    const active =
                      viewAsActive && viewAsMeta?.target_id === preset.user_id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        disabled={viewAsSwitching}
                        onClick={() => handlePickViewAsPreset(preset)}
                        className={`flex w-full items-start gap-1.5 rounded-lg px-2 py-1.5 text-left text-[12px] font-semibold transition disabled:opacity-50 ${
                          active
                            ? "bg-amber-300/90 text-amber-950"
                            : "text-sky-100 hover:bg-white/10 hover:text-white"
                        }`}
                        title={preset.mo_ta}
                      >
                        <span className="mt-0.5 shrink-0">{active ? "●" : "○"}</span>
                        <span className="min-w-0">
                          <span className="block leading-tight">{preset.ho_ten}</span>
                          <span className="block text-[10px] font-medium leading-tight opacity-80">
                            {roleLabel(preset.phan_quyen)}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                  {viewAsActive ? (
                    <button
                      type="button"
                      disabled={viewAsExiting || viewAsSwitching}
                      onClick={handleExitViewAs}
                      className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[12px] font-bold text-rose-200 hover:bg-rose-500/30 disabled:opacity-50"
                    >
                      ↩ Thoát chế độ xem
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </nav>
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
                {viewAsActive ? " · xem quyền" : ""}
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
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {viewAsActive ? (
          <ViewAsPermissionBanner onExit={handleExitViewAs} exiting={viewAsExiting} />
        ) : null}
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
