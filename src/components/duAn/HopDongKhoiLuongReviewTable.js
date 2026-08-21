"use client";

import React from "react";
import { formatGiaTriHopDong as fmtMoney } from "../../lib/hopDong";
import {
  applyPhanRaPasteToKhoiLuongRows,
  formatMoneyInput,
  parsePhanRaPasteClipboard,
  phaseChenhLech,
  PHAN_RA_PASTE_FIELDS,
  stripMoneyInput,
  sumPhanRa,
  updateKhoiLuongField,
} from "../../lib/hopDongKhoiLuong";
import { numOrNull as toNum } from "../../lib/hopDongThucHien";
import {
  isTnctttExplainedPhanRaGap,
  normalizeChietGiamTncttt,
  resolveChietGiamTnctttPhaseAmount,
} from "../../lib/hopDongTncttt";

/**
 * Bảng giá trị theo giai đoạn. Khảo sát tách Địa hình / Địa chất / Khác-thỏa thuận.
 * Giá trị HĐ = tổng 5 cột phân rã (chỉ đọc). Có thể dán Excel vào 5 cột (không thay quét AI).
 * Có TNCTTT: cột Chiết giảm (màu ấm) sau Chủ trương Đầu tư — số trừ theo dòng.
 */
export default function HopDongKhoiLuongReviewTable({
  rows = [],
  onChange,
  showInclude = true,
  readOnly = false,
  chietGiam = null,
}) {
  const list = rows || [];
  const included = list.filter((r) => r.include !== false);
  const chiet = normalizeChietGiamTncttt(chietGiam);
  const [pasteHint, setPasteHint] = React.useState("");

  const moneyFields = [
    "gia_tri_hd",
    "gia_tri_ks_dia_hinh",
    "gia_tri_ks_dia_chat",
    "gia_tri_ks_khac",
    "gia_tri_lap_hs",
    "gia_tri_ctdt",
  ];
  const phanRaFields = PHAN_RA_PASTE_FIELDS;

  const thCls =
    "border-b border-r border-slate-300 bg-slate-50 px-1.5 py-1.5 text-[9px] font-bold uppercase leading-tight tracking-tight text-slate-700 text-center align-middle";
  const thDeduct =
    "border-b border-r-0 border-slate-300 bg-amber-100 px-1.5 py-1.5 text-[9px] font-bold uppercase leading-tight tracking-tight text-amber-950 text-center align-middle";
  const tdCls = "border-b border-r border-slate-300 bg-white px-1.5 py-1.5 align-middle";
  const tdDeduct =
    "border-b border-r-0 border-slate-300 bg-amber-50 px-1.5 py-1.5 align-middle text-right";
  const inputCls =
    "w-full min-w-[7.25rem] rounded border border-slate-200 bg-white px-1.5 py-1 text-[12px] font-normal tabular-nums text-slate-900 text-right outline-none focus:ring-1 focus:ring-sky-300";
  const moneyCellMin = { minWidth: "7.75rem" };
  const moneyWideMin = { minWidth: "8.75rem" };

  const setRow = (idx, next) => {
    if (readOnly || !onChange) return;
    const copy = list.map((r, i) => (i === idx ? next : r));
    onChange(copy);
  };

  const setField = (idx, field, value) => {
    if (field === "gia_tri_hd") return;
    const next = updateKhoiLuongField(list[idx], field, value);
    setRow(idx, next.nguonNote ? { ...next, nguonNote: "", nguonNoteWarn: false } : next);
  };

  const handlePaste = (e, startRowIndex = 0) => {
    if (readOnly || !onChange) return;
    const text = e.clipboardData?.getData("text/plain") || "";
    if (!text.includes("\t") && !text.includes("\n")) return;
    const pasteRows = parsePhanRaPasteClipboard(text);
    if (!pasteRows.length) return;
    e.preventDefault();
    const result = applyPhanRaPasteToKhoiLuongRows(list, pasteRows, { startRowIndex });
    onChange(result.rows);
    setPasteHint(result.message);
  };

  if (!list.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4 text-xs text-slate-500 italic">
        Chọn giai đoạn áp dụng để hiện bảng khối lượng.
      </div>
    );
  }

  const mismatchRows = list.filter((row) => {
    if (row.include === false || row.canSave === false) return false;
    const chenh = phaseChenhLech(row);
    const hasPhanRa = phanRaFields.some((field) => toNum(row[field]) != null);
    if (!(hasPhanRa && chenh != null && Math.abs(chenh) > 0.5)) return false;
    if (isTnctttExplainedPhanRaGap(chenh, sumPhanRa(row), chiet.ty_le)) return false;
    return true;
  });

  const tnctttGapRows = list.filter((row) => {
    if (row.include === false || row.canSave === false) return false;
    const chenh = phaseChenhLech(row);
    return isTnctttExplainedPhanRaGap(chenh, sumPhanRa(row), chiet.ty_le);
  });

  const tyLeTncttt =
    chiet.ty_le != null && chiet.ty_le > 0 ? chiet.ty_le : chiet.co_chiet_giam ? 6 : null;
  const showTnctttCol =
    Boolean(tyLeTncttt) ||
    chiet.co_chiet_giam ||
    tnctttGapRows.length > 0 ||
    list.some((row) => {
      if (row.include === false) return false;
      return (
        resolveChietGiamTnctttPhaseAmount({
          tongPhanRa: sumPhanRa(row),
          giaTriHd: toNum(row.gia_tri_hd),
          chietGiam: chiet,
        }) != null
      );
    });

  const columnTotal = (field) =>
    list
      .filter((r) => r.include !== false && r.canSave !== false)
      .reduce((s, r) => s + (toNum(r[field]) || 0), 0);

  const rowChietGiam = (row) =>
    resolveChietGiamTnctttPhaseAmount({
      tongPhanRa: sumPhanRa(row),
      giaTriHd: toNum(row.gia_tri_hd),
      chietGiam: chiet,
      defaultTyLe: tyLeTncttt || 6,
    });

  const chietGiamTotal = list
    .filter((r) => r.include !== false && r.canSave !== false)
    .reduce((s, r) => s + (rowChietGiam(r) || 0), 0);

  return (
    <div className="w-full space-y-2" onPaste={(e) => handlePaste(e, 0)}>
      {pasteHint ? (
        <p className="text-[11px] text-teal-800 bg-teal-50 border border-teal-100 rounded-md px-2 py-1.5">
          {pasteHint}
        </p>
      ) : null}
      <div className="w-full overflow-x-auto rounded-lg border border-slate-300">
        <table className="w-full min-w-[1040px] border-collapse">
          <thead>
            <tr>
              {showInclude ? (
                <th className={thCls} rowSpan={2} style={{ width: "2.75rem", minWidth: "2.75rem" }}>
                  Lưu
                </th>
              ) : null}
              <th
                className={thCls}
                rowSpan={2}
                style={{
                  minWidth: list.some((r) => r.multiCongTrinh) ? "12rem" : "4.5rem",
                  width: list.some((r) => r.multiCongTrinh) ? "18%" : "5rem",
                }}
              >
                Giai đoạn
              </th>
              <th className={thCls} rowSpan={2} style={moneyWideMin}>
                Giá trị HĐ{" "}
                <span className="font-medium normal-case tracking-normal text-slate-600">
                  (tự cộng)
                </span>
              </th>
              <th className={thCls} colSpan={3}>
                Khảo sát
              </th>
              <th className={thCls} rowSpan={2} style={moneyWideMin}>
                Lập Hồ sơ Thiết kế
              </th>
              <th className={thCls} rowSpan={2} style={moneyCellMin}>
                Chủ trương Đầu tư
              </th>
              {showTnctttCol ? (
                <th
                  className={thDeduct}
                  rowSpan={2}
                  style={moneyWideMin}
                  title="Số trừ theo dòng — gross KS/Lập − Giá trị HĐ net"
                >
                  <span className="block leading-tight">
                    {`Chiết giảm TNCTTT (${tyLeTncttt || 6}%)`}
                  </span>
                </th>
              ) : null}
            </tr>
            <tr>
              <th className={thCls} style={moneyCellMin}>
                Địa hình
              </th>
              <th className={thCls} style={moneyCellMin}>
                Địa chất
              </th>
              <th
                className={thCls}
                style={moneyCellMin}
                title="Khảo sát khác, thỏa thuận, thu thập số liệu"
              >
                Khác
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map((row, idx) => {
              const chenh = phaseChenhLech(row);
              const hasPhanRa = phanRaFields.some((field) => toNum(row[field]) != null);
              const tnctttGap = isTnctttExplainedPhanRaGap(chenh, sumPhanRa(row), chiet.ty_le);
              const mismatch = hasPhanRa && chenh != null && Math.abs(chenh) > 0.5 && !tnctttGap;
              const disabled = row.canSave === false;
              const mismatchMoneyCls = mismatch
                ? " border-red-400 ring-1 ring-red-200 font-bold text-red-700"
                : "";
              const chietAmt = showTnctttCol ? rowChietGiam(row) : null;
              return (
                <tr
                  key={row.key || `${row.ma_du_an}-${idx}`}
                  className={
                    disabled ? "opacity-60" : mismatch ? "bg-red-50/70" : tnctttGap ? "bg-teal-50/40" : ""
                  }
                  title={
                    mismatch
                      ? "Phân rã không khớp Giá trị HĐ"
                      : tnctttGap
                        ? `KS/Lập = gross; Giá trị HĐ = net sau TNCTTT ${chiet.ty_le || tyLeTncttt}%`
                        : undefined
                  }
                >
                  {showInclude ? (
                    <td className={`${tdCls} text-center`}>
                      <input
                        type="checkbox"
                        checked={row.include !== false}
                        disabled={readOnly || disabled}
                        onChange={(e) => setRow(idx, { ...row, include: e.target.checked })}
                        className="cursor-pointer"
                        title={disabled ? row.reason || "Không thể lưu" : "Ghi dòng này vào sổ"}
                      />
                    </td>
                  ) : null}
                  <td className={`${tdCls} text-left px-1.5`}>
                    <span
                      className={`block text-[11px] font-black leading-snug text-center ${
                        mismatch ? "text-red-700" : "text-violet-800"
                      }`}
                    >
                      {row.phaseBadge || (row.multiCongTrinh ? null : row.phaseLabel) || "—"}
                    </span>
                    {row.multiCongTrinh && row.ten_du_an ? (
                      <p
                        className={`mt-1 text-[10px] leading-snug whitespace-normal break-words ${
                          mismatch ? "font-bold text-red-700" : "font-medium text-slate-700"
                        }`}
                        title={row.ten_du_an}
                      >
                        {row.ten_du_an}
                      </p>
                    ) : null}
                    {row.reason ? (
                      <p className="mt-0.5 text-[10px] font-normal text-amber-700 leading-snug">
                        {row.reason}
                      </p>
                    ) : null}
                  </td>
                  {moneyFields.map((field) => {
                    const isHd = field === "gia_tri_hd";
                    return (
                      <td key={field} className={tdCls} style={isHd ? moneyWideMin : moneyCellMin}>
                        {readOnly || disabled || isHd ? (
                          <span
                            className={`block whitespace-nowrap px-1 py-1 text-[12px] tabular-nums text-right ${
                              mismatch
                                ? "font-bold text-red-700"
                                : isHd
                                  ? "font-semibold text-slate-800 bg-slate-50 rounded"
                                  : "font-normal text-slate-800"
                            }`}
                            title={
                              isHd
                                ? "Tự cộng từ Địa hình + Địa chất + Khác + Lập Hồ sơ Thiết kế + Chủ trương Đầu tư (net nếu đã trừ TNCTTT)"
                                : undefined
                            }
                          >
                            {formatMoneyInput(row[field]) || "—"}
                          </span>
                        ) : (
                          <input
                            className={`${inputCls}${mismatchMoneyCls}`}
                            value={formatMoneyInput(row[field])}
                            onChange={(e) => setField(idx, field, stripMoneyInput(e.target.value))}
                            onPaste={(e) => handlePaste(e, idx)}
                            inputMode="numeric"
                          />
                        )}
                      </td>
                    );
                  })}
                  {showTnctttCol ? (
                    <td className={tdDeduct} style={moneyWideMin} title={chiet.ghi_chu || undefined}>
                      <span className="block whitespace-nowrap px-1 py-1 text-[12px] font-semibold tabular-nums text-amber-950">
                        {chietAmt != null ? formatMoneyInput(String(chietAmt)) : "—"}
                      </span>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50">
              {showInclude ? <td className={`${tdCls} border-b-0 bg-slate-50`} /> : null}
              <td
                className={`${tdCls} border-b-0 bg-slate-50 text-center text-[10px] font-black uppercase text-teal-800`}
              >
                Tổng
              </td>
              {moneyFields.map((field) => (
                <td
                  key={field}
                  className={`${tdCls} border-b-0 bg-slate-50 text-right text-[12px] font-black tabular-nums whitespace-nowrap text-teal-800`}
                  style={field === "gia_tri_hd" || field === "gia_tri_lap_hs" ? moneyWideMin : moneyCellMin}
                >
                  {formatMoneyInput(String(columnTotal(field)))}
                </td>
              ))}
              {showTnctttCol ? (
                <td
                  className={`${tdDeduct} border-b-0 bg-amber-100 text-[12px] font-black tabular-nums whitespace-nowrap text-amber-950`}
                  style={moneyWideMin}
                >
                  {chietGiamTotal > 0 ? formatMoneyInput(String(chietGiamTotal)) : "—"}
                </td>
              ) : null}
            </tr>
          </tfoot>
        </table>
      </div>

      {mismatchRows.length > 0 ? (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-[11px] text-red-800 leading-snug">
          <p className="font-bold text-red-900">Phân rã dòng ≠ cột Giá trị HĐ</p>
          <ul className="mt-1 space-y-0.5 list-disc pl-4">
            {mismatchRows.map((row) => {
              const tong = sumPhanRa(row);
              const gia = toNum(row.gia_tri_hd);
              const label =
                row.multiCongTrinh && row.ten_du_an
                  ? `${row.phaseBadge || row.phaseLabel || "—"} — ${row.ten_du_an}`
                  : row.phaseLabel || "—";
              return (
                <li key={row.key || row.ma_du_an}>
                  <strong>{label}</strong>: KS+Lập+CTĐT {fmtMoney(tong)} ≠ HĐ {fmtMoney(gia)} — sửa/dán lại 5
                  cột.
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {included.length === 0 ? (
        <p className="text-[11px] text-amber-800">Chưa chọn dòng nào để lưu.</p>
      ) : null}
    </div>
  );
}
