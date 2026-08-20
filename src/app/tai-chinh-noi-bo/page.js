"use client";

import { useEffect, useState } from "react";
import { loadAuthSession } from "../../lib/authSession";
import { canSuaChiaNoiBo, canSeeChiaNoiBo } from "../../lib/menuAccess";
import { formatPct, formatVnd, giaTriBenB } from "../../lib/finance";
import { fetchDb, logActivity, replaceChiaNoiBo, uid } from "../../lib/store";
import { useRouter } from "next/navigation";

export default function TaiChinhNoiBoPage() {
  const router = useRouter();
  const [db, setDb] = useState(null);
  const [user, setUser] = useState(null);
  const [perms, setPerms] = useState(null);
  const [duAnId, setDuAnId] = useState("");
  const [drafts, setDrafts] = useState([]);

  useEffect(() => {
    const { user: u, perms: p } = loadAuthSession();
    setUser(u);
    setPerms(p);
    if (!canSeeChiaNoiBo(u, p)) {
      router.replace("/");
      return;
    }
    fetchDb().then((data) => {
      setDb(data);
      if (data.duAn[0]) setDuAnId(data.duAn[0].id);
    });
  }, [router]);

  useEffect(() => {
    if (!db || !duAnId) return;
    const rows = db.chiaNoiBo.filter((c) => c.du_an_id === duAnId);
    const benBUsers = db.users.filter((u) => u.phe === "ben_b" && u.trang_thai === "active");
    setDrafts(
      benBUsers.map((u) => {
        const existing = rows.find((r) => r.nguoi_dung_id === u.id);
        return {
          nguoi_dung_id: u.id,
          ho_ten: u.ho_ten,
          ty_le: existing ? existing.ty_le : 0,
          ghi_chu: existing?.ghi_chu || "",
        };
      })
    );
  }, [db, duAnId]);

  if (!db || !user) return <p className="text-sm font-bold text-teal-800">Đang tải…</p>;

  const duAn = db.duAn.find((d) => d.id === duAnId);
  const sum = drafts.reduce((s, d) => s + Number(d.ty_le || 0), 0);
  const canEdit = canSuaChiaNoiBo(user, perms);

  async function save() {
    if (!canEdit) return;
    if (Math.abs(sum - 1) > 0.001) {
      alert("Tổng tỷ lệ phải = 100%.");
      return;
    }
    const rows = drafts
      .filter((d) => Number(d.ty_le) > 0)
      .map((d) => ({
        id: uid("cn"),
        du_an_id: duAnId,
        nguoi_dung_id: d.nguoi_dung_id,
        ty_le: Number(d.ty_le),
        ghi_chu: d.ghi_chu || "",
      }));
    try {
      await replaceChiaNoiBo(duAnId, rows);
      await logActivity({
        username: user.username,
        ho_ten: user.ho_ten,
        phan_he: "chia_noi_bo",
        hanh_dong: "LUU",
        chi_tiet: duAn?.ma_du_an || duAnId,
      });
      setDb(await fetchDb());
      alert("Đã lưu bảng tài chính nội bộ.");
    } catch (err) {
      alert(err.message || "Lỗi lưu");
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-black text-indigo-950">Tài chính nội bộ</h1>
        <p className="mt-1 text-sm font-medium text-teal-800">
          Chỉ thành viên Bên B xem / chỉnh — tách khỏi sổ A↔B
        </p>
      </header>

      <label className="block text-xs font-bold text-blue-900">
        Dự án
        <select
          className="mt-1 w-full max-w-md rounded-xl border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-950"
          value={duAnId}
          onChange={(e) => setDuAnId(e.target.value)}
        >
          {db.duAn.map((d) => (
            <option key={d.id} value={d.id}>
              {d.ma_du_an} — {d.ten}
            </option>
          ))}
        </select>
      </label>

      {duAn ? (
        <p className="text-sm font-bold text-blue-900">
          Phần B: {formatVnd(giaTriBenB(duAn))} · Tổng % đang nhập:{" "}
          <span className={Math.abs(sum - 1) < 0.001 ? "text-emerald-700" : "text-rose-700"}>
            {formatPct(sum)}
          </span>
        </p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-indigo-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-indigo-100 text-xs font-black uppercase text-indigo-950">
            <tr>
              <th className="px-4 py-3">Thành viên</th>
              <th className="px-4 py-3">Tỷ lệ (0–1)</th>
              <th className="px-4 py-3">Hưởng</th>
              <th className="px-4 py-3">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((d, idx) => (
              <tr key={d.nguoi_dung_id} className="border-t border-indigo-100">
                <td className="px-4 py-3 font-bold text-indigo-950">{d.ho_ten}</td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    disabled={!canEdit}
                    className="w-24 rounded-lg border border-indigo-300 bg-indigo-50 px-2 py-1 font-bold text-indigo-950 disabled:opacity-60"
                    value={d.ty_le}
                    onChange={(e) => {
                      const next = [...drafts];
                      next[idx] = { ...d, ty_le: e.target.value };
                      setDrafts(next);
                    }}
                  />
                </td>
                <td className="px-4 py-3 font-black tabular-nums text-blue-900">
                  {formatVnd(giaTriBenB(duAn || {}) * Number(d.ty_le || 0))}
                </td>
                <td className="px-4 py-3">
                  <input
                    disabled={!canEdit}
                    className="w-full rounded-lg border border-indigo-300 bg-indigo-50 px-2 py-1 font-medium text-indigo-950 disabled:opacity-60"
                    value={d.ghi_chu}
                    onChange={(e) => {
                      const next = [...drafts];
                      next[idx] = { ...d, ghi_chu: e.target.value };
                      setDrafts(next);
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canEdit ? (
        <button
          type="button"
          onClick={save}
          className="rounded-xl bg-gradient-to-r from-indigo-600 to-teal-600 px-5 py-2.5 text-sm font-black text-white"
        >
          Lưu bảng tài chính nội bộ
        </button>
      ) : (
        <p className="text-sm font-medium text-teal-800">Bạn chỉ có quyền xem.</p>
      )}
    </div>
  );
}
