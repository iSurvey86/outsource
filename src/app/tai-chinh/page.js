"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatVnd } from "../../lib/finance";
import { fetchDb } from "../../lib/store";

export default function TaiChinhPage() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    fetchDb().then((db) => {
      const list = db.giaoDich
        .map((g) => ({
          ...g,
          ma: db.duAn.find((d) => d.id === g.du_an_id)?.ma_du_an || "—",
        }))
        .sort((a, b) => String(b.ngay).localeCompare(String(a.ngay)));
      setRows(list);
    });
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-black text-blue-950">Tài chính A↔B</h1>
        <p className="mt-1 text-sm font-medium text-teal-800">
          Sổ tạm ứng / thanh toán — Bên A và Bên B đều xem được
        </p>
      </header>

      <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-emerald-100 text-xs font-black uppercase text-emerald-950">
            <tr>
              <th className="px-4 py-3">Ngày</th>
              <th className="px-4 py-3">DA</th>
              <th className="px-4 py-3">Loại</th>
              <th className="px-4 py-3">Nội dung</th>
              <th className="px-4 py-3 text-right">Số tiền</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <tr key={g.id} className="border-t border-emerald-100 hover:bg-emerald-50/70">
                <td className="px-4 py-3 font-medium text-teal-900">{g.ngay}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/du-an/${encodeURIComponent(g.ma)}`}
                    className="font-bold text-blue-700"
                  >
                    {g.ma}
                  </Link>
                </td>
                <td className="px-4 py-3 font-bold text-emerald-900">{g.loai}</td>
                <td className="px-4 py-3 font-medium text-teal-800">{g.noi_dung || "—"}</td>
                <td className="px-4 py-3 text-right font-black tabular-nums text-blue-950">
                  {formatVnd(g.so_tien)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
