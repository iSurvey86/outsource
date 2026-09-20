"use client";

import React from "react";

/**
 * Khung bảng: table-layout fixed + colgroup + căn giữa tùy chọn.
 */
export default function ResizableTableFrame({
  widths = [],
  totalWidth,
  centered = false,
  maxWidthClass = "max-w-5xl",
  className = "",
  tableClassName = "",
  /** false = giữ đúng px từng cột, không co theo khung (tránh chồng chữ header). */
  shrinkToFit = true,
  /** Callback ref từ useResizableTableColumns (fitContainer). */
  containerRef,
  fitContainer = false,
  children,
}) {
  const tableW = totalWidth || widths.reduce((s, w) => s + w, 0);

  return (
    <div
      ref={containerRef}
      className={`overflow-x-auto w-full rounded-lg border border-rose-100/80 shadow-sm ${centered ? `${maxWidthClass} mx-auto` : ""} ${className}`}
    >
      <table
        className={`border-collapse table-fixed w-full ${tableClassName}`}
        style={
          fitContainer
            ? { width: "100%", minWidth: 0 }
            : {
                width: tableW,
                ...(shrinkToFit ? { minWidth: "100%" } : {}),
              }
        }
      >
        <colgroup>
          {widths.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
        {children}
      </table>
    </div>
  );
}
