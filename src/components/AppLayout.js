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
  KeyRound,
  Menu,
  Pin,
  PinOff,
} from "lucide-react";
import {
  APP_NAME,
  APP_SYSTEM_LABEL,
  POST_LOGIN_ROUTE,
  SHOW_DASHBOARD,
} from "../lib/brand";
import { loadAuthSession, setAuthSession, userMustChangePassword } from "../lib/authSession";
import {
  canSeeChiaNoiBo,
  canSeeQlht,
  canSeeTaiChinhAb,
  checkPathAccess,
} from "../lib/menuAccess";
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
import LoginScreen from "./LoginScreen";
import { loginUserFacingError } from "../lib/publicErrors";
import { useAppSidebar } from "../hooks/useAppSidebar";

const navItemClass = (active, collapsed = false) =>
  `flex items-center rounded-xl text-sm font-semibold transition ${
    collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5"
  } ${
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
  const [loginNotice, setLoginNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [viewAsMenuOpen, setViewAsMenuOpen] = useState(false);
  const [viewAsActive, setViewAsActive] = useState(false);
  const [viewAsSwitching, setViewAsSwitching] = useState(false);
  const [viewAsExiting, setViewAsExiting] = useState(false);
  const sidebar = useAppSidebar();

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
    try {
      const notice = sessionStorage.getItem("outsrc_login_notice");
      if (notice) {
        sessionStorage.removeItem("outsrc_login_notice");
        setLoginNotice(notice);
      }
    } catch {
      /* ignore */
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
      if (userMustChangePassword(user)) {
        router.replace("/tai-khoan");
      } else {
        router.replace(POST_LOGIN_ROUTE);
      }
      return;
    }
    if (user && userMustChangePassword(user) && pathname !== "/tai-khoan") {
      router.replace("/tai-khoan");
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
    sidebar.closeMobile();
  }, [pathname, sidebar.closeMobile]);

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
        setLoginError(loginUserFacingError(res.error || "Đăng nhập thất bại."));
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
      router.replace(userMustChangePassword(res.user) ? "/tai-khoan" : POST_LOGIN_ROUTE);
    } catch (err) {
      setLoginError(loginUserFacingError(err));
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
      <LoginScreen
        username={username}
        setUsername={setUsername}
        password={password}
        setPassword={setPassword}
        showPw={showPw}
        setShowPw={setShowPw}
        loginError={loginError}
        loginNotice={loginNotice}
        busy={busy}
        onSubmit={handleLogin}
      />
    );
  }

  const showTaiChinhAb = canSeeTaiChinhAb(user, perms);
  const showChia = canSeeChiaNoiBo(user, perms);
  const showQlht = canSeeQlht(user, perms);
  const showViewAsEntry = canUseViewAsPermission();
  const viewAsMeta = viewAsActive ? getViewAsMeta() : null;
  const mustChangePw = userMustChangePassword(user);
  const { isMobile, mobileOpen, pinned, collapsed, togglePin, openMobile, closeMobile } = sidebar;

  const navLink = (href, active, icon, label) => (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      onClick={isMobile ? closeMobile : undefined}
      className={navItemClass(active, collapsed)}
    >
      {icon}
      {!collapsed ? <span className="truncate">{label}</span> : null}
    </Link>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-sky-50 via-teal-50/80 to-emerald-50">
      {isMobile && mobileOpen ? (
        <button
          type="button"
          aria-label="Đóng menu"
          className="fixed inset-0 z-40 bg-slate-900/45 lg:hidden"
          onClick={closeMobile}
        />
      ) : null}

      <aside
        className={`flex h-full shrink-0 flex-col overflow-y-auto bg-gradient-to-b from-blue-800 via-blue-700 to-teal-700 text-white shadow-xl shadow-blue-300/40 transition-[transform,width] duration-200 ease-out max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:w-56 ${
          mobileOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full"
        } lg:static lg:translate-x-0 ${collapsed ? "lg:w-[4.5rem]" : "lg:w-56"}`}
      >
        <div
          className={`relative shrink-0 border-b border-white/15 ${
            collapsed ? "px-2 py-3 text-center" : "px-4 py-4 text-center"
          }`}
        >
          {!isMobile ? (
            <button
              type="button"
              onClick={togglePin}
              title={pinned ? "Bỏ ghim — thu gọn sidebar" : "Ghim sidebar — luôn mở rộng"}
              className={`absolute right-1.5 top-1.5 inline-flex items-center justify-center rounded-lg p-1.5 transition hover:bg-white/15 ${
                pinned ? "text-amber-200" : "text-sky-200"
              }`}
              aria-pressed={pinned}
            >
              {pinned ? (
                <Pin className="h-4 w-4 rotate-[38deg] transition-transform duration-200" />
              ) : (
                <PinOff className="h-4 w-4 -rotate-[18deg] transition-transform duration-200" />
              )}
            </button>
          ) : null}
          {!collapsed ? (
            <>
              <p className="text-sm font-black tracking-[0.12em] text-sky-200">
                {APP_SYSTEM_LABEL}
              </p>
              <p className="text-lg font-black tracking-tight">{APP_NAME}</p>
            </>
          ) : (
            <p className="text-sm font-black tracking-tight">{APP_NAME.slice(0, 1)}</p>
          )}
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {mustChangePw ? (
            navLink(
              "/tai-khoan",
              pathname.startsWith("/tai-khoan"),
              <KeyRound className="h-4 w-4 shrink-0" />,
              "Đặt mật khẩu mới"
            )
          ) : (
            <>
          {SHOW_DASHBOARD
            ? navLink(
                "/",
                pathname === "/",
                <LayoutDashboard className="h-4 w-4 shrink-0" />,
                "Dashboard"
              )
            : null}
          {navLink(
            "/du-an",
            pathname.startsWith("/du-an") || pathname.startsWith("/nhap-du-an"),
            <FolderKanban className="h-4 w-4 shrink-0" />,
            "Dự án"
          )}
          {showTaiChinhAb
            ? navLink(
                "/tai-chinh",
                pathname.startsWith("/tai-chinh") && !pathname.startsWith("/tai-chinh-noi-bo"),
                <Wallet className="h-4 w-4 shrink-0" />,
                "Tài chính A↔B"
              )
            : null}
          {showChia
            ? navLink(
                "/tai-chinh-noi-bo",
                pathname.startsWith("/tai-chinh-noi-bo"),
                <PieChart className="h-4 w-4 shrink-0" />,
                "Tài chính nội bộ"
              )
            : null}
          {showQlht
            ? navLink(
                "/quan-ly-he-thong",
                pathname.startsWith("/quan-ly-he-thong"),
                <Settings className="h-4 w-4 shrink-0" />,
                "Quản trị HT"
              )
            : null}

          {showViewAsEntry && !collapsed ? (
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
            </>
          )}
        </nav>
        <div className="shrink-0 border-t border-white/15">
          <div
            className={`flex items-center py-3 ${collapsed ? "justify-center px-2" : "gap-2.5 px-3"}`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-teal-400 text-xs font-black text-blue-950 shadow-sm">
              {getUserInitials(user.ho_ten)}
            </div>
            {!collapsed ? (
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
            ) : null}
          </div>
          {!collapsed ? (
            <div className="space-y-1.5 px-3 pb-3">
              {!mustChangePw ? (
                <Link
                  href="/tai-khoan"
                  onClick={isMobile ? closeMobile : undefined}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-sky-50 ring-1 ring-white/20 transition hover:bg-white/20"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  Đổi mật khẩu
                </Link>
              ) : null}
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-sky-100 hover:bg-white/10 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
                Đăng xuất
              </button>
            </div>
          ) : (
            <div className="space-y-1.5 px-2 pb-3">
              {!mustChangePw ? (
                <Link
                  href="/tai-khoan"
                  title="Đổi mật khẩu"
                  onClick={isMobile ? closeMobile : undefined}
                  className="flex w-full items-center justify-center rounded-xl bg-white/10 p-2 text-sky-50 ring-1 ring-white/20 transition hover:bg-white/20"
                >
                  <KeyRound className="h-4 w-4" />
                </Link>
              ) : null}
              <button
                type="button"
                title="Đăng xuất"
                onClick={handleLogout}
                className="flex w-full items-center justify-center rounded-xl p-2.5 text-sky-100 hover:bg-white/10 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {isMobile ? (
          <header className="flex shrink-0 items-center gap-2 border-b border-teal-200/80 bg-white/90 px-3 py-2 shadow-sm backdrop-blur-sm lg:hidden">
            <button
              type="button"
              onClick={openMobile}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-blue-900 ring-1 ring-teal-200/80 hover:bg-teal-50"
              aria-label="Mở menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold uppercase tracking-wide text-teal-700">
                {APP_SYSTEM_LABEL}
              </p>
              <p className="truncate text-sm font-black text-blue-950">{APP_NAME}</p>
            </div>
          </header>
        ) : null}
        {viewAsActive ? (
          <ViewAsPermissionBanner onExit={handleExitViewAs} exiting={viewAsExiting} />
        ) : null}
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
