"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadAuthSession } from "../../lib/authSession";
import { canSeeQlht } from "../../lib/menuAccess";
import {
  fetchDb,
  logActivity,
  resetDb,
  insertRow,
  updateRow,
  uid,
  SEED_ROLES,
  hasSupabase,
} from "../../lib/store";

export default function QuanLyHeThongPage() {
  const router = useRouter();
  const [tab, setTab] = useState("nhat_ky");
  const [db, setDb] = useState(null);
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({
    username: "",
    mat_khau: "",
    ho_ten: "",
    phe: "ben_b",
    phan_quyen: "member",
  });

  async function reload() {
    setDb(await fetchDb());
  }

  useEffect(() => {
    const { user: u, perms: p } = loadAuthSession();
    setUser(u);
    if (!canSeeQlht(u, p)) {
      router.replace("/");
      return;
    }
    reload().catch(console.error);
  }, [router]);

  if (!db || !user) return <p className="text-sm font-bold text-teal-800">Đang tải…</p>;

  async function createUser(e) {
    e.preventDefault();
    const uname = form.username.trim().toLowerCase().replace(/\s/g, "");
    if (!uname) return;
    if (db.users.some((u) => u.username === uname)) {
      alert("User đã tồn tại.");
      return;
    }
    try {
      await insertRow("nguoi_dung", {
        id: uid("u"),
        username: uname,
        mat_khau: form.mat_khau,
        ho_ten: form.ho_ten.trim(),
        phe: form.phe,
        phan_quyen: form.phe === "ben_a" ? "ben_a_viewer" : form.phan_quyen,
        trang_thai: "active",
      });
      await logActivity({
        username: user.username,
        ho_ten: user.ho_ten,
        phan_he: "qlht",
        hanh_dong: "TAO_USER",
        chi_tiet: uname,
      });
      setForm({ username: "", mat_khau: "", ho_ten: "", phe: "ben_b", phan_quyen: "member" });
      await reload();
    } catch (err) {
      alert(err.message || "Lỗi tạo user");
    }
  }

  async function toggleLock(id) {
    const u = db.users.find((x) => x.id === id);
    if (!u || u.id === user.id) return;
    const next = u.trang_thai === "active" ? "locked" : "active";
    try {
      await updateRow("nguoi_dung", id, { trang_thai: next });
      await logActivity({
        username: user.username,
        ho_ten: user.ho_ten,
        phan_he: "qlht",
        hanh_dong: next === "locked" ? "KHOA_USER" : "MO_USER",
        chi_tiet: u.username,
      });
      await reload();
    } catch (err) {
      alert(err.message || "Lỗi cập nhật");
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-blue-950">Quản trị hệ thống</h1>
          <p className="mt-1 text-sm font-medium text-teal-800">Nhật ký · Tài khoản</p>
        </div>
        {!hasSupabase ? (
          <button
            type="button"
            className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800"
            onClick={async () => {
              if (confirm("Reset toàn bộ dữ liệu demo local?")) {
                await resetDb();
                await reload();
              }
            }}
          >
            Reset demo DB
          </button>
        ) : (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black text-emerald-800">
            Supabase
          </span>
        )}
      </header>

      <div className="flex gap-2 rounded-xl bg-sky-100 p-1">
        <TabBtn active={tab === "nhat_ky"} onClick={() => setTab("nhat_ky")}>
          Nhật ký
        </TabBtn>
        <TabBtn active={tab === "tai_khoan"} onClick={() => setTab("tai_khoan")}>
          Tài khoản
        </TabBtn>
      </div>

      {tab === "nhat_ky" ? (
        <div className="overflow-hidden rounded-2xl border border-sky-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-sky-100 text-xs font-black uppercase text-blue-900">
              <tr>
                <th className="px-3 py-2">Thời gian</th>
                <th className="px-3 py-2">Người</th>
                <th className="px-3 py-2">Phân hệ</th>
                <th className="px-3 py-2">Hành động</th>
                <th className="px-3 py-2">Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {db.lichSu.slice(0, 100).map((l) => (
                <tr key={l.id} className="border-t border-sky-100">
                  <td className="px-3 py-2 text-xs font-medium text-teal-800">
                    {l.thoi_gian?.replace("T", " ").slice(0, 19)}
                  </td>
                  <td className="px-3 py-2 font-bold text-blue-950">{l.ho_ten}</td>
                  <td className="px-3 py-2 font-medium text-teal-900">{l.phan_he}</td>
                  <td className="px-3 py-2 font-bold text-blue-800">{l.hanh_dong}</td>
                  <td className="px-3 py-2 font-medium text-teal-800">{l.chi_tiet}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          <form
            onSubmit={createUser}
            className="grid gap-3 rounded-2xl border border-teal-200 bg-white p-4 sm:grid-cols-3"
          >
            <input
              required
              placeholder="User (vd: phuongdm)"
              className="rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-blue-950"
              value={form.username}
              onChange={(e) =>
                setForm({ ...form, username: e.target.value.replace(/\s/g, "").toLowerCase() })
              }
            />
            <input
              required
              placeholder="Mật khẩu"
              className="rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-blue-950"
              value={form.mat_khau}
              onChange={(e) => setForm({ ...form, mat_khau: e.target.value })}
            />
            <input
              required
              placeholder="Họ tên"
              className="rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-blue-950"
              value={form.ho_ten}
              onChange={(e) => setForm({ ...form, ho_ten: e.target.value })}
            />
            <select
              className="rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-blue-950"
              value={form.phe}
              onChange={(e) => setForm({ ...form, phe: e.target.value })}
            >
              <option value="ben_b">Bên B</option>
              <option value="ben_a">Bên A</option>
            </select>
            {form.phe === "ben_b" ? (
              <select
                className="rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-blue-950"
                value={form.phan_quyen}
                onChange={(e) => setForm({ ...form, phan_quyen: e.target.value })}
              >
                {Object.keys(SEED_ROLES)
                  .filter((k) => k !== "ben_a_viewer")
                  .map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
              </select>
            ) : (
              <div className="rounded-xl bg-sky-50 px-3 py-2 text-sm font-medium text-teal-800">
                Role: ben_a_viewer
              </div>
            )}
            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-blue-600 to-teal-600 px-4 py-2 text-sm font-black text-white"
            >
              Tạo tài khoản
            </button>
          </form>

          <div className="overflow-hidden rounded-2xl border border-sky-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-sky-100 text-xs font-black uppercase text-blue-900">
                <tr>
                  <th className="px-3 py-2">Họ tên</th>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Phe</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">TT</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {db.users.map((u) => (
                  <tr key={u.id} className="border-t border-sky-100">
                    <td className="px-3 py-2 font-bold text-blue-950">{u.ho_ten}</td>
                    <td className="px-3 py-2 font-medium text-teal-900">{u.username}</td>
                    <td className="px-3 py-2 font-bold text-teal-800">{u.phe}</td>
                    <td className="px-3 py-2 font-medium text-blue-800">{u.phan_quyen}</td>
                    <td className="px-3 py-2 font-bold text-emerald-800">{u.trang_thai}</td>
                    <td className="px-3 py-2">
                      {u.id !== user.id ? (
                        <button
                          type="button"
                          className="text-xs font-bold text-rose-700 hover:underline"
                          onClick={() => toggleLock(u.id)}
                        >
                          {u.trang_thai === "active" ? "Khóa" : "Mở"}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg px-3 py-2 text-sm font-black transition ${
        active
          ? "bg-white text-blue-900 shadow-sm"
          : "text-teal-800 hover:bg-white/60"
      }`}
    >
      {children}
    </button>
  );
}
