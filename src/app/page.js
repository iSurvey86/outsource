"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadAuthSession } from "../lib/authSession";
import { canSeeChiaNoiBo, canSeeTaiChinhAb, filterDuAnForUser } from "../lib/menuAccess";
import { conLai, formatVnd, giaTriBenB, tongThu } from "../lib/finance";
import { formatNgayVi } from "../lib/formatNgay";
import { fetchDb, hasSupabase } from "../lib/store";
import { PipelineChip } from "../components/StatusChip";

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [user, setUser] = useState(null);
  const [perms, setPerms] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    const { user: u, perms: p } = loadAuthSession();
    setUser(u);
    setPerms(p);
    fetchDb()
      .then(setData)
      .catch((e) => setErr(e.message || "Không tải được dữ liệu"));
  }, []);

  if (err) {
    return (
      <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800 ring-1 ring-rose-200">
        {err}
        {!hasSupabase ? "" : " — kiểm tra Supabase URL/KEY và đã chạy SQL seed."}
      </p>
    );
  }

  if (!data || !user) {
    return <p className="text-sm font-bold text-teal-800">Đang tải…</p>;
  }

  const visibleDuAn = filterDuAnForUser(data.duAn, user);
  const dangLam = visibleDuAn.filter((d) =>
    ["moi", "da_tam_ung", "dang_lam", "da_giao_tuyen"].includes(d.trang_thai)
  );
  let tongConLai = 0;
  for (const d of visibleDuAn) {
    const gd = data.giaoDich.filter((g) => g.du_an_id === d.id);
    tongConLai += conLai(d, gd);
  }

  const mocSapToi = data.moc
    .filter((m) => m.trang_thai !== "hoan_thanh" && visibleDuAn.some((d) => d.id === m.du_an_id))
    .slice(0, 5);

  const myShares = canSeeChiaNoiBo(user, perms)
    ? data.chiaNoiBo.filter((c) => c.nguoi_dung_id === user.id)
    : [];
  const showTaiChinhAb = canSeeTaiChinhAb(user, perms);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-black text-blue-950">Dashboard</h1>
        <p className="mt-1 text-sm font-medium text-teal-800">
          Xin chào {user.ho_ten}
          {showTaiChinhAb ? " — theo dõi tiến độ & công nợ A↔B" : " — theo dõi tiến độ dự án"}
          {hasSupabase ? (
            <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">
              Supabase
            </span>
          ) : (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-900">
              Local
            </span>
          )}
        </p>
      </header>

      <div className={`grid gap-4 ${showTaiChinhAb ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        <StatCard label="DA đang theo dõi" value={String(dangLam.length)} tone="blue" />
        {showTaiChinhAb ? (
          <StatCard label="Tổng còn thu (phần B)" value={formatVnd(tongConLai)} tone="teal" />
        ) : null}
        {showTaiChinhAb ? (
          <StatCard
            label="User Bên A"
            value={String(data.users.filter((u) => u.phe === "ben_a").length)}
            tone="emerald"
          />
        ) : null}
      </div>

      <section className="rounded-2xl border border-sky-200 bg-white p-5 shadow-sm shadow-sky-100">
        <h2 className="text-sm font-black uppercase tracking-wide text-blue-900">
          Dự án đang làm
        </h2>
        <div className="mt-3 divide-y divide-sky-100">
          {dangLam.map((d) => {
            const gd = data.giaoDich.filter((g) => g.du_an_id === d.id);
            return (
              <Link
                key={d.id}
                href={`/du-an/${encodeURIComponent(d.ma_du_an)}`}
                className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-sky-50/80"
              >
                <div>
                  <p className="font-bold text-blue-950">
                    {d.ma_du_an} — {d.ten}
                  </p>
                  <p className="text-xs font-medium text-teal-800">
                    Phần B {formatVnd(giaTriBenB(d))} · Đã thu {formatVnd(tongThu(gd))}
                  </p>
                </div>
                <PipelineChip status={d.trang_thai} />
              </Link>
            );
          })}
          {!dangLam.length ? (
            <p className="py-4 text-sm font-medium text-teal-700">Chưa có dự án.</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-teal-200 bg-white p-5 shadow-sm shadow-teal-100">
        <h2 className="text-sm font-black uppercase tracking-wide text-teal-900">
          Mốc sắp tới
        </h2>
        <ul className="mt-3 space-y-2">
          {mocSapToi.map((m) => {
            const da = data.duAn.find((d) => d.id === m.du_an_id);
            return (
              <li
                key={m.id}
                className="flex justify-between rounded-xl bg-teal-50 px-3 py-2 text-sm"
              >
                <span className="font-semibold text-teal-950">
                  {da?.ma_du_an} · {m.ten}
                </span>
                <span className="font-bold text-blue-800">
                  Hạn {m.han ? formatNgayVi(m.han) || m.han : "—"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {myShares.length ? (
        <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm shadow-emerald-100">
          <h2 className="text-sm font-black uppercase tracking-wide text-emerald-900">
            Phần tôi (tài chính nội bộ)
          </h2>
          <ul className="mt-3 space-y-2">
            {myShares.map((c) => {
              const da = data.duAn.find((d) => d.id === c.du_an_id);
              const huong = giaTriBenB(da || {}) * c.ty_le;
              return (
                <li
                  key={c.id}
                  className="flex justify-between text-sm font-semibold text-emerald-950"
                >
                  <span>{da?.ma_du_an}</span>
                  <span>
                    {(c.ty_le * 100).toFixed(0)}% · {formatVnd(huong)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, tone }) {
  const tones = {
    blue: "from-blue-600 to-sky-500",
    teal: "from-teal-600 to-emerald-500",
    emerald: "from-emerald-600 to-teal-500",
  };
  return (
    <div
      className={`rounded-2xl bg-gradient-to-br ${tones[tone]} p-4 text-white shadow-md shadow-teal-200/50`}
    >
      <p className="text-xs font-bold uppercase tracking-wide text-sky-100">{label}</p>
      <p className="mt-2 text-xl font-black tabular-nums">{value}</p>
    </div>
  );
}
