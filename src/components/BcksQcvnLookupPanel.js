"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  buildMuc23TuNhienText,
  guessTinhFromViTriText,
  listGioDiaDanhForTinh,
  listDongDatDiaDanhForTinh,
  listQcvnTinhOptions,
  listTramForTinh,
} from "../lib/qcvnCatalogLookup";

const SEL =
  "h-9 w-full rounded-lg border border-teal-200 bg-white px-2 text-[12px] text-slate-800 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100";

/**
 * Thanh tra cứu QCVN → điền mục 2.3 Điều kiện tự nhiên.
 */
export default function BcksQcvnLookupPanel({ muc22ViTri, muc23Value, onApply }) {
  const tinhOptions = useMemo(() => listQcvnTinhOptions(), []);
  const [tinh, setTinh] = useState("");
  const [diaGio, setDiaGio] = useState("");
  const [diaDd, setDiaDd] = useState("");
  const [tram, setTram] = useState("");

  const gioOpts = useMemo(() => (tinh ? listGioDiaDanhForTinh(tinh) : []), [tinh]);
  const ddOpts = useMemo(() => (tinh ? listDongDatDiaDanhForTinh(tinh) : []), [tinh]);
  const tramOpts = useMemo(() => (tinh ? listTramForTinh(tinh) : []), [tinh]);

  // Gợi ý tỉnh từ chuỗi mục 2.2 (không import bcksReportSchema — tránh vòng phụ thuộc)
  useEffect(() => {
    if (tinh) return;
    const guess = guessTinhFromViTriText(muc22ViTri);
    if (guess?.label) setTinh(guess.label);
  }, [muc22ViTri, tinh]);

  useEffect(() => {
    setDiaGio("");
    setDiaDd("");
    setTram("");
  }, [tinh]);

  useEffect(() => {
    if (!diaGio && gioOpts.length === 1) setDiaGio(gioOpts[0].dia_danh);
  }, [gioOpts, diaGio]);

  useEffect(() => {
    if (!tram && tramOpts.length === 1) setTram(tramOpts[0].tram);
  }, [tramOpts, tram]);

  const handleApply = () => {
    if (!tinh) return;
    const text = buildMuc23TuNhienText({
      tinh,
      diaDanhGio: diaGio,
      diaDanhDongDat: diaDd || diaGio,
      diaDanhSet: diaDd || diaGio,
      tram,
      existingText: muc23Value,
    });
    onApply?.(text);
  };

  return (
    <div className="mb-2 rounded-lg border border-teal-200 bg-teal-50/60 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-teal-900">
          Tra cứu QCVN 02:2022/BXD → điền mục 2.3
        </p>
        <button
          type="button"
          disabled={!tinh}
          onClick={handleApply}
          className="rounded-md border border-teal-400 bg-teal-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Điền từ QCVN
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-[11px] font-semibold text-teal-900">
          Tỉnh / TP
          <select className={`${SEL} mt-0.5`} value={tinh} onChange={(e) => setTinh(e.target.value)}>
            <option value="">— Chọn —</option>
            {tinhOptions.map((o) => (
              <option key={o.key} value={o.label}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[11px] font-semibold text-teal-900">
          Địa danh gió (5.1)
          <select
            className={`${SEL} mt-0.5`}
            value={diaGio}
            disabled={!tinh}
            onChange={(e) => setDiaGio(e.target.value)}
          >
            <option value="">— Mặc định dòng đầu —</option>
            {gioOpts.map((o) => (
              <option key={o.dia_danh} value={o.dia_danh}>
                {o.dia_danh.length > 80 ? `${o.dia_danh.slice(0, 80)}…` : o.dia_danh} (Vùng {o.vung})
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[11px] font-semibold text-teal-900">
          Địa danh động đất (6.1)
          <select
            className={`${SEL} mt-0.5`}
            value={diaDd}
            disabled={!tinh}
            onChange={(e) => setDiaDd(e.target.value)}
          >
            <option value="">— Theo gió / dòng đầu —</option>
            {ddOpts.map((o) => (
              <option key={o.dia_danh} value={o.dia_danh}>
                {o.dia_danh} ({o.agR_label})
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[11px] font-semibold text-teal-900">
          Trạm khí tượng (A.1)
          <select
            className={`${SEL} mt-0.5`}
            value={tram}
            disabled={!tinh}
            onChange={(e) => setTram(e.target.value)}
          >
            <option value="">— Mặc định trạm đầu —</option>
            {tramOpts.map((o) => (
              <option key={`${o.tram}-${o.huyen}`} value={o.tram}>
                {o.tram}
                {o.huyen ? ` · ${o.huyen}` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-2 text-[10px] leading-snug text-teal-800/80">
        Điền gió (5.1), sét (4.1), động đất (6.1), trạm + nhiệt độ/mưa (A.1/A.2/A.25). Giữ nguyên phần «Thủy văn -
        Địa hình» nếu đã có. Có thể sửa tay sau khi điền.
      </p>
    </div>
  );
}
