"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { loadAuthSession } from "../../lib/authSession";
import { canSeeChiaNoiBo, filterDuAnForUser, filterBenBNoiBoUi } from "../../lib/menuAccess";
import {
  formatPct,
  formatVndShort,
  giaTriBenB,
  tongGopVonNoiBo,
  tongNhanTuA,
} from "../../lib/finance";
import { fetchDb } from "../../lib/store";
import { giaiDoanBadgeClass } from "../../lib/duAnMeta";

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
  const [db, setDb] = useState(null);
  const [user, setUser] = useState(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    const { user: u, perms: p } = loadAuthSession();
    setUser(u);
    if (!canSeeChiaNoiBo(u, p)) {
      router.replace("/");
      return;
    }
    fetchDb().then(setDb).catch(() => setDb({ duAn: [], giaoDich: [], chiaNoiBo: [], gopVonNoiBo: [] }));
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead className="bg-indigo-800 text-xs font-black uppercase tracking-wide text-white">
              <tr>
                <th className="w-12 px-3 py-3 text-center">STT</th>
                <th className="px-3 py-3 text-left">Dự án</th>
                <th className="w-28 px-3 py-3 text-center">Giai đoạn</th>
                <th className="w-36 px-3 py-3 text-right">Đã nhận A</th>
                <th className="w-32 px-3 py-3 text-right">Góp nội bộ</th>
                <th className="w-36 px-3 py-3 text-right">Phần B GTV</th>
                <th className="w-36 px-3 py-3 text-center">Chia nội bộ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const d = row.duAn;
                const href = `/tai-chinh-noi-bo/${encodeURIComponent(d.ma_du_an)}`;
                return (
                  <tr
                    key={d.id}
                    className="border-t border-indigo-100 odd:bg-white even:bg-indigo-50/50 hover:bg-teal-50/80"
                  >
                    <td className="px-3 py-3 text-center font-bold tabular-nums text-indigo-900">
                      {idx + 1}
                    </td>
                    <td className="px-3 py-3">
                      <Link href={href} className="font-bold text-blue-700 hover:text-teal-700">
                        {d.ten}
                      </Link>
                      <p className="mt-0.5 text-xs font-semibold text-indigo-600/80">{d.ma_du_an}</p>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-black ring-1 ${giaiDoanBadgeClass(
                          d.giai_doan
                        )}`}
                      >
                        {d.giai_doan || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums text-indigo-950">
                      <Link href={href} className="hover:text-teal-700">
                        {row.tongNhan > 0 ? formatVndShort(row.tongNhan) : "—"}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums text-violet-900">
                      <Link href={href} className="hover:text-violet-700">
                        {row.tongGop > 0 ? formatVndShort(row.tongGop) : "—"}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-indigo-800">
                      {row.phanB > 0 ? formatVndShort(row.phanB) : "—"}
                    </td>
                    <td className="px-3 py-3 text-center">
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
                  </tr>
                );
              })}
              {!rows.length ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm font-medium text-teal-700">
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
