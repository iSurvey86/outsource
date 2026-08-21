"use client";

/**
 * Ô tiêu đề cột có tay kéo chỉnh độ rộng (mé phải).
 */
export default function ResizableTh({
  children,
  columnIndex,
  onResizeStart,
  className = "",
  resizable = true,
  title,
}) {
  return (
    <th
      className={`${className?.includes("sticky") ? "" : "relative"} select-none ${className}`}
      title={title}
    >
      {children}
      {resizable ? (
        <span
          role="separator"
          aria-orientation="vertical"
          aria-label="Kéo chỉnh độ rộng cột"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onResizeStart?.(columnIndex, e.clientX);
          }}
          className="absolute top-0 right-0 z-10 h-full w-1.5 cursor-col-resize hover:bg-sky-400/50 active:bg-sky-500/60"
        />
      ) : null}
    </th>
  );
}
