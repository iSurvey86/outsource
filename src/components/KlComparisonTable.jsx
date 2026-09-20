"use client";

import React from "react";
import { getKlSectionHeaderClass, preventKlNumberInput, KL_SECTION_TITLE_CELL_CLASS } from "../lib/klTableUtils";
import { computeKlDcChenhDiff, getKlDc02InputClass, getKlDcChenhDisplayClass, isKlDcValueChanged } from "../lib/nvksDcKl";
import { useResizableTableColumns } from "../hooks/useResizableTableColumns";
import ResizableTableFrame from "./table/ResizableTableFrame";
import ResizableTh from "./table/ResizableTh";

/** Cột (01)/(02)/(03) rộng đủ tiêu đề một dòng (text-base). Tổng ~1446px. */
const DEFAULT_WIDTHS = [52, 380, 76, 80, 280, 270, 260];

/** Vạch dọc mờ giữa các cột tiêu đề. */
const TH_DIVIDER = "border-r border-rose-300/40";

const COL_TOOLTIPS = {
  kl01: "Khối lượng đã phê duyệt (01) — lấy từ NVKS Gốc",
  kl02: "Khối lượng điều chỉnh (02) — mặc định bằng (01); rà soát và chỉnh những hạng mục cần thay đổi",
  kl03: "Chênh lệch (03) = (02) − (01)",
};

/**
 * Bảng KL so sánh NVKS Điều chỉnh — (01)/(02)/(03), cột kéo chỉnh, chữ lớn.
 */
