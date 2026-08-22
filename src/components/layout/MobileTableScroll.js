/**
 * Bọc bảng rộng — cho phép cuộn ngang trên mobile mà không vỡ layout.
 */
export default function MobileTableScroll({
  children,
  minWidth = 640,
  bleed = true,
  className = "",
}) {
  return (
    <div
      className={`min-w-0 overflow-x-auto ${bleed ? "-mx-3 px-3 sm:mx-0 sm:px-0" : ""} ${className}`}
    >
      <div className="w-full" style={{ minWidth: typeof minWidth === "number" ? `${minWidth}px` : minWidth }}>
        {children}
      </div>
    </div>
  );
}
