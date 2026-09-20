"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useAppDialog } from "./AppDialog";
import {
  BCKS_MAIN_TABS,
  CO_LY_DAT_HAT_COLS,
  CO_LY_DAT_2_HAT_COLS,
  listBcksDiaChatForms,
  computeDoDtsRow,
  BAO_CAO_DTS_DEFAULT_LOP,
} from "../lib/bcksFormRegistry";
import {
  addDiaChatTableRow,
  buildBcksDbPayload,
  buildInitialBcksForm,
  loadBcksDraft,
  mergeSavedBcksIntoForm,
  ensureCoLyDat2DefaultRows,
  ensureTnDaDefaultRows,
  ensureDoDtsComputedRows,
  ensureBaoCaoDtsBlock,
  patchBcksField,
  patchDiaChatField,
  patchDiaChatTableRow,
  patchBaoCaoDtsLayer,
  setBaoCaoDtsSoLop,
  removeDiaChatTableRow,
  saveBcksDraft,
} from "../lib/bcksInit";
import { exportBcksDiaChatExcel, formatHaNoiDateLine } from "../lib/bcksDiaChatExport";
import { saveBcksToDb } from "../lib/bcksHoSo";
import { applyBcksKqScan, isBcksKqFormKey } from "../lib/bcksKqScan";
import { emptyBcksKlRow, emptyBcksTcRow, recomputeBcksKlRow, BCKS_PHU_LUC_SLOTS, emptyBcksPhuLucFile, parseBcksPhuLucFiles, parseMuc22ViTri, joinMuc22ViTri } from "../lib/bcksReportSchema";
import { seedBcksReportFromSources } from "../lib/bcksReportSeed";
import { exportBcksWord } from "../lib/bcksWordExport";
import {
  buildBcksExportStoragePath,
  uploadBcksExportBlob,
} from "../lib/bcksExportStorage";
import {
  EXPORT_REPLACE_CONFIRM_MSG,
  hasExistingExportFile,
  syncXuatBanTaiLieuSafe,
} from "../lib/hoSoTaiLieu";
import { exportDisplayNameFromUrl } from "../lib/hoSoTaiLieuBackfill";
import { getAuthUser } from "../lib/authSession";
import { isTnNuocKetQuaOutOfSpec } from "../lib/bcksTnNuocSpec";
import { formatGiaiDoanFullName } from "../lib/giaiDoanOrder";
import { formatFileSizeMb, GEMINI_MAX_INLINE_BYTES } from "../lib/legalCatalogMime";
import DoDtsGiaiTichChart from "./DoDtsGiaiTichChart";
import { supabase } from "../lib/supabase";
import { logHoatDong } from "../lib/logger";
import { Paperclip, Trash2 } from "lucide-react";

/** Catalog QCVN nặng — load tách chunk, tránh làm hỏng graph module FormBCKS (Turbopack). */
const BcksQcvnLookupPanel = dynamic(() => import("./BcksQcvnLookupPanel"), {
  ssr: false,
  loading: () => (
    <div className="mb-2 rounded-lg border border-teal-100 bg-teal-50/40 px-3 py-2 text-[11px] text-teal-800">
      Đang tải tra cứu QCVN…
    </div>
  ),
});

const TOOLBAR_BTN =
  "inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-45 disabled:cursor-not-allowed";

const FIELD =
  "mt-1 w-full h-9 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-slate-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100";
const TEXTAREA =
  "mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate-800 text-justify leading-snug resize-y min-h-[5rem] outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100";
/** Textarea BCKS: TNR 13pt, giãn dòng 1.3, cao theo nội dung, không scroll */
const BCKS_AUTO_TA =
  "mt-1 w-full min-h-[2.75rem] box-border rounded-lg border border-gray-200 bg-white px-3 py-2 text-slate-800 text-justify outline-none overflow-hidden resize-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 [font-family:Times_New_Roman,Times,serif] text-[13pt] leading-[1.3]";
const BCKS_FIELD =
  "mt-1 w-full h-9 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-slate-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 [font-family:Times_New_Roman,Times,serif] text-[13pt] leading-[1.3]";
const BCKS_REPORT_WRAP =
  "[font-family:Times_New_Roman,Times,serif] text-[13pt] leading-[1.3]";
/** Nhãn mục con (2.1, 3.1…) — cỡ đồng bộ mục cha; màu xanh như cũ */
const BCKS_SUBHEAD =
  "mb-1 block text-sm font-bold uppercase tracking-wide text-teal-700";
/** Nhãn a)/b) — chữ thường, nghiêng, cỡ 13pt như nội dung */
const BCKS_SUBHEAD_SENTENCE =
  "mb-1 block italic font-normal tracking-normal text-teal-700 text-[13pt] leading-[1.3] normal-case";

function BcksAutoTextarea({ value, onChange, className = "", ...rest }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 44)}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value ?? ""}
      onChange={onChange}
      className={`${BCKS_AUTO_TA} ${className}`}
      style={{ fieldSizing: "content", fontFamily: '"Times New Roman", Times, serif', fontSize: "13pt", lineHeight: 1.3 }}
      {...rest}
    />
  );
}

