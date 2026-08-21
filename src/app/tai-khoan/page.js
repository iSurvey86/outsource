"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { loadAuthSession, userMustChangePassword } from "../../lib/authSession";
import {
  forceReLoginAfterPasswordChange,
  validatePasswordChange,
} from "../../lib/userAccount";
import { logActivity } from "../../lib/store";
import { toUserFacingError } from "../../lib/publicErrors";

export default function TaiKhoanPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [err, setErr] = useState("");

  useEffect(() => {
    const { user: u } = loadAuthSession();
    if (!u) {
      router.replace("/login");
      return;
    }
    setUser(u);
  }, [router]);

  if (!user) {
    return <p className="text-sm font-bold text-teal-800">Đang tải…</p>;
  }

  const mustChange = userMustChangePassword(user);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    const check = validatePasswordChange({
      currentPassword: form.current,
      newPassword: form.next,
      confirmPassword: form.confirm,
      requireCurrent: true,
    });
    if (!check.ok) {
      setErr(check.message);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          username: user.username,
          currentPassword: form.current,
          newPassword: form.next,
          confirmPassword: form.confirm,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data?.ok) {
        setErr(toUserFacingError(data?.error || "Không đổi được mật khẩu."));
        setSaving(false);
        return;
      }

      try {
        await logActivity({
          username: user.username,
          ho_ten: user.ho_ten,
          phan_he: "auth",
          hanh_dong: "DOI_MAT_KHAU",
          chi_tiet: mustChange ? "Đổi mật khẩu lần đầu" : "Đổi mật khẩu",
        });
      } catch {
        /* ignore log failure */
      }

      forceReLoginAfterPasswordChange(
        "Đổi mật khẩu thành công. Vui lòng đăng nhập lại bằng mật khẩu mới."
      );
    } catch (ex) {
      setErr(toUserFacingError(ex));
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <header>
        <h1 className="text-2xl font-black text-blue-950">Tài khoản</h1>
        <p className="mt-1 text-sm font-medium text-teal-800">
          {user.ho_ten} · {user.username}
        </p>
        {mustChange ? (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950">
            Đây là lần đăng nhập đầu (hoặc mật khẩu vừa được quản trị đặt lại). Vui lòng đặt mật
            khẩu mới trước khi tiếp tục làm việc.
          </div>
        ) : null}
      </header>

      <section className="rounded-2xl border border-sky-200 bg-white p-5 shadow-sm shadow-sky-100">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-teal-700" />
          <h2 className="text-sm font-black uppercase tracking-wide text-blue-900">
            {mustChange ? "Đặt mật khẩu mới" : "Đổi mật khẩu"}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-blue-900">Mật khẩu hiện tại</label>
            <input
              type="password"
              autoComplete="current-password"
              className="w-full rounded-xl border border-sky-300 bg-sky-50 px-3 py-2.5 text-sm font-medium text-blue-950 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
              value={form.current}
              onChange={(e) => setForm({ ...form, current: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-blue-900">Mật khẩu mới</label>
            <input
              type="password"
              autoComplete="new-password"
              className="w-full rounded-xl border border-sky-300 bg-sky-50 px-3 py-2.5 text-sm font-medium text-blue-950 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
              value={form.next}
              onChange={(e) => setForm({ ...form, next: e.target.value })}
            />
            <p className="mt-1 text-[11px] font-medium text-teal-700">Tối thiểu 6 ký tự.</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-blue-900">Xác nhận mật khẩu mới</label>
            <input
              type="password"
              autoComplete="new-password"
              className="w-full rounded-xl border border-sky-300 bg-sky-50 px-3 py-2.5 text-sm font-medium text-blue-950 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            />
          </div>

          {err ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
              {err}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-teal-600 py-2.5 text-sm font-black text-white shadow-md shadow-teal-300/40 disabled:opacity-60"
          >
            {saving ? "Đang lưu…" : mustChange ? "Lưu mật khẩu mới" : "Đổi mật khẩu"}
          </button>
          {!mustChange ? (
            <p className="text-center text-[11px] font-medium text-teal-700">
              Sau khi đổi, hệ thống sẽ đăng xuất — đăng nhập lại bằng mật khẩu mới.
            </p>
          ) : null}
        </form>
      </section>
    </div>
  );
}
