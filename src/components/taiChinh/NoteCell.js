"use client";

import { useEffect, useRef, useState } from "react";

/** Ô ghi chú wrap + justify + căn giữa chiều dọc trong ô bảng. */
export default function NoteCell({ value, disabled, onCommit }) {
  const [text, setText] = useState(value || "");
  const ref = useRef(null);

  useEffect(() => {
    setText(value || "");
  }, [value]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.max(el.scrollHeight, 36)}px`;
  }, [text]);

  return (
    <div className="flex h-full min-h-[2.75rem] w-full items-center">
      <textarea
        ref={ref}
        rows={1}
        disabled={disabled}
        className="w-full resize-none overflow-hidden rounded border border-sky-200/80 bg-white/80 px-1.5 py-1.5 text-xs leading-snug text-slate-800 text-justify outline-none whitespace-pre-wrap break-words hover:border-sky-300 focus:border-sky-400 focus:bg-white focus:ring-1 focus:ring-sky-200 disabled:cursor-default disabled:border-transparent disabled:bg-transparent"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onBlur={() => {
          if ((text || "") !== (value || "")) onCommit?.(text.trim());
        }}
      />
    </div>
  );
}