/** Nội dung báo cáo: dòng bắt đầu bằng "- " tô đậm; click để sửa (textarea) */
function BcksDashBoldBody({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const taRef = useRef(null);
  const lines = String(value ?? "").split("\n");

  useLayoutEffect(() => {
    if (!editing || !taRef.current) return;
    const el = taRef.current;
    el.focus();
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 44)}px`;
  }, [editing, value]);

  if (editing) {
    return (
      <textarea
        ref={taRef}
        rows={1}
        value={value ?? ""}
        onChange={onChange}
        onBlur={() => setEditing(false)}
        className={BCKS_AUTO_TA}
        style={{ fieldSizing: "content", fontFamily: '"Times New Roman", Times, serif', fontSize: "13pt", lineHeight: 1.3 }}
      />
    );
  }

  return (
    <div
      role="textbox"
      tabIndex={0}
      title="Click để sửa"
      onClick={() => setEditing(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setEditing(true);
        }
      }}
      className={`${BCKS_AUTO_TA} cursor-text whitespace-pre-wrap`}
      style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: "13pt", lineHeight: 1.3 }}
    >
      {lines.length === 0 || (lines.length === 1 && !lines[0]) ? (
        <span className="text-slate-400">Click để nhập nội dung…</span>
      ) : (
        lines.map((line, i) => {
          const bold = /^\s*-\s/.test(line);
          return (
            <div key={i} className={bold ? "font-bold" : undefined}>
              {line || "\u00A0"}
            </div>
          );
        })
      )}
    </div>
  );
}

function BcksReportField({ label, children, className = "", labelClassName = "", sentenceCase = false }) {
  const labelCls = sentenceCase ? BCKS_SUBHEAD_SENTENCE : BCKS_SUBHEAD;
  return (
    <div className={`block min-w-0 ${className}`}>
      {label ? <span className={`${labelCls} ${labelClassName}`}>{label}</span> : null}
      {children}
    </div>
  );
}

/** Ô đính kèm phụ lục 7.x — metadata lưu trong hồ sơ (upload Storage làm sau) */
function BcksPhuLucSlot({ label, hint, files, onChange }) {
  const list = parseBcksPhuLucFiles(files);

  const addFiles = (fileList) => {
    const picked = Array.from(fileList || []);
    if (!picked.length) return;
    const next = [
      ...list,
      ...picked.map((f) =>
        emptyBcksPhuLucFile({
          ten: f.name,
          size: f.size || 0,
          mime: f.type || "",
        })
      ),
    ];
    onChange(next);
  };

  const removeAt = (id) => {
    onChange(list.filter((f) => f.id !== id));
  };

  return (
    <BcksReportField label={label}>
      <div className="space-y-2 rounded-lg border border-dashed border-amber-300 bg-amber-50/40 p-3 [font-family:ui-sans-serif,system-ui,sans-serif]">
        {hint ? (
          <p className="whitespace-pre-line text-[11px] leading-snug text-amber-900/80">{hint}</p>
        ) : null}
        {list.length === 0 ? (
          <p className="text-xs text-slate-400">Chưa đính kèm tệp</p>
        ) : (
          <ul className="space-y-1.5">
            {list.map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center gap-2 rounded-md border border-amber-100 bg-white px-2.5 py-1.5 text-xs text-slate-800"
              >
                <Paperclip className="h-3.5 w-3.5 shrink-0 text-amber-700" />
                {f.link ? (
                  <a href={f.link} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-semibold text-blue-700 hover:underline">
                    {f.ten}
                  </a>
                ) : (
                  <span className="min-w-0 flex-1 truncate font-semibold">{f.ten}</span>
                )}
                {f.size > 0 ? (
                  <span className="shrink-0 text-slate-400">{formatFileSizeMb(f.size)}</span>
                ) : null}
                <button
                  type="button"
                  onClick={() => removeAt(f.id)}
                  className="shrink-0 text-rose-600 hover:text-rose-800"
                  title="Gỡ tệp"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-amber-400 bg-white px-2.5 py-1.5 text-[11px] font-bold text-amber-900 hover:bg-amber-50">
            <Paperclip className="h-3 w-3" />
            Đính kèm tệp
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <span className="text-[10px] text-slate-400">PDF, Word, Excel, ảnh…</span>
        </div>
      </div>
    </BcksReportField>
  );
}

/** Bảng báo cáo (TC / KL) — TNR; padding mặc định; nội dung căn giữa theo chiều dọc ô */
const BCKS_TABLE =
  "w-full table-fixed text-[13px] leading-normal [font-family:Times_New_Roman,Times,serif]";
const BCKS_TH =
  "border border-teal-200 px-1.5 py-1 text-center align-middle";
const BCKS_TD =
  "border border-teal-100 px-1 py-0.5 align-middle";
const BCKS_KL_CELL =
  "w-full rounded border-0 bg-transparent px-1 py-0.5 text-center text-[13px] leading-normal outline-none align-middle [font-family:Times_New_Roman,Times,serif]";
const BCKS_KL_TA =
  "box-border block w-full resize-none overflow-hidden rounded border-0 bg-transparent px-1 py-0.5 text-[13px] leading-normal outline-none whitespace-pre-wrap break-words align-middle [font-family:Times_New_Roman,Times,serif]";

/**
 * Ô nội dung bảng TC/KL.
 * - Không wrap: height = scrollHeight (đã bỏ min-h) → khớp các cột input.
 * - Có wrap: scrollHeight thường thiếu mép dòng cuối → chỉ cộng thêm
 *   ~0.15 line-height dưới dòng cuối (không đụng ô 1 dòng).
 */
function BcksKlNoiDungCell({ value, onChange, justify = false }) {
  const ref = useRef(null);

  const fitHeight = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    const scrollH = el.scrollHeight;
    const cs = window.getComputedStyle(el);
    const fontSize = parseFloat(cs.fontSize) || 13;
    const lineH = Number.parseFloat(cs.lineHeight);
    const linePx = Number.isFinite(lineH) ? lineH : fontSize * 1.2;
    const padTop = parseFloat(cs.paddingTop) || 0;
    const padBottom = parseFloat(cs.paddingBottom) || 0;
    const oneLineBox = linePx + padTop + padBottom;
    const wrapped = scrollH > oneLineBox + 2;
    // Chỉ wrap: đệm tính từ dòng cuối (bù descender / đo thiếu scrollHeight)
    const extraBottom = wrapped ? Math.ceil(linePx * 0.15) : 0;
    el.style.height = `${scrollH + extraBottom}px`;
  }, []);

  useLayoutEffect(() => {
    fitHeight();
  }, [value, fitHeight]);

  useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!parent || typeof ResizeObserver === "undefined") return;
    let lastW = parent.clientWidth;
    const ro = new ResizeObserver(() => {
      const w = parent.clientWidth;
      if (Math.abs(w - lastW) < 1) return;
      lastW = w;
      fitHeight();
    });
    ro.observe(parent);
    return () => ro.disconnect();
  }, [fitHeight]);

  return (
    <textarea
      ref={ref}
      rows={1}
      className={`${BCKS_KL_TA} ${justify ? "text-justify" : "text-left"}`}
      style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: "13px", lineHeight: "normal" }}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

const ZONE = {
  chung: { wrap: "border-indigo-200", badge: "bg-indigo-600 text-white" },
  dia_chat: {
    tabIdle: "border-teal-200 text-teal-800/70 bg-white hover:bg-teal-50/50",
    tabActive: "border-teal-500 text-teal-950 bg-white shadow-sm ring-1 ring-teal-300",
    panel: "border-teal-300",
    badge: "bg-teal-700 text-white",
    head: "bg-teal-50 text-teal-950",
  },
  bcks: {
    tabIdle: "border-amber-200 text-amber-800/70 bg-white hover:bg-amber-50/50",
    tabActive: "border-amber-500 text-amber-950 bg-white shadow-sm ring-1 ring-amber-300",
    panel: "border-amber-300",
    badge: "bg-amber-600 text-white",
  },
  sub: {
    idle: "border-slate-200 text-slate-600 bg-white hover:bg-slate-50",
    active: "border-teal-500 text-teal-900 bg-teal-50/80 shadow-sm",
  },
};

/** Màu CTA sub-tab Địa chất theo tính chất hạng mục */
const DIA_CHAT_TAB_TONE = {
  co_ly_dat: {
    idle: "border-amber-200 text-amber-800/80 bg-white hover:bg-amber-50",
    active: "border-amber-600 bg-amber-600 text-white shadow-sm ring-1 ring-amber-400",
  },
  co_ly_dat_2: {
    idle: "border-amber-200 text-amber-800/80 bg-white hover:bg-amber-50",
    active: "border-amber-600 bg-amber-600 text-white shadow-sm ring-1 ring-amber-400",
  },
  tn_nuoc: {
    idle: "border-sky-200 text-sky-800/80 bg-white hover:bg-sky-50",
    active: "border-sky-600 bg-sky-600 text-white shadow-sm ring-1 ring-sky-400",
  },
  tn_da: {
    idle: "border-teal-300 text-teal-800/85 bg-white hover:bg-teal-50",
    active: "border-teal-700 bg-teal-700 text-white shadow-sm ring-1 ring-teal-500",
  },
  do_dts: {
    idle: "border-violet-200 text-violet-800/80 bg-white hover:bg-violet-50",
    active: "border-violet-600 bg-violet-600 text-white shadow-sm ring-1 ring-violet-400",
  },
  bao_cao_dts: {
    idle: "border-cyan-200 text-cyan-800/80 bg-white hover:bg-cyan-50",
    active: "border-cyan-600 bg-cyan-600 text-white shadow-sm ring-1 ring-cyan-400",
  },
};

function diaChatTabTone(key) {
  return DIA_CHAT_TAB_TONE[key] || ZONE.sub;
}

function Field({ label, children, className = "" }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="block text-[11px] font-bold uppercase tracking-wide text-teal-700">{label}</span>
      {children}
    </label>
  );
}

function CellInput({ value, onChange, className = "", readOnly = false, title }) {
  return (
    <input
      type="text"
      title={title}
      readOnly={readOnly}
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
      className={`w-full min-w-[2.5rem] rounded border border-gray-200 bg-white px-1 py-0.5 text-[11px] text-slate-800 outline-none focus:border-teal-400 ${
        readOnly ? "bg-slate-50 text-slate-600" : ""
      } ${className}`}
    />
  );
}

function CellAutoTextarea({ value, onChange, className = "" }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 18)}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      className={`block w-full resize-none overflow-hidden rounded border border-gray-200 bg-white px-1 py-0.5 text-[11px] leading-snug text-slate-800 outline-none focus:border-teal-400 ${className}`}
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
    />
  );
}

function SignRow({ fields }) {
  return (
    <div className="bcks-sign-row-3 mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
      {fields.map((f) => (
        <Field key={f.key} label={f.label} className="text-center">
          <input type="text" className={`${FIELD} text-center`} value={f.value ?? ""} onChange={(e) => f.onChange(e.target.value)} />
        </Field>
      ))}
    </div>
  );
}

function TableAddBtn({ onClick, title = "Thêm dòng", labeled = false }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={
        labeled
          ? "inline-flex items-center justify-center whitespace-nowrap rounded-md px-1 py-0.5 text-[11px] font-bold text-teal-800 hover:bg-teal-50"
          : "inline-flex h-7 w-7 items-center justify-center rounded-md text-sm font-bold leading-none text-teal-800 hover:bg-teal-50"
      }
    >
      {labeled ? "+ Thêm dòng" : "+"}
    </button>
  );
}

/** —— Cơ lý đất (mẫu 01) —— */
function CoLyDatPanel({ data, onField, onCell, onAdd, onRemove }) {
  const rows = data?.rows || [];
  const th = "border border-teal-200 px-1 py-1 text-center text-[10px] font-bold leading-tight";
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="text-sm font-black uppercase tracking-wide text-teal-900">
          Bảng tổng hợp chỉ tiêu cơ lý của mẫu đất nguyên dạng
        </h3>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Công trình">
          <input className={FIELD} value={data.cong_trinh || ""} onChange={(e) => onField("cong_trinh", e.target.value)} />
        </Field>
        <Field label="Đơn vị yêu cầu">
          <input
            className={FIELD}
            value={data.don_vi_yeu_cau || ""}
            onChange={(e) => onField("don_vi_yeu_cau", e.target.value)}
          />
        </Field>
      </div>

      <div className="overflow-x-auto rounded-lg border border-teal-200">
        <table className="min-w-[1400px] border-collapse text-[10px]">
          <thead className="bg-teal-50 text-teal-950">
            <tr>
              <th rowSpan={3} className={th}>
                Số TT
              </th>
              <th rowSpan={3} className={th}>
                Vị trí khoan mẫu
              </th>
              <th rowSpan={3} className={th}>
                Số hiệu mẫu khoan
              </th>
              <th rowSpan={3} className={th}>
                Lớp
              </th>
              <th rowSpan={3} className={th}>
                Độ sâu lấy mẫu
              </th>
              <th colSpan={10} className={th}>
                Thành phần cỡ hạt (%)
              </th>
              <th colSpan={7} className={th}>
                Chỉ tiêu vật lý
              </th>
              <th colSpan={4} className={th}>
                Hạn độ Atterberg
              </th>
              <th colSpan={2} className={th}>
                Góc nghỉ γ (°)
              </th>
              <th colSpan={3} className={th}>
                Chỉ tiêu lực học
              </th>
              <th rowSpan={3} className={th}>
                Sức chịu tải quy ước R₀
              </th>
              <th rowSpan={3} className={th}>
                Mô đun tổng biến dạng E₀
              </th>
              <th rowSpan={3} className={`${th} min-w-[160px]`}>
                Tên đất theo quy phạm
              </th>
              <th rowSpan={3} className={`${th} w-9 px-0.5 bcks-no-print`}>
                <TableAddBtn onClick={onAdd} />
              </th>
            </tr>
            <tr>
              <th colSpan={3} className={th}>
                Hạt sỏi sạn (mm)
              </th>
              <th colSpan={4} className={th}>
                Hạt cát (mm)
              </th>
              <th colSpan={2} className={th}>
                Hạt bụi (mm)
              </th>
              <th className={th}>
                Hạt sét (mm)
              </th>
              <th rowSpan={2} className={th}>
                W %
              </th>
              <th rowSpan={2} className={th}>
                γw g/cm³
              </th>
              <th rowSpan={2} className={th}>
                γc g/cm³
              </th>
              <th rowSpan={2} className={th}>
                Δ g/cm³
              </th>
              <th rowSpan={2} className={th}>
                e₀
              </th>
              <th rowSpan={2} className={th}>
                n %
              </th>
              <th rowSpan={2} className={th}>
                G %
              </th>
              <th rowSpan={2} className={th}>
                Wₗ
              </th>
              <th rowSpan={2} className={th}>
                Wp
              </th>
              <th rowSpan={2} className={th}>
                Ip
              </th>
              <th rowSpan={2} className={th}>
                B
              </th>
              <th rowSpan={2} className={th}>
                Khi khô
              </th>
              <th rowSpan={2} className={th}>
                Khi ướt
              </th>
              <th rowSpan={2} className={th}>
                C kg/cm²
              </th>
              <th rowSpan={2} className={th}>
                φ °
              </th>
              <th rowSpan={2} className={th}>
                a₁₋₂
              </th>
            </tr>
            <tr>
              {CO_LY_DAT_HAT_COLS.map((c) => (
                <th key={c.key} className={th}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="odd:bg-white even:bg-teal-50/30">
                <td className="border border-gray-200 px-1 py-0.5 text-center font-semibold">{ri + 1}</td>
                <td className="border border-gray-200 p-0.5">
                  <CellInput value={row.vi_tri_khoan} onChange={(v) => onCell(ri, "vi_tri_khoan", v)} />
                </td>
                <td className="border border-gray-200 p-0.5">
                  <CellInput value={row.so_hieu_mau} onChange={(v) => onCell(ri, "so_hieu_mau", v)} />
                </td>
                <td className="border border-gray-200 p-0.5">
                  <CellInput value={row.lop} onChange={(v) => onCell(ri, "lop", v)} />
                </td>
                <td className="border border-gray-200 p-0.5">
                  <CellInput value={row.do_sau} onChange={(v) => onCell(ri, "do_sau", v)} />
                </td>
                {CO_LY_DAT_HAT_COLS.map((c) => (
                  <td key={c.key} className="border border-gray-200 p-0.5">
                    <CellInput value={row[c.key]} onChange={(v) => onCell(ri, c.key, v)} />
                  </td>
                ))}
                {["w", "gw", "gc", "r", "e0", "n", "g", "wl", "wp", "ip", "b", "goc_nghi_kho", "goc_nghi_uot", "c", "phi", "a12", "r0", "e0_modun"].map(
                  (k) => (
                    <td key={k} className="border border-gray-200 p-0.5">
                      <CellInput value={row[k]} onChange={(v) => onCell(ri, k, v)} />
                    </td>
                  )
                )}
                <td className="border border-gray-200 p-0.5 min-w-[140px]">
                  <CellAutoTextarea value={row.ten_dat} onChange={(v) => onCell(ri, "ten_dat", v)} />
                </td>
                <td className="border border-gray-200 p-0.5 text-center">
                  {rows.length > 1 ? (
                    <button
                      type="button"
                      className="text-rose-600 font-bold text-xs"
                      title="Xóa dòng"
                      onClick={() => onRemove(ri)}
                    >
                      ×
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Field label="Ngày">
        <input type="date" className={`${FIELD} max-w-xs`} value={data.ngay || ""} onChange={(e) => onField("ngay", e.target.value)} />
      </Field>
      <SignRow
        fields={[
          { key: "nguoi_tong_hop", label: "Người tổng hợp", value: data.nguoi_tong_hop, onChange: (v) => onField("nguoi_tong_hop", v) },
          {
            key: "phong_thi_nghiem",
            label: "Phòng thí nghiệm",
            value: data.phong_thi_nghiem,
            onChange: (v) => onField("phong_thi_nghiem", v),
          },
          { key: "pho_giam_doc", label: "P. Giám đốc", value: data.pho_giam_doc, onChange: (v) => onField("pho_giam_doc", v) },
        ]}
      />
    </div>
  );
}

/** Dòng ngày trống / đã có — dùng khi in PDF TN nước */
function formatNgayThangNamLine(isoDate) {
  const blank = "Ngày..........tháng......năm..........";
  if (!isoDate) return blank;
  const m = String(isoDate).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return blank;
  return `Ngày ${Number(m[3])} tháng ${Number(m[2])} năm ${m[1]}`;
}

/** —— TN nước (mẫu 02) —— */
function TnNuocPanel({ data, tenDuAn, giaiDoan, onField, onCell, onAdd, onRemove }) {
  const rows = data?.chi_tieu || [];
  return (
    <div className={`bcks-tn-nuoc-sheet mx-auto w-full max-w-4xl space-y-4 rounded-xl border bg-white p-4 ${ZONE.dia_chat.panel}`}>
      <div className="bcks-tn-header text-center space-y-1">
        <h3 className="bcks-print-title pt-1 text-base font-black uppercase tracking-wide text-sky-900">
          Báo cáo kết quả thí nghiệm mẫu nước
        </h3>
        <p
          className="bcks-print-meta text-[12px] font-semibold text-sky-800"
          style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
        >
          <span>Dự án: {tenDuAn || "—"}</span>
          <span className="bcks-print-meta-sep" aria-hidden>
            {" · "}
          </span>
          <span>Giai đoạn: {formatGiaiDoanFullName(giaiDoan) || giaiDoan || "—"}</span>
        </p>
      </div>

      <div className="bcks-tn-header-gap h-4" aria-hidden />

      <div className="bcks-tn-meta-grid grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Nguồn gốc mẫu" className="!flex flex-col items-center text-center">
          <input className={`${FIELD} text-center`} value={data.nguon_goc_mau || ""} onChange={(e) => onField("nguon_goc_mau", e.target.value)} />
        </Field>
        <Field label="Đơn vị yêu cầu" className="!flex flex-col items-center text-center">
          <input className={`${FIELD} text-center`} value={data.don_vi_yeu_cau || ""} onChange={(e) => onField("don_vi_yeu_cau", e.target.value)} />
        </Field>
        <Field label="Ngày gửi mẫu" className="!flex flex-col items-center text-center">
          <p className="bcks-tn-date-print mt-1 hidden w-full text-center text-sm italic text-teal-900">{formatNgayThangNamLine(data.ngay_gui_mau)}</p>
          <input
            type="date"
            className={`bcks-tn-date-input ${FIELD} text-center [&::-webkit-datetime-edit]:flex [&::-webkit-datetime-edit]:w-full [&::-webkit-datetime-edit]:justify-center [&::-webkit-date-and-time-value]:text-center`}
            value={data.ngay_gui_mau || ""}
            onChange={(e) => onField("ngay_gui_mau", e.target.value)}
          />
        </Field>
        <Field label="Ngày thí nghiệm" className="!flex flex-col items-center text-center">
          <p className="bcks-tn-date-print mt-1 hidden w-full text-center text-sm italic text-teal-900">{formatNgayThangNamLine(data.ngay_thi_nghiem)}</p>
          <input
            type="date"
            className={`bcks-tn-date-input ${FIELD} text-center [&::-webkit-datetime-edit]:flex [&::-webkit-datetime-edit]:w-full [&::-webkit-datetime-edit]:justify-center [&::-webkit-date-and-time-value]:text-center`}
            value={data.ngay_thi_nghiem || ""}
            onChange={(e) => onField("ngay_thi_nghiem", e.target.value)}
          />
        </Field>
      </div>

      <h4 className="text-sm font-black uppercase text-center text-teal-800">Kết quả thí nghiệm</h4>
      <div className="overflow-x-auto rounded-lg border border-teal-200">
        <table className="bcks-tn-table min-w-full text-xs">
          <colgroup>
            <col className="bcks-tn-col-stt" />
            <col className="bcks-tn-col-chi-tieu" />
            <col className="bcks-tn-col-yeu-cau" />
            <col className="bcks-tn-col-ket-qua" />
            <col className="bcks-tn-col-pp" />
            <col className="bcks-no-print" />
          </colgroup>
          <thead className="bg-teal-50 text-teal-950">
            <tr>
              <th className="px-2 py-2 text-center font-bold">STT</th>
              <th className="px-2 py-2 text-left font-bold">Chỉ tiêu thí nghiệm</th>
              <th className="px-2 py-2 text-center font-bold">Yêu cầu</th>
              <th className="px-2 py-2 text-center font-bold">Kết quả</th>
              <th className="px-2 py-2 text-center font-bold">Phương pháp thí nghiệm</th>
              <th className="w-8 bcks-no-print" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-t border-gray-100">
                <td className="px-2 py-1.5 text-center font-semibold align-middle">{ri + 1}</td>
                <td className="px-1 py-1.5 align-middle text-left">
                  <CellInput className="text-left" value={row.chi_tieu} onChange={(v) => onCell(ri, "chi_tieu", v)} />
                </td>
                <td className="px-1 py-1.5 text-center align-middle">
                  <CellInput className="text-center" value={row.yeu_cau} onChange={(v) => onCell(ri, "yeu_cau", v)} />
                </td>
                <td className="px-1 py-1.5 text-center align-middle">
                  <CellInput
                    className={`text-center ${
                      isTnNuocKetQuaOutOfSpec(row.yeu_cau, row.ket_qua)
                        ? "bcks-tn-kq-out !font-bold !text-rose-600"
                        : ""
                    }`}
                    value={row.ket_qua}
                    onChange={(v) => onCell(ri, "ket_qua", v)}
                  />
                </td>
                <td className="px-1 py-1.5 align-middle text-center">
                  <CellInput className="text-center" value={row.phuong_phap} onChange={(v) => onCell(ri, "phuong_phap", v)} />
                </td>
                <td className="px-1 text-center align-middle bcks-no-print">
                  {rows.length > 1 ? (
                    <button type="button" className="text-rose-600 font-bold" onClick={() => onRemove(ri)}>
                      ×
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            <tr className="bcks-no-print border-t border-teal-100">
              <td className="px-1 py-1.5 align-middle whitespace-nowrap" colSpan={2}>
                <TableAddBtn onClick={onAdd} labeled />
              </td>
              <td colSpan={4} />
            </tr>
          </tbody>
        </table>
      </div>

      <label className="bcks-tn-ghi-chu flex min-w-0 max-w-full flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="shrink-0 text-sm font-semibold text-teal-800">Ghi chú:</span>
        <input
          type="text"
          className="bcks-tn-ghi-chu-input min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-slate-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          value={data.ghi_chu || ""}
          onChange={(e) => onField("ghi_chu", e.target.value)}
        />
      </label>
      <SignRow
        fields={[
          {
            key: "nguoi_thi_nghiem",
            label: "Người thí nghiệm",
            value: data.nguoi_thi_nghiem,
            onChange: (v) => onField("nguoi_thi_nghiem", v),
          },
          {
            key: "phong_thi_nghiem",
            label: "Phòng thí nghiệm",
            value: data.phong_thi_nghiem,
            onChange: (v) => onField("phong_thi_nghiem", v),
          },
          { key: "pho_giam_doc", label: "Phó giám đốc", value: data.pho_giam_doc, onChange: (v) => onField("pho_giam_doc", v) },
        ]}
      />
    </div>
  );
}

/** Nhãn header dọc (đọc từ dưới lên) — khớp mẫu PDF cơ lý đất */
function VertLabel({ children, compact = false }) {
  return (
    <span
      className={`bcks-vert-label inline-block overflow-hidden whitespace-nowrap font-semibold leading-none text-teal-950 ${
        compact ? "max-h-[6rem] text-[10px]" : "max-h-[6.5rem] text-[10.5px]"
      }`}
      style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
    >
      {children}
    </span>
  );
}

function ThVert({ children, className = "", rowSpan, colSpan, tall = false }) {
  return (
    <th
      rowSpan={rowSpan}
      colSpan={colSpan}
      className={`bcks-th-vert border border-teal-600/40 bg-teal-50 px-0 py-0.5 text-center align-middle ${className}`}
    >
      <div
        className={`bcks-th-vert-inner mx-auto flex h-full min-h-[5.25rem] items-center justify-center ${
          tall ? "min-h-[8.25rem] bcks-th-vert-tall" : ""
        }`}
      >
        <VertLabel compact={!tall}>{children}</VertLabel>
      </div>
    </th>
  );
}

function ThHoz({ children, className = "", rowSpan, colSpan }) {
  return (
    <th
      rowSpan={rowSpan}
      colSpan={colSpan}
      className={`border border-teal-200 px-0.5 py-0.5 text-center text-[10px] font-bold leading-tight text-teal-950 align-middle ${className}`}
    >
      {children}
    </th>
  );
}

/** —— Cơ lý đất: tổng hợp chỉ tiêu cơ lý các lớp đất (khớp mẫu Excel) —— */
function CoLyDat2Panel({ data, tenDuAn, giaiDoan, onField, onCell, onAdd, onRemove }) {
  const rows = (data?.rows || []).filter((r) => r?.type !== "lop");
  const hat = CO_LY_DAT_2_HAT_COLS;
  let mauStt = 0;

  const valueCols = [
    ...hat.map((c) => c.key),
    "w",
    "gamma_w",
    "gamma_bh",
    "gamma_k",
    "delta",
    "e0",
    "n",
    "g",
    "wch",
    "wd",
    "ip",
    "b",
    "phi_do",
    "phi_phut",
    "c",
    "a12",
  ];

  /** Index thật trong data.rows (có thể còn sót dòng type=lop cũ) */
  const realIndex = (filteredIndex) => {
    let seen = -1;
    for (let i = 0; i < (data?.rows || []).length; i++) {
      if (data.rows[i]?.type === "lop") continue;
      seen += 1;
      if (seen === filteredIndex) return i;
    }
    return filteredIndex;
  };

  const th = "border border-teal-600/40 bg-teal-50 px-0.5 py-1.5 text-center align-middle text-[10px] font-bold leading-tight text-teal-950";
  const thNum = "border border-teal-600/40 bg-indigo-100 px-0 py-1 text-center align-middle text-[9px] font-bold text-indigo-950";

  return (
    <div className="bcks-print-sheet space-y-3">
      <div className="bcks-print-header space-y-1 text-center">
        <h3
          className="bcks-print-title text-sm font-bold uppercase tracking-wide text-teal-900"
          style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
        >
          Bảng tổng hợp chỉ tiêu cơ lý các lớp đất
        </h3>
        <p
          className="bcks-print-meta text-[12px] font-semibold text-teal-800"
          style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
        >
          <span>Dự án: {tenDuAn || "—"}</span>
          <span className="bcks-print-meta-sep" aria-hidden>
            {" · "}
          </span>
          <span>Giai đoạn: {formatGiaiDoanFullName(giaiDoan) || giaiDoan || "—"}</span>
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-teal-200">
        <table className="bcks-print-table min-w-[1780px] border-collapse text-[11px]">
          <thead className="text-teal-950">
            {/* Hàng 1 — nhóm lớn */}
            <tr className="bcks-hr-1">
              <ThVert rowSpan={5} tall>
                TT
              </ThVert>
              <ThVert rowSpan={5} tall>
                Hố khoan
              </ThVert>
              <ThVert rowSpan={5} tall>
                Số hiệu mẫu
              </ThVert>
              <ThVert rowSpan={5} tall>
                Lớp
              </ThVert>
              <th rowSpan={2} colSpan={2} className={th}>
                Độ sâu (m)
              </th>
              <th rowSpan={2} colSpan={3} className={th}>
                Cuội – dăm
              </th>
              <th rowSpan={2} colSpan={2} className={th}>
                Sỏi – sạn
              </th>
              <th colSpan={5} className={th}>
                Cát
              </th>
              <th colSpan={3} className={th}>
                Bụi
              </th>
              <th rowSpan={2} colSpan={8} className={th}>
                Chỉ tiêu vật lý
              </th>
              <th rowSpan={2} colSpan={2} className={th}>
                Độ ẩm
              </th>
              <ThVert rowSpan={3}>Chỉ số dẻo</ThVert>
              <ThVert rowSpan={3}>Độ sệt</ThVert>
              <th rowSpan={2} colSpan={3} className={th}>
                Cắt phẳng
              </th>
              <ThVert rowSpan={3}>Hệ số nén lún</ThVert>
              <th rowSpan={5} className={`${th} min-w-[120px] px-1`}>
                Phân loại
                <br />
                <span className="font-semibold normal-case">(Theo TCVN 9362:2012)</span>
              </th>
              <th rowSpan={5} className={`${th} w-9 px-0.5 bcks-no-print`}>
                Xóa
              </th>
            </tr>
            {/* Hàng 2 — Thô / Vừa / Mịn / To / Nhỏ / Sét */}
            <tr className="bcks-hr-2">
              <th colSpan={2} className={th}>
                Thô
              </th>
              <th className={th}>
                Vừa
              </th>
              <th colSpan={2} className={th}>
                Mịn
              </th>
              <th className={th}>
                To
              </th>
              <th className={th}>
                Nhỏ
              </th>
              <th className={th}>
                Sét
              </th>
            </tr>
            {/* Hàng 3 — Từ/Đến, cỡ hạt, tên chỉ tiêu */}
            <tr>
              <ThVert rowSpan={3}>Từ</ThVert>
              <ThVert rowSpan={3}>Đến</ThVert>
              {hat.map((c) => (
                <ThVert key={c.key}>{`${c.label} (mm)`}</ThVert>
              ))}
              <ThVert>Độ ẩm tự nhiên</ThVert>
              <ThVert>Dung trọng tự nhiên</ThVert>
              <ThVert>Dung trọng bão hòa</ThVert>
              <ThVert>Dung trọng khô</ThVert>
              <ThVert>Khối lượng riêng</ThVert>
              <ThVert>Hệ số rỗng tự nhiên</ThVert>
              <ThVert>Độ lỗ rỗng</ThVert>
              <ThVert>Độ bão hòa</ThVert>
              <ThVert>Giới hạn chảy</ThVert>
              <ThVert>Giới hạn dẻo</ThVert>
              <ThVert>Góc ma sát trong</ThVert>
              <ThVert>Góc ma sát (′)</ThVert>
              <ThVert>Lực dính kết</ThVert>
            </tr>
            {/* Hàng 4 — Thành phần hạt + ký hiệu */}
            <tr className="bcks-hr-4">
              <th colSpan={13} className={th}>
                Thành phần hạt P (%)
              </th>
              <th className={th}>W</th>
              <th className={th}>gw</th>
              <th className={th}>gc</th>
              <th className={th}>
                γ<sub>k</sub>
              </th>
              <th className={th}>ρ</th>
              <th className={th}>
                ε<sub>0</sub>
              </th>
              <th className={th}>h</th>
              <th className={th}>G</th>
              <th className={th}>
                W<sub>ch</sub>
              </th>
              <th className={th}>
                W<sub>d</sub>
              </th>
              <th className={th}>
                I<sub>p</sub>
              </th>
              <th className={th}>B</th>
              <th colSpan={2} className={th}>
                φ°
              </th>
              <th className={th}>C</th>
              <th className={th}>
                a<sub>1-2</sub>
              </th>
            </tr>
            {/* Hàng 5 — đơn vị */}
            <tr className="bcks-hr-5">
              {hat.map((c) => (
                <th key={`u-${c.key}`} className={th}>
                  %
                </th>
              ))}
              <th className={th}>%</th>
              <th className={th}>g/cm³</th>
              <th className={th}>g/cm³</th>
              <th className={th}>g/cm³</th>
              <th className={th}>g/cm³</th>
              <th className={th}>—</th>
              <th className={th}>%</th>
              <th className={th}>%</th>
              <th className={th}>%</th>
              <th className={th}>%</th>
              <th className={th}>%</th>
              <th className={th}>—</th>
              <th className={th}>độ</th>
              <th className={th}>phút</th>
              <th className={th}>kG/cm²</th>
              <th className={th}>kG/cm²</th>
            </tr>
            {/* Hàng số cột 1…37 (37 = cột thao tác, ẩn khi in/xuất) */}
            <tr className="bcks-hr-6">
              {Array.from({ length: 37 }, (_, i) => (
                <th key={`n-${i}`} className={`${thNum}${i === 36 ? " bcks-no-print" : ""}`}>
                  {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, fi) => {
              const ri = realIndex(fi);
              const type = row.type || "mau";
              const isAvg = type === "trung_binh";
              if (!isAvg) mauStt += 1;
              const sttLabel = isAvg ? "TB" : String(mauStt);

              return (
                <tr
                  key={ri}
                  className={
                    isAvg
                      ? "bcks-row-avg bg-cyan-50/70 font-semibold"
                      : fi % 2 === 0
                        ? "bcks-row-plain bg-white"
                        : "bcks-row-zebra bg-orange-50/70"
                  }
                >
                  <td className="border border-teal-600/30 px-1 text-center font-semibold">{sttLabel}</td>
                  <td className="border border-teal-600/30 p-0.5">
                    {isAvg ? (
                      <span className="block px-1 text-center text-[11px] text-teal-800">Trung bình lớp</span>
                    ) : (
                      <CellInput
                        className="text-center"
                        value={row.ho_khoan}
                        onChange={(v) => onCell(ri, "ho_khoan", v)}
                      />
                    )}
                  </td>
                  <td className="border border-teal-600/30 p-0.5">
                    {isAvg ? (
                      <span className="block text-center px-1">—</span>
                    ) : (
                      <CellInput
                        className="text-center"
                        value={row.so_hieu_mau}
                        onChange={(v) => onCell(ri, "so_hieu_mau", v)}
                      />
                    )}
                  </td>
                  <td className="border border-teal-600/30 p-0.5">
                    <CellInput className="text-center" value={row.lop} onChange={(v) => onCell(ri, "lop", v)} />
                  </td>
                  <td className="border border-teal-600/30 p-0.5">
                    {isAvg ? (
                      <span className="block text-center px-1">—</span>
                    ) : (
                      <CellInput
                        className="text-center"
                        value={row.do_sau_tu}
                        onChange={(v) => onCell(ri, "do_sau_tu", v)}
                      />
                    )}
                  </td>
                  <td className="border border-teal-600/30 p-0.5">
                    {isAvg ? (
                      <span className="block text-center px-1">—</span>
                    ) : (
                      <CellInput
                        className="text-center"
                        value={row.do_sau_den}
                        onChange={(v) => onCell(ri, "do_sau_den", v)}
                      />
                    )}
                  </td>
                  {valueCols.map((k) => (
                    <td key={k} className="border border-teal-600/30 p-0.5">
                      <CellInput className="text-center" value={row[k]} onChange={(v) => onCell(ri, k, v)} />
                    </td>
                  ))}
                  <td className="border border-teal-600/30 p-0.5 min-w-[120px]">
                    <CellAutoTextarea
                      className="text-center"
                      value={row.phan_loai}
                      onChange={(v) => onCell(ri, "phan_loai", v)}
                    />
                  </td>
                  <td className="border border-teal-600/30 px-0.5 text-center align-middle bcks-no-print">
                    <button
                      type="button"
                      title={rows.length > 1 ? "Xóa dòng" : "Cần ít nhất 1 dòng"}
                      disabled={rows.length <= 1}
                      onClick={() => onRemove(ri)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex flex-wrap gap-2 bcks-no-print">
        <button
          type="button"
          onClick={() => onAdd("mau")}
          className="rounded-lg border border-teal-300 bg-teal-50 px-3 py-1.5 text-[11px] font-bold text-teal-800 hover:bg-teal-100"
        >
          + Thêm mẫu
        </button>
        <button
          type="button"
          onClick={() => onAdd("trung_binh")}
          className="rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-1.5 text-[11px] font-bold text-cyan-900 hover:bg-cyan-100"
        >
          + Trung bình lớp
        </button>
      </div>

      <div className="bcks-sign-ngay mt-4 flex flex-col items-end gap-1.5">
        <p
          className="bcks-sign-ngay-line max-w-full text-right text-sm font-normal italic text-slate-700"
          style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
        >
          {formatHaNoiDateLine(data.ngay)}
        </p>
        <input
          type="date"
          title="Chọn ngày để điền vào dòng Hà Nội, ngày…tháng…năm…"
          className={`${FIELD} max-w-[11rem] text-right`}
          value={data.ngay || ""}
          onChange={(e) => onField("ngay", e.target.value)}
        />
      </div>
      <div className="bcks-sign-row mt-6 flex w-full flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-start sm:gap-6">
        <fieldset className="bcks-sign-box w-full max-w-[13.5rem] rounded-md border border-teal-400/80 bg-white px-2 pb-1.5 pt-0 sm:max-w-[12.5rem]">
          <legend className="mx-auto w-fit px-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-teal-700">
            Người lập
          </legend>
          <input
            type="text"
            className="mt-0.5 w-full border-0 bg-transparent px-0.5 py-1 text-center text-xs text-slate-800 outline-none focus:ring-0"
            value={data.nguoi_lap ?? ""}
            onChange={(e) => onField("nguoi_lap", e.target.value)}
          />
        </fieldset>
        <fieldset className="bcks-sign-box bcks-sign-kiem-tra ml-auto w-full max-w-[13.5rem] rounded-md border border-teal-400/80 bg-white px-2 pb-1.5 pt-0 sm:max-w-[12.5rem]">
          <legend className="mx-auto w-fit px-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-teal-700">
            Người kiểm tra
          </legend>
          <input
            type="text"
            className="mt-0.5 w-full border-0 bg-transparent px-0.5 py-1 text-center text-xs text-slate-800 outline-none focus:ring-0"
            value={data.nguoi_kiem_tra ?? ""}
            onChange={(e) => onField("nguoi_kiem_tra", e.target.value)}
          />
        </fieldset>
      </div>
    </div>
  );
}

/** —— TN đá (mẫu 03) —— */
function TnDaPanel({ data, tenDuAn, giaiDoan, onField, onCell, onAdd, onRemove }) {
  const rows = data?.rows || [];
  const th =
    "border border-teal-600/45 bg-teal-50 px-1 py-1 text-center text-[9px] font-bold leading-tight text-teal-950";
  const td = "border border-teal-600/35 p-0.5";
  const fieldTeal = `${FIELD} !border-teal-200 !text-teal-950 focus:!border-teal-500 focus:!ring-teal-100`;
  const cellTeal = "!border-teal-200 !bg-white !text-teal-950 focus:!border-teal-500";
  return (
    <div className={`bcks-tn-da-sheet mx-auto w-full max-w-6xl space-y-4 rounded-xl border bg-white p-4 ${ZONE.dia_chat.panel}`}>
      <div className="bcks-tn-da-header text-center space-y-1">
        <h3 className="bcks-print-title pt-1 text-sm font-black uppercase tracking-wide text-teal-950">
          Bảng tổng hợp kết quả thí nghiệm mẫu đá
        </h3>
        <p className="bcks-tn-da-pptn text-xs font-medium text-teal-700">(ppTN: {data.pp_tn || "7572-10:06"})</p>
        <p
          className="bcks-tn-da-meta-du-an text-[12px] font-semibold text-teal-800"
          style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
        >
          Dự án: {tenDuAn || "—"}
        </p>
        <p
          className="bcks-tn-da-meta-giai-doan text-[12px] font-semibold text-teal-800"
          style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
        >
          Giai đoạn: {formatGiaiDoanFullName(giaiDoan) || giaiDoan || "—"}
        </p>
      </div>

      <div className="bcks-tn-da-meta-grid grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.8fr)_minmax(0,0.6fr)_minmax(0,0.6fr)]">
        <Field label="Đơn vị yêu cầu" className="text-center md:text-left">
          <input
            className={`${fieldTeal} text-center md:text-left`}
            value={data.don_vi_yeu_cau || ""}
            onChange={(e) => onField("don_vi_yeu_cau", e.target.value)}
          />
        </Field>
        <Field label="Ngày nhận mẫu" className="text-center">
          <p className="bcks-tn-date-print mt-1 hidden w-full text-center text-sm italic text-teal-900">
            {formatNgayThangNamLine(data.ngay_nhan_mau)}
          </p>
          <input
            type="date"
            className={`bcks-tn-date-input ${fieldTeal} text-center`}
            value={data.ngay_nhan_mau || ""}
            onChange={(e) => onField("ngay_nhan_mau", e.target.value)}
          />
        </Field>
        <Field label="Ngày thí nghiệm" className="text-center">
          <p className="bcks-tn-date-print mt-1 hidden w-full text-center text-sm italic text-teal-900">
            {formatNgayThangNamLine(data.ngay_thi_nghiem)}
          </p>
          <input
            type="date"
            className={`bcks-tn-date-input ${fieldTeal} text-center`}
            value={data.ngay_thi_nghiem || ""}
            onChange={(e) => onField("ngay_thi_nghiem", e.target.value)}
          />
        </Field>
      </div>

      <div className="overflow-x-auto rounded-lg border border-teal-300">
        <table className="bcks-tn-da-table min-w-[1100px] border-collapse text-[9px]">
          <thead className="bg-teal-50 text-teal-950">
            {/* Hàng 1 — nhóm chỉ tiêu */}
            <tr>
              <th rowSpan={4} className={th}>
                Số TT
              </th>
              <th rowSpan={4} className={`${th} min-w-[4.5rem] whitespace-normal`}>
                <span className="block whitespace-nowrap">Số hiệu</span>
                <span className="block whitespace-nowrap">thí nghiệm</span>
              </th>
              <th rowSpan={4} className={th}>
                Lớp
              </th>
              <th rowSpan={4} className={th}>
                Vị trí lấy mẫu
              </th>
              <th rowSpan={4} className={th}>
                Độ sâu
                <br />
                <span className="font-semibold normal-case">(m)</span>
              </th>
              <th rowSpan={4} className={`${th} min-w-[140px]`}>
                Mô tả đá
              </th>
              <th colSpan={2} className={th}>
                Độ ẩm
              </th>
              <th rowSpan={2} className={th}>
                Tỷ trọng
              </th>
              <th colSpan={3} className={th}>
                Khối lượng thể tích
              </th>
              <th rowSpan={2} className={th}>
                Độ rỗng
              </th>
              <th colSpan={2} className={th}>
                Độ BH
              </th>
              <th colSpan={2} className={th}>
                C/độ kháng nén
              </th>
              <th rowSpan={2} className={th}>
                Hệ số mềm
              </th>
              <th rowSpan={5} className={`${th} w-8 bcks-no-print`} />
            </tr>
            {/* Hàng 2 — phân loại KG / BH / … */}
            <tr>
              <th className={th}>KG</th>
              <th className={th}>BH</th>
              <th className={th}>KG</th>
              <th className={th}>BH</th>
              <th className={th}>T/đối</th>
              <th className={th}>Tự do</th>
              <th className={th}>C/bức</th>
              <th className={th}>Khô gió</th>
              <th className={th}>Bão hòa</th>
            </tr>
            {/* Hàng 3 — ký hiệu */}
            <tr>
              <th className={th}>W₀</th>
              <th className={th}>Ws</th>
              <th className={th}>ρ</th>
              <th className={th}>γ₀</th>
              <th className={th}>γs</th>
              <th className={th}>γc</th>
              <th className={th}>n</th>
              <th className={th}>G₀</th>
              <th className={th}>Gs</th>
              <th className={th}>δC</th>
              <th className={th}>δCH</th>
              <th className={th}>K</th>
            </tr>
            {/* Hàng 4 — đơn vị */}
            <tr>
              <th colSpan={2} className={th}>
                %
              </th>
              <th colSpan={4} className={th}>
                g/cm³
              </th>
              <th className={th}>%</th>
              <th colSpan={2} className={th} />
              <th colSpan={2} className={th}>
                (kg/cm²)
              </th>
              <th className={th}>%</th>
            </tr>
            {/* Hàng 5 — số cột (màu khác header) */}
            <tr>
              {Array.from({ length: 18 }, (_, i) => (
                <th
                  key={`n-${i}`}
                  className="border border-teal-600/45 !bg-amber-100 px-1 py-1 text-center text-[9px] font-bold text-amber-950"
                >
                  {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-[#FDEADA]/70"}>
                <td className={`${td} px-1 text-center font-semibold text-teal-950`}>{ri + 1}</td>
                {[
                  "so_hieu_tn",
                  "lop",
                  "vi_tri",
                  "do_sau",
                  "mo_ta_da",
                  "w0",
                  "ws",
                  "r",
                  "g0",
                  "gs",
                  "gc",
                  "n",
                  "g0_bh",
                  "gs_bh",
                  "dc",
                  "dch",
                  "k",
                ].map((k) => (
                  <td key={k} className={`${td} ${ri % 2 === 0 ? "bg-white" : "bg-[#FDEADA]/70"}`}>
                    {k === "mo_ta_da" ? (
                      <CellAutoTextarea
                        className={`${cellTeal} ${ri % 2 === 0 ? "!bg-white" : "!bg-transparent"}`}
                        value={row[k]}
                        onChange={(v) => onCell(ri, k, v)}
                      />
                    ) : (
                      <CellInput
                        className={`${cellTeal} text-center ${ri % 2 === 0 ? "!bg-white" : "!bg-transparent"}`}
                        value={row[k]}
                        onChange={(v) => onCell(ri, k, v)}
                      />
                    )}
                  </td>
                ))}
                <td className={`${td} text-center align-middle bcks-no-print ${ri % 2 === 0 ? "bg-white" : "bg-[#FDEADA]/70"}`}>
                  <button
                    type="button"
                    title={rows.length > 1 ? "Xóa dòng" : "Cần ít nhất 1 dòng"}
                    disabled={rows.length <= 1}
                    onClick={() => onRemove(ri)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
            <tr className="bcks-no-print">
              <td className={`${td} px-1 py-1 align-middle whitespace-nowrap`} colSpan={4}>
                <TableAddBtn onClick={onAdd} labeled />
              </td>
              <td className={td} colSpan={15} />
            </tr>
          </tbody>
        </table>
      </div>
      <SignRow
        fields={[
          {
            key: "nguoi_thi_nghiem",
            label: "Người thí nghiệm",
            value: data.nguoi_thi_nghiem,
            onChange: (v) => onField("nguoi_thi_nghiem", v),
          },
          {
            key: "truong_phong_tn",
            label: "Trưởng phòng thí nghiệm",
            value: data.truong_phong_tn,
            onChange: (v) => onField("truong_phong_tn", v),
          },
          { key: "pho_giam_doc", label: "Phó giám đốc", value: data.pho_giam_doc, onChange: (v) => onField("pho_giam_doc", v) },
        ]}
      />
    </div>
  );
}

/** Hiển thị số Đo ĐTS luôn 2 chữ số thập phân: 0.50, 5.00 */
function formatDoDts2(v) {
  if (v === "" || v == null) return "";
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n.toFixed(2) : String(v);
}

/** Sơ đồ bố trí A—M—O—N—B — ống block arrow đỏ ngoài, xanh trong */
function DoDtsBoTriDiagram() {
  const pts = { A: 56, M: 120, O: 200, N: 280, B: 344 };
  const y = 30;
  const yLabel = 50;

  /** Ống 2 đầu kiểu block arrow: đầu rộng hơn thân, vai vuông 90° */
  const hollowBlockArrow = (
    x1,
    x2,
    { shaftH = 5, headH = 11, headW = 16, color = "#dc2626", strokeW = 2.4 } = {}
  ) => {
    const xl = x1 + headW;
    const xr = x2 - headW;
    const d = [
      `M ${x1} ${y}`,
      `L ${xl} ${y - headH}`,
      `L ${xl} ${y - shaftH}`,
      `L ${xr} ${y - shaftH}`,
      `L ${xr} ${y - headH}`,
      `L ${x2} ${y}`,
      `L ${xr} ${y + headH}`,
      `L ${xr} ${y + shaftH}`,
      `L ${xl} ${y + shaftH}`,
      `L ${xl} ${y + headH}`,
      "Z",
    ].join(" ");
    return (
      <path
        d={d}
        fill="#ffffff"
        stroke={color}
        strokeWidth={strokeW}
        strokeLinejoin="miter"
        strokeLinecap="butt"
      />
    );
  };

  return (
    <div className="bcks-do-dts-bo-tri bg-white p-3" data-do-dts-capture="bo-tri">
      <p className="bcks-do-dts-bo-tri-title mb-1 text-[12px] font-bold text-amber-900">
        Bố trí thiết bị đo điện trở của đất
      </p>
      <svg
        className="bcks-do-dts-bo-tri-svg mx-auto block w-full max-w-lg"
        viewBox="0 0 400 78"
        role="img"
        aria-label="Sơ đồ bố trí ống A M O N B"
      >
        {/* Ống đỏ ngoài A—B — ngắn/nhỏ hơn */}
        {hollowBlockArrow(pts.A, pts.B, {
          shaftH: 4,
          headH: 7.5,
          headW: 11,
          color: "#dc2626",
          strokeW: 1.5,
        })}
        {/* Ống xanh trong M—N */}
        {hollowBlockArrow(pts.M, pts.N, {
          shaftH: 1.6,
          headH: 3.4,
          headW: 8,
          color: "#1e3a8a",
          strokeW: 1.3,
        })}
        {Object.entries(pts).map(([lab, x]) => (
          <text
            key={lab}
            x={x}
            y={yLabel}
            textAnchor="middle"
            fontFamily="Arial, Helvetica, sans-serif"
            fontSize="9"
            fontWeight="600"
            fill="#334155"
          >
            {lab}
          </text>
        ))}
        <text
          x={pts.O}
          y={70}
          textAnchor="middle"
          fontFamily="Arial, Helvetica, sans-serif"
          fontSize="8"
          fill="#64748b"
        >
          Vị trí đặt máy
        </text>
      </svg>
    </div>
  );
}

/** —— Đo ĐTS (mẫu 04) —— */
function DoDtsPanel({
  data,
  tenDuAn,
  giaiDoan,
  onField,
  onCell,
  onAdd,
  onRemove,
  onPhanTichCell,
  onPhanTichAdd,
  onPhanTichRemove,
}) {
  const rows = (data?.rows || []).map((row) => computeDoDtsRow(row || {}));
  return (
    <div className={`bcks-do-dts-sheet space-y-4 ${ZONE.dia_chat.panel}`}>
      <div className="bcks-do-dts-grid grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Trang 1 PDF — Báo cáo */}
        <div className="bcks-do-dts-main bcks-do-dts-page1 rounded-xl border border-teal-200 bg-white p-4 space-y-3">
          <h3 className="bcks-do-dts-title text-sm font-black uppercase text-center text-teal-900">
            Báo cáo kết quả đo điện trở suất
          </h3>
          <div
            className="bcks-do-dts-meta space-y-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-sky-800"
            style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
          >
            <p className="bcks-do-dts-meta-line m-0">Dự án: {tenDuAn || "—"}</p>
            <p className="bcks-do-dts-meta-line m-0">
              Giai đoạn: {formatGiaiDoanFullName(giaiDoan) || giaiDoan || "—"}
            </p>
          </div>
          <div className="bcks-do-dts-thiet-bi mx-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 text-[12px] leading-none sm:mx-6">
            <label className="inline-flex min-w-0 flex-1 items-baseline gap-1.5">
              <span className="shrink-0 text-[12px] font-bold uppercase tracking-wide text-teal-800">
                Mã số thiết bị:
              </span>
              <input
                className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[12px] font-semibold leading-none text-teal-900 outline-none focus:ring-0"
                value={data.ma_thiet_bi || ""}
                onChange={(e) => onField("ma_thiet_bi", e.target.value)}
              />
            </label>
            <label className="inline-flex min-w-0 flex-1 items-baseline justify-end gap-1.5">
              <span className="shrink-0 text-[12px] font-bold uppercase tracking-wide text-teal-800">
                Số Serial:
              </span>
              <input
                className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[12px] font-semibold leading-none text-teal-900 outline-none placeholder:text-[12px] placeholder:font-semibold placeholder:text-teal-900/35 focus:ring-0"
                value={data.so_series || ""}
                onChange={(e) => onField("so_series", e.target.value)}
                placeholder="123456"
              />
            </label>
          </div>

          <div className="bcks-do-dts-cong-thuc rounded-lg bg-slate-50 border border-slate-200 p-3 text-[11px] text-slate-700 leading-relaxed space-y-1.5">
            <p className="font-semibold">Điện trở của đất được tính từ kết quả đo ngoài hiện trường:</p>
            <p className="bcks-do-dts-formula py-1 text-center font-mono text-sm font-semibold" style={{ color: "#0000FF" }}>
              ρₖ = k × U / I
            </p>
            <p className="font-semibold">Trong đó:</p>
            <div className="pl-8 space-y-0.5">
              <p>U: Hiệu điện thế</p>
              <p>I: Cường độ dòng điện A-B</p>
              <p>k: Hệ số thiết bị k = π × AM × AN / MN</p>
            </div>
            <p>
              Độ sâu bất kỳ tương ứng với Điện trở suất của đất được tính bởi công thức (1/3)*(AB/2)
            </p>
          </div>

          <Field label="Bảng tính điểm" className="bcks-do-dts-diem">
            <input
              className={FIELD}
              placeholder="VD: K1 (DD-VT01)"
              value={data.diem_do || ""}
              onChange={(e) => onField("diem_do", e.target.value)}
            />
          </Field>

          <div className="bcks-do-dts-table-wrap overflow-x-auto">
            <table className="bcks-do-dts-table min-w-full border-collapse text-xs">
              <thead className="bg-teal-50 text-teal-950">
                <tr>
                  {["TT", "AB/2 (m)", "MN (m)", "k", "U (mV)", "I (mA)", "ρₖ (Ωm)", "Độ sâu (m)"].map((h) => (
                    <th
                      key={h}
                      className="border border-teal-600/45 bg-teal-50 px-1.5 py-2 text-center font-bold whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                  <th className="w-9 border border-teal-600/45 px-0.5 bcks-no-print">
                    <TableAddBtn onClick={onAdd} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} className="border-t border-gray-100">
                    <td className="border border-teal-600/35 px-1 py-1 text-center font-semibold">{ri + 1}</td>
                    {["ab2", "mn"].map((k) => (
                      <td key={k} className="border border-teal-600/35 p-0.5">
                        <CellInput value={row[k]} onChange={(v) => onCell(ri, k, v)} />
                      </td>
                    ))}
                    <td className="border border-teal-600/35 p-0.5">
                      <CellInput
                        value={formatDoDts2(row.k)}
                        readOnly
                        title="Tự tính: π×(AB/2−MN/2)×(AB/2+MN/2)/MN"
                        className="!text-sky-700 font-semibold"
                      />
                    </td>
                    {["u_mv", "i_ma"].map((k) => (
                      <td key={k} className="border border-teal-600/35 p-0.5">
                        <CellInput value={row[k]} onChange={(v) => onCell(ri, k, v)} />
                      </td>
                    ))}
                    <td className="border border-teal-600/35 p-0.5">
                      <CellInput
                        value={formatDoDts2(row.rho_k)}
                        readOnly
                        title="Tự tính: k×U/I"
                        className="!text-sky-700 font-semibold"
                      />
                    </td>
                    <td className="border border-teal-600/35 p-0.5">
                      <CellInput
                        value={formatDoDts2(row.do_sau)}
                        readOnly
                        title="Tự tính: (1/3)×(AB/2)"
                        className="!text-sky-700 font-semibold"
                      />
                    </td>
                    <td className="border border-teal-600/35 text-center bcks-no-print">
                      {rows.length > 1 ? (
                        <button type="button" className="text-rose-600 font-bold" onClick={() => onRemove(ri)}>
                          ×
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <DoDtsBoTriDiagram />

          <div className="bcks-do-dts-signs mx-4 mt-4 flex items-start justify-between gap-6 sm:mx-6">
            <label className="bcks-do-dts-sign-left block w-[42%] text-center">
              <span className="block text-center text-[11px] font-bold uppercase tracking-wide text-teal-700">
                Người đo và tính
              </span>
              <input
                type="text"
                className={`${FIELD} mt-1 text-center`}
                value={data.nguoi_do ?? ""}
                onChange={(e) => onField("nguoi_do", e.target.value)}
              />
            </label>
            <label className="bcks-do-dts-sign-right block w-[42%] text-center">
              <span className="block text-center text-[11px] font-bold uppercase tracking-wide text-teal-700">
                Người kiểm tra
              </span>
              <input
                type="text"
                className={`${FIELD} mt-1 text-center`}
                value={data.nguoi_kiem_tra ?? ""}
                onChange={(e) => onField("nguoi_kiem_tra", e.target.value)}
              />
            </label>
          </div>
        </div>

        {/* Trang 2 PDF — Giải tích */}
        <div className="bcks-do-dts-giai-tich bcks-do-dts-page2 flex flex-col gap-5 rounded-xl border border-amber-200 bg-amber-50/30 p-4">
          {/* Cùng khoảng cách tiêu đề→Dự án như trang Báo cáo (space-y-3) */}
          <div className="bcks-do-dts-giai-tich-head space-y-3">
            <h3 className="bcks-do-dts-title bcks-do-dts-giai-tich-title text-sm font-black uppercase text-center text-amber-900">
              Giải tích kết quả đo điện trở suất
            </h3>
            <div
              className="bcks-do-dts-meta space-y-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-sky-800"
              style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
            >
              <p className="bcks-do-dts-meta-line m-0">Dự án: {tenDuAn || "—"}</p>
              <p className="bcks-do-dts-meta-line m-0">
                Giai đoạn: {formatGiaiDoanFullName(giaiDoan) || giaiDoan || "—"}
              </p>
            </div>
          </div>

          <DoDtsGiaiTichChart rows={data?.rows} phanTich={data?.phan_tich} diemDo={data?.diem_do} />

          <div className="bcks-do-dts-phan-tich mt-16 flex flex-col items-start">
            <div className="w-[17rem] max-w-full">
              <h4 className="mb-1.5 text-[11px] font-semibold leading-tight text-amber-950">
                Bảng phân tích điện trở suất
              </h4>
              <div className="rounded border border-amber-300 bg-white">
                <table className="bcks-do-dts-phan-tich-table w-full table-fixed text-[11px]">
                  <thead className="bg-amber-50 text-amber-950">
                    <tr>
                      {[
                        { h: "N", w: "w-8" },
                        { h: "ρ", w: "w-[3rem]" },
                        { h: "h", w: "w-[2.75rem]" },
                        { h: "d", w: "w-[2.75rem]" },
                        { h: "Alt", w: "w-[3rem]" },
                      ].map(({ h, w }) => (
                        <th
                          key={h}
                          className={`border border-amber-200/80 px-0.5 py-0.5 text-center font-bold ${w}`}
                        >
                          {h}
                        </th>
                      ))}
                      <th className="w-7 border border-amber-200/80 px-0 bcks-no-print">
                        <TableAddBtn onClick={onPhanTichAdd} title="Thêm lớp" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.phan_tich || []).map((row, ri) => (
                      <tr key={ri} className="border-t border-amber-100">
                        <td className="border border-amber-100 bg-slate-50 px-0.5 py-0.5 text-center font-semibold text-slate-600">
                          {ri + 1}
                        </td>
                        {["rho", "h"].map((k) => (
                          <td key={k} className="border border-amber-100 p-0">
                            <CellInput
                              value={row[k]}
                              onChange={(v) => onPhanTichCell(ri, k, v)}
                              className="!min-w-0 !rounded-none !border-0 !px-0.5 !py-0.5 text-center"
                            />
                          </td>
                        ))}
                        <td className="border border-amber-100 p-0">
                          <CellInput
                            value={row.d}
                            readOnly
                            title="Tự tính: tích lũy h"
                            className="!min-w-0 !rounded-none !border-0 !bg-slate-50 !px-0.5 !py-0.5 text-center !text-sky-700"
                          />
                        </td>
                        <td className="border border-amber-100 p-0">
                          <CellInput
                            value={row.alt}
                            readOnly
                            title="Tự tính: −d"
                            className="!min-w-0 !rounded-none !border-0 !bg-slate-50 !px-0.5 !py-0.5 text-center !text-sky-700"
                          />
                        </td>
                        <td className="border border-amber-100 text-center bcks-no-print">
                          {(data?.phan_tich || []).length > 1 ? (
                            <button
                              type="button"
                              className="text-rose-600 font-bold leading-none"
                              onClick={() => onPhanTichRemove(ri)}
                            >
                              ×
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="bcks-do-dts-signs mx-4 mt-4 flex items-start justify-between gap-6 sm:mx-6">
            <label className="bcks-do-dts-sign-left block w-[42%] text-center">
              <span className="block text-center text-[11px] font-bold uppercase tracking-wide text-teal-700">
                Người đo và tính
              </span>
              <input
                type="text"
                className={`${FIELD} mt-1 text-center`}
                value={data.nguoi_do ?? ""}
                onChange={(e) => onField("nguoi_do", e.target.value)}
              />
            </label>
            <label className="bcks-do-dts-sign-right block w-[42%] text-center">
              <span className="block text-center text-[11px] font-bold uppercase tracking-wide text-teal-700">
                Người kiểm tra
              </span>
              <input
                type="text"
                className={`${FIELD} mt-1 text-center`}
                value={data.nguoi_kiem_tra ?? ""}
                onChange={(e) => onField("nguoi_kiem_tra", e.target.value)}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

/** —— Báo cáo DTS / bảng thông số tiếp địa —— */
function BaoCaoDtsPanel({
  data,
  tenDuAn,
  giaiDoan,
  onField,
  onCell,
  onLayerCell,
  onSoLopChange,
  onAdd,
  onRemove,
}) {
  const soLop = Math.max(1, Number(data?.so_lop) || BAO_CAO_DTS_DEFAULT_LOP);
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  const th =
    "border border-cyan-300 bg-cyan-50 px-1.5 py-1 text-center text-[10px] font-bold uppercase tracking-wide text-cyan-950";
  /** Không uppercase — tránh ρ → Ρ (trông như P) và h (m) → H (M) */
  const thSub =
    "border border-cyan-300 bg-cyan-50 px-1.5 py-1 text-center text-[10px] font-bold normal-case tracking-normal text-cyan-950";
  const td = "border border-cyan-200 px-1 py-0.5 align-middle";

  return (
    <div className={`bcks-bao-cao-dts-sheet mx-auto w-full max-w-6xl space-y-3 rounded-xl border bg-white p-4 ${ZONE.dia_chat.panel}`}>
      <div className="space-y-1 text-center">
        <h3 className="bcks-print-title bcks-bao-cao-dts-title pt-1 text-base font-black uppercase tracking-wide text-cyan-900">
          Bảng thông số tiếp địa
        </h3>
        <div
          className="bcks-bao-cao-dts-meta bcks-print-meta space-y-1 px-3 text-center text-[12px] font-semibold uppercase leading-snug tracking-wide text-sky-800"
          style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
        >
          <p className="bcks-bao-cao-dts-meta-line m-0 break-words text-center uppercase">
            Dự án: {data?.ten_du_an || tenDuAn || "—"}
          </p>
          <p className="bcks-bao-cao-dts-meta-line m-0 break-words text-center uppercase">
            Giai đoạn:{" "}
            {data?.giai_doan
              ? formatGiaiDoanFullName(data.giai_doan) || data.giai_doan
              : formatGiaiDoanFullName(giaiDoan) || giaiDoan || "—"}
          </p>
        </div>
      </div>

      <div className="bcks-no-print flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-cyan-900">
          <span>Số lớp:</span>
          <button
            type="button"
            className="rounded border border-cyan-300 bg-cyan-50 px-2 py-0.5 font-bold hover:bg-cyan-100 disabled:opacity-40"
            onClick={() => onSoLopChange?.(soLop - 1)}
            disabled={soLop <= 1}
          >
            −
          </button>
          <span className="tabular-nums">{soLop}</span>
          <button
            type="button"
            className="rounded border border-cyan-300 bg-cyan-50 px-2 py-0.5 font-bold hover:bg-cyan-100 disabled:opacity-40"
            onClick={() => onSoLopChange?.(soLop + 1)}
            disabled={soLop >= 12}
          >
            +
          </button>
        </div>
        <button
          type="button"
          onClick={() => onAdd?.()}
          className="rounded-md border border-cyan-400 bg-cyan-50 px-2.5 py-1 text-[11px] font-bold text-cyan-900 hover:bg-cyan-100"
        >
          + Thêm vị trí
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-cyan-200 print:border-0">
        <table className="bcks-print-table bcks-bao-cao-dts-table w-full min-w-[52rem] border-collapse text-[11px]">
          <thead>
            <tr>
              <th rowSpan={2} className={`${th} w-10`}>
                STT
              </th>
              <th rowSpan={2} className={`${th} min-w-[6rem]`}>
                Vị trí
              </th>
              <th rowSpan={2} className={`${th} min-w-[12rem]`}>
                Mô tả môi trường vị trí
              </th>
              {Array.from({ length: soLop }, (_, i) => (
                <th key={`lop-${i}`} colSpan={2} className={th}>
                  Lớp {i + 1}
                </th>
              ))}
              <th rowSpan={2} className={`${th} bcks-no-print w-10`}>
                Xóa
              </th>
            </tr>
            <tr>
              {Array.from({ length: soLop }, (_, i) => (
                <React.Fragment key={`sub-${i}`}>
                  <th className={thSub}>h (m)</th>
                  <th className={thSub}>ρ (Ω·m)</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row, ri) => (
                <tr key={ri} className="odd:bg-white even:bg-cyan-50/40">
                  <td className={`${td} text-center tabular-nums font-semibold text-cyan-800`}>
                    {ri + 1}
                  </td>
                  <td className={td}>
                    <CellInput
                      value={row.vi_tri}
                      onChange={(v) => onCell(ri, "vi_tri", v)}
                      className="w-full min-w-[5rem] px-1 py-0.5 text-center"
                    />
                  </td>
                  <td className={td}>
                    <CellInput
                      value={row.mo_ta}
                      onChange={(v) => onCell(ri, "mo_ta", v)}
                      className="w-full min-w-[10rem] px-1 py-0.5 text-left"
                    />
                  </td>
                  {Array.from({ length: soLop }, (_, li) => {
                    const layer = row.layers?.[li] || { h: "", rho: "" };
                    return (
                      <React.Fragment key={`L${ri}-${li}`}>
                        <td className={td}>
                          <CellInput
                            value={layer.h}
                            onChange={(v) => onLayerCell(ri, li, "h", v)}
                            className="w-full min-w-[3rem] px-0.5 py-0.5 text-center tabular-nums"
                          />
                        </td>
                        <td className={td}>
                          <CellInput
                            value={layer.rho}
                            onChange={(v) => onLayerCell(ri, li, "rho", v)}
                            className="w-full min-w-[3.5rem] px-0.5 py-0.5 text-center tabular-nums"
                          />
                        </td>
                      </React.Fragment>
                    );
                  })}
                  <td className={`${td} bcks-no-print text-center`}>
                    <button
                      type="button"
                      onClick={() => onRemove(ri)}
                      disabled={rows.length <= 1}
                      className="rounded px-1.5 py-0.5 text-[10px] font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-30"
                      title="Xóa dòng"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={4 + soLop * 2}
                  className="border border-cyan-200 px-3 py-6 text-center text-cyan-700/70"
                >
                  Chưa có vị trí — bấm «Thêm vị trí».
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="bcks-no-print text-[10px] text-cyan-800/70">
        Mỗi vị trí gồm các lớp đất với chiều dày h (m) và điện trở suất ρ (Ω·m). Có thể tăng/giảm số lớp
        cột.
      </p>
    </div>
  );
}

function BcksReportPanel({
  data,
  onField,
  onKlCell,
  onKlAdd,
  onKlRemove,
  onTcCell,
  onTcAdd,
  onTcRemove,
  coverHidden,
  onHideCover,
}) {
  const rows = Array.isArray(data.muc4_1_rows) ? data.muc4_1_rows : [];
  const tcRows = Array.isArray(data.muc3_1_rows) ? data.muc3_1_rows : [];

  return (
    <div className={`w-full space-y-5 ${BCKS_REPORT_WRAP}`} style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: "13pt", lineHeight: 1.3 }}>
      <div className={`flex flex-col gap-6 lg:items-start ${coverHidden ? "" : "lg:flex-row"}`}>
        <div
          className={`min-w-0 space-y-4 ${
            coverHidden ? "mx-auto w-full max-w-4xl" : "flex-1 lg:w-2/3"
          }`}
        >
          <section className="space-y-3 rounded-xl border border-amber-200/80 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wide text-amber-900">
              1. Căn cứ thực hiện khảo sát xây dựng
            </h3>
            <BcksAutoTextarea
              value={data.muc1_can_cu || ""}
              onChange={(e) => onField("muc1_can_cu", e.target.value)}
            />
          </section>

          <section className="space-y-3 rounded-xl border border-amber-200/80 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wide text-amber-900">
              2. Khái quát vị trí, điều kiện tự nhiên, đặc điểm công trình
            </h3>
            <BcksReportField label="2.1. Đặc điểm, quy mô, tính chất">
              <BcksAutoTextarea
                value={data.muc2_1_dac_diem || ""}
                onChange={(e) => onField("muc2_1_dac_diem", e.target.value)}
              />
            </BcksReportField>
            <BcksReportField label="2.2. Vị trí và mô tả tuyến">
              {(() => {
                const { viTri, moTa } = parseMuc22ViTri(data.muc2_2_vi_tri);
                const commit = (nextVi, nextMo) => onField("muc2_2_vi_tri", joinMuc22ViTri(nextVi, nextMo));
                return (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <p className="text-[13pt] font-bold text-slate-900" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                        - Vị trí địa lý:
                      </p>
                      <input
                        type="text"
                        className={`${BCKS_FIELD} placeholder:text-red-500/80`}
                        style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: "13pt", lineHeight: 1.3 }}
                        value={viTri}
                        placeholder="Dự án nằm trên địa bàn xã ............., tỉnh ..........."
                        onChange={(e) => commit(e.target.value, moTa)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[13pt] font-bold text-slate-900" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                        - Mô tả tuyến:
                      </p>
                      <BcksAutoTextarea
                        value={moTa}
                        placeholder="Viết chi tiết thông tin mô tả tuyến, vị trí đặt trạm biến áp"
                        className="placeholder:text-red-500/80"
                        onChange={(e) => commit(viTri, e.target.value)}
                      />
                    </div>
                  </div>
                );
              })()}
            </BcksReportField>
            <BcksReportField label="2.3. Điều kiện tự nhiên">
              <BcksQcvnLookupPanel
                muc22ViTri={data.muc2_2_vi_tri}
                muc23Value={data.muc2_3_tu_nhien}
                onApply={(text) => onField("muc2_3_tu_nhien", text)}
              />
              <BcksAutoTextarea
                value={data.muc2_3_tu_nhien || ""}
                onChange={(e) => onField("muc2_3_tu_nhien", e.target.value)}
              />
            </BcksReportField>
          </section>

          <section className="space-y-3 rounded-xl border border-amber-200/80 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wide text-amber-900">
              3. Tiêu chuẩn; quy trình và phương pháp khảo sát
            </h3>
            <BcksReportField label="3.1. Tiêu chuẩn áp dụng">
              <div className="space-y-2">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={onTcAdd}
                    className="rounded-md border border-teal-300 bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-800 hover:bg-teal-100"
                  >
                    + Thêm dòng
                  </button>
                </div>
                <div className="overflow-x-auto rounded-lg border border-teal-200">
                  <table className={BCKS_TABLE}>
                    <colgroup>
                      <col className="w-12" />
                      <col className="w-[28%]" />
                      <col />
                      <col className="w-8" />
                    </colgroup>
                    <thead>
                      <tr className="bg-teal-50 font-bold uppercase tracking-wide text-teal-950">
                        <th className={BCKS_TH}>STT</th>
                        <th className={BCKS_TH}>Ký hiệu</th>
                        <th className={BCKS_TH}>Tên tài liệu</th>
                        <th className={`${BCKS_TH} px-1`} />
                      </tr>
                    </thead>
                    <tbody>
                      {tcRows.length === 0 ? (
                        <tr>
                          <td colSpan={4} className={`${BCKS_TD} px-3 py-4 text-center text-slate-500`}>
                            Chưa có dòng — seed từ danh mục tiêu chuẩn hoặc bấm «Thêm dòng».
                          </td>
                        </tr>
                      ) : (
                        tcRows.map((row, ri) => (
                          <tr key={ri}>
                            <td className={BCKS_TD}>
                              <input
                                className={BCKS_KL_CELL}
                                value={row.stt || ""}
                                onChange={(e) => onTcCell(ri, "stt", e.target.value)}
                              />
                            </td>
                            <td className={BCKS_TD}>
                              <input
                                className={`${BCKS_KL_CELL} text-left font-semibold text-teal-900`}
                                value={row.ky_hieu || ""}
                                onChange={(e) => onTcCell(ri, "ky_hieu", e.target.value)}
                              />
                            </td>
                            <td className={BCKS_TD}>
                              <BcksKlNoiDungCell
                                value={row.ten_tai_lieu || ""}
                                onChange={(v) => onTcCell(ri, "ten_tai_lieu", v)}
                              />
                            </td>
                            <td className={`${BCKS_TD} text-center`}>
                              <button
                                type="button"
                                className="text-rose-600 font-bold"
                                onClick={() => onTcRemove(ri)}
                                title="Xóa"
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </BcksReportField>
            <BcksReportField label="3.2. Máy móc thiết bị và phần mềm">
              <BcksAutoTextarea
                value={data.muc3_2_may_moc || ""}
                onChange={(e) => onField("muc3_2_may_moc", e.target.value)}
              />
            </BcksReportField>
            <div className="space-y-3">
              <p className={BCKS_SUBHEAD}>3.3. Quy trình và phương pháp khảo sát</p>
              <BcksReportField label="a) Quy trình và phương pháp khảo sát địa hình" sentenceCase>
                <BcksDashBoldBody
                  value={data.muc3_3a_dia_hinh || ""}
                  onChange={(e) => onField("muc3_3a_dia_hinh", e.target.value)}
                />
              </BcksReportField>
              <BcksReportField label="b) Quy trình và phương pháp khảo sát địa chất" sentenceCase>
                <BcksDashBoldBody
                  value={data.muc3_3b_dia_chat || ""}
                  onChange={(e) => onField("muc3_3b_dia_chat", e.target.value)}
                />
              </BcksReportField>
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-amber-200/80 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wide text-amber-900">
              4. Khối lượng đã thực hiện; kết quả sau thí nghiệm
            </h3>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold uppercase tracking-wide text-teal-700">
                  4.1. Khối lượng đã thực hiện
                </p>
                <button
                  type="button"
                  onClick={onKlAdd}
                  className="rounded-md border border-teal-300 bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-800 hover:bg-teal-100"
                >
                  + Thêm dòng
                </button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-teal-200">
                <table className={BCKS_TABLE}>
                  <colgroup>
                    <col className="w-[2.75rem]" />
                    <col />
                    <col className="w-16" />
                    <col className="w-24" />
                    <col className="w-24" />
                    <col className="w-20" />
                    <col className="w-8" />
                  </colgroup>
                  <thead>
                    <tr className="bg-teal-50 font-bold uppercase tracking-wide text-teal-950">
                      <th rowSpan={2} className={BCKS_TH}>
                        STT
                      </th>
                      <th rowSpan={2} className={BCKS_TH}>
                        Nội dung
                      </th>
                      <th rowSpan={2} className={BCKS_TH}>
                        ĐVT
                      </th>
                      <th colSpan={2} className={BCKS_TH}>
                        Khối lượng
                      </th>
                      <th rowSpan={2} className={BCKS_TH}>
                        Chênh lệch
                      </th>
                      <th rowSpan={2} className={`${BCKS_TH} px-1`} />
                    </tr>
                    <tr className="bg-teal-50 font-bold uppercase tracking-wide text-teal-950">
                      <th className={BCKS_TH}>Thực hiện</th>
                      <th className={BCKS_TH}>Phê duyệt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className={`${BCKS_TD} px-3 py-4 text-center text-slate-500`}>
                          Chưa có dòng — seed từ NVKS hoặc bấm «Thêm dòng».
                        </td>
                      </tr>
                    ) : (
                      rows.map((row, ri) =>
                        row.is_header ? (
                          <tr key={ri} className="bg-amber-50/80">
                            <td className={`${BCKS_TD} text-center font-bold`}>
                              {row.stt}
                            </td>
                            <td
                              colSpan={5}
                              className={`${BCKS_TD} text-justify font-bold text-amber-950 break-words whitespace-pre-wrap`}
                            >
                              {row.noi_dung}
                            </td>
                            <td className={`${BCKS_TD} text-center`}>
                              <button type="button" className="text-rose-600 font-bold" onClick={() => onKlRemove(ri)} title="Xóa">
                                ×
                              </button>
                            </td>
                          </tr>
                        ) : (
                          <tr key={ri}>
                            <td className={BCKS_TD}>
                              <input
                                className={BCKS_KL_CELL}
                                value={row.stt || ""}
                                onChange={(e) => onKlCell(ri, "stt", e.target.value)}
                              />
                            </td>
                            <td className={BCKS_TD}>
                              <BcksKlNoiDungCell
                                justify
                                value={row.noi_dung || ""}
                                onChange={(v) => onKlCell(ri, "noi_dung", v)}
                              />
                            </td>
                            <td className={BCKS_TD}>
                              <input
                                className={BCKS_KL_CELL}
                                value={row.don_vi || ""}
                                onChange={(e) => onKlCell(ri, "don_vi", e.target.value)}
                              />
                            </td>
                            <td className={BCKS_TD}>
                              <input
                                className={`${BCKS_KL_CELL} font-semibold text-teal-900`}
                                value={row.kl_thuc_hien || ""}
                                onChange={(e) => onKlCell(ri, "kl_thuc_hien", e.target.value)}
                              />
                            </td>
                            <td className={BCKS_TD}>
                              <input
                                className={BCKS_KL_CELL}
                                value={row.kl_phe_duyet || ""}
                                onChange={(e) => onKlCell(ri, "kl_phe_duyet", e.target.value)}
                              />
                            </td>
                            <td className={`${BCKS_TD} text-center font-semibold text-rose-700`}>
                              {row.chenh_lech || "-"}
                            </td>
                            <td className={`${BCKS_TD} text-center`}>
                              <button type="button" className="text-rose-600 font-bold" onClick={() => onKlRemove(ri)} title="Xóa">
                                ×
                              </button>
                            </td>
                          </tr>
                        )
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <BcksReportField label="4.2. Kết quả, số liệu phân tích">
              <BcksAutoTextarea
                value={data.muc4_2_ket_qua || ""}
                onChange={(e) => onField("muc4_2_ket_qua", e.target.value)}
              />
            </BcksReportField>
          </section>

          <section className="space-y-3 rounded-xl border border-amber-200/80 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wide text-amber-900">
              5. Phân tích, đánh giá và đề xuất giải pháp kỹ thuật
            </h3>
            <BcksReportField label="5.1. Phân tích, đánh giá điều kiện">
              <BcksAutoTextarea
                value={data.muc5_1_danh_gia || ""}
                onChange={(e) => onField("muc5_1_danh_gia", e.target.value)}
              />
            </BcksReportField>
            <BcksReportField label="5.2. Đề xuất giải pháp kỹ thuật">
              <BcksAutoTextarea
                value={data.muc5_2_de_xuat || ""}
                onChange={(e) => onField("muc5_2_de_xuat", e.target.value)}
              />
            </BcksReportField>
          </section>

          <section className="space-y-3 rounded-xl border border-amber-200/80 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wide text-amber-900">6. Kết luận và kiến nghị</h3>
            <BcksAutoTextarea
              value={data.muc6_ket_luan || ""}
              onChange={(e) => onField("muc6_ket_luan", e.target.value)}
            />
          </section>

          <section className="space-y-3 rounded-xl border border-amber-200/80 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wide text-amber-900">7. Các phụ lục kèm theo</h3>
            {BCKS_PHU_LUC_SLOTS.map((slot) => (
              <BcksPhuLucSlot
                key={slot.filesKey}
                label={slot.label}
                hint={data[slot.textKey] || ""}
                files={data[slot.filesKey]}
                onChange={(next) => onField(slot.filesKey, next)}
              />
            ))}
          </section>
        </div>

        {!coverHidden ? (
          <aside className="w-full shrink-0 space-y-3 lg:sticky lg:top-2 lg:w-1/3">
            <div className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2 border-b border-amber-100 pb-2">
                <h3 className="text-sm font-bold uppercase tracking-wide text-amber-900">
                  Trang bìa &amp; chữ ký
                </h3>
                <button
                  type="button"
                  onClick={() => onHideCover?.()}
                  className="bcks-no-serif shrink-0 rounded-md border-2 border-amber-600 bg-white px-2.5 py-1 text-[11px] font-black tracking-wide text-amber-950 shadow-sm hover:bg-amber-50"
                  style={{
                    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
                    fontWeight: 800,
                    letterSpacing: "0.04em",
                  }}
                  title="Ẩn khung bìa — nội dung bên trái căn giữa"
                >
                  HIDE/ẨN
                </button>
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-amber-300 text-amber-700 focus:ring-amber-200"
                    checked={Boolean(data.is_dieu_chinh)}
                    onChange={(e) => onField("is_dieu_chinh", e.target.checked)}
                  />
                  <span className="font-medium">Báo cáo điều chỉnh</span>
                </label>
                <Field label="Người lập">
                  <input
                    type="text"
                    className={BCKS_FIELD}
                    style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: "13pt", lineHeight: 1.3 }}
                    value={data.nguoi_lap || ""}
                    onChange={(e) => onField("nguoi_lap", e.target.value)}
                  />
                </Field>
                <Field label="Chủ nhiệm khảo sát (CNKS)">
                  <input
                    type="text"
                    className={BCKS_FIELD}
                    style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: "13pt", lineHeight: 1.3 }}
                    value={data.chu_nhiem_ks || ""}
                    onChange={(e) => onField("chu_nhiem_ks", e.target.value)}
                  />
                </Field>
                <Field label="Phó giám đốc duyệt">
                  <input
                    type="text"
                    className={BCKS_FIELD}
                    style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: "13pt", lineHeight: 1.3 }}
                    value={data.lanh_dao_duyet || ""}
                    onChange={(e) => onField("lanh_dao_duyet", e.target.value)}
                  />
                </Field>
                <Field label="Thời điểm lập (footer)">
                  <input
                    type="date"
                    className={BCKS_FIELD}
                    style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: "13pt", lineHeight: 1.3 }}
                    value={
                      /^\d{4}-\d{2}-\d{2}/.test(String(data.thoi_diem_lap || ""))
                        ? String(data.thoi_diem_lap).slice(0, 10)
                        : ""
                    }
                    onChange={(e) => onField("thoi_diem_lap", e.target.value)}
                  />
                  {!/^\d{4}-\d{2}-\d{2}/.test(String(data.thoi_diem_lap || "")) && data.thoi_diem_lap ? (
                    <p className="mt-1 text-[11px] text-slate-500">Đang lưu: {data.thoi_diem_lap}</p>
                  ) : null}
                </Field>
              </div>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}

export default function FormBCKS({ project, nvksRecord, paktksRecord, bcksRecord, onClose, onSaved }) {
  const { showAlert, showConfirm } = useAppDialog();
  const [mainTab, setMainTab] = useState("dia_chat");
  const [diaChatTab, setDiaChatTab] = useState("co_ly_dat_2");
  const [saving, setSaving] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingWord, setExportingWord] = useState(false);
  const [scanningKq, setScanningKq] = useState(false);
  const [seedingReport, setSeedingReport] = useState(false);
  const [coverHidden, setCoverHidden] = useState(false);
  /** In/PDF + Xuất Word (tab Báo cáo) chỉ sáng sau lần Lưu thành công; sửa form → tắt lại */
  const [docsExportReady, setDocsExportReady] = useState(false);
  const skipExportDirtyRef = useRef(true);
  const [recordId, setRecordId] = useState(bcksRecord?.id || null);
  const printRef = useRef(null);
  const scanKqInputRef = useRef(null);

  const [formData, setFormData] = useState(() => {
    let initial;
    if (bcksRecord) initial = mergeSavedBcksIntoForm(bcksRecord, project, nvksRecord);
    else {
      const draft = loadBcksDraft(project?.ma_du_an || nvksRecord?.ma_du_an);
      initial = draft
        ? mergeSavedBcksIntoForm(draft, project, nvksRecord)
        : buildInitialBcksForm(project, nvksRecord);
    }
    return ensureBaoCaoDtsBlock(
      ensureDoDtsComputedRows(ensureTnDaDefaultRows(ensureCoLyDat2DefaultRows(initial)))
    );
  });

  useEffect(() => {
    setRecordId(bcksRecord?.id || null);
    let next;
    if (bcksRecord) {
      next = mergeSavedBcksIntoForm(bcksRecord, project, nvksRecord);
    } else {
      const draft = loadBcksDraft(project?.ma_du_an || nvksRecord?.ma_du_an);
      next = draft
        ? mergeSavedBcksIntoForm(draft, project, nvksRecord)
        : buildInitialBcksForm(project, nvksRecord);
    }
    skipExportDirtyRef.current = true;
    setDocsExportReady(false);
    setFormData(
      ensureBaoCaoDtsBlock(
        ensureDoDtsComputedRows(ensureTnDaDefaultRows(ensureCoLyDat2DefaultRows(next)))
      )
    );
  }, [project, nvksRecord, bcksRecord]);

  useEffect(() => {
    if (skipExportDirtyRef.current) {
      skipExportDirtyRef.current = false;
      return;
    }
    setDocsExportReady(false);
  }, [formData]);

  /** Seed căn cứ / TC / máy móc / KL từ NVKS + catalog */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSeedingReport(true);
      try {
        let baseForm;
        if (bcksRecord) baseForm = mergeSavedBcksIntoForm(bcksRecord, project, nvksRecord);
        else {
          const draft = loadBcksDraft(project?.ma_du_an || nvksRecord?.ma_du_an);
          baseForm = draft
            ? mergeSavedBcksIntoForm(draft, project, nvksRecord)
            : buildInitialBcksForm(project, nvksRecord);
        }
        const seeded = await seedBcksReportFromSources(baseForm.chi_tiet_bcks?.bcks, {
          supabase,
          project,
          nvksRecord,
          paktksRecord,
        });
        if (cancelled) return;
        setFormData((prev) => ({
          ...prev,
          chi_tiet_bcks: {
            ...prev.chi_tiet_bcks,
            bcks: seeded,
          },
        }));
      } catch (err) {
        console.warn("BCKS seed report:", err);
      } finally {
        if (!cancelled) setSeedingReport(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ seed khi đổi hồ sơ (id), không theo reference object
  }, [project?.ma_du_an, nvksRecord?.id, paktksRecord?.id, bcksRecord?.id]);

  /** Seed mẫu 10 dòng khi đang mở tab Cơ lý đất mà state còn trống / sườn cũ */
  useEffect(() => {
    if (diaChatTab !== "co_ly_dat_2") return;
    setFormData((prev) => ensureCoLyDat2DefaultRows(prev));
  }, [diaChatTab]);

  /** Seed 6 dòng TN đá khi mở tab mà còn sườn trống */
  useEffect(() => {
    if (diaChatTab !== "tn_da") return;
    setFormData((prev) => ensureTnDaDefaultRows(prev));
  }, [diaChatTab]);

  /** Tính lại k / ρₖ / độ sâu khi mở tab Đo ĐTS */
  useEffect(() => {
    if (diaChatTab !== "do_dts") return;
    setFormData((prev) => ensureDoDtsComputedRows(prev));
  }, [diaChatTab]);

  /** Báo cáo DTS: tạo khối + seed 5 vị trí nếu draft/DB cũ thiếu */
  useEffect(() => {
    if (diaChatTab !== "bao_cao_dts") return;
    setFormData((prev) => ensureBaoCaoDtsBlock(prev));
  }, [diaChatTab]);

  const diaChatForms = useMemo(() => listBcksDiaChatForms(), []);
  const diaBlock = formData.chi_tiet_bcks?.dia_chat?.[diaChatTab];

  const handleSave = useCallback(
    async ({ closeAfter = false } = {}) => {
      if (!nvksRecord?.id) {
        await showAlert("Thiếu hồ sơ NVKS — không lưu được BCKS.");
        return;
      }
      setSaving(true);
      try {
        const payload = buildBcksDbPayload(formData, {
          nvksId: nvksRecord.id,
          paktksId: paktksRecord?.id || null,
        });
        const result = await saveBcksToDb(supabase, {
          payload,
          recordId,
          maDuAn: formData.ma_du_an,
        });
        setRecordId(result.id);
        saveBcksDraft({ ...formData, id: result.id });
        skipExportDirtyRef.current = true;
        setDocsExportReady(true);
        await logHoatDong({
          phanHe: "BCKS",
          hanhDong: result.created ? "CREATE" : "UPDATE",
          chiTietNgan: result.created ? "Tạo hồ sơ BCKS" : "Cập nhật hồ sơ BCKS",
          doiTuongId: formData.ma_du_an,
          duLieuDong: { bcks_id: result.id, giai_doan: formData.giai_doan, ma_du_an: formData.ma_du_an },
        });
        await showAlert(result.created ? "Đã tạo hồ sơ BCKS trên hệ thống." : "Đã lưu hồ sơ BCKS.");
        onSaved?.();
        if (closeAfter) onClose?.();
      } catch (err) {
        console.error(err);
        const msg = err?.message || String(err);
        const code = err?.code || err?.details || "";
        const isMissingTable =
          /Could not find the table/i.test(msg) ||
          /relation ["']?HO_SO_BCKS["']? does not exist/i.test(msg) ||
          (/schema cache/i.test(msg) && /HO_SO_BCKS/i.test(msg));
        if (isMissingTable) {
          saveBcksDraft(formData);
          await showAlert(
            "Chưa có bảng HO_SO_BCKS trên Supabase.\n\nChạy scripts/sql/create-ho-so-bcks.sql rồi rls-ho-so-bcks.sql.\nĐã lưu nháp tạm trên máy."
          );
        } else {
          saveBcksDraft(formData);
          await showAlert(
            `Lỗi lưu BCKS:\n${msg}${code ? `\n(${code})` : ""}\n\nĐã lưu nháp tạm trên máy.`
          );
        }
      } finally {
        setSaving(false);
      }
    },
    [formData, nvksRecord, paktksRecord, recordId, onClose, onSaved, showAlert]
  );

  const handleExportExcel = useCallback(async () => {
    if (mainTab !== "dia_chat") return;
    setExportingExcel(true);
    try {
      let images;
      if (diaChatTab === "do_dts") {
        const { captureDoDtsExportImages } = await import("../lib/doDtsExportCapture");
        images = await captureDoDtsExportImages(printRef.current || document);
      }
      await exportBcksDiaChatExcel(formData, diaChatTab, { images });
    } catch (err) {
      await showAlert(err?.message || "Không xuất được Excel.");
    } finally {
      setExportingExcel(false);
    }
  }, [mainTab, formData, diaChatTab, showAlert]);

  const handleExportWord = useCallback(async () => {
    if (mainTab !== "bcks") return;
    if (!docsExportReady) {
      await showAlert("Vui lòng nhấn Lưu trước khi xuất Word.");
      return;
    }
    const hadDocx = await hasExistingExportFile(supabase, {
      maDuAn: formData.ma_du_an,
      moduleLoai: "bcks",
      kind: "docx",
      formLink: formData.link_docx_xuat,
    });
    if (hadDocx) {
      const ok = await showConfirm(EXPORT_REPLACE_CONFIRM_MSG, {
        title: "Đã có file Word xuất",
        confirmLabel: "Xuất lại",
        cancelLabel: "Hủy",
        variant: "warning",
      });
      if (!ok) return;
    }
    setExportingWord(true);
    try {
      const { blob, fileName } = await exportBcksWord(formData, { download: true });
      const storagePath = buildBcksExportStoragePath(formData, fileName);
      const storageUrl = await uploadBcksExportBlob(supabase, blob, storagePath);
      const exportedAt = new Date().toISOString();

      if (recordId) {
        const { error: linkErr } = await supabase
          .from("HO_SO_BCKS")
          .update({ link_docx_xuat: storageUrl, exported_at: exportedAt })
          .eq("id", recordId);
        if (linkErr) {
          console.warn("Không cập nhật link_docx_xuat BCKS:", linkErr.message);
        }
      }

      const user = getAuthUser();
      await syncXuatBanTaiLieuSafe(supabase, {
        maDuAn: formData.ma_du_an,
        moduleLoai: "bcks",
        kind: "docx",
        storagePath: storageUrl,
        displayName: exportDisplayNameFromUrl(storageUrl) || fileName,
        thoiGian: exportedAt,
        nguoiUpMaNv: user?.ma_nv,
      });

      setFormData((prev) => ({
        ...prev,
        link_docx_xuat: storageUrl,
        exported_at: exportedAt,
      }));

      await logHoatDong({
        phanHe: "BCKS",
        hanhDong: "EXPORT_WORD",
        chiTietNgan: `Xuất Word BCKS — ${formData.ma_du_an}`,
        doiTuongId: recordId,
        duLieuDong: { link_docx_xuat: storageUrl, giai_doan: formData.giai_doan },
      });
    } catch (err) {
      await showAlert(err?.message || "Không xuất được Word.");
    } finally {
      setExportingWord(false);
    }
  }, [mainTab, formData, docsExportReady, recordId, showAlert, showConfirm]);

  const handleScanKqClick = useCallback(() => {
    if (mainTab !== "dia_chat" || scanningKq) return;
    if (!isBcksKqFormKey(diaChatTab)) {
      showAlert("Tab hiện tại chưa hỗ trợ ScanKQ.");
      return;
    }
    scanKqInputRef.current?.click();
  }, [mainTab, diaChatTab, scanningKq, showAlert]);

  const handleScanKqFile = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      if (mainTab !== "dia_chat" || !isBcksKqFormKey(diaChatTab)) {
        await showAlert("Chỉ quét khi đang mở tab Địa chất hỗ trợ ScanKQ.");
        return;
      }
      if (file.size > GEMINI_MAX_INLINE_BYTES) {
        await showAlert(
          `File quá lớn (${formatFileSizeMb(file.size)}). AI nhận PDF/ảnh tối đa ~20 MB.`
        );
        return;
      }
      setScanningKq(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("form_key", diaChatTab);
        const res = await fetch("/api/parse-bcks-kq", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Không quét được file.");

        setFormData((prev) =>
          ensureDoDtsComputedRows(
            ensureTnDaDefaultRows(ensureCoLyDat2DefaultRows(applyBcksKqScan(prev, diaChatTab, data.data)))
          )
        );

        const stats = data.stats || {};
        let filledNote = "";
        if (diaChatTab === "do_dts") {
          filledNote = `Đã điền ${stats.rows || 0} dòng đo` +
            (stats.phan_tich ? `, ${stats.phan_tich} lớp phân tích` : "") +
            ".";
        } else if (diaChatTab === "tn_nuoc") {
          filledNote = `Đã điền kết quả cho ${stats.chi_tieu || 0} chỉ tiêu.`;
        } else if (diaChatTab === "tn_da") {
          filledNote = `Đã điền ${stats.rows || 0} dòng mẫu đá.`;
        } else {
          filledNote = `Đã điền ${stats.rows || 0} dòng cơ lý.`;
        }
        const lines = [
          `${filledNote} Kiểm tra biểu mẫu trước khi Lưu.`,
        ];
        if (data.warning) lines.push(`\n⚠️ ${data.warning}`);
        if (data.confidence) lines.push(`\nĐộ tin cậy ước tính: ${data.confidence}%`);
        await showAlert(lines.join(""));
      } catch (err) {
        await showAlert(err?.message || "Không quét được file.");
      } finally {
        setScanningKq(false);
      }
    },
    [mainTab, diaChatTab, showAlert]
  );

  const handlePrintPdf = useCallback(() => {
    if (mainTab !== "dia_chat" && mainTab !== "bcks") return;
    if (mainTab === "bcks" && !docsExportReady) {
      showAlert("Vui lòng nhấn Lưu trước khi In/PDF.");
      return;
    }
    const node = printRef.current;
    if (!node) {
      showAlert("Không tìm thấy nội dung để in.");
      return;
    }

    const title =
      mainTab === "bcks"
        ? "Lập hồ sơ báo cáo khảo sát"
        : listBcksDiaChatForms().find((f) => f.key === diaChatTab)?.label || "BCKS Địa chất";
    // Báo cáo RTK: A4 dọc; Cơ lý đất: A3 ngang; TN nước + Đo ĐTS: A4 dọc;
    // Báo cáo DTS / TN đá: A4 ngang — dùng từ khóa landscape/portrait (Chrome đổi khổ trong hộp thoại ổn hơn so với mm cố định)
    const pageSize =
      mainTab === "bcks"
        ? "A4 portrait"
        : diaChatTab === "co_ly_dat_2"
          ? "A3 landscape"
          : diaChatTab === "tn_nuoc" || diaChatTab === "do_dts"
            ? "A4 portrait"
            : diaChatTab === "bao_cao_dts"
              ? "A4 landscape"
              : "A4 landscape";

    // Clone nội dung in — Đo ĐTS: làm tròn k / độ sâu 2 chữ số trước khi đưa vào PDF
    const printRoot = node.cloneNode(true);
    if (mainTab === "dia_chat" && diaChatTab === "do_dts") {
      const round2 = (el) => {
        const n = Number(String(el.value ?? "").replace(",", "."));
        if (Number.isFinite(n) && String(el.value ?? "").trim() !== "") {
          const s = n.toFixed(2);
          el.value = s;
          el.setAttribute("value", s);
        }
      };
      printRoot.querySelectorAll('input[title*="π"], input[title*="(1/3)"], input[title*="k×U"]').forEach(round2);
    }

    // In qua iframe ẩn — không mở popup (tránh bị chặn / about:blank vì noopener)
    // Cần kích thước thật (không 0×0) để layout căn giữa tiêu đề / bảng không bị xô góc.
    const iframe = document.createElement("iframe");
    iframe.setAttribute("title", "BCKS print");
    iframe.style.cssText =
      "position:fixed;left:-12000px;top:0;width:1600px;height:1000px;border:0;opacity:0;pointer-events:none;";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      iframe.remove();
      showAlert("Không khởi tạo được khung in. Thử lại hoặc dùng trình duyệt khác.");
      return;
    }

    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title>
<style>
  @page { size: ${pageSize}; margin: 8mm; }
  @media print {
    @page { size: ${pageSize}; margin: 8mm; }
  }
  * { box-sizing: border-box; box-shadow: none !important; text-shadow: none !important; filter: none !important; }
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    font-family: Arial, Helvetica, sans-serif !important;
    color: #134e4a;
    font-size: 9px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body { padding: 6mm 4mm; }
  .bcks-print-header {
    width: 100%;
    text-align: center !important;
    margin: 0 0 6mm;
  }
  .bcks-print-title, h3, h4 {
    display: block;
    width: 100%;
    margin: 0 0 3mm;
    text-align: center !important;
    text-transform: uppercase;
    font-family: Arial, Helvetica, sans-serif !important;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: #134e4a;
  }
  .bcks-print-meta {
    display: block;
    width: 100%;
    margin: 0;
    text-align: center !important;
    font-family: Arial, Helvetica, sans-serif !important;
    font-size: 11px;
    font-weight: 600;
    color: #0f766e;
  }
  .bcks-print-meta-sep {
    display: inline;
    margin: 0 0.6em;
    font-weight: 700;
  }
  .overflow-x-auto { overflow: visible !important; width: 100%; }
  table {
    border-collapse: collapse;
    border-spacing: 0;
    width: 100%;
  }
  .bcks-print-table {
    width: 100% !important;
    min-width: 0 !important;
    table-layout: fixed;
    /* Chrome/Edge in PDF ép border>0 về hairline tối thiểu — tránh border 4 cạnh (dễ nhìn đậm gấp đôi) */
    border-top: 0.5px solid #0f766e !important;
    border-left: 0.5px solid #0f766e !important;
  }
  th, td {
    border: none !important;
    border-right: 0.5px solid #0f766e !important;
    border-bottom: 0.5px solid #0f766e !important;
    padding: 1px 2px !important;
    vertical-align: middle !important;
    text-align: center !important;
    font-size: 7.5px;
    line-height: 1.15;
    word-break: break-word;
  }
  th {
    background: #f0fdfa !important;
    font-weight: 700;
    color: #134e4a;
  }
  .bcks-print-table thead tr.bcks-hr-1 th,
  .bcks-print-table thead tr:nth-child(1) th { height: 9mm; }
  .bcks-print-table thead tr.bcks-hr-2 th,
  .bcks-print-table thead tr:nth-child(2) th { height: 7.5mm; }
  .bcks-print-table thead tr.bcks-hr-4 th,
  .bcks-print-table thead tr:nth-child(4) th { height: 6.5mm; }
  .bcks-print-table thead tr.bcks-hr-5 th,
  .bcks-print-table thead tr:nth-child(5) th { height: 6mm; }
  .bcks-print-table thead tr.bcks-hr-6 th,
  .bcks-print-table thead tr:nth-child(6) th {
    height: 6mm;
    background: #e0e7ff !important;
    font-size: 9px !important;
  }
  /* Xen kẽ nền dòng dữ liệu — khớp Excel (cam nhạt FDEADA) */
  .bcks-print-table tbody tr.bcks-row-plain td {
    background: #ffffff !important;
  }
  .bcks-print-table tbody tr.bcks-row-zebra td {
    background: #fdeada !important;
  }
  .bcks-print-table tbody tr.bcks-row-avg td {
    background: #ecfeff !important;
  }
  .bcks-th-vert-inner {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    min-height: 18mm;
    margin: 0 auto;
    width: 100%;
  }
  .bcks-th-vert-tall { min-height: 28mm !important; }
  .bcks-vert-label {
    display: inline-block !important;
    writing-mode: vertical-rl !important;
    -webkit-writing-mode: vertical-rl !important;
    transform: rotate(180deg) !important;
    white-space: nowrap !important;
    font-size: 7.5px !important;
    font-weight: 700 !important;
    line-height: 1.05 !important;
    max-height: 26mm;
    overflow: hidden;
  }
  input, textarea {
    border: none !important;
    background: transparent !important;
    box-shadow: none !important;
    outline: none !important;
    resize: none !important;
    width: 100% !important;
    min-width: 0 !important;
    padding: 0 !important;
    margin: 0 !important;
    font: inherit !important;
    text-align: center !important;
    color: inherit !important;
  }
  td span {
    text-align: center !important;
  }
  button, .shrink-0, .bcks-no-print { display: none !important; }
  .rounded-lg, .rounded-xl { border-radius: 0 !important; }
  label span { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #0f766e; }
  .bcks-sign-ngay {
    display: flex !important;
    flex-direction: column !important;
    align-items: flex-end !important;
    justify-content: flex-end !important;
    margin: 4mm 0 2mm;
  }
  .bcks-sign-ngay-line {
    font-family: Arial, Helvetica, sans-serif !important;
    font-size: 11px !important;
    font-style: italic !important;
    font-weight: 400 !important;
    text-align: right !important;
    color: #134E4A !important;
  }
  .bcks-sign-ngay input[type="date"] { display: none !important; }
  .bcks-sign-row {
    display: flex !important;
    flex-direction: row !important;
    justify-content: space-between !important;
    align-items: flex-start !important;
    gap: 8mm;
    width: 100%;
    margin: 6mm 0 0 !important;
  }
  .bcks-sign-box {
    border: none !important;
    border-radius: 0;
    padding: 0 0 4mm;
    margin: 0;
    width: 42mm;
    max-width: 42mm;
    min-width: 0;
    background: transparent !important;
  }
  .bcks-sign-box legend {
    margin: 0 auto !important;
    padding: 0;
    width: fit-content;
    text-align: center !important;
    font-size: 9px !important;
    font-weight: 700 !important;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #0f766e !important;
    border: none !important;
  }
  .bcks-sign-kiem-tra {
    margin-left: auto !important;
  }
  .bcks-sign-kiem-tra legend {
    margin: 0 auto !important;
    text-align: center !important;
  }
  .bcks-sign-box input {
    border: none !important;
    background: transparent !important;
    text-align: center !important;
    width: 100% !important;
    font-size: 9px !important;
    padding: 1mm 0 0 !important;
  }
  .bcks-tn-date-print { display: none; }
  /* —— TN nước: bố cục in khớp màn hình —— */
  .bcks-tn-nuoc-sheet {
    max-width: 100% !important;
    width: 100% !important;
    margin: 0 !important;
    border: none !important;
    border-radius: 0 !important;
    padding: 0 !important;
    box-shadow: none !important;
  }
  .bcks-tn-header {
    text-align: center !important;
    margin-bottom: 0 !important;
  }
  .bcks-tn-header .bcks-print-meta,
  .bcks-tn-header p {
    text-align: center !important;
    width: 100% !important;
    display: block !important;
  }
  .bcks-tn-header-gap {
    display: block !important;
    height: 16mm !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  .bcks-tn-meta-grid {
    display: grid !important;
    grid-template-columns: 1fr 1fr !important;
    gap: 3.5mm 8mm !important;
    margin: 0 0 5mm !important;
  }
  .bcks-tn-meta-grid label {
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: flex-start !important;
    width: 100% !important;
    text-align: center !important;
  }
  .bcks-tn-meta-grid label > span {
    display: block !important;
    width: 100% !important;
    margin-bottom: 1mm;
    text-align: center !important;
  }
  .bcks-tn-meta-grid label > input,
  .bcks-tn-meta-grid label > p {
    width: 100% !important;
    text-align: center !important;
    font-size: 11px !important;
    font-weight: 400 !important;
    color: #134E4A !important;
  }
  .bcks-tn-date-print {
    display: block !important;
    width: 100% !important;
    margin: 1mm 0 0 !important;
    font-size: 11px !important;
    font-style: italic !important;
    font-weight: 400 !important;
    color: #134E4A !important;
    text-align: center !important;
  }
  .bcks-tn-date-input { display: none !important; }
  .bcks-tn-table {
    width: 100% !important;
    min-width: 0 !important;
    table-layout: fixed !important;
    border-collapse: collapse !important;
    margin: 2mm 0 4mm !important;
  }
  .bcks-tn-table th,
  .bcks-tn-table td {
    border: 0.4pt solid #0f766e !important;
    padding: 2.8mm 2mm !important;
    vertical-align: middle !important;
    font-size: 10px !important;
    line-height: 1.35 !important;
  }
  .bcks-tn-table th {
    background: #f0fdfa !important;
    font-weight: 700 !important;
    text-align: center !important;
  }
  .bcks-tn-table th:nth-child(2) {
    text-align: left !important;
  }
  .bcks-tn-table th:nth-child(5) {
    text-align: center !important;
  }
  .bcks-tn-table td:nth-child(1) { text-align: center !important; width: 8%; }
  .bcks-tn-table td:nth-child(2) { text-align: left !important; width: 28%; }
  .bcks-tn-table td:nth-child(3) { text-align: center !important; width: 18%; }
  .bcks-tn-table td:nth-child(4) { text-align: center !important; width: 16%; }
  .bcks-tn-table td:nth-child(5) { text-align: center !important; width: 30%; }
  .bcks-tn-table td:nth-child(2) input {
    text-align: left !important;
  }
  .bcks-tn-table td:nth-child(5) input {
    text-align: center !important;
  }
  .bcks-tn-table td:nth-child(4) input {
    text-align: center !important;
  }
  .bcks-tn-table td:nth-child(4) input.bcks-tn-kq-out {
    color: #e11d48 !important;
    font-weight: 700 !important;
  }
  .bcks-tn-col-stt { width: 8%; }
  .bcks-tn-col-chi-tieu { width: 28%; }
  .bcks-tn-col-yeu-cau { width: 18%; }
  .bcks-tn-col-ket-qua { width: 16%; }
  .bcks-tn-col-pp { width: 30%; }
  .bcks-tn-nuoc-sheet h4 {
    margin: 4mm 0 2mm !important;
    font-size: 12px !important;
  }
  .bcks-tn-ghi-chu {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    align-items: baseline !important;
    gap: 2mm !important;
    margin: 3mm 0 4mm !important;
    width: 100% !important;
    text-align: left !important;
  }
  .bcks-tn-ghi-chu > span {
    display: inline !important;
    flex-shrink: 0 !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    text-transform: none !important;
    color: #134e4a !important;
  }
  .bcks-tn-ghi-chu-input {
    flex: 1 1 auto !important;
    width: auto !important;
    text-align: left !important;
    font-size: 11px !important;
    font-style: italic !important;
  }
  .bcks-sign-row-3 {
    display: grid !important;
    grid-template-columns: 1fr 1fr 1fr !important;
    gap: 4mm 8mm !important;
    width: 100% !important;
    margin: 5mm 0 0 !important;
  }
  .bcks-sign-row-3 label {
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    text-align: center !important;
    width: 100% !important;
  }
  .bcks-sign-row-3 label > span {
    display: block !important;
    width: 100% !important;
    text-align: center !important;
    margin-bottom: 1mm;
  }
  .bcks-sign-row-3 input {
    text-align: center !important;
  }
  /* —— TN đá: bố cục in khớp màn hình (A4 ngang) —— */
  .bcks-tn-da-sheet {
    max-width: 100% !important;
    width: 100% !important;
    margin: 0 !important;
    border: none !important;
    border-radius: 0 !important;
    padding: 0 !important;
    box-shadow: none !important;
  }
  .bcks-tn-da-header {
    text-align: center !important;
    margin: 0 0 4mm !important;
  }
  .bcks-tn-da-header h3 {
    font-size: 13px !important;
    margin: 0 0 1.5mm !important;
  }
  .bcks-tn-da-pptn {
    font-size: 10px !important;
    color: #0f766e !important;
    margin: 0 0 2mm !important;
  }
  .bcks-tn-da-meta-du-an,
  .bcks-tn-da-meta-giai-doan {
    display: block !important;
    width: 100% !important;
    text-align: center !important;
    font-size: 11px !important;
    font-weight: 600 !important;
    color: #0f766e !important;
    margin: 0 0 1mm !important;
  }
  .bcks-tn-da-meta-grid {
    display: grid !important;
    grid-template-columns: 1.8fr 0.7fr 0.7fr !important;
    gap: 3mm 5mm !important;
    margin: 3mm 0 4mm !important;
  }
  .bcks-tn-da-meta-grid label {
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    text-align: center !important;
  }
  .bcks-tn-da-meta-grid label > span {
    display: block !important;
    width: 100% !important;
    text-align: center !important;
    margin-bottom: 1mm;
    font-size: 9px !important;
  }
  .bcks-tn-da-meta-grid label > input,
  .bcks-tn-da-meta-grid label > p {
    width: 100% !important;
    text-align: center !important;
    font-size: 10px !important;
    color: #134e4a !important;
    border: none !important;
    background: transparent !important;
  }
  .bcks-tn-da-table {
    width: 100% !important;
    min-width: 0 !important;
    table-layout: fixed !important;
    border-collapse: collapse !important;
    margin: 0 0 4mm !important;
  }
  .bcks-tn-da-table th,
  .bcks-tn-da-table td {
    border: 0.4pt solid #0f766e !important;
    padding: 1.2mm 0.8mm !important;
    vertical-align: middle !important;
    text-align: center !important;
    font-size: 9px !important;
    line-height: 1.2 !important;
    color: #134e4a !important;
  }
  .bcks-tn-da-table thead th {
    background: #f0fdfa !important;
    font-weight: 700 !important;
    font-size: 9px !important;
  }
  .bcks-tn-da-table thead tr:last-child th {
    background: #fef3c7 !important;
    color: #78350f !important;
    font-size: 9px !important;
  }
  .bcks-tn-da-table tbody tr:nth-child(even) td {
    background: #fdeada !important;
  }
  .bcks-tn-da-table tbody tr:nth-child(odd) td {
    background: #ffffff !important;
  }
  .bcks-tn-da-table input,
  .bcks-tn-da-table textarea {
    text-align: center !important;
    font-size: 9px !important;
    border: none !important;
    background: transparent !important;
    padding: 0 !important;
  }
  /* —— Đo ĐTS: A4 dọc, xếp dọc vừa khung —— */
  .bcks-do-dts-sheet {
    max-width: 100% !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    box-shadow: none !important;
    background: transparent !important;
  }
  .bcks-do-dts-grid {
    display: block !important;
  }
  .bcks-do-dts-main,
  .bcks-do-dts-giai-tich {
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    border-radius: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
  }
  .bcks-do-dts-page1 {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  .bcks-do-dts-page2 {
    page-break-before: always !important;
    break-before: page !important;
    padding-top: 12mm !important;
    margin-top: 0 !important;
  }
  .bcks-do-dts-signs {
    display: flex !important;
    flex-direction: row !important;
    justify-content: space-between !important;
    align-items: flex-start !important;
    width: auto !important;
    margin: 8mm 12mm 0 !important;
    gap: 0 !important;
  }
  .bcks-do-dts-sign-left,
  .bcks-do-dts-sign-right {
    width: 40% !important;
    max-width: 40% !important;
  }
  .bcks-do-dts-sign-left {
    text-align: center !important;
  }
  .bcks-do-dts-sign-right {
    text-align: center !important;
    margin-left: auto !important;
  }
  .bcks-do-dts-sign-left > span,
  .bcks-do-dts-sign-right > span {
    display: block !important;
    width: 100% !important;
    font-size: 9px !important;
    font-weight: 700 !important;
    text-transform: uppercase !important;
    color: #0f766e !important;
    text-align: center !important;
  }
  .bcks-do-dts-sign-left input,
  .bcks-do-dts-sign-right input {
    border: none !important;
    background: transparent !important;
    font-size: 10px !important;
    padding: 1mm 0 0 !important;
    text-align: center !important;
  }
  .bcks-do-dts-title {
    font-size: 13px !important;
    margin: 0 0 2mm !important;
    color: #134e4a !important;
  }
  .bcks-do-dts-meta {
    display: block !important;
    text-align: center !important;
    white-space: normal !important;
    font-size: 8.5px !important;
    font-weight: 600 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.01em !important;
    color: #075985 !important;
    margin: 0 0 2.5mm !important;
    line-height: 1.35 !important;
    overflow: visible !important;
  }
  .bcks-do-dts-meta-line {
    display: block !important;
    margin: 0 0 1.2mm !important;
    white-space: normal !important;
    word-break: break-word !important;
    line-height: 1.4 !important;
  }
  .bcks-do-dts-meta-sep {
    display: none !important;
  }
  /* Báo cáo DTS — meta dự án / giai đoạn: giữa + in hoa trên PDF */
  .bcks-bao-cao-dts-sheet {
    width: 100% !important;
    max-width: none !important;
    border: none !important;
    padding: 0 !important;
  }
  .bcks-bao-cao-dts-title {
    font-size: 13px !important;
    margin: 0 0 2mm !important;
    text-align: center !important;
    text-transform: uppercase !important;
    color: #134e4a !important;
  }
  .bcks-bao-cao-dts-meta,
  .bcks-bao-cao-dts-meta.bcks-print-meta {
    display: block !important;
    width: 100% !important;
    text-align: center !important;
    white-space: normal !important;
    font-size: 10px !important;
    font-weight: 600 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.01em !important;
    color: #075985 !important;
    margin: 0 0 3mm !important;
    line-height: 1.4 !important;
  }
  .bcks-bao-cao-dts-meta-line {
    display: block !important;
    width: 100% !important;
    margin: 0 0 1.2mm !important;
    text-align: center !important;
    text-transform: uppercase !important;
    white-space: normal !important;
    word-break: break-word !important;
    line-height: 1.4 !important;
  }
  /* Viền đủ 4 cạnh — Chrome hay mất top/left nếu chỉ đặt trên table */
  .bcks-bao-cao-dts-sheet .overflow-x-auto {
    border: none !important;
    overflow: visible !important;
  }
  .bcks-bao-cao-dts-table,
  .bcks-bao-cao-dts-sheet table.bcks-print-table {
    width: 100% !important;
    min-width: 0 !important;
    table-layout: auto !important;
    border-collapse: collapse !important;
    border: none !important;
  }
  .bcks-bao-cao-dts-table th,
  .bcks-bao-cao-dts-table td,
  .bcks-bao-cao-dts-sheet table.bcks-print-table th,
  .bcks-bao-cao-dts-sheet table.bcks-print-table td {
    border: 0.75pt solid #0f766e !important;
    background-clip: padding-box !important;
  }
  .bcks-bao-cao-dts-table thead th {
    background: #ecfeff !important;
    font-weight: 700 !important;
  }
  .bcks-do-dts-thiet-bi {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    justify-content: space-between !important;
    align-items: baseline !important;
    gap: 4mm !important;
    margin: 0 12mm 2.5mm !important;
    width: auto !important;
  }
  .bcks-do-dts-thiet-bi label {
    display: inline-flex !important;
    flex-direction: row !important;
    align-items: baseline !important;
    gap: 1.5mm !important;
    flex: 1 1 0 !important;
    min-width: 0 !important;
    margin: 0 !important;
  }
  .bcks-do-dts-thiet-bi label:last-child {
    justify-content: flex-end !important;
  }
  .bcks-do-dts-thiet-bi label > span {
    display: inline !important;
    flex-shrink: 0 !important;
    font-size: 10px !important;
    font-weight: 700 !important;
    text-transform: uppercase !important;
    color: #0f766e !important;
    margin: 0 !important;
    line-height: 1.2 !important;
  }
  .bcks-do-dts-thiet-bi input {
    display: inline !important;
    width: auto !important;
    min-width: 12mm !important;
    flex: 0 1 auto !important;
    font-size: 10px !important;
    font-weight: 600 !important;
    line-height: 1.2 !important;
    color: #134e4a !important;
    border: none !important;
    background: transparent !important;
    text-align: left !important;
    padding: 0 !important;
    margin: 0 !important;
    height: auto !important;
  }
  .bcks-do-dts-cong-thuc {
    margin: 0 0 2.5mm !important;
    padding: 2mm 2.5mm !important;
    border: 0.4pt solid #cbd5e1 !important;
    border-radius: 0 !important;
    background: #f8fafc !important;
    font-size: 9px !important;
    line-height: 1.35 !important;
  }
  .bcks-do-dts-formula {
    color: #0000FF !important;
    font-size: 11px !important;
    margin: 1mm 0 !important;
    text-align: center !important;
  }
  .bcks-do-dts-diem {
    margin: 0 0 3mm !important;
  }
  .bcks-do-dts-diem input {
    font-size: 10px !important;
    border: none !important;
    border-bottom: none !important;
    border-radius: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    outline: none !important;
    text-align: center !important;
  }
  .bcks-do-dts-diem label > span {
    display: none !important;
  }
  .bcks-do-dts-table-wrap {
    overflow: visible !important;
    border: none !important;
    border-radius: 0 !important;
    margin: 0 0 3mm !important;
    padding: 0 !important;
    box-shadow: none !important;
    filter: none !important;
    outline: none !important;
    background: transparent !important;
    /* tách khỏi dòng điểm đo — tránh gạch nhạt dính mép bảng */
    margin-top: 1mm !important;
  }
  .bcks-do-dts-table {
    width: 100% !important;
    min-width: 0 !important;
    table-layout: fixed !important;
    border-collapse: collapse !important;
    border-spacing: 0 !important;
    font-size: 8px !important;
    border: none !important;
    outline: none !important;
    box-shadow: none !important;
    filter: none !important;
    background: transparent !important;
  }
  .bcks-do-dts-table thead,
  .bcks-do-dts-table tbody,
  .bcks-do-dts-table tr {
    box-shadow: none !important;
    filter: none !important;
    outline: none !important;
    background: transparent !important;
  }
  .bcks-do-dts-table th,
  .bcks-do-dts-table td {
    border: none !important;
    border-right: 1px solid #0f766e !important;
    border-bottom: 1px solid #0f766e !important;
    padding: 1mm 0.5mm !important;
    vertical-align: middle !important;
    text-align: center !important;
    font-size: 8px !important;
    line-height: 1.15 !important;
    color: #134e4a !important;
    word-wrap: break-word !important;
    box-shadow: none !important;
    filter: none !important;
    outline: none !important;
    background-clip: padding-box !important;
  }
  /* Viền trái / trên 1 nét — tránh đôi viền tạo bóng mờ trên Chrome PDF */
  .bcks-do-dts-table tr > *:first-child {
    border-left: 1px solid #0f766e !important;
  }
  .bcks-do-dts-table thead tr:first-child > * {
    border-top: 1px solid #0f766e !important;
  }
  .bcks-do-dts-table thead th {
    background: #f0fdfa !important;
    background-clip: padding-box !important;
    font-weight: 700 !important;
    white-space: normal !important;
    box-shadow: none !important;
  }
  .bcks-do-dts-table input {
    width: 100% !important;
    font-size: 8px !important;
    text-align: center !important;
    border: none !important;
    background: transparent !important;
    padding: 0 !important;
    color: inherit !important;
    box-shadow: none !important;
    outline: none !important;
  }
  .bcks-do-dts-giai-tich {
    display: flex !important;
    flex-direction: column !important;
    gap: 5mm !important;
  }
  .bcks-do-dts-giai-tich-head {
    margin: 0 !important;
    padding: 0 !important;
  }
  /* Cùng margin tiêu đề→meta như .bcks-do-dts-title (trang Báo cáo) */
  .bcks-do-dts-giai-tich-title {
    color: #92400e !important;
  }
  .bcks-do-dts-giai-tich .bcks-do-dts-meta {
    margin: 0 !important;
    font-size: 8.5px !important;
  }
  .bcks-do-dts-chart {
    height: auto !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    font-size: 10px !important;
    border: none !important;
    border-radius: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    page-break-inside: avoid !important;
  }
  .bcks-do-dts-chart-plot {
    height: 75mm !important;
    width: 100% !important;
    min-height: 75mm !important;
  }
  .bcks-do-dts-chart-plot .recharts-responsive-container {
    width: 100% !important;
    height: 100% !important;
  }
  .bcks-do-dts-chart-legend {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: wrap !important;
    justify-content: center !important;
    align-items: center !important;
    gap: 3mm 5mm !important;
    margin: 3mm 0 0 !important;
    padding: 0 !important;
    list-style: none !important;
    font-size: 8px !important;
    color: #334155 !important;
  }
  .bcks-do-dts-phan-tich {
    margin: 14mm 0 0 !important;
    padding-top: 2mm !important;
    align-items: flex-start !important;
  }
  .bcks-do-dts-phan-tich > div {
    width: 55mm !important;
    max-width: 55mm !important;
  }
  .bcks-do-dts-phan-tich h4 {
    font-size: 8px !important;
    font-weight: 600 !important;
    margin: 0 0 1.5mm !important;
  }
  .bcks-do-dts-phan-tich-table {
    width: 100% !important;
    table-layout: fixed !important;
    border-collapse: collapse !important;
    font-size: 7.5px !important;
  }
  .bcks-do-dts-phan-tich-table th,
  .bcks-do-dts-phan-tich-table td {
    border: 0.4px solid #000 !important;
    padding: 0.4mm 0.3mm !important;
    text-align: center !important;
  }
  .bcks-do-dts-phan-tich-table thead th {
    background: #f8fafc !important;
  }
  .bcks-do-dts-phan-tich-table input {
    border: none !important;
    background: transparent !important;
    font-size: 7.5px !important;
    text-align: center !important;
    padding: 0 !important;
    min-width: 0 !important;
  }
  .bcks-do-dts-bo-tri {
    margin: 3mm 0 2mm !important;
    padding: 1mm 0 !important;
    border: none !important;
    border-radius: 0 !important;
    background: #ffffff !important;
    box-shadow: none !important;
  }
  .bcks-do-dts-bo-tri-title {
    font-size: 10px !important;
    font-weight: 700 !important;
    color: #92400e !important;
    margin: 0 0 1mm !important;
  }
  .bcks-do-dts-bo-tri-svg {
    width: 100% !important;
    max-width: 160mm !important;
    height: auto !important;
    display: block !important;
    margin: 0 auto !important;
  }
</style></head><body>${printRoot.innerHTML}</body></html>`);
    doc.close();

    const cleanup = () => {
      setTimeout(() => iframe.remove(), 500);
    };

    const doPrint = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        showAlert(err?.message || "Không mở được hộp thoại in.");
      } finally {
        cleanup();
      }
    };

    // Chờ layout xong rồi mới gọi print
    setTimeout(doPrint, 250);
  }, [mainTab, diaChatTab, docsExportReady, showAlert]);

  const onDiaField = (field, value) => {
    setFormData((prev) => patchDiaChatField(prev, diaChatTab, field, value));
  };

  const tableKey = diaChatTab === "tn_nuoc" ? "chi_tieu" : "rows";

  const onDiaCell = (rowIndex, field, value) => {
    setFormData((prev) => patchDiaChatTableRow(prev, diaChatTab, tableKey, rowIndex, field, value));
  };

  const onDiaAdd = (kind) => setFormData((prev) => addDiaChatTableRow(prev, diaChatTab, tableKey, kind));
  const onDiaRemove = (rowIndex) =>
    setFormData((prev) => removeDiaChatTableRow(prev, diaChatTab, tableKey, rowIndex));

  const onDoDtsPhanTichCell = (rowIndex, field, value) => {
    setFormData((prev) => patchDiaChatTableRow(prev, "do_dts", "phan_tich", rowIndex, field, value));
  };
  const onDoDtsPhanTichAdd = () => setFormData((prev) => addDiaChatTableRow(prev, "do_dts", "phan_tich"));
  const onDoDtsPhanTichRemove = (rowIndex) =>
    setFormData((prev) => removeDiaChatTableRow(prev, "do_dts", "phan_tich", rowIndex));

  const onBaoCaoDtsLayerCell = (rowIndex, layerIndex, field, value) => {
    setFormData((prev) => patchBaoCaoDtsLayer(prev, rowIndex, layerIndex, field, value));
  };
  const onBaoCaoDtsSoLop = (next) => {
    setFormData((prev) => setBaoCaoDtsSoLop(prev, next));
  };

  const onBcksKlCell = (rowIndex, field, value) => {
    setFormData((prev) => {
      const next = structuredClone(prev);
      const rows = next.chi_tiet_bcks?.bcks?.muc4_1_rows;
      if (!Array.isArray(rows) || !rows[rowIndex]) return prev;
      rows[rowIndex] = recomputeBcksKlRow({ ...rows[rowIndex], [field]: value });
      return next;
    });
  };
  const onBcksKlAdd = () => {
    setFormData((prev) => {
      const next = structuredClone(prev);
      if (!next.chi_tiet_bcks?.bcks) return prev;
      const rows = next.chi_tiet_bcks.bcks.muc4_1_rows || [];
      next.chi_tiet_bcks.bcks.muc4_1_rows = [...rows, emptyBcksKlRow()];
      return next;
    });
  };
  const onBcksKlRemove = (rowIndex) => {
    setFormData((prev) => {
      const next = structuredClone(prev);
      const rows = next.chi_tiet_bcks?.bcks?.muc4_1_rows;
      if (!Array.isArray(rows)) return prev;
      rows.splice(rowIndex, 1);
      return next;
    });
  };

  const onBcksTcCell = (rowIndex, field, value) => {
    setFormData((prev) => {
      const next = structuredClone(prev);
      const rows = next.chi_tiet_bcks?.bcks?.muc3_1_rows;
      if (!Array.isArray(rows) || !rows[rowIndex]) return prev;
      rows[rowIndex] = { ...rows[rowIndex], [field]: value };
      return next;
    });
  };
  const onBcksTcAdd = () => {
    setFormData((prev) => {
      const next = structuredClone(prev);
      if (!next.chi_tiet_bcks?.bcks) return prev;
      const rows = next.chi_tiet_bcks.bcks.muc3_1_rows || [];
      next.chi_tiet_bcks.bcks.muc3_1_rows = [
        ...rows,
        emptyBcksTcRow({ stt: String(rows.length + 1) }),
      ];
      return next;
    });
  };
  const onBcksTcRemove = (rowIndex) => {
    setFormData((prev) => {
      const next = structuredClone(prev);
      const rows = next.chi_tiet_bcks?.bcks?.muc3_1_rows;
      if (!Array.isArray(rows)) return prev;
      rows.splice(rowIndex, 1);
      rows.forEach((r, i) => {
        r.stt = String(i + 1);
      });
      return next;
    });
  };

  const mainTheme = ZONE[mainTab] || ZONE.dia_chat;

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {/* Header: dự án + giai đoạn · CTA Địa chất / Báo cáo khảo sát */}
      <div className="shrink-0 border-b border-teal-200/80 bg-gradient-to-r from-teal-50 via-cyan-50 to-sky-50 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              title="Quay lại"
              className="shrink-0 rounded-lg p-1.5 text-teal-800 transition hover:bg-teal-100/80"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div className="min-w-0 flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <p className="min-w-0 text-sm font-bold text-teal-950">
                <span className="font-semibold text-teal-700">Dự án:</span>{" "}
                <span className="break-words">{formData.ten_du_an || formData.ma_du_an || "—"}</span>
              </p>
              <p className="shrink-0 text-sm font-bold text-teal-950">
                <span className="font-semibold text-teal-700">Giai đoạn:</span>{" "}
                {formatGiaiDoanFullName(formData.giai_doan) || formData.giai_doan || "—"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {BCKS_MAIN_TABS.map((t) => {
              const active = mainTab === t.key;
              const ctaLabel = t.key === "bcks" ? "Lập hồ sơ BCKS" : t.shortLabel;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setMainTab(t.key)}
                  className={`rounded-lg border px-4 py-2 text-xs font-bold transition ${
                    active
                      ? t.key === "dia_chat"
                        ? "border-teal-500 bg-teal-600 text-white shadow-sm"
                        : "border-amber-500 bg-amber-500 text-white shadow-sm"
                      : t.key === "dia_chat"
                        ? "border-teal-300 bg-white/80 text-teal-800 hover:bg-teal-100"
                        : "border-amber-300 bg-white/80 text-amber-900 hover:bg-amber-50"
                  }`}
                >
                  {ctaLabel}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Thanh thao tác: (Địa chất) sub-tab | tiêu đề BCKS căn giữa · In/PDF · Lưu… */}
      <div className="relative shrink-0 flex flex-wrap items-center justify-between gap-2 border-b border-teal-100 bg-cyan-50/50 px-4 py-2">
        {mainTab === "dia_chat" ? (
          <div className="flex flex-wrap items-center gap-2">
            {diaChatForms.map((f) => {
              const tone = diaChatTabTone(f.key);
              const active = diaChatTab === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setDiaChatTab(f.key)}
                  className={`rounded-md border px-3 py-1.5 text-[11px] font-bold transition ${
                    active ? tone.active : tone.idle
                  }`}
                  title={f.label}
                >
                  {f.shortLabel}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center px-4">
            <span
              className="max-w-[min(100%,48rem)] text-center text-lg font-black uppercase leading-tight tracking-wide text-amber-950"
              style={{
                fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
              }}
            >
              Lập hồ sơ báo cáo khảo sát
            </span>
          </div>
        )}

        <div className="relative z-10 ml-auto flex flex-wrap items-center gap-2 shrink-0">
          {mainTab === "dia_chat" ? (
            <>
              <button
                type="button"
                onClick={handlePrintPdf}
                className="inline-flex items-center gap-1.5 rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-[11px] font-bold text-rose-800 hover:bg-rose-100 transition"
                title="In / lưu PDF biểu mẫu đang mở"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                In/PDF
              </button>
              <button
                type="button"
                disabled={exportingExcel}
                onClick={handleExportExcel}
                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 transition disabled:opacity-50"
                title="Xuất Excel biểu mẫu đang mở"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {exportingExcel ? "Đang xuất…" : "Xuất excel"}
              </button>
              <input
                ref={scanKqInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,application/pdf,image/png,image/jpeg,image/webp,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                onChange={handleScanKqFile}
              />
              <button
                type="button"
                disabled={scanningKq || exportingExcel}
                onClick={handleScanKqClick}
                className="inline-flex items-center gap-1.5 rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-[11px] font-bold text-indigo-800 hover:bg-indigo-100 transition disabled:opacity-50"
                title="Quét PDF/ảnh/Excel kết quả lab → điền biểu mẫu"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M8 12h8M12 8v8" />
                </svg>
                {scanningKq ? "Đang quét…" : "ScanKQ"}
              </button>
              <span className="mx-0.5 hidden h-5 w-px bg-teal-200 sm:block" aria-hidden />
            </>
          ) : null}
          {mainTab === "bcks" ? (
            <>
              <button
                type="button"
                disabled={!docsExportReady}
                onClick={handlePrintPdf}
                className="inline-flex items-center gap-1.5 rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-[11px] font-bold text-rose-800 hover:bg-rose-100 transition disabled:cursor-not-allowed disabled:opacity-40"
                title={
                  docsExportReady
                    ? "In / lưu PDF báo cáo khảo sát"
                    : "Nhấn Lưu để mở In/PDF"
                }
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                In/PDF
              </button>
              <button
                type="button"
                disabled={!docsExportReady || exportingWord}
                onClick={handleExportWord}
                className="inline-flex items-center gap-1.5 rounded-md border border-violet-300 bg-violet-50 px-3 py-1.5 text-[11px] font-bold text-violet-900 hover:bg-violet-100 transition disabled:cursor-not-allowed disabled:opacity-40"
                title={
                  docsExportReady
                    ? "Xuất Word báo cáo khảo sát (mẫu RTK)"
                    : "Nhấn Lưu để mở Xuất Word"
                }
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {exportingWord ? "Đang xuất…" : "Xuất Word"}
              </button>
              {coverHidden ? (
                <button
                  type="button"
                  onClick={() => setCoverHidden(false)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-900 hover:bg-amber-50 transition"
                  title="Hiện lại khung trang bìa & chữ ký"
                >
                  Hiện trang bìa
                </button>
              ) : null}
              <span className="mx-0.5 hidden h-5 w-px bg-teal-200 sm:block" aria-hidden />
            </>
          ) : null}
          <button
            type="button"
            disabled={saving}
            className={`${TOOLBAR_BTN} bg-teal-600 text-white hover:bg-teal-700 shadow-sm`}
            onClick={() => handleSave()}
          >
            Lưu
          </button>
          <button
            type="button"
            disabled={saving}
            className={`${TOOLBAR_BTN} border border-teal-300 bg-white text-teal-800 hover:bg-teal-50`}
            onClick={() => handleSave({ closeAfter: true })}
          >
            Lưu &amp; đóng
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
        <div
          ref={printRef}
          className={
            mainTab === "bcks"
              ? "bg-transparent p-0"
              : mainTab === "dia_chat" &&
                  (diaChatTab === "tn_nuoc" ||
                    diaChatTab === "tn_da" ||
                    diaChatTab === "do_dts" ||
                    diaChatTab === "bao_cao_dts")
                ? "bg-transparent p-0"
                : `rounded-xl border bg-white p-4 lg:p-5 ${mainTheme.panel}`
          }
        >
          {mainTab === "dia_chat" && diaChatTab === "co_ly_dat" ? (
            <CoLyDatPanel
              data={diaBlock}
              onField={onDiaField}
              onCell={onDiaCell}
              onAdd={onDiaAdd}
              onRemove={onDiaRemove}
            />
          ) : null}
          {mainTab === "dia_chat" && diaChatTab === "tn_nuoc" ? (
            <TnNuocPanel
              data={diaBlock}
              tenDuAn={formData.ten_du_an}
              giaiDoan={formData.giai_doan}
              onField={onDiaField}
              onCell={onDiaCell}
              onAdd={onDiaAdd}
              onRemove={onDiaRemove}
            />
          ) : null}
          {mainTab === "dia_chat" && diaChatTab === "co_ly_dat_2" ? (
            <CoLyDat2Panel
              data={diaBlock}
              tenDuAn={formData.ten_du_an}
              giaiDoan={formData.giai_doan}
              onField={onDiaField}
              onCell={onDiaCell}
              onAdd={onDiaAdd}
              onRemove={onDiaRemove}
            />
          ) : null}
          {mainTab === "dia_chat" && diaChatTab === "tn_da" ? (
            <TnDaPanel
              data={diaBlock}
              tenDuAn={formData.ten_du_an}
              giaiDoan={formData.giai_doan}
              onField={onDiaField}
              onCell={onDiaCell}
              onAdd={onDiaAdd}
              onRemove={onDiaRemove}
            />
          ) : null}
          {mainTab === "dia_chat" && diaChatTab === "do_dts" ? (
            <DoDtsPanel
              data={diaBlock}
              tenDuAn={formData.ten_du_an}
              giaiDoan={formData.giai_doan}
              onField={onDiaField}
              onCell={onDiaCell}
              onAdd={onDiaAdd}
              onRemove={onDiaRemove}
              onPhanTichCell={onDoDtsPhanTichCell}
              onPhanTichAdd={onDoDtsPhanTichAdd}
              onPhanTichRemove={onDoDtsPhanTichRemove}
            />
          ) : null}
          {mainTab === "dia_chat" && diaChatTab === "bao_cao_dts" ? (
            <BaoCaoDtsPanel
              data={diaBlock}
              tenDuAn={formData.ten_du_an}
              giaiDoan={formData.giai_doan}
              onField={onDiaField}
              onCell={onDiaCell}
              onLayerCell={onBaoCaoDtsLayerCell}
              onSoLopChange={onBaoCaoDtsSoLop}
              onAdd={onDiaAdd}
              onRemove={onDiaRemove}
            />
          ) : null}
          {mainTab === "bcks" ? (
            <BcksReportPanel
              data={formData.chi_tiet_bcks?.bcks || {}}
              coverHidden={coverHidden}
              onHideCover={() => setCoverHidden(true)}
              onField={(field, value) => setFormData((prev) => patchBcksField(prev, field, value))}
              onKlCell={onBcksKlCell}
              onKlAdd={onBcksKlAdd}
              onKlRemove={onBcksKlRemove}
              onTcCell={onBcksTcCell}
              onTcAdd={onBcksTcAdd}
              onTcRemove={onBcksTcRemove}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
