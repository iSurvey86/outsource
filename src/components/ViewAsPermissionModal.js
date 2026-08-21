"use client";

import { Eye, X } from "lucide-react";
import {
  getViewAsMeta,
  roleLabel,
} from "../lib/viewAsPermission";

/** Banner vang khi Admin dang xem voi quyen persona. */
export function ViewAsPermissionBanner({ onExit, exiting = false }) {
  const meta = getViewAsMeta();
  if (!meta) return null;
  return (
    <div className="shrink-0 border-b border-amber-300 bg-amber-500 text-amber-950 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4">
        <p className="min-w-0 text-[12px] font-bold leading-snug sm:text-[13px]">
          <span className="mr-1.5 inline-block rounded bg-amber-950 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-50">
            Xem quyền
          </span>
          Đang xem như{" "}
          <span className="font-black">{meta.target_ho_ten || meta.target_username}</span>
          {meta.target_phan_quyen ? (
            <span className="font-semibold text-amber-950/80">
              {" "}
              · {roleLabel(meta.target_phan_quyen)}
            </span>
          ) : null}
        </p>
        <button
          type="button"
          disabled={exiting}
          onClick={onExit}
          className="shrink-0 rounded-lg border border-amber-950/30 bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-amber-950 shadow-sm hover:bg-amber-50 disabled:opacity-50"
        >
          {exiting ? "Đang thoát…" : "Thoát chế độ xem"}
        </button>
      </div>
    </div>
  );
}

/** Modal chon persona (tuy chon — AppLayout dung menu sidebar). */
export default function ViewAsPermissionModal({ open, onClose, presets, busyId, error, onPick }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/45"
        aria-label="Dong"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-amber-100 bg-amber-50/80 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-black uppercase tracking-wide text-amber-950">
              Xem voi quyen
            </h2>
            <p className="mt-1 text-[11px] leading-snug text-amber-900/80">
              Chon persona theo nhom quyen. Lich su van ghi duoi ten Admin.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-amber-800 hover:bg-amber-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {error ? (
          <div className="mx-4 mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-800">
            {error}
          </div>
        ) : null}
        <ul className="space-y-1 p-3">
          {(presets || []).map((preset) => {
            const busy = busyId === preset.id;
            return (
              <li key={preset.id}>
                <button
                  type="button"
                  disabled={Boolean(busyId)}
                  onClick={() => onPick?.(preset)}
                  className="flex w-full items-start gap-2.5 rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-left hover:border-amber-300 hover:bg-amber-50/70 disabled:opacity-50"
                >
                  <Eye className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black text-slate-900">{preset.ho_ten}</span>
                    <span className="mt-0.5 block text-[11px] font-semibold text-slate-600">
                      {roleLabel(preset.phan_quyen)}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-slate-500">{preset.mo_ta}</span>
                  </span>
                  <span className="shrink-0 self-center text-[10px] font-bold uppercase text-amber-800">
                    {busy ? "…" : "Chon"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
