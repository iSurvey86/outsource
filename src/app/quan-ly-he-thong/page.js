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
  deleteWhere,
  uid,
  SEED_ROLES,
  hasSupabase,
} from "../../lib/store";
import { useAppDialog } from "../../components/AppDialog";
import NhatKyHoatDongPanel from "../../components/quanLyHeThong/NhatKyHoatDongPanel";
import {
  labelPhe,
  labelVaiTro,
  presenceKey,
  subscribeOnlineUsers,
} from "../../lib/onlinePresence";

const emptyForm = () => ({
  username: "",
  mat_khau: "",
  ho_ten: "",
  phe: "ben_b",
  phan_quyen: "member",
});

export default function QuanLyHeThongPage() {
  const router = useRouter();
  const { showAlert, showConfirm } = useAppDialog();
  const [tab, setTab] = useState("nhat_ky");
  const [db, setDb] = useState(null);
  const [user, setUser] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({
    ho_ten: "",
    mat_khau: "",
    phe: "ben_b",
    phan_quyen: "member",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(() => new Set());

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

  useEffect(() => {
    return subscribeOnlineUsers(setOnlineUsers);
  }, []);

  if (!db || !user) return <p className="text-sm font-bold text-teal-800">Đang tải…</p>;

  async function createUser(e) {
    e.preventDefault();
    const uname = form.username.trim().toLowerCase().replace(/\s/g, "");
    if (!uname) return;
    if (db.users.some((u) => u.username === uname)) {
      await showAlert("User đã tồn tại.");
      return;
    }
    setCreating(true);
    try {
      await insertRow("nguoi_dung", {
        id: uid("u"),
        username: uname,
        mat_khau: form.mat_khau,
        ho_ten: form.ho_ten.trim(),
        phe: form.phe,
        phan_quyen: form.phe === "ben_a" ? "ben_a_viewer" : form.phan_quyen,
        trang_thai: "active",
        bat_doi_mk: 1,
      });
      await logActivity({
        username: user.username,
        ho_ten: user.ho_ten,
        phan_he: "qlht",
        hanh_dong: "TAO_USER",
        chi_tiet: uname,
      });
      setForm(emptyForm());
      setCreateOpen(false);
      await reload();
    } catch (err) {
      await showAlert(err.message || "Lỗi tạo user");
    } finally {
      setCreating(false);
    }
  }

  function openEdit(u) {
    setEditUser(u);
    setEditForm({
      ho_ten: u.ho_ten || "",
      mat_khau: "",
      phe: u.phe || "ben_b",
      phan_quyen: u.phan_quyen || "member",
    });
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editUser) return;
    const hoTen = editForm.ho_ten.trim();
    if (!hoTen) {
      await showAlert("Họ tên không được để trống.");
      return;
    }
    setSavingEdit(true);
    try {
      const patch = {
        ho_ten: hoTen,
        phe: editForm.phe,
        phan_quyen: editForm.phe === "ben_a" ? "ben_a_viewer" : editForm.phan_quyen,
      };
      if (editForm.mat_khau.trim()) {
        patch.mat_khau = editForm.mat_khau.trim();
        patch.bat_doi_mk = 1;
      }
      await updateRow("nguoi_dung", editUser.id, patch);
      await logActivity({
        username: user.username,
        ho_ten: user.ho_ten,
        phan_he: "qlht",
        hanh_dong: "SUA_USER",
        chi_tiet: editUser.username,
      });
      setEditUser(null);
      await reload();
    } catch (err) {
      await showAlert(err.message || "Lỗi cập nhật tài khoản");
    } finally {
      setSavingEdit(false);
    }
  }

  async function deleteUser(u) {
    if (!u || u.id === user.id) {
      await showAlert("Không thể xóa tài khoản đang đăng nhập.");
      return;
    }
    const ok = await showConfirm(
      `Xóa tài khoản «${u.username}» (${u.ho_ten})?\nThao tác không hoàn tác.`
    );
    if (!ok) return;
    try {
      await deleteWhere("nguoi_dung", "id", u.id);
      await logActivity({
        username: user.username,
        ho_ten: user.ho_ten,
        phan_he: "qlht",
        hanh_dong: "XOA_USER",
        chi_tiet: u.username,
      });
      await reload();
    } catch (err) {
      await showAlert(err.message || "Lỗi xóa tài khoản");
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
      await showAlert(err.message || "Lỗi cập nhật");
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-800">Quản lý hệ thống</h1>
          <p className="mt-1 text-xs font-medium text-gray-500">
            Giám sát hoạt động và quản trị tài khoản người dùng
          </p>
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
        ) : null}
      </header>

      <div className="flex gap-2 rounded-xl bg-slate-100 p-1">
        <TabBtn active={tab === "nhat_ky"} onClick={() => setTab("nhat_ky")} tone="indigo">
          Nhật ký hoạt động
        </TabBtn>
        <TabBtn active={tab === "tai_khoan"} onClick={() => setTab("tai_khoan")} tone="emerald">
          Danh sách tài khoản
        </TabBtn>
      </div>

      {tab === "nhat_ky" ? (
        <NhatKyHoatDongPanel currentUser={user} />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-600">
              {db.users.length} tài khoản
            </p>
            <button
              type="button"
              onClick={() => {
                setForm(emptyForm());
                setCreateOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-teal-600 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:from-blue-700 hover:to-teal-700"
            >
              <span className="text-base leading-none">+</span>
              Thêm tài khoản
            </button>
          </div>

          <div className="min-w-0 overflow-hidden rounded-2xl border border-sky-200 bg-white">
            {/* Mobile — thẻ tài khoản */}
            <div className="space-y-3 p-3 md:hidden">
              {db.users.map((u) => {
                const isSelf = u.id === user.id;
                const isOnline = onlineUsers.has(presenceKey(u));
                const isLocked = u.trang_thai === "locked";
                return (
                  <article
                    key={u.id}
                    className="rounded-xl border border-sky-100 bg-sky-50/40 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-blue-950">{u.ho_ten}</p>
                        <p className="text-sm font-medium text-teal-900">{u.username}</p>
                        <p className="mt-1 text-xs font-semibold text-blue-800">
                          {labelPhe(u.phe)} · {labelVaiTro(u.phan_quyen)}
                        </p>
                      </div>
                      <div className="shrink-0 text-center">
                        {isOnline ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-700">
                            <span className="h-2 w-2 rounded-full bg-green-500" />
                            Online
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-500">
                            <span className="h-2 w-2 rounded-full bg-gray-400" />
                            Offline
                          </span>
                        )}
                        {isLocked ? (
                          <p className="mt-0.5 text-[10px] font-semibold text-rose-600">Đã khóa</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-md bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100"
                        onClick={() => openEdit(u)}
                      >
                        Sửa
                      </button>
                      {!isSelf ? (
                        <>
                          <button
                            type="button"
                            className="rounded-md bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                            onClick={() => toggleLock(u.id)}
                          >
                            {isLocked ? "Mở" : "Khóa"}
                          </button>
                          <button
                            type="button"
                            className="rounded-md bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
                            onClick={() => deleteUser(u)}
                          >
                            Xóa
                          </button>
                        </>
                      ) : (
                        <span className="self-center text-[10px] font-semibold text-gray-400">Tài khoản của bạn</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Desktop — bảng */}
            <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-sky-100 text-xs font-black uppercase text-blue-900">
                <tr>
                  <th className="px-3 py-2">Họ tên</th>
                  <th className="px-3 py-2">Tên tài khoản</th>
                  <th className="px-3 py-2">Bên</th>
                  <th className="px-3 py-2">Vai trò</th>
                  <th className="px-3 py-2 text-center">Trạng thái</th>
                  <th className="px-3 py-2 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {db.users.map((u) => {
                  const isSelf = u.id === user.id;
                  const isOnline = onlineUsers.has(presenceKey(u));
                  const isLocked = u.trang_thai === "locked";
                  return (
                    <tr key={u.id} className="border-t border-sky-100">
                      <td className="px-3 py-2 font-bold text-blue-950">{u.ho_ten}</td>
                      <td className="px-3 py-2 font-medium text-teal-900">{u.username}</td>
                      <td className="px-3 py-2 font-bold text-teal-800">{labelPhe(u.phe)}</td>
                      <td className="px-3 py-2 font-medium text-blue-800">
                        {labelVaiTro(u.phan_quyen)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="inline-flex flex-col items-center gap-0.5">
                          {isOnline ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-green-700">
                              <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                              </span>
                              Online
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-gray-500">
                              <span className="h-2 w-2 rounded-full bg-gray-400" />
                              Offline
                            </span>
                          )}
                          {isLocked ? (
                            <span className="text-[10px] font-semibold text-rose-600">Đã khóa</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          <button
                            type="button"
                            className="rounded-md bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800 hover:bg-amber-100"
                            onClick={() => openEdit(u)}
                          >
                            Sửa
                          </button>
                          {!isSelf ? (
                            <>
                              <button
                                type="button"
                                className="rounded-md bg-slate-50 px-2 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
                                onClick={() => toggleLock(u.id)}
                              >
                                {isLocked ? "Mở" : "Khóa"}
                              </button>
                              <button
                                type="button"
                                className="rounded-md bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100"
                                onClick={() => deleteUser(u)}
                              >
                                Xóa
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] font-semibold text-gray-400">Bạn</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <form
            onSubmit={createUser}
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 bg-emerald-50 px-5 py-3">
              <h3 className="text-sm font-black uppercase text-emerald-900">Thêm tài khoản</h3>
              <button
                type="button"
                disabled={creating}
                onClick={() => setCreateOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 p-5">
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-400">
                  Tên tài khoản
                </label>
                <input
                  required
                  placeholder="vd: phuongdm"
                  className="mt-1 w-full rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-blue-950"
                  value={form.username}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      username: e.target.value.replace(/\s/g, "").toLowerCase(),
                    })
                  }
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-teal-700">Mật khẩu tạm</label>
                <input
                  required
                  type="password"
                  autoComplete="new-password"
                  className="mt-1 w-full rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-blue-950"
                  value={form.mat_khau}
                  onChange={(e) => setForm({ ...form, mat_khau: e.target.value })}
                  placeholder="User phải đổi khi đăng nhập lần đầu"
                />
                <p className="mt-1 text-[10px] font-medium text-teal-700">
                  Đăng nhập lần đầu sẽ bắt buộc đổi mật khẩu.
                </p>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-400">Họ tên</label>
                <input
                  required
                  className="mt-1 w-full rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-blue-950"
                  value={form.ho_ten}
                  onChange={(e) => setForm({ ...form, ho_ten: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-gray-400">Bên</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-blue-950"
                    value={form.phe}
                    onChange={(e) => setForm({ ...form, phe: e.target.value })}
                  >
                    <option value="ben_b">Bên B</option>
                    <option value="ben_a">Bên A</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-gray-400">Vai trò</label>
                  {form.phe === "ben_b" ? (
                    <select
                      className="mt-1 w-full rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-blue-950"
                      value={form.phan_quyen}
                      onChange={(e) => setForm({ ...form, phan_quyen: e.target.value })}
                    >
                      {Object.keys(SEED_ROLES)
                        .filter((k) => k !== "ben_a_viewer")
                        .map((k) => (
                          <option key={k} value={k}>
                            {labelVaiTro(k)}
                          </option>
                        ))}
                    </select>
                  ) : (
                    <p className="mt-1 rounded-xl bg-sky-50 px-3 py-2 text-sm font-medium text-teal-800">
                      Bên A (xem)
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
              <button
                type="button"
                disabled={creating}
                onClick={() => setCreateOpen(false)}
                className="rounded-lg px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={creating}
                className="rounded-lg bg-gradient-to-r from-blue-600 to-teal-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {creating ? "Đang tạo…" : "Tạo tài khoản"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {editUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <form
            onSubmit={saveEdit}
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 bg-amber-50 px-5 py-3">
              <h3 className="text-sm font-black uppercase text-amber-900">Sửa tài khoản</h3>
              <button
                type="button"
                disabled={savingEdit}
                onClick={() => setEditUser(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 p-5">
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-400">
                  Tên tài khoản
                </label>
                <p className="mt-1 rounded-lg bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
                  {editUser.username}
                </p>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-400">Họ tên</label>
                <input
                  required
                  className="mt-1 w-full rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-blue-950"
                  value={editForm.ho_ten}
                  onChange={(e) => setEditForm({ ...editForm, ho_ten: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-teal-700">
                  Mật khẩu mới (để trống = giữ nguyên)
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  className="mt-1 w-full rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-blue-950"
                  value={editForm.mat_khau}
                  onChange={(e) => setEditForm({ ...editForm, mat_khau: e.target.value })}
                />
                <p className="mt-1 text-[10px] font-medium text-teal-700">
                  Nếu đặt lại: user phải đổi mật khẩu ở lần đăng nhập kế tiếp.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-gray-400">Bên</label>
                  <select
                    className="mt-1 w-full rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-blue-950"
                    value={editForm.phe}
                    onChange={(e) => setEditForm({ ...editForm, phe: e.target.value })}
                  >
                    <option value="ben_b">Bên B</option>
                    <option value="ben_a">Bên A</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-gray-400">Vai trò</label>
                  {editForm.phe === "ben_b" ? (
                    <select
                      className="mt-1 w-full rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-blue-950"
                      value={editForm.phan_quyen}
                      onChange={(e) => setEditForm({ ...editForm, phan_quyen: e.target.value })}
                    >
                      {Object.keys(SEED_ROLES)
                        .filter((k) => k !== "ben_a_viewer")
                        .map((k) => (
                          <option key={k} value={k}>
                            {labelVaiTro(k)}
                          </option>
                        ))}
                    </select>
                  ) : (
                    <p className="mt-1 rounded-xl bg-sky-50 px-3 py-2 text-sm font-medium text-teal-800">
                      Bên A (xem)
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
              <button
                type="button"
                disabled={savingEdit}
                onClick={() => setEditUser(null)}
                className="rounded-lg px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {savingEdit ? "Đang lưu…" : "Lưu"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function TabBtn({ active, onClick, children, tone = "indigo" }) {
  const activeCls =
    tone === "emerald"
      ? "bg-emerald-600 text-white shadow-md"
      : "bg-indigo-600 text-white shadow-md";
  const idleCls =
    tone === "emerald"
      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
      : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold transition-all ${
        active ? activeCls : idleCls
      }`}
    >
      {children}
    </button>
  );
}