export default function KlComparisonTable({
  tableId = "nvks-dc-kl-v4",
  rows = [],
  editableKl02 = false,
  readOnly = false,
  onKl02Change,
  emptyMessage = "Chưa có dòng khối lượng.",
  centered = false,
  maxWidthClass = "",
  title = null,
  helpText = null,
}) {
  const {
    widths,
    startResize,
    totalWidth,
    containerRef,
    fitContainer,
  } = useResizableTableColumns(tableId, DEFAULT_WIDTHS, { fitContainer: true });

  const shellClass =
    "rounded-lg border border-rose-200 overflow-hidden shadow-sm w-full max-w-full";

  if (!rows.length) {
    return (
      <div className="w-full flex justify-center overflow-x-auto">
        <div className={shellClass}>
          {(title || helpText) && (
            <div className="bg-white px-4 py-2.5 border-b border-rose-100">
              {title ? <h4 className="font-bold text-blue-800">{title}</h4> : null}
              {helpText ? <p className="text-sm text-slate-600 mt-1 leading-relaxed">{helpText}</p> : null}
            </div>
          )}
          <p className="text-sm text-amber-700 bg-amber-50 border-t border-amber-100 px-4 py-3">
            {emptyMessage}
          </p>
        </div>
      </div>
    );
  }

  const hasTitleBlock = title || helpText;

  return (
    <div className="w-full flex justify-center overflow-x-auto">
      <div className={shellClass}>
        {hasTitleBlock ? (
          <div className="bg-white px-4 py-2.5 border-b border-rose-100">
            {title ? <h4 className="font-bold text-blue-800">{title}</h4> : null}
            {helpText ? <p className="text-sm text-slate-600 mt-1 leading-relaxed">{helpText}</p> : null}
          </div>
        ) : null}
        <ResizableTableFrame
          widths={widths}
          totalWidth={totalWidth}
          containerRef={containerRef}
          fitContainer={fitContainer}
          centered={false}
          maxWidthClass=""
          shrinkToFit={false}
          className="border-0 rounded-none shadow-none"
          tableClassName="text-base"
        >
        <thead>
          <tr className="bg-gradient-to-r from-rose-50 via-orange-50 to-amber-50 text-rose-950 border-b border-rose-200/60">
            <ResizableTh columnIndex={0} onResizeStart={startResize} className={`px-2 py-3 text-center font-bold align-middle ${TH_DIVIDER}`}>
              STT
            </ResizableTh>
            <ResizableTh columnIndex={1} onResizeStart={startResize} className={`px-2 py-3 text-center font-bold align-middle ${TH_DIVIDER}`}>
              Nội dung công việc
            </ResizableTh>
            <ResizableTh columnIndex={2} onResizeStart={startResize} className={`px-2 py-3 text-center font-bold align-middle ${TH_DIVIDER}`}>
              Cấp ĐH
            </ResizableTh>
            <ResizableTh columnIndex={3} onResizeStart={startResize} className={`px-2 py-3 text-center font-bold align-middle ${TH_DIVIDER}`}>
              Đơn vị
            </ResizableTh>
            <ResizableTh
              columnIndex={4}
              onResizeStart={startResize}
              title={COL_TOOLTIPS.kl01}
              className={`px-2 py-2.5 text-center font-bold align-middle whitespace-nowrap text-blue-800 cursor-help ${TH_DIVIDER}`}
            >
              KHỐI LƯỢNG ĐÃ PHÊ DUYỆT (01)
            </ResizableTh>
            <ResizableTh
              columnIndex={5}
              onResizeStart={startResize}
              title={COL_TOOLTIPS.kl02}
              className={`px-2 py-2.5 text-center font-bold align-middle whitespace-nowrap text-emerald-800 cursor-help ${TH_DIVIDER}`}
            >
              KHỐI LƯỢNG ĐIỀU CHỈNH (02)
            </ResizableTh>
            <ResizableTh
              columnIndex={6}
              onResizeStart={startResize}
              title={COL_TOOLTIPS.kl03}
              className="px-2 py-2.5 text-center font-bold align-middle leading-tight whitespace-nowrap text-rose-800 cursor-help"
            >
              CHÊNH LỆCH (03 = 02 - 01)
            </ResizableTh>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) =>
            row.is_header ? (
              <tr
                key={`h-${idx}`}
                className={getKlSectionHeaderClass(row.stt, {
                  isThoiGianSection: row.is_thoi_gian_section,
                })}
              >
                <td className="px-2 py-2 font-bold text-center">{row.stt}</td>
                <td colSpan={6} className={`px-2 py-2 ${KL_SECTION_TITLE_CELL_CLASS}`}>
                  {row.noi_dung}
                </td>
              </tr>
            ) : (
              <tr
                key={`r-${row.id_cong_viec || idx}`}
                className="border-t border-sky-50 bg-white even:bg-sky-50/30 hover:bg-amber-50/40 transition-colors"
              >
                <td className="px-2 py-2 text-center text-slate-600">{row.stt}</td>
                {row.is_thoi_gian || row.is_text_kl ? (
                  <td colSpan={2} className="px-2 py-2 text-slate-800 break-words text-justify leading-snug">
                    {row.noi_dung}
                  </td>
                ) : (
                  <>
                    <td className="px-2 py-2 text-slate-800 break-words text-justify leading-snug">{row.noi_dung}</td>
                    <td className="px-2 py-2 text-center text-slate-600">{row.cap_dh}</td>
                  </>
                )}
                <td className="px-2 py-2 text-center text-slate-600">{row.don_vi}</td>
                <td className="px-2 py-2 text-center font-medium text-blue-800">{row.kl_01 || "—"}</td>
                <td className="px-2 py-2 text-center font-medium text-emerald-800">
                  {editableKl02 && !readOnly ? (
                    <input
                      type="text"
                      inputMode={row.is_text_kl ? "text" : "decimal"}
                      value={row.kl_02 ?? ""}
                      onChange={(e) => onKl02Change?.(row.id_cong_viec, e.target.value)}
                      onKeyDown={row.is_text_kl ? undefined : preventKlNumberInput}
                      className={getKlDc02InputClass(isKlDcValueChanged(row.kl_02, row.kl_01), false)}
                    />
                  ) : (
                    row.kl_02 || "—"
                  )}
                </td>
                <td className={`px-2 py-2 text-center font-medium ${getKlDcChenhDisplayClass(computeKlDcChenhDiff(row.kl_02, row.kl_01))}`}>{row.chenh_lech || "—"}</td>
              </tr>
            )
          )}
        </tbody>
      </ResizableTableFrame>
      </div>
    </div>
  );
}
