"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { loadAuthSession } from "../../lib/authSession";
import {
  canSeeChiaNoiBo,
  canSuaTaiChinhAb,
  filterDuAnForUser,
  filterBenBNoiBoUi,
} from "../../lib/menuAccess";
import {
  formatPct,
  formatVndShort,
  giaTriBenB,
  tongGopVonNoiBo,
  tongNhanTuA,
} from "../../lib/finance";
import { fetchDb, logActivity, updateRow } from "../../lib/store";
import { giaiDoanBadgeClass } from "../../lib/duAnMeta";
import { useAppDialog } from "../../components/AppDialog";
import NoteCell from "../../components/taiChinh/NoteCell";

function trangThaiChia(chiaRows) {
  const sum = (chiaRows || []).reduce((s, r) => s + (Number(r.ty_le) || 0), 0);
  if (!chiaRows?.length || sum <= 0) {
    return { label: "Chưa chia", tone: "amber" };
  }
  if (Math.abs(sum - 1) < 0.001) {
    return { label: "Đã chia", tone: "emerald" };
  }
  return { label: `Đang nhập (${formatPct(sum)})`, tone: "sky" };
}

export default function TaiChinhNoiBoListPage() {
  const router = useRouter();
  const { showAlert } = useAppDialog();
  const [db, setDb] = useState(null);
  const [user, setUser] = useState(null);
  const [perms, setPerms] = useState(null);
  const [q, setQ] = useState("");
  const [savingId, setSavingId] = useState(null);

  async function reload() {
    setDb(await fetchDb());
  }

  useEffect(() => {
    function syncAuth() {
      const { user: u, perms: p } = loadAuthSession();
      setUser(u);
      setPerms(p);
      if (!canSeeChiaNoiBo(u, p)) {
        router.replace("/");
      }
    }
    syncAuth();
    reload().catch(() =>
      setDb({ duAn: [], giaoDich: [], chiaNoiBo: [], gopVonNoiBo: [] })
    );
    window.addEventListener("outsrc-auth-session-changed", syncAuth);
    return () => window.removeEventListener("outsrc-auth-session-changed", syncAuth);
  }, [router]);

  const rows = useMemo(() => {
    if (!db || !user) return [];
    const list = filterDuAnForUser(db.duAn || [], user);
    const needle = q.trim().toLowerCase();
    return list
      .filter((d) => {
        if (!needle) return true;
        return (
          String(d.ten || "")
            .toLowerCase()
            .includes(needle) ||
          String(d.ma_du_an || "")
            .toLowerCase()
            .includes(needle)
        );
      })
      .map((d) => {
        const gd = (db.giaoDich || []).filter((g) => g.du_an_id === d.id);
        const uiIds = new Set(filterBenBNoiBoUi(db.users).map((u) => u.id));
        const chia = (db.chiaNoiBo || []).filter(
          (c) => c.du_an_id === d.id && uiIds.has(c.nguoi_dung_id)
        );
        const tongGop = tongGopVonNoiBo(db.gopVonNoiBo || [], d.id);
        return {
          duAn: d,
          tongNhan: tongNhanTuA(gd),
          tongGop,
          phanB: giaTriBenB(d),
          status: trangThaiChia(chia),
        };
      });
  }, [db, user, q]);

  const canEditNote = canSuaTaiChinhAb(perms);

  async function patchGhiChu(duAn, text) {
    if (!canEditNote) {
      showAlert("Chỉ Admin được sửa ghi chú tài chính.");
      return;
    }
    setSavingId(duAn.id);
    try {
      await updateRow("du_an", duAn.id, { ghi_chu_tai_chinh: text });
      await logActivity({
        username: user.username,
        ho_ten: user.ho_ten,
        phan_he: "tai_chinh_noi_bo",
        hanh_dong: "SUA_GHI_CHU",
        chi_tiet: duAn.ma_du_an,
      });
      await reload();
    } catch (err) {
      showAlert(err.message || "Lỗi lưu ghi chú");
    } finally {
      setSavingId(null);
    }
  }

  if (!db || !user) {
    return <p className="text-sm font-bold text-teal-800">Đang tải…</p>;
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-black text-indigo-950">Tài chính nội bộ</h1>
      </header>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-indigo-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm mã / tên dự án…"
          className="w-full rounded-xl border border-indigo-300 bg-indigo-50 py-2 pl-8 pr-3 text-sm font-medium text-indigo-950 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-sm">
        <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[900px] table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-12" />
              <col />
              <col className="w-28" />
              <col className="w-32" />
              <col className="w-28" />
              <col className="w-32" />
              <col className="w-32" />
              <col className="w-[18%]" />
            </colgroup>
            <thead className="bg-indigo-800 text-xs font-black uppercase tracking-wide text-white">
              <tr>
                <th className="px-3 py-3 text-center">STT</th>
                <th className="px-3 py-3 text-left">Dự án</th>
                <th className="px-3 py-3 text-center">Giai đoạn</th>
                <th className="px-3 py-3 text-right">Đã nhận A</th>
                <th className="px-3 py-3 text-right">Góp nội bộ</th>
                <th className="px-3 py-3 text-right">Phần B GTV</th>
                <th className="px-3 py-3 text-center">Chia nội bộ</th>
                <th className="px-3 py-3 text-center">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const d = row.duAn;
                const href = `/tai-chinh-noi-bo/${encodeURIComponent(d.ma_du_an)}`;
                const busy = savingId === d.id;
                return (
                  <tr
                    key={d.id}
                    className="border-t border-indigo-100 odd:bg-white even:bg-indigo-50/50 hover:bg-teal-50/80"
                  >
                    <td className="px-3 py-3 text-center align-middle font-bold tabular-nums text-indigo-900">
                      {idx + 1}
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <Link href={href} className="font-bold text-blue-700 hover:text-teal-700">
                        {d.ten}
                      </Link>
                      <p className="mt-0.5 break-all text-xs font-semibold text-indigo-600/80">
                        {d.ma_du_an}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-center align-middle">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-black ring-1 ${giaiDoanBadgeClass(
                          d.giai_doan
                        )}`}
                      >
                        {d.giai_doan || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right align-middle font-bold tabular-nums text-indigo-950">
                      <Link href={href} className="hover:text-teal-700">
                        {row.tongNhan > 0 ? formatVndShort(row.tongNhan) : "—"}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-right align-middle font-bold tabular-nums text-violet-900">
                      <Link href={href} className="hover:text-violet-700">
                        {row.tongGop > 0 ? formatVndShort(row.tongGop) : "—"}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-right align-middle font-semibold tabular-nums text-indigo-800">
                      {row.phanB > 0 ? formatVndShort(row.phanB) : "—"}
                    </td>
                    <td className="px-3 py-3 text-center align-middle">
                      <Link
                        href={href}
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${
                          row.status.tone === "emerald"
                            ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                            : row.status.tone === "sky"
                              ? "bg-sky-50 text-sky-800 ring-sky-200"
                              : "bg-amber-50 text-amber-900 ring-amber-200"
                        }`}
                      >
                        {row.status.label}
                      </Link>
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <NoteCell
                        value={d.ghi_chu_tai_chinh || ""}
                        disabled={!canEditNote || busy}
                        onCommit={(text) => patchGhiChu(d, text)}
                      />
                    </td>
                  </tr>
                );
              })}
              {!rows.length ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-sm font-medium text-teal-700"
                  >
                    Không có dự án khớp.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
