"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadAuthSession } from "../../lib/authSession";
import { canSuaDuAn } from "../../lib/menuAccess";
import {
  DEFAULT_TY_LE_BEN_B,
  DEFAULT_TY_LE_TAM_UNG,
  formatVnd,
  giaTriBenB,
} from "../../lib/finance";
import { fetchDb, logActivity, createDuAnBundle, uid } from "../../lib/store";
import { PipelineChip } from "../../components/StatusChip";

export default function DuAnListPage() {
  const [db, setDb] = useState(null);
  const [user, setUser] = useState(null);
  const [perms, setPerms] = useState(null);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    ma_du_an: "",
    ten: "",
    ben_a_user_id: "",
    chu_dau_tu: "",
    quy_mo: "",
    dia_diem: "",
    giai_doan: "BCNCKT",
    gia_tri_tu_van: "",
    nguon_gia_tri: "padt_tam_tinh",
  });

  async function reload() {
    setDb(await fetchDb());
  }

  useEffect(() => {
    const { user: u, perms: p } = loadAuthSession();
    setUser(u);
    setPerms(p);
    reload().catch(console.error);
  }, []);

  if (!db) return <p className="text-sm font-bold text-teal-800">Đang tải…</p>;

  const filtered = db.duAn.filter((d) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (
      d.ma_du_an.toLowerCase().includes(s) ||
      d.ten.toLowerCase().includes(s) ||
      (d.chu_dau_tu || "").toLowerCase().includes(s)
    );
  });

  async function handleCreate(e) {
    e.preventDefault();
    if (!canSuaDuAn(perms)) return;
    const id = uid("da");
    const duAn = {
      id,
      ma_du_an: form.ma_du_an.trim(),
      ten: form.ten.trim(),
      ben_a_user_id: form.ben_a_user_id || null,
      phu_trach_id: user.id,
      chu_dau_tu: form.chu_dau_tu.trim(),
      quy_mo: form.quy_mo.trim(),
      dia_diem: form.dia_diem.trim(),
      giai_doan: form.giai_doan,
      trang_thai: "moi",
      nguon_gia_tri: form.nguon_gia_tri,
      gia_tri_tu_van: Number(form.gia_tri_tu_van) || 0,
      ty_le_ben_b: DEFAULT_TY_LE_BEN_B,
      ty_le_tam_ung: DEFAULT_TY_LE_TAM_UNG,
      mo_ta: "",
      ngay_bat_dau: new Date().toISOString().slice(0, 10),
      ngay_ket_thuc_dk: null,
    };
    const mocList = [
      {
        id: uid("m"),
        du_an_id: id,
        ma: "trien_khai",
        ten: "Triển khai",
        thu_tu: 1,
        trang_thai: "chua_lam",
        han: null,
      },
      {
        id: uid("m"),
        du_an_id: id,
        ma: "giao_tuyen",
        ten: "Giao tuyến",
        thu_tu: 2,
        trang_thai: "chua_lam",
        han: null,
      },
    ];
    const ksList = ["nvks", "paktks", "bcks", "nghiem_thu", "nhat_ky"].map((loai) => ({
      id: uid("ks"),
      du_an_id: id,
      loai,
      trang_thai: "chua_lam",
    }));
    try {
      await createDuAnBundle({ duAn, mocList, ksList });
      await logActivity({
        username: user.username,
        ho_ten: user.ho_ten,
        phan_he: "du_an",
        hanh_dong: "TAO",
        chi_tiet: form.ma_du_an,
      });
      setShowForm(false);
      await reload();
    } catch (err) {
      alert(err.message || "Lỗi tạo dự án");
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-blue-950">Quản lý dự án</h1>
          <p className="mt-1 text-sm font-medium text-teal-800">
            Danh mục dự án ngoài — mở workspace theo mã
          </p>
        </div>
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm mã / tên / CĐT…"
            className="rounded-xl border border-sky-300 bg-white px-3 py-2 text-sm font-medium text-blue-950"
          />
          {canSuaDuAn(perms) ? (
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="rounded-xl bg-gradient-to-r from-blue-600 to-teal-600 px-4 py-2 text-sm font-black text-white"
            >
              {showForm ? "Đóng" : "Thêm DA"}
            </button>
          ) : null}
        </div>
      </header>

      {showForm ? (
        <form
          onSubmit={handleCreate}
          className="grid gap-3 rounded-2xl border border-teal-200 bg-white p-5 sm:grid-cols-2"
        >
          <Field label="Mã DA" required value={form.ma_du_an} onChange={(v) => setForm({ ...form, ma_du_an: v })} />
          <Field label="Tên DA" required value={form.ten} onChange={(v) => setForm({ ...form, ten: v })} />
          <label className="text-xs font-bold text-blue-900">
            Bên A (user)
            <select
              className="mt-1 w-full rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-blue-950"
              value={form.ben_a_user_id}
              onChange={(e) => setForm({ ...form, ben_a_user_id: e.target.value })}
            >
              <option value="">— Chọn —</option>
              {db.users
                .filter((u) => u.phe === "ben_a" && u.trang_thai === "active")
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.ho_ten} ({u.username})
                  </option>
                ))}
            </select>
          </label>
          <Field label="Chủ đầu tư" value={form.chu_dau_tu} onChange={(v) => setForm({ ...form, chu_dau_tu: v })} />
          <Field label="Quy mô" value={form.quy_mo} onChange={(v) => setForm({ ...form, quy_mo: v })} />
          <Field label="Địa điểm" value={form.dia_diem} onChange={(v) => setForm({ ...form, dia_diem: v })} />
          <Field
            label="GT tư vấn (₫)"
            value={form.gia_tri_tu_van}
            onChange={(v) => setForm({ ...form, gia_tri_tu_van: v })}
          />
          <label className="text-xs font-bold text-blue-900">
            Nguồn GT
            <select
              className="mt-1 w-full rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-blue-950"
              value={form.nguon_gia_tri}
              onChange={(e) => setForm({ ...form, nguon_gia_tri: e.target.value })}
            >
              <option value="padt_tam_tinh">Tạm tính PAĐT</option>
              <option value="hop_dong">Hợp đồng tư vấn</option>
            </select>
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-blue-600 to-teal-600 px-5 py-2.5 text-sm font-black text-white"
            >
              Lưu dự án
            </button>
          </div>
        </form>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-sky-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-sky-100 text-xs font-black uppercase text-blue-900">
            <tr>
              <th className="px-4 py-3">Mã</th>
              <th className="px-4 py-3">Tên / CĐT</th>
              <th className="px-4 py-3">Phần B</th>
              <th className="px-4 py-3">TT</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.id} className="border-t border-sky-100 hover:bg-sky-50/80">
                <td className="px-4 py-3">
                  <Link
                    href={`/du-an/${encodeURIComponent(d.ma_du_an)}`}
                    className="font-black text-blue-700 hover:text-teal-700"
                  >
                    {d.ma_du_an}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <p className="font-bold text-blue-950">{d.ten}</p>
                  <p className="text-xs font-medium text-teal-800">{d.chu_dau_tu || "—"}</p>
                </td>
                <td className="px-4 py-3 font-bold tabular-nums text-teal-900">
                  {formatVnd(giaTriBenB(d))}
                </td>
                <td className="px-4 py-3">
                  <PipelineChip status={d.trang_thai} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, required }) {
  return (
    <label className="text-xs font-bold text-blue-900">
      {label}
      <input
        required={required}
        className="mt-1 w-full rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-blue-950"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
