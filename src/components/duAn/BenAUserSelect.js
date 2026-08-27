"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { listBenAUsers, labelBenAUser } from "../../lib/benAUsers";

/**
 * Dropdown đa chọn tài khoản Bên A (`ben_a_user_ids`) — có ô tìm kiếm.
 */
export default function BenAUserSelect({
  users = [],
  value = [],
  onChange,
  required = false,
  disabled = false,
  className = "",
  id = "ben-a-user-select",
}) {
  const options = listBenAUsers(users);
  const selected = Array.isArray(value)
    ? value.map(String).filter(Boolean)
    : value
      ? [String(value)]
      : [];
  const selectedSet = new Set(selected);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const searchRef = useRef(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((u) => {
      const label = labelBenAUser(u).toLowerCase();
      const un = String(u.username || "").toLowerCase();
      const ht = String(u.ho_ten || "").toLowerCase();
      return label.includes(q) || un.includes(q) || ht.includes(q);
    });
  }, [options, query]);

  const selectedLabels = useMemo(
    () =>
      selected
        .map((uid) => {
          const u = options.find((x) => String(x.id) === uid);
          return u ? labelBenAUser(u) : null;
        })
        .filter(Boolean),
    [selected, options]
  );

  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    }
    function onKey(e) {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      const t = requestAnimationFrame(() => searchRef.current?.focus());
      return () => cancelAnimationFrame(t);
    }
  }, [open]);

  function toggle(uid) {
    if (disabled) return;
    const next = selectedSet.has(uid)
      ? selected.filter((x) => x !== uid)
      : [...selected, uid];
    onChange?.(next);
  }

  function clearAll(e) {
    e.stopPropagation();
    if (disabled) return;
    onChange?.([]);
  }

  const triggerText =
    selectedLabels.length === 0
      ? "Chọn tài khoản Bên A…"
      : selectedLabels.length <= 2
        ? selectedLabels.join("; ")
        : `${selectedLabels.slice(0, 2).join("; ")} (+${selectedLabels.length - 2})`;

  return (
    <div className={className} ref={rootRef}>
      <p id={id} className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-blue-600">
        Tài khoản Bên A {required ? <span className="text-rose-500">*</span> : null}
      </p>

      {!options.length ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-900">
          Chưa có user phe=ben_a. Tạo trong Quản lý hệ thống trước.
        </p>
      ) : (
        <div className="relative">
          <button
            type="button"
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-labelledby={id}
            onClick={() => {
              if (disabled) return;
              setOpen((v) => !v);
              if (open) setQuery("");
            }}
            className={`flex w-full items-center gap-2 rounded-xl border bg-sky-50/50 px-3 py-2.5 text-left text-sm outline-none transition ${
              open
                ? "border-blue-500 ring-2 ring-blue-500/30"
                : "border-sky-200 hover:border-sky-400"
            } ${disabled ? "cursor-default opacity-60" : "cursor-pointer"}`}
          >
            <span
              className={`min-w-0 flex-1 truncate font-medium ${
                selectedLabels.length ? "text-slate-800" : "text-slate-400"
              }`}
            >
              {triggerText}
            </span>
            {selected.length > 0 && !disabled ? (
              <span
                role="button"
                tabIndex={0}
                title="Bỏ chọn hết"
                onClick={clearAll}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    clearAll(e);
                  }
                }}
                className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-500 hover:bg-slate-100 hover:text-rose-600"
              >
                Xóa
              </span>
            ) : null}
            <svg
              className={`h-4 w-4 shrink-0 text-slate-500 transition ${open ? "rotate-180" : ""}`}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {open ? (
            <div
              className="absolute z-40 mt-1 w-full overflow-hidden rounded-lg border border-sky-200 bg-white shadow-lg shadow-slate-900/10"
              role="listbox"
              aria-multiselectable="true"
            >
              <div className="border-b border-slate-100 p-2">
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tìm tên hoặc username…"
                  className="w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <ul className="max-h-48 overflow-y-auto py-1">
                {filtered.length === 0 ? (
                  <li className="px-3 py-2 text-center text-xs font-medium text-slate-500">
                    Không tìm thấy tài khoản phù hợp.
                  </li>
                ) : (
                  filtered.map((u) => {
                    const uid = String(u.id);
                    const checked = selectedSet.has(uid);
                    return (
                      <li key={u.id} role="option" aria-selected={checked}>
                        <label
                          className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm font-medium ${
                            checked
                              ? "bg-teal-50 text-teal-950"
                              : "text-slate-800 hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 shrink-0 accent-teal-700"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => toggle(uid)}
                          />
                          <span className="min-w-0 truncate">{labelBenAUser(u)}</span>
                        </label>
                      </li>
                    );
                  })
                )}
              </ul>
              {selected.length > 0 ? (
                <div className="border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-teal-800">
                  Đã chọn {selected.length} người
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

    </div>
  );
}
