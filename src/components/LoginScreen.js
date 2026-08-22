"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import {
  APP_NAME,
  APP_SYSTEM_LABEL,
  APP_VERSION_LABEL,
  LOGIN_BG_URL,
} from "../lib/brand";

const inputClass =
  "w-full rounded-xl border border-sky-300 bg-sky-50 px-3 py-3 text-sm font-medium text-blue-950 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200";

/**
 * Login — ảnh nền full màn; form card trắng cổ điển (giống bản đầu).
 */
export default function LoginScreen({
  username,
  setUsername,
  password,
  setPassword,
  showPw,
  setShowPw,
  loginError,
  loginNotice,
  busy,
  onSubmit,
}) {
  const [bgOk, setBgOk] = useState(true);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-900">
      <div className="absolute inset-0" aria-hidden>
        {bgOk ? (
          <img
            src={LOGIN_BG_URL}
            alt=""
            className="login-bg-photo h-full w-full object-cover object-center"
            decoding="sync"
            fetchPriority="high"
            onError={() => setBgOk(false)}
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-sky-100 via-teal-50 to-blue-100" />
        )}
        <div className="absolute inset-0 bg-black/15" />
      </div>

      <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
        <form
          onSubmit={onSubmit}
          className="flex w-full max-w-[20rem] flex-col rounded-2xl border border-sky-200 bg-white px-6 py-12 sm:py-14"
        >
          <div className="mb-10 text-center">
            <p className="text-sm font-black tracking-[0.18em] text-teal-600">
              {APP_SYSTEM_LABEL}
            </p>
            <h1 className="mt-1 text-3xl font-black leading-none text-blue-900">{APP_NAME}</h1>
          </div>
          {loginNotice ? (
            <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
              {loginNotice}
            </p>
          ) : null}
          <label className="mb-1.5 block text-xs font-bold text-blue-900">Tài khoản</label>
          <input
            className={`${inputClass} mb-6`}
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/\s/g, "").toLowerCase())}
            autoComplete="username"
          />
          <label className="mb-1.5 block text-xs font-bold text-blue-900">Mật khẩu</label>
          <div className="relative mb-8">
            <input
              type={showPw ? "text" : "password"}
              className={`${inputClass} pr-10`}
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
            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-teal-600 py-3 text-sm font-black text-white shadow-md shadow-teal-300/50 transition hover:from-blue-700 hover:to-teal-700 disabled:opacity-60"
          >
            {busy ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
          <p className="mt-8 text-center text-[11px] font-medium text-blue-700">
            {APP_VERSION_LABEL}
          </p>
        </form>
      </div>
    </div>
  );
}
