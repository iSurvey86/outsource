"use client";

import React, { useMemo, useState } from "react";
import { getKlSectionHeaderClass, KL_SECTION_TITLE_CELL_CLASS } from "../lib/klTableUtils";
import { groupNkksKlRowsForDisplay } from "../lib/nkksAutoFillFromKl";
import { useResizableTableColumns } from "../hooks/useResizableTableColumns";
import ResizableTableFrame from "./table/ResizableTableFrame";
import ResizableTh from "./table/ResizableTh";

const DEFAULT_WIDTHS = [52, 280, 72, 72, 100];

function KlDataCells({ row }) {
  return (
    <>
      <td className="px-2 py-1.5 text-center text-slate-600">{row.stt}</td>
      <td className="px-2 py-1.5 text-slate-800 break-words">{row.noi_dung}</td>
      <td className="px-2 py-1.5 text-center text-slate-600">{row.cap_dh}</td>
      <td className="px-2 py-1.5 text-center text-slate-600">{row.don_vi}</td>
      <td className="px-2 py-1.5 text-center font-medium text-blue-800">{row.khoi_luong || "—"}</td>
    </>
  );
}

/** Bảng KL tham chiếu NKKS — một cột khối lượng; mục con (-) gom vào Chi tiết. */
export default function NkksSimpleKlTable({
  tableId = "nkks-kl-ref",
  rows = [],
  emptyMessage,
  centered = true,
}) {
  const {
    widths,
    startResize,
    totalWidth,
    containerRef,
    fitContainer,
  } = useResizableTableColumns(tableId, DEFAULT_WIDTHS, { fitContainer: true });

  const groups = useMemo(() => groupNkksKlRowsForDisplay(rows), [rows]);
  const [openDetails, setOpenDetails] = useState(() => new Set());

  const toggleDetails = (key) => {
    setOpenDetails((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (!rows.length) {
    return (
      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
        {emptyMessage || "Chưa có dòng khối lượng từ NVKS."}
      </p>
    );
  }

  return (
    <ResizableTableFrame
      widths={widths}
      totalWidth={totalWidth}
      containerRef={containerRef}
      fitContainer={fitContainer}
      centered={centered}
      tableClassName="text-xs"
    >
      <thead>
        <tr className="bg-gradient-to-r from-rose-50 via-orange-50 to-amber-50 text-rose-950 border-b border-rose-200/60">
          <ResizableTh columnIndex={0} onResizeStart={startResize} className="px-2 py-2.5 text-center font-bold align-middle">
            STT
          </ResizableTh>
          <ResizableTh columnIndex={1} onResizeStart={startResize} className="px-2 py-2.5 text-center font-bold align-middle">
            Nội dung công việc
          </ResizableTh>
          <ResizableTh columnIndex={2} onResizeStart={startResize} className="px-2 py-2.5 text-center font-bold align-middle">
            Cấp ĐH
          </ResizableTh>
          <ResizableTh columnIndex={3} onResizeStart={startResize} className="px-2 py-2.5 text-center font-bold align-middle">
            Đơn vị
          </ResizableTh>
          <ResizableTh columnIndex={4} onResizeStart={startResize} className="px-2 py-2.5 text-center font-bold align-middle">
            Khối lượng
          </ResizableTh>
        </tr>
      </thead>
      <tbody>
        {groups.map((group) => {
          if (group.kind === "header") {
            const row = group.row;
            return (
              <tr key={`h-${group.sourceIndex}`} className={getKlSectionHeaderClass(row.stt)}>
                <td className="px-2 py-2 font-bold text-center">{row.stt}</td>
                <td colSpan={4} className={`px-2 py-2 ${KL_SECTION_TITLE_CELL_CLASS}`}>
                  {row.noi_dung}
                </td>
              </tr>
            );
          }

          const parent = group.parent;
          const children = group.children || [];
          const detailKey = `d-${group.sourceIndex}`;
          const open = openDetails.has(detailKey);

          return (
            <React.Fragment key={detailKey}>
              <tr className="border-t border-sky-50 bg-white even:bg-sky-50/30">
                <KlDataCells row={parent} />
              </tr>
              {children.length > 0 ? (
                <>
                  <tr className="border-t border-slate-100 bg-slate-50/80">
                    <td className="px-2 py-1 text-center text-slate-400">·</td>
                    <td colSpan={4} className="px-2 py-1">
                      <button
                        type="button"
                        onClick={() => toggleDetails(detailKey)}
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-sky-700 hover:text-sky-900 hover:underline cursor-pointer"
                        aria-expanded={open}
                      >
                        <span className="tabular-nums">{open ? "▾" : "▸"}</span>
                        Chi tiết ({children.length})
                      </button>
                    </td>
                  </tr>
                  {open
                    ? children.map((child, cIdx) => (
                        <tr
                          key={`${detailKey}-c-${cIdx}`}
                          className="border-t border-sky-50/80 bg-slate-50/40"
                        >
                          <td className="px-2 py-1.5 text-center text-slate-500 pl-3">{child.stt}</td>
                          <td className="px-2 py-1.5 text-slate-700 break-words pl-4">{child.noi_dung}</td>
                          <td className="px-2 py-1.5 text-center text-slate-500">{child.cap_dh}</td>
                          <td className="px-2 py-1.5 text-center text-slate-500">{child.don_vi}</td>
                          <td className="px-2 py-1.5 text-center font-medium text-slate-700">
                            {child.khoi_luong || "—"}
                          </td>
                        </tr>
                      ))
                    : null}
                </>
              ) : null}
            </React.Fragment>
          );
        })}
      </tbody>
    </ResizableTableFrame>
  );
}
