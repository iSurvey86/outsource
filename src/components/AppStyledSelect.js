"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

export default function AppStyledSelect({
  name,
  value,
  onChange,
  options = [],
  placeholder = "Chọn...",
  disabled = false,
  invalid = false,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const selectedLabel = options.find((o) => o.value === value)?.label || "";

  const pick = (val) => {
    onChange({ target: { name, value: val } });
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`w-full border rounded p-2 text-sm outline-none transition font-semibold text-left flex items-center justify-between gap-2 ${
          disabled
            ? "bg-gray-100 text-gray-500 cursor-not-allowed border-gray-300"
            : invalid || !value
              ? "text-red-600 border-red-300 bg-red-50/10"
              : "text-gray-800 border-gray-300 bg-white hover:border-blue-400"
        } ${open && !disabled ? "ring-2 ring-blue-400/40 border-blue-500" : ""}`}
      >
        <span className="truncate">{value ? selectedLabel : placeholder}</span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-blue-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && !disabled && (
        <ul className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-blue-200 rounded-lg shadow-lg py-1">
          {options.map((opt) => (
            <li key={opt.value}>
              <button
                type="button"
                onClick={() => pick(opt.value)}
                className={`w-full text-left px-3 py-2.5 text-sm font-medium transition-colors ${
                  value === opt.value
                    ? "bg-blue-100 text-blue-800"
                    : "text-gray-800 hover:bg-blue-50 hover:text-blue-700"
                }`}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
