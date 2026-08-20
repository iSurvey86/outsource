"use client";

import { KS_STATUS_LABELS, PIPELINE_LABELS } from "../lib/finance";

const PIPELINE_TONE = {
  moi: "bg-sky-100 text-sky-900 ring-sky-300",
  da_tam_ung: "bg-amber-100 text-amber-950 ring-amber-300",
  dang_lam: "bg-blue-100 text-blue-950 ring-blue-300",
  da_giao_tuyen: "bg-teal-100 text-teal-950 ring-teal-300",
  da_thanh_toan: "bg-emerald-100 text-emerald-950 ring-emerald-300",
  dong: "bg-indigo-100 text-indigo-950 ring-indigo-300",
};

const KS_TONE = {
  chua_lam: "bg-sky-50 text-sky-800 ring-sky-200",
  dang_lam: "bg-amber-100 text-amber-950 ring-amber-300",
  da_xuat_ban: "bg-emerald-100 text-emerald-950 ring-emerald-300",
};

export function PipelineChip({ status }) {
  const label = PIPELINE_LABELS[status] || status;
  const tone = PIPELINE_TONE[status] || "bg-blue-100 text-blue-950 ring-blue-200";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${tone}`}>
      {label}
    </span>
  );
}

export function KsStatusChip({ status }) {
  const label = KS_STATUS_LABELS[status] || status;
  const tone = KS_TONE[status] || "bg-blue-50 text-blue-900 ring-blue-200";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${tone}`}>
      {label}
    </span>
  );
}
