"use client";

import { listBenAUsers, labelBenAUser } from "../../lib/benAUsers";

/**
 * Chọn 1 hoặc nhiều tài khoản Bên A gắn DA (`ben_a_user_ids`).
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

  function toggle(uid) {
    if (disabled) return;
    const next = selectedSet.has(uid)
      ? selected.filter((x) => x !== uid)
      : [...selected, uid];
    onChange?.(next);
  }

  return (
    <div className={className}>
      <p id={id} className="mb-1 block text-xs font-bold uppercase text-blue-900">
        Tài khoản Bên A {required ? <span className="text-rose-500">*</span> : null}
        <span className="ml-1 font-semibold normal-case text-teal-700">
          (có thể chọn nhiều — nhóm)
        </span>
      </p>
      {!options.length ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-900">
          Chưa có user phe=ben_a. Tạo trong Quản lý hệ thống trước.
        </p>
      ) : (
        <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-sky-300 bg-sky-50/80 p-2">
          {options.map((u) => {
            const checked = selectedSet.has(String(u.id));
            return (
              <li key={u.id}>
                <label
                  className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium ${
                    checked ? "bg-teal-100 text-teal-950" : "text-blue-950 hover:bg-white/80"
                  } ${disabled ? "cursor-default opacity-60" : ""}`}
                >
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-teal-700"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggle(String(u.id))}
                  />
                  <span>{labelBenAUser(u)}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-1 text-[11px] font-medium text-teal-800">
        {selected.length
          ? `Đã chọn ${selected.length} người — mỗi người đều thấy dự án này.`
          : "Chưa gán — Bên A sẽ không thấy dự án."}
      </p>
    </div>
  );
}
