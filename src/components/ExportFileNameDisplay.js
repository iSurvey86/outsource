"use client";

/**
 * Một dòng: tên file căn trái (truncate) · thời gian căn phải (màu teal).
 * Dùng button (không dùng <a href>) để trình duyệt không hiện URL Storage khi hover.
 */
export default function ExportFileNameDisplay({
  displayName,
  displayTime,
  nameSuffix = null,
  href,
  className = "",
  nameClassName = "font-bold text-blue-800",
  suffixClassName = "text-[10px] font-semibold text-emerald-700",
  timeClassName = "font-semibold text-teal-700",
  title = null,
  onClick,
}) {
  const friendlyTitle =
    title || [displayName, nameSuffix, displayTime].filter(Boolean).join(" — ") || "Mở file";
  const canOpen = Boolean(href || onClick);

  const handleOpen = () => {
    if (href) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    onClick?.();
  };

  const inner = (
    <span className="flex min-w-0 max-w-full items-center justify-between gap-2 overflow-hidden">
      <span className={`flex min-w-0 items-center gap-0.5 text-left ${nameClassName}`}>
        <span className="min-w-0 truncate">{displayName || "—"}</span>
        {nameSuffix ? <span className={`shrink-0 ${suffixClassName}`}>{nameSuffix}</span> : null}
      </span>
      {displayTime ? (
        <span className={`shrink-0 whitespace-nowrap text-right ${timeClassName}`}>{displayTime}</span>
      ) : null}
    </span>
  );

  if (canOpen) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className={`block min-w-0 w-full cursor-pointer text-left text-[11px] hover:underline ${className}`}
        title={friendlyTitle}
      >
        {inner}
      </button>
    );
  }

  return <span className={`block min-w-0 max-w-full text-[11px] ${className}`}>{inner}</span>;
}
