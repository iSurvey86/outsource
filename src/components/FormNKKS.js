"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, CloudRain } from "lucide-react";
import { supabase } from "../lib/supabase";
import { logHoatDong } from "../lib/logger";
import { useAppDialog } from "./AppDialog";
import {
  applyNkksDuPhongToDay,
  countDaysWithDiaryContent,
  filterNkksKlRowsForDisplay,
  generateNkksDiaryFromKl,
  NKKS_DEFAULT_MAY_MOC,
  NKKS_DEFAULT_NHAN_LUC,
} from "../lib/nkksAutoFillFromKl";
import { filterMauNuocChiTieuWhenParentZero, pruneEmptyNkksKlSectionHeaders, supplementDmCongViec } from "../lib/nvksLoaiHinh";
import {
  buildInitialNkksForm,
  buildNkksDbPayload,
  buildNkksNgaysFromRange,
  countFilledNkksDays,
  countNkksDaysForExport,
  createEmptyNkksDayRow,
  enumerateNkksIsoDates,
  getNkksDateRangeDayCount,
  isNkksDateRangeActive,
  MAX_NKKS_RANGE_DAYS,
  mergeSavedNkksIntoForm,
} from "../lib/nkksInit";
import {
  nkksKlSourceIsStale,
  resolveNvksKlSourceForNkks,
} from "../lib/nkksKlSource";
import { exportNkksWord, formatNkksNgayDisplay, generateNkksWordBlob } from "../lib/nkksWordExport";
import { convertDocxBlobToPdfDownload } from "../lib/exportPdfClient";
import {
  buildNkksExportFileNames,
  buildNkksExportStoragePath,
  parseNkksExportLink,
  uploadNkksExportBlob,
} from "../lib/nkksExportStorage";
import {
  EXPORT_REPLACE_CONFIRM_MSG,
  hasExistingExportFile,
  syncXuatBanTaiLieuSafe,
} from "../lib/hoSoTaiLieu";
import { getAuthUser } from "../lib/authSession";
import {
  NKKS_THOI_TIET_CHIP_STYLES,
  NKKS_THOI_TIET_OPTIONS,
  isDefaultGiamSatValue,
  isDefaultKhongValue,
  NKKS_DEFAULT_GIAM_SAT_VALUE,
  normalizeGiamSatField,
  normalizeThoiTiet,
  toggleThoiTietOption,
} from "../lib/nkksThoiTiet";
import { fetchNkksByMaDuAn, saveNkksToDb, updateNkksExportLinks } from "../lib/nkksHoSo";
import ExportFileNameDisplay from "./ExportFileNameDisplay";
import NkksSimpleKlTable from "./NkksSimpleKlTable";

const DAY_LABELS = {
  ngay_khao_sat: "Ngày KS",
  thoi_tiet: "Điều kiện thời tiết",
  nhan_luc: "Nhân lực",
  cong_viec_thuc_hien: "Công việc thực hiện trong ngày",
  may_moc_thiet_bi: "Máy móc TB",
  y_kien_chu_dau_tu: "Ý kiến của CĐT",
  y_kien_giam_sat: "Ý kiến giám sát",
  cac_van_de_dac_biet: "Vấn đề đặc biệt khác",
};

const TOOLBAR_BTN =
  "inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-45 disabled:cursor-not-allowed";

const NKKS_FIELD =
  "mt-1 w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100";
const NKKS_FIELD_READONLY = `${NKKS_FIELD} bg-gray-50`;
const NKKS_FIELD_DATE =
  "mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100";
const NKKS_FIELD_TEXTAREA = `${NKKS_FIELD} resize-none overflow-hidden text-justify leading-relaxed`;
const NKKS_DAY_DATE_HEADER =
  "bg-transparent border-0 text-sm font-bold text-white outline-none min-w-[9rem] [color-scheme:dark]";

const NKKS_DAY_HEADER_THEMES = [
  { bar: "bg-gradient-to-r from-sky-600 to-sky-500 border-sky-700", outer: "border-sky-500", text: "text-white" },
  { bar: "bg-gradient-to-r from-teal-600 to-teal-500 border-teal-700", outer: "border-teal-500", text: "text-white" },
  { bar: "bg-gradient-to-r from-indigo-600 to-indigo-500 border-indigo-700", outer: "border-indigo-500", text: "text-white" },
  { bar: "bg-gradient-to-r from-amber-600 to-amber-500 border-amber-700", outer: "border-amber-500", text: "text-white" },
  { bar: "bg-gradient-to-r from-rose-600 to-rose-500 border-rose-700", outer: "border-rose-500", text: "text-white" },
];

function getNkksDayHeaderTheme(index) {
  return NKKS_DAY_HEADER_THEMES[index % NKKS_DAY_HEADER_THEMES.length];
}

const NKKS_SPARE_DAY_THEME = {
  bar: "bg-gradient-to-r from-violet-700 to-purple-500 border-violet-800",
  outer: "border-violet-500",
  text: "text-white",
};

const NKKS_WEEKDAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function toNkksIsoDate(year, monthIndex, day) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseNkksIsoParts(iso) {
  const key = String(iso || "").slice(0, 10);
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { year: y, monthIndex: m - 1, day: d };
}

function shiftNkksMonth(year, monthIndex, delta) {
  const date = new Date(year, monthIndex + delta, 1);
  return { year: date.getFullYear(), monthIndex: date.getMonth() };
}

function buildNkksMonthCells(year, monthIndex) {
  const firstDow = new Date(year, monthIndex, 1).getDay();
  const mondayOffset = firstDow === 0 ? 6 : firstDow - 1;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < mondayOffset; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, iso: toNkksIsoDate(year, monthIndex, day) });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function NkksSpareDayCalendar({
  rangeStart,
  rangeEnd,
  selectedSet,
  viewYear,
  viewMonthIndex,
  onViewChange,
  onToggleDay,
  onDone,
}) {
  const start = String(rangeStart || "").slice(0, 10);
  const end = String(rangeEnd || "").slice(0, 10);
  const startParts = parseNkksIsoParts(start);
  const endParts = parseNkksIsoParts(end);
  const cells = useMemo(
    () => buildNkksMonthCells(viewYear, viewMonthIndex),
    [viewYear, viewMonthIndex]
  );

  const canPrev =
    startParts &&
    (viewYear > startParts.year ||
      (viewYear === startParts.year && viewMonthIndex > startParts.monthIndex));
  const canNext =
    endParts &&
    (viewYear < endParts.year ||
      (viewYear === endParts.year && viewMonthIndex < endParts.monthIndex));

  return (
    <div className="relative mt-2 rounded-lg border border-violet-200 bg-white p-2.5 pt-9 shadow-sm">
      <button
        type="button"
        onClick={onDone}
        className="absolute right-2 top-2 inline-flex h-6 items-center justify-center rounded-full border border-violet-300 bg-violet-50 px-2 text-[10px] font-bold text-violet-700 hover:bg-violet-100"
        title="Chọn xong"
      >
        ✓ Xong
      </button>

      <div className="mb-2 flex items-center justify-between gap-2 pr-16">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => onViewChange(shiftNkksMonth(viewYear, viewMonthIndex, -1))}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-violet-100 text-violet-700 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-35"
          aria-label="Tháng trước"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-xs font-semibold text-violet-800 tabular-nums">
          Tháng {viewMonthIndex + 1}/{viewYear}
        </p>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => onViewChange(shiftNkksMonth(viewYear, viewMonthIndex, 1))}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-violet-100 text-violet-700 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-35"
          aria-label="Tháng sau"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {NKKS_WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="text-center text-[10px] font-semibold text-slate-500 py-0.5"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, idx) => {
          if (!cell) {
            return <div key={`empty-${idx}`} className="h-8" />;
          }
          const inRange = cell.iso >= start && cell.iso <= end;
          const selected = selectedSet.has(cell.iso);
          return (
            <button
              key={cell.iso}
              type="button"
              disabled={!inRange}
              onClick={() => onToggleDay(cell.iso, !selected)}
              aria-pressed={selected}
              title={selected ? `Ngày ${cell.day} — ngày nghỉ (bấm để bỏ)` : `Ngày ${cell.day}`}
              className={`relative mx-auto flex h-8 w-8 items-center justify-center rounded-full text-[12px] tabular-nums transition-colors ${
                !inRange
                  ? "cursor-not-allowed text-slate-300"
                  : selected
                    ? "bg-violet-600 text-white hover:bg-violet-700"
                    : "text-slate-700 hover:bg-violet-50"
              }`}
            >
              {selected ? (
                <>
                  <span className="absolute text-[11px] font-semibold opacity-35">
                    {cell.day}
                  </span>
                  <CloudRain className="relative z-10 h-5 w-5" aria-hidden />
                </>
              ) : (
                cell.day
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const NKKS_DAY_INPUT =
  "mt-0.5 w-full rounded-md border border-gray-200 px-2 py-1 text-xs bg-white outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-100 resize-y min-h-[1.6rem]";

function nkksKhongFieldClass(value) {
  return isDefaultKhongValue(value)
    ? `${NKKS_DAY_INPUT} text-sky-500`
    : `${NKKS_DAY_INPUT} text-gray-800`;
}

function nkksGiamSatFieldClass(value) {
  return isDefaultGiamSatValue(value)
    ? `${NKKS_DAY_INPUT} text-sky-500`
    : `${NKKS_DAY_INPUT} text-gray-800`;
}

function normalizeGiamSatDisplay(value) {
  return normalizeGiamSatField(value);
}

/** Textarea tự giãn theo nội dung */
function NkksAutoGrowTextarea({ className, value, onChange, placeholder, minHeight = 40 }) {
  const ref = React.useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(minHeight, el.scrollHeight)}px`;
  }, [value, minHeight]);
  return (
    <textarea
      ref={ref}
      className={className}
      rows={1}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
    />
  );
}

function NkksThoiTietPicker({ value, onChange }) {
  const weather = normalizeThoiTiet(value);

  const renderRow = (buoiKey, label) => (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="text-[10px] font-bold text-gray-500 shrink-0 w-[4.5rem]">+ {label}</span>
      <div className="flex flex-wrap gap-1">
        {NKKS_THOI_TIET_OPTIONS.map((opt) => {
          const checked = weather[buoiKey].includes(opt);
          const chip = NKKS_THOI_TIET_CHIP_STYLES[opt];
          return (
            <button
              key={`${buoiKey}-${opt}`}
              type="button"
              aria-pressed={checked}
              onClick={() => onChange(toggleThoiTietOption(weather, buoiKey, opt))}
              className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold transition-all ${
                checked ? chip.active : chip.idle
              }`}
            >
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-sm border ${
                  checked ? chip.box : "border-gray-300 bg-white"
                }`}
                aria-hidden
              />
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="mt-0.5 space-y-1 rounded-md border border-sky-100 bg-white px-2 py-1.5">
      {renderRow("sang", "Buổi sáng")}
      {renderRow("chieu", "Buổi chiều")}
    </div>
  );
}

function NkksDayField({ label, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}

function NkksDayRow({ row, index, canRemove, dateReadOnly, onPatch, onRemove }) {
  const bind = (field) => ({
    value: row[field] || "",
    onChange: (e) => onPatch(index, field, e.target.value),
  });
  const bindKhong = (field) => ({
    value: row[field] || "Không",
    onChange: (e) => onPatch(index, field, e.target.value),
    onBlur: (e) => {
      if (!String(e.target.value || "").trim()) onPatch(index, field, "Không");
    },
    className: nkksKhongFieldClass(row[field]),
  });
  const bindGiamSat = {
    value: normalizeGiamSatDisplay(row.y_kien_giam_sat),
    onChange: (e) => onPatch(index, "y_kien_giam_sat", e.target.value),
    onBlur: (e) => {
      if (!String(e.target.value || "").trim()) {
        onPatch(index, "y_kien_giam_sat", NKKS_DEFAULT_GIAM_SAT_VALUE);
      }
    },
    className: nkksGiamSatFieldClass(normalizeGiamSatDisplay(row.y_kien_giam_sat)),
  };
  const isSpare = Boolean(row.la_ngay_du_phong);
  const theme = isSpare ? NKKS_SPARE_DAY_THEME : getNkksDayHeaderTheme(index);

  return (
    <div
      className={`rounded-lg border-2 overflow-hidden bg-white shadow-sm ${theme.outer}`}
    >
      <div
        className={`grid grid-cols-3 items-center gap-3 px-3 py-2.5 border-b-2 ${theme.bar}`}
      >
        <span className={`justify-self-start text-sm font-black tracking-tight ${theme.text} inline-flex items-center gap-2`}>
          Ngày {index + 1}
          {isSpare ? (
            <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/20 border border-white/40">
              Dự phòng
            </span>
          ) : null}
        </span>
        <label className="justify-self-center inline-flex items-center gap-2">
          <span className={`text-xs font-bold uppercase tracking-wide ${theme.text}`}>
            Ngày khảo sát
          </span>
          {dateReadOnly ? (
            <span className={`text-sm font-bold tabular-nums ${theme.text}`}>
              {formatNkksNgayDisplay(row.ngay_khao_sat) || "—"}
            </span>
          ) : (
            <input
              type="date"
              value={String(row.ngay_khao_sat || "").slice(0, 10)}
              onChange={(e) => onPatch(index, "ngay_khao_sat", e.target.value)}
              className={NKKS_DAY_DATE_HEADER}
            />
          )}
        </label>
        <div className="justify-self-end min-h-[1.5rem] flex items-center justify-end">
          {canRemove ? (
            <button
              type="button"
              onClick={() => onRemove(index)}
              title="Xóa ngày"
              aria-label={`Xóa ngày ${index + 1}`}
              className={`h-6 w-6 rounded-full border border-white/40 bg-transparent ${theme.text} opacity-80 hover:opacity-100 hover:bg-white/10 flex items-center justify-center text-sm leading-none font-bold transition-colors`}
            >
              ×
            </button>
          ) : null}
        </div>
      </div>

      <div className="p-3 grid grid-cols-1 lg:grid-cols-2 gap-3 bg-gray-50/40">
        <div className="space-y-2 flex flex-col min-h-0">
          <NkksDayField label={DAY_LABELS.thoi_tiet}>
            <NkksThoiTietPicker
              value={row.thoi_tiet}
              onChange={(next) => onPatch(index, "thoi_tiet", next)}
            />
          </NkksDayField>
          <NkksDayField label={DAY_LABELS.cong_viec_thuc_hien} className="flex-1">
            <NkksAutoGrowTextarea
              {...bind("cong_viec_thuc_hien")}
              className={`${NKKS_DAY_INPUT} min-h-[6rem]`}
              minHeight={96}
            />
          </NkksDayField>
        </div>
        <div className="space-y-2">
          <NkksDayField label={DAY_LABELS.cac_van_de_dac_biet}>
            <textarea rows={2} {...bindKhong("cac_van_de_dac_biet")} />
          </NkksDayField>
          <NkksDayField label={DAY_LABELS.y_kien_giam_sat}>
            <textarea rows={2} {...bindGiamSat} />
          </NkksDayField>
          <NkksDayField label={DAY_LABELS.y_kien_chu_dau_tu}>
            <textarea rows={2} {...bindKhong("y_kien_chu_dau_tu")} />
          </NkksDayField>
        </div>
      </div>
    </div>
  );
}

function ToolbarSpinner() {
  return (
    <svg className="animate-spin w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export default function FormNKKS({ project, nvksRecord, nkksRecord: initialNkks, onClose, onSaved }) {
  const { showAlert, showConfirm } = useAppDialog();
  const [formData, setFormData] = useState(() => buildInitialNkksForm(project, nvksRecord));
  const [nkksRecordId, setNkksRecordId] = useState(initialNkks?.id || null);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isPrintingPdf, setIsPrintingPdf] = useState(false);
  const [formDirty, setFormDirty] = useState(!initialNkks?.id);
  const [initialized, setInitialized] = useState(false);
  const [templateData, setTemplateData] = useState([]);
  const [isLoadingKl, setIsLoadingKl] = useState(true);
  const [klResolve, setKlResolve] = useState(null);
  const [diaryGenModal, setDiaryGenModal] = useState(null);
  const [isSpareDatePickerOpen, setIsSpareDatePickerOpen] = useState(false);
  const [spareCalendarView, setSpareCalendarView] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), monthIndex: now.getMonth() };
  });
  const skipEmptyBootstrapRef = useRef(Boolean(initialNkks?.id));

  const loadKlTable = useCallback(async () => {
    const maDuAn = project?.ma_du_an || nvksRecord?.ma_du_an;
    if (!maDuAn) {
      setKlResolve(null);
      setIsLoadingKl(false);
      return;
    }
    setIsLoadingKl(true);
    try {
      const resolved = await resolveNvksKlSourceForNkks(supabase, maDuAn, {
        templateData,
        project,
      });
      setKlResolve(resolved);
      // Ghi đè snapshot KL đã lưu trên NKKS bằng bản live từ NVKS (tránh bảng tham chiếu kẹt 3 cũ)
      if (resolved?.rows) {
        setFormData((prev) => ({
          ...prev,
          bang_khoi_luong: resolved.rows,
          nvks_kl_source_id: resolved.klSourceRecord?.id || prev.nvks_kl_source_id,
          nvks_kl_source_label: resolved.klSourceLabel || prev.nvks_kl_source_label,
        }));
      }
    } catch (err) {
      console.error("Lỗi tải bảng KL NKKS:", err);
      setKlResolve(null);
    } finally {
      setIsLoadingKl(false);
    }
  }, [project, nvksRecord?.ma_du_an, templateData]);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from("DM_CONG_VIEC")
          .select("*")
          .order("id_cong_viec", { ascending: true });
        if (error) throw error;
        setTemplateData(supplementDmCongViec(data || []));
      } catch (err) {
        console.error("Lỗi tải DM công việc NKKS:", err.message);
      }
    })();
  }, []);

  useEffect(() => {
    if (!templateData.length) return;
    loadKlTable();
  }, [templateData, loadKlTable]);

  // Quay lại tab / mở lại form → tải lại KL từ NVKS đã lưu (tránh kẹt snapshot cũ)
  useEffect(() => {
    if (!templateData.length) return;
    const refresh = () => {
      if (document.visibilityState === "visible") loadKlTable();
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [templateData.length, loadKlTable]);

  useEffect(() => {
    if (initialNkks?.id) {
      skipEmptyBootstrapRef.current = true;
      setFormData(mergeSavedNkksIntoForm(initialNkks, project, nvksRecord));
      setNkksRecordId(initialNkks.id);
      setFormDirty(false);
    } else if (!skipEmptyBootstrapRef.current) {
      setFormData(buildInitialNkksForm(project, nvksRecord));
      setNkksRecordId(null);
      setFormDirty(true);
    }
    setInitialized(true);
  }, [initialNkks, project, nvksRecord]);

  useEffect(() => {
    const maDuAn = project?.ma_du_an || nvksRecord?.ma_du_an;
    if (!maDuAn || initialNkks?.id || nkksRecordId) return;

    let cancelled = false;
    (async () => {
      try {
        const saved = await fetchNkksByMaDuAn(supabase, maDuAn);
        if (cancelled || !saved?.id) return;
        skipEmptyBootstrapRef.current = true;
        setFormData(mergeSavedNkksIntoForm(saved, project, nvksRecord));
        setNkksRecordId(saved.id);
        setFormDirty(false);
      } catch (err) {
        console.error("Lỗi tải NKKS đã lưu:", err.message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialNkks?.id, nkksRecordId, project, nvksRecord]);

  const patchForm = useCallback((patch) => {
    setFormData((prev) => ({ ...prev, ...patch }));
    setFormDirty(true);
  }, []);

  const patchFormWithDateRange = useCallback(
    (patch) => {
      setFormData((prev) => {
        const next = { ...prev, ...patch };
        const start = String(next.ngay_bat_dau || "").slice(0, 10);
        const end = String(next.ngay_ket_thuc || "").slice(0, 10);

        // Ngày kết thúc không được trước ngày bắt đầu
        if (start && end && end < start) {
          queueMicrotask(() =>
            showAlert(
              "Ngày kết thúc không được nhỏ hơn ngày bắt đầu.\n\nVui lòng chọn lại khoảng thời gian khảo sát."
            )
          );
          return prev;
        }

        const dayCount = getNkksDateRangeDayCount(next.ngay_bat_dau, next.ngay_ket_thuc);

        if (dayCount > MAX_NKKS_RANGE_DAYS) {
          queueMicrotask(() =>
            showAlert(`Khoảng ngày tối đa ${MAX_NKKS_RANGE_DAYS} ngày. Vui lòng chọn lại ngày bắt đầu / kết thúc.`)
          );
          return prev;
        }

        const synced = buildNkksNgaysFromRange(next.ngay_bat_dau, next.ngay_ket_thuc, prev.nkks_ngays);
        if (synced) next.nkks_ngays = synced;
        return next;
      });
      setFormDirty(true);
    },
    [showAlert]
  );

  const patchDay = useCallback((index, field, value) => {
    setFormData((prev) => {
      const nkks_ngays = [...(prev.nkks_ngays || [])];
      nkks_ngays[index] = { ...nkks_ngays[index], [field]: value };
      return { ...prev, nkks_ngays };
    });
    setFormDirty(true);
  }, []);

  const addDay = () => {
    setFormData((prev) => ({
      ...prev,
      nkks_ngays: [...(prev.nkks_ngays || []), createEmptyNkksDayRow()],
    }));
    setFormDirty(true);
  };

  const removeDay = (index) => {
    setFormData((prev) => {
      const nkks_ngays = [...(prev.nkks_ngays || [])];
      if (nkks_ngays.length <= 1) return prev;
      nkks_ngays.splice(index, 1);
      return { ...prev, nkks_ngays };
    });
    setFormDirty(true);
  };

  const toggleSpareDay = useCallback((isoDate, enabled) => {
    const key = String(isoDate || "").slice(0, 10);
    if (!key) return;
    setFormData((prev) => {
      const nkks_ngays = (prev.nkks_ngays || []).map((row) => {
        if (String(row.ngay_khao_sat || "").slice(0, 10) !== key) return row;
        return applyNkksDuPhongToDay(row, enabled);
      });
      return { ...prev, nkks_ngays };
    });
    setFormDirty(true);
  }, []);

  const openSpareDatePicker = useCallback(() => {
    setIsSpareDatePickerOpen((open) => {
      if (!open) {
        const startParts = parseNkksIsoParts(formData.ngay_bat_dau);
        if (startParts) {
          setSpareCalendarView({ year: startParts.year, monthIndex: startParts.monthIndex });
        }
      }
      return !open;
    });
  }, [formData.ngay_bat_dau]);

  const liveKlRows = useMemo(() => klResolve?.rows || [], [klResolve?.rows]);
  // Ưu tiên KL live từ NVKS; chỉ fallback snapshot đã lưu khi chưa resolve xong
  const displayKlRows = useMemo(() => {
    if (klResolve) return liveKlRows;
    return formData.bang_khoi_luong || [];
  }, [klResolve, liveKlRows, formData.bang_khoi_luong]);
  const visibleKlRows = useMemo(() => {
    const base = filterNkksKlRowsForDisplay(displayKlRows);
    return pruneEmptyNkksKlSectionHeaders(filterMauNuocChiTieuWhenParentZero(base));
  }, [displayKlRows]);
  const visibleWorkRowCount = useMemo(
    () =>
      visibleKlRows.filter(
        (row) =>
          !row?.is_header &&
          parseFloat(String(row?.khoi_luong || "0").replace(",", ".")) > 0
      ).length,
    [visibleKlRows]
  );

  const rangeIsoDates = useMemo(
    () => enumerateNkksIsoDates(formData.ngay_bat_dau, formData.ngay_ket_thuc),
    [formData.ngay_bat_dau, formData.ngay_ket_thuc]
  );
  const spareDaySet = useMemo(() => {
    const set = new Set();
    for (const row of formData.nkks_ngays || []) {
      if (row?.la_ngay_du_phong) {
        const key = String(row.ngay_khao_sat || "").slice(0, 10);
        if (key) set.add(key);
      }
    }
    return set;
  }, [formData.nkks_ngays]);
  const spareDayCount = spareDaySet.size;

  const applyDiaryGeneration = useCallback(
    (mode) => {
      const klRows = klResolve ? liveKlRows : formData.bang_khoi_luong || [];
      const result = generateNkksDiaryFromKl({
        klRows,
        days: formData.nkks_ngays || [],
        mode,
        nhanLuc: formData.nhan_luc,
        mayMoc: formData.may_moc_thiet_bi,
      });
      if (result.error === "all_spare") {
        setDiaryGenModal(null);
        void showAlert(
          "Tất cả ngày trong khoảng đang là ngày dự phòng. Bỏ chọn ít nhất một ngày hiện trường trước khi VIẾT NKKS."
        );
        return;
      }
      setFormData((prev) => ({
        ...prev,
        nkks_ngays: result.days,
        nhan_luc: result.nhan_luc,
        may_moc_thiet_bi: result.may_moc_thiet_bi,
      }));
      setFormDirty(true);
      setDiaryGenModal(null);
      const tenDuAn =
        formData.ten_cong_trinh ||
        formData.ten_du_an ||
        project?.ten_du_an ||
        "—";
      const pages = result.stats.filled;
      void showAlert(
        `Đã viết xong ${pages} trang Nhật ký khảo sát dự án: ${tenDuAn}` +
          (result.stats.skipped
            ? `\n\n(Đã giữ nguyên ${result.stats.skipped} trang đã có nội dung.)`
            : "")
      );
    },
    [
      formData.bang_khoi_luong,
      formData.may_moc_thiet_bi,
      formData.nhan_luc,
      formData.nkks_ngays,
      formData.ten_cong_trinh,
      formData.ten_du_an,
      klResolve,
      liveKlRows,
      project?.ten_du_an,
      showAlert,
    ]
  );

  const handleOpenDiaryGenerate = useCallback(async () => {
    const days = formData.nkks_ngays || [];
    if (!days.length) {
      await showAlert("Chưa có trang nhật ký. Chọn ngày bắt đầu & kết thúc trước.");
      return;
    }
    const workDays = days.filter((d) => !d?.la_ngay_du_phong);
    if (!workDays.length) {
      await showAlert(
        "Tất cả ngày trong khoảng đang là ngày dự phòng. Bỏ chọn ít nhất một ngày hiện trường trước khi VIẾT NKKS."
      );
      return;
    }
    const klRows = klResolve ? liveKlRows : formData.bang_khoi_luong || [];
    if (!klRows.some((r) => !r.is_header && parseFloat(String(r.khoi_luong || "0").replace(",", ".")) > 0)) {
      await showAlert("Chưa có khối lượng từ NVKS để nhặt vào nhật ký.");
      return;
    }
    const existing = countDaysWithDiaryContent(days);
    if (existing > 0) {
      setDiaryGenModal({ existingCount: existing, dayCount: workDays.length });
      return;
    }
    applyDiaryGeneration("overwrite");
  }, [
    applyDiaryGeneration,
    formData.bang_khoi_luong,
    formData.nkks_ngays,
    klResolve,
    liveKlRows,
    showAlert,
  ]);

  const klStale = useMemo(
    () =>
      nkksKlSourceIsStale(
        { nvks_kl_source_id: formData.nvks_kl_source_id || initialNkks?.nvks_kl_source_id },
        klResolve
      ),
    [formData.nvks_kl_source_id, initialNkks?.nvks_kl_source_id, klResolve]
  );

  const handleSave = async ({ closeAfter = false } = {}) => {
    if (!nvksRecord?.id && !klResolve?.nvksGocId) {
      await showAlert("Thiếu hồ sơ NVKS — không thể lưu NKKS.");
      return null;
    }

    const filledDays = countFilledNkksDays(formData.nkks_ngays);
    if (filledDays < 1) {
      await showAlert("Cần ít nhất 1 dòng nhật ký có nội dung.");
      return null;
    }

    const nvksGocId = klResolve?.nvksGocId || nvksRecord?.id;
    const klSnapshot = {
      rows: liveKlRows,
      klSourceId: klResolve?.klSourceRecord?.id || null,
      klSourceLabel: klResolve?.klSourceLabel || "",
    };

    setIsSaving(true);
    try {
      const payload = buildNkksDbPayload(formData, nvksGocId, klSnapshot);
      const { id: savedId, created } = await saveNkksToDb(supabase, {
        payload,
        recordId: nkksRecordId,
        maDuAn: formData.ma_du_an,
      });

      setNkksRecordId(savedId);
      skipEmptyBootstrapRef.current = true;

      setFormData((prev) => ({
        ...prev,
        bang_khoi_luong: payload.bang_khoi_luong,
        nvks_kl_source_id: payload.nvks_kl_source_id,
        nvks_kl_source_label: payload.nvks_kl_source_label,
      }));

      await logHoatDong({
        phanHe: "NKKS",
        hanhDong: created ? "CREATE" : "UPDATE",
        chiTietNgan: `${created ? "Tạo" : "Cập nhật"} NKKS — ${formData.ma_du_an} (KL: ${klSnapshot.klSourceLabel})`,
        doiTuongId: savedId,
        duLieuDong: {
          ma_du_an: formData.ma_du_an,
          so_ngay: filledDays,
          nvks_kl_source_label: klSnapshot.klSourceLabel,
          giai_doan: formData.giai_doan,
        },
      });

      setFormDirty(false);
      onSaved?.();
      if (closeAfter) onClose?.();
      else await showAlert("Đã lưu nhật ký khảo sát.");
      return savedId;
    } catch (err) {
      console.error(err);
      await showAlert(`Lỗi lưu NKKS: ${err.message}`);
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const buildExportForm = () => ({
    ...formData,
    bang_khoi_luong: (formData.bang_khoi_luong?.length ? formData.bang_khoi_luong : liveKlRows) || [],
    giai_doan: formData.giai_doan || project?.giai_doan || "",
  });

  const assertExportReady = async () => {
    if (!nkksRecordId || formDirty) {
      await showAlert("Bạn phải Lưu trước khi xuất file.");
      return false;
    }
    const readyDays = countNkksDaysForExport(
      formData.nkks_ngays,
      formData.ngay_bat_dau,
      formData.ngay_ket_thuc
    );
    if (readyDays < 1) {
      await showAlert("Cần ít nhất 1 ngày khảo sát để xuất file.");
      return false;
    }
    return true;
  };

  const handleExportWord = async () => {
    if (!(await assertExportReady())) return;

    const hadDocx = await hasExistingExportFile(supabase, {
      maDuAn: formData.ma_du_an,
      moduleLoai: "nkks",
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

    setIsExporting(true);
    try {
      const exportForm = buildExportForm();
      const { storageUrl, displayName, displayTime, timestamp } = await exportNkksWord({
        formData: exportForm,
        supabase,
        saveToStorage: true,
        download: true,
      });

      if (!storageUrl) {
        throw new Error("Đã xuất Word nhưng không lấy được URL file trên kho lưu trữ.");
      }

      const exportedAt = new Date(timestamp || Date.now()).toISOString();
      const updatedRow = await updateNkksExportLinks(supabase, nkksRecordId, {
        link_docx_xuat: storageUrl,
        exported_at: exportedAt,
      });

      const user = getAuthUser();
      await syncXuatBanTaiLieuSafe(supabase, {
        maDuAn: formData.ma_du_an,
        moduleLoai: "nkks",
        kind: "docx",
        storagePath: storageUrl,
        displayName: displayName || parseNkksExportLink(storageUrl, exportedAt).displayName,
        thoiGian: exportedAt,
        nguoiUpMaNv: user?.ma_nv,
      });

      setFormData((prev) => ({
        ...prev,
        link_docx_xuat: updatedRow.link_docx_xuat || storageUrl,
        link_pdf_xuat: updatedRow.link_pdf_xuat || prev.link_pdf_xuat || "",
        exported_at: updatedRow.exported_at || exportedAt,
      }));

      if (updatedRow.schemaWarning) {
        await showAlert(
          `Đã tải Word thành công.\n\nLưu ý: chưa ghi link lên hồ sơ — ${updatedRow.schemaWarning}`
        );
      } else if (displayName) {
        await showAlert(
          `Đã xuất Word: ${displayName}${displayTime ? `\nThời gian: ${displayTime}` : ""}`
        );
      }

      await logHoatDong({
        phanHe: "NKKS",
        hanhDong: "EXPORT_WORD",
        chiTietNgan: `Xuất Word NKKS — ${formData.ma_du_an}`,
        doiTuongId: nkksRecordId,
        duLieuDong: { link_docx_xuat: storageUrl, giai_doan: formData.giai_doan, ma_du_an: formData.ma_du_an },
      });
    } catch (err) {
      console.error(err);
      await showAlert(`Lỗi xuất Word: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrintPdf = async () => {
    if (!(await assertExportReady())) return;
    setIsPrintingPdf(true);
    try {
      const exportForm = buildExportForm();
      const { outBlob, downloadFileName } = await generateNkksWordBlob(exportForm);
      const pdfName = String(downloadFileName || `${exportForm.ma_du_an || "NKKS"}.docx`).replace(
        /\.docx$/i,
        ".pdf"
      );
      await convertDocxBlobToPdfDownload(outBlob, {
        fileName: pdfName,
        download: true,
        openAfterDownload: true,
      });
      await logHoatDong({
        phanHe: "NKKS",
        hanhDong: "PRINT_PDF",
        chiTietNgan: `Xuất PDF NKKS — ${formData.ma_du_an}`,
        doiTuongId: nkksRecordId,
        duLieuDong: { giai_doan: formData.giai_doan, ma_du_an: formData.ma_du_an, via: "libreoffice" },
      });
    } catch (err) {
      console.error(err);
      await showAlert(`Lỗi xuất PDF: ${err.message}`);
    } finally {
      setIsPrintingPdf(false);
    }
  };

  const handleUploadPdfPhatHanh = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!nkksRecordId) {
      await showAlert("Lưu hồ sơ NKKS trước khi upload PDF để trình ký.");
      e.target.value = "";
      return;
    }
    const isPdf =
      file.type === "application/pdf" || String(file.name || "").toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      await showAlert("Chọn file PDF (.pdf).");
      e.target.value = "";
      return;
    }
    const hadPdf = await hasExistingExportFile(supabase, {
      maDuAn: formData.ma_du_an,
      moduleLoai: "nkks",
      kind: "pdf",
      formLink: formData.link_pdf_xuat,
    });
    if (hadPdf) {
      const ok = await showConfirm(EXPORT_REPLACE_CONFIRM_MSG, {
        title: "Đã có PDF để trình ký",
        confirmLabel: "Tải lên",
        cancelLabel: "Hủy",
        variant: "warning",
      });
      if (!ok) {
        e.target.value = "";
        return;
      }
    }
    try {
      const exportForm = buildExportForm();
      const ts = Date.now();
      const names = buildNkksExportFileNames(exportForm, { timestamp: ts, ext: "pdf" });
      const pdfPath = buildNkksExportStoragePath(exportForm, names.localFileName);
      const pdfUrl = await uploadNkksExportBlob(supabase, file, pdfPath, "application/pdf");
      const exportedAt = new Date(ts).toISOString();
      const updatedRow = await updateNkksExportLinks(supabase, nkksRecordId, {
        link_pdf_xuat: pdfUrl,
        exported_at: exportedAt,
      });
      const user = getAuthUser();
      await syncXuatBanTaiLieuSafe(supabase, {
        maDuAn: formData.ma_du_an,
        moduleLoai: "nkks",
        kind: "pdf",
        storagePath: pdfUrl,
        displayName: names.displayName,
        thoiGian: exportedAt,
        nguoiUpMaNv: user?.ma_nv,
      });
      setFormData((prev) => ({
        ...prev,
        link_pdf_xuat: updatedRow.link_pdf_xuat || pdfUrl,
        exported_at: updatedRow.exported_at || exportedAt,
      }));
      if (updatedRow.schemaWarning) {
        await showAlert(
          `Đã lưu PDF nhưng chưa ghi đủ link lên hồ sơ — ${updatedRow.schemaWarning}`
        );
      } else {
        await showAlert(
          `Đã upload PDF: ${names.displayName}${names.displayTime ? `\nThời gian: ${names.displayTime}` : ""}`
        );
      }
      await logHoatDong({
        phanHe: "NKKS",
        hanhDong: "UPLOAD_PDF_PHAT_HANH",
        chiTietNgan: `Upload PDF để trình ký NKKS — ${formData.ma_du_an}`,
        doiTuongId: nkksRecordId,
        duLieuDong: { link_pdf_xuat: pdfUrl, giai_doan: formData.giai_doan, ma_du_an: formData.ma_du_an },
      });
    } catch (err) {
      await showAlert(`Lỗi upload PDF để trình ký: ${err.message}`);
    } finally {
      e.target.value = "";
    }
  };

  const docxExportMeta = useMemo(
    () => parseNkksExportLink(formData.link_docx_xuat, formData.exported_at),
    [formData.link_docx_xuat, formData.exported_at]
  );
  const pdfExportMeta = useMemo(
    () => parseNkksExportLink(formData.link_pdf_xuat, formData.exported_at),
    [formData.link_pdf_xuat, formData.exported_at]
  );

  if (!initialized) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        Đang tải form NKKS...
      </div>
    );
  }

  const filledDays = countFilledNkksDays(formData.nkks_ngays);
  const exportableDays = countNkksDaysForExport(
    formData.nkks_ngays,
    formData.ngay_bat_dau,
    formData.ngay_ket_thuc
  );
  const dateRangeActive = isNkksDateRangeActive(formData.ngay_bat_dau, formData.ngay_ket_thuc);
  const rangeDayCount = getNkksDateRangeDayCount(formData.ngay_bat_dau, formData.ngay_ket_thuc);
  const canExport =
    Boolean(nkksRecordId) && !formDirty && exportableDays > 0 && !isExporting && !isPrintingPdf;

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white text-gray-800">
      <div className="bg-white px-6 py-4 border-b border-sky-100 flex justify-between items-center shadow-sm z-10 gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-sky-50 rounded text-gray-500 transition shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div className="min-w-0">
            <h3 className="font-black text-sky-900 text-base tracking-tight uppercase truncate">
              Nhật ký khảo sát (NKKS)
            </h3>
            <p className="text-xs text-sky-700 font-medium truncate">{project?.ten_du_an}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSave()}
            className={`${TOOLBAR_BTN} bg-sky-600 hover:bg-sky-700 text-white shadow-sm`}
          >
            {isSaving ? <ToolbarSpinner /> : null}
            Lưu
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => handleSave({ closeAfter: true })}
            className={`${TOOLBAR_BTN} bg-white border border-sky-200 text-sky-800 hover:bg-sky-50`}
          >
            Lưu &amp; đóng
          </button>
          <button
            type="button"
            disabled={!canExport}
            onClick={handleExportWord}
            className={`${TOOLBAR_BTN} ${
              canExport
                ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md"
                : "bg-slate-200 text-slate-400"
            }`}
            title={!nkksRecordId || formDirty ? "Lưu trước khi xuất Word" : "Xuất file Word"}
          >
            {isExporting ? <ToolbarSpinner /> : null}
            Xuất Word
          </button>
          <button
            type="button"
            disabled={!canExport}
            onClick={handlePrintPdf}
            className={`${TOOLBAR_BTN} ${
              canExport
                ? "bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-md"
                : "bg-slate-200 text-slate-400"
            }`}
            title={!nkksRecordId || formDirty ? "Lưu trước khi In/PDF" : "Xuất PDF A4 chuẩn (LibreOffice)"}
          >
            {isPrintingPdf ? <ToolbarSpinner /> : null}
            {isPrintingPdf ? "Xuất PDF…" : "In/PDF"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-slate-50/50">
        <div className="max-w-6xl mx-auto space-y-6">
          {klStale && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex flex-wrap items-center justify-between gap-3">
              <p>
                <span className="font-bold">Đã có NVKS điều chỉnh mới hơn</span> (đang hiển thị{" "}
                <span className="font-semibold">{klResolve?.klSourceLabel}</span>
                {initialNkks?.nvks_kl_source_label
                  ? `; lần lưu trước tham chiếu ${initialNkks.nvks_kl_source_label}`
                  : ""}
                ). Bảng KL bên dưới đã cập nhật theo thực tế mới nhất — bấm <strong>Lưu</strong> để ghi vết tham chiếu.
              </p>
            </div>
          )}

          <section className="rounded-xl border border-sky-100 bg-white p-4 lg:p-5 shadow-sm">
            <h4 className="text-sm font-bold text-sky-900 mb-0.5 uppercase tracking-wide">I. Thông tin chung</h4>
            <p className="text-xs text-gray-500 mb-3">Phase 1: metadata phục vụ nhật ký và nghiệm thu sau này</p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs font-semibold text-gray-600">Tên công trình</span>
                  <input
                    type="text"
                    readOnly
                    value={formData.ten_cong_trinh || ""}
                    className={NKKS_FIELD_READONLY}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-gray-600">Chủ đầu tư</span>
                  <input
                    type="text"
                    value={formData.chu_dau_tu || ""}
                    onChange={(e) => patchForm({ chu_dau_tu: e.target.value })}
                    className={NKKS_FIELD}
                    placeholder="Tự lấy từ dự án — sửa nếu phát hiện sai"
                  />
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-semibold text-gray-600">Địa điểm</span>
                    <input
                      type="text"
                      value={formData.dia_diem || ""}
                      onChange={(e) => patchForm({ dia_diem: e.target.value })}
                      className={NKKS_FIELD}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-gray-600">Hạng mục</span>
                    <input
                      type="text"
                      value={formData.hang_muc || ""}
                      onChange={(e) => patchForm({ hang_muc: e.target.value })}
                      className={NKKS_FIELD}
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="text-xs font-semibold text-gray-600">Nhà thầu KS</span>
                  <input
                    type="text"
                    value={formData.nha_thau_ks || ""}
                    onChange={(e) => patchForm({ nha_thau_ks: e.target.value })}
                    className={NKKS_FIELD}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-gray-600">Nhà thầu Tư vấn giám sát</span>
                  <input
                    type="text"
                    value={formData.nha_thau_tvgs || ""}
                    onChange={(e) => patchForm({ nha_thau_tvgs: e.target.value })}
                    placeholder="Để trống nếu Chủ đầu tư tự giám sát"
                    className={NKKS_FIELD}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-gray-600">Gói thầu</span>
                  <input
                    type="text"
                    value={formData.goi_thau || ""}
                    onChange={(e) => patchForm({ goi_thau: e.target.value })}
                    className={NKKS_FIELD}
                  />
                </label>
              </div>

              <div className="flex flex-col gap-3 lg:min-h-[280px]">
                <label className="block">
                  <span className="text-xs font-semibold text-gray-600">Nhân lực</span>
                  <NkksAutoGrowTextarea
                    value={formData.nhan_luc || ""}
                    onChange={(e) => patchForm({ nhan_luc: e.target.value })}
                    placeholder={NKKS_DEFAULT_NHAN_LUC}
                    className={`mt-1 ${NKKS_FIELD_TEXTAREA}`}
                    minHeight={52}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-gray-600">Máy móc TB</span>
                  <NkksAutoGrowTextarea
                    value={formData.may_moc_thiet_bi || ""}
                    onChange={(e) => patchForm({ may_moc_thiet_bi: e.target.value })}
                    placeholder={NKKS_DEFAULT_MAY_MOC}
                    className={`mt-1 ${NKKS_FIELD_TEXTAREA}`}
                    minHeight={52}
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-semibold text-gray-600">Ngày bắt đầu</span>
                    <input
                      type="date"
                      value={formData.ngay_bat_dau || ""}
                      onChange={(e) => patchFormWithDateRange({ ngay_bat_dau: e.target.value })}
                      max={formData.ngay_ket_thuc || undefined}
                      className={NKKS_FIELD_DATE}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-gray-600">Ngày kết thúc</span>
                    <input
                      type="date"
                      value={formData.ngay_ket_thuc || ""}
                      onChange={(e) => patchFormWithDateRange({ ngay_ket_thuc: e.target.value })}
                      min={formData.ngay_bat_dau || undefined}
                      className={NKKS_FIELD_DATE}
                    />
                  </label>
                </div>

                {dateRangeActive && rangeIsoDates.length > 0 ? (
                  <div>
                    <label className="block">
                      <span className="text-xs font-semibold text-violet-700">
                        Ngày nghỉ (mưa, bão...)
                        {spareDayCount > 0 ? (
                          <span className="ml-1 font-normal text-violet-600">
                            · {spareDayCount}/{rangeDayCount}
                          </span>
                        ) : null}
                      </span>
                      <button
                        type="button"
                        onClick={openSpareDatePicker}
                        aria-expanded={isSpareDatePickerOpen}
                        className={`${NKKS_FIELD_DATE} flex items-center justify-between border-violet-300 text-left focus:border-violet-500 focus:ring-violet-100`}
                      >
                        <span className={spareDayCount > 0 ? "text-violet-700 font-normal" : "text-slate-500 font-normal"}>
                          {spareDayCount > 0
                            ? `Đã chọn ${spareDayCount} ngày nghỉ`
                            : "Chọn ngày nghỉ"}
                        </span>
                        <CalendarIcon className="h-4 w-4 shrink-0 text-violet-600" aria-hidden />
                      </button>
                    </label>
                    {isSpareDatePickerOpen ? (
                      <NkksSpareDayCalendar
                        rangeStart={formData.ngay_bat_dau}
                        rangeEnd={formData.ngay_ket_thuc}
                        selectedSet={spareDaySet}
                        viewYear={spareCalendarView.year}
                        viewMonthIndex={spareCalendarView.monthIndex}
                        onViewChange={setSpareCalendarView}
                        onToggleDay={toggleSpareDay}
                        onDone={() => setIsSpareDatePickerOpen(false)}
                      />
                    ) : null}
                    {spareDayCount > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {rangeIsoDates
                          .filter((iso) => spareDaySet.has(iso))
                          .map((iso) => (
                            <button
                              key={iso}
                              type="button"
                              onClick={() => toggleSpareDay(iso, false)}
                              title="Bỏ ngày nghỉ"
                              className="inline-flex items-center gap-1.5 rounded-md border border-violet-400 bg-violet-600 px-2 py-1 text-[11px] font-normal text-white hover:bg-violet-700"
                            >
                              {formatNkksNgayDisplay(iso)}
                              <span aria-hidden>×</span>
                            </button>
                          ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-auto pt-3 border-t border-sky-100">
                  <p className="text-[11px] font-bold text-indigo-700 uppercase mb-2">FILE XUẤT &amp; KHO HỒ SƠ</p>
                  <div className="bg-indigo-50/40 border border-indigo-100 rounded-lg p-2.5">
                    {formData.link_docx_xuat || formData.link_pdf_xuat ? (
                      <div className="min-w-0 space-y-1">
                        {formData.link_docx_xuat ? (
                          <ExportFileNameDisplay
                            href={formData.link_docx_xuat}
                            displayName={docxExportMeta.displayName || "Word.docx"}
                            displayTime={docxExportMeta.displayTime}
                          />
                        ) : null}
                        {formData.link_pdf_xuat ? (
                          <ExportFileNameDisplay
                            href={formData.link_pdf_xuat}
                            displayName={pdfExportMeta.displayName || "PDF.pdf"}
                            displayTime={pdfExportMeta.displayTime}
                            nameClassName="font-bold text-red-800"
                          />
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-[11px] text-gray-500 leading-snug">
                        Chưa có file — xuất Word, In/PDF hoặc upload PDF để trình ký.
                      </p>
                    )}
                    <div className="pt-2 mt-2 border-t border-indigo-100">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                        Upload PDF để trình ký
                      </label>
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={handleUploadPdfPhatHanh}
                        disabled={!nkksRecordId}
                        className="w-full text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-bold file:bg-rose-100 file:text-rose-800"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-rose-100 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <h4 className="text-sm font-bold text-rose-800 uppercase tracking-wide">
                  II. Bảng khối lượng
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  KL tham chiếu từ NVKS đã lưu — ưu tiên cột điều chỉnh (02) nếu có, không thì KL Gốc.
                  Sửa NVKS xong nhớ nhấn Lưu rồi mở lại / refresh NKKS.
                  {klResolve?.klSourceLabel && klResolve.klSourceLabel !== "GỐC" ? (
                    <>
                      {" "}
                      · nguồn ĐC:{" "}
                      <span className="font-semibold text-amber-800">{klResolve.klSourceLabel}</span>
                    </>
                  ) : null}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => loadKlTable()}
                  disabled={isLoadingKl || !templateData.length}
                  className="text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 rounded-lg px-2.5 py-1 hover:bg-teal-100 disabled:opacity-50"
                  title="Tải lại khối lượng từ NVKS đã lưu"
                >
                  {isLoadingKl ? "Đang tải…" : "↻ Đồng bộ từ NVKS"}
                </button>
                <span className="text-xs font-bold text-sky-800 bg-sky-50 border border-sky-200 rounded-lg px-2.5 py-1">
                  {visibleWorkRowCount} hạng mục KL
                </span>
              </div>
            </div>

            {isLoadingKl ? (
              <p className="text-sm text-gray-400 py-6 text-center">Đang tải bảng khối lượng từ NVKS...</p>
            ) : visibleKlRows.length === 0 ? (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
                Chưa có dòng khối lượng &gt; 0 từ NVKS. Hoàn thiện bảng KL trên NVKS trước khi ghi nhật ký chi tiết.
              </p>
            ) : (
              <NkksSimpleKlTable
                rows={visibleKlRows}
                emptyMessage="Chưa có dòng khối lượng từ NVKS. Hoàn thiện bảng KL trên NVKS trước khi ghi nhật ký chi tiết."
              />
            )}
          </section>

          <section className="rounded-xl border border-sky-100 bg-white p-4 lg:p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <h4 className="text-sm font-bold text-sky-900 uppercase tracking-wide">
                  III. Nhật ký khảo sát theo ngày
                </h4>
                {dateRangeActive ? (
                  <p className="text-xs text-sky-700 mt-0.5">
                    Tự động <span className="font-bold">{rangeDayCount}</span> ngày KS (
                    {formatNkksNgayDisplay(formData.ngay_bat_dau)} –{" "}
                    {formatNkksNgayDisplay(formData.ngay_ket_thuc)}) · {filledDays} ngày đã ghi dữ liệu
                    {spareDayCount > 0 ? (
                      <>
                        {" "}
                        · <span className="font-semibold text-indigo-700">{spareDayCount}</span> ngày
                        dự phòng
                      </>
                    ) : null}
                  </p>
                ) : (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Chọn ngày bắt đầu &amp; kết thúc ở mục I để tự chia trang nhật ký
                    {filledDays > 0 ? ` · hiện ${filledDays} dòng` : ""}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenDiaryGenerate}
                  disabled={isLoadingKl || !liveKlRows.length}
                  className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold px-3 py-1.5 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  title="Nhặt hạng mục từ bảng KL, chia đều theo số ngày KS"
                >
                  VIẾT NKKS
                </button>
                {!dateRangeActive ? (
                  <button
                    type="button"
                    onClick={addDay}
                    className="rounded-lg bg-sky-50 border border-sky-200 text-sky-800 text-xs font-bold px-3 py-1.5 hover:bg-sky-100"
                  >
                    + Thêm ngày
                  </button>
                ) : null}
              </div>
            </div>

            <div className="space-y-3">
              {(formData.nkks_ngays || []).map((row, index) => (
                <NkksDayRow
                  key={row.ngay_khao_sat || `day-${index}`}
                  row={row}
                  index={index}
                  canRemove={(formData.nkks_ngays || []).length > 1}
                  dateReadOnly={dateRangeActive}
                  onPatch={patchDay}
                  onRemove={removeDay}
                />
              ))}
            </div>
          </section>
        </div>
      </div>

      {diaryGenModal ? (
        <div
          className="fixed inset-0 z-[10050] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setDiaryGenModal(null)}
          role="presentation"
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-amber-100 max-w-md w-full p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="nkks-diary-gen-title"
          >
            <div>
              <h3 id="nkks-diary-gen-title" className="text-base font-black text-amber-900">
                VIẾT NKKS — sinh nhật ký từ bảng KL
              </h3>
              <p className="text-[13px] text-slate-600 mt-2 leading-relaxed">
                Đã có nội dung công việc/KL ở{" "}
                <span className="font-bold text-slate-800">{diaryGenModal.existingCount}</span>/
                {diaryGenModal.dayCount} ngày. Chọn cách cập nhật:
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => applyDiaryGeneration("empty_only")}
                className="w-full text-left px-4 py-3 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 cursor-pointer"
              >
                <div className="text-sm font-bold text-emerald-900">Chỉ điền ngày trống</div>
                <div className="text-[11px] text-emerald-800/80 mt-0.5">
                  Giữ nguyên ngày đã ghi tay; chỉ sinh cho ô còn trống.
                </div>
              </button>
              <button
                type="button"
                onClick={() => applyDiaryGeneration("overwrite")}
                className="w-full text-left px-4 py-3 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 cursor-pointer"
              >
                <div className="text-sm font-bold text-amber-950">Ghi đè toàn bộ</div>
                <div className="text-[11px] text-amber-900/80 mt-0.5">
                  Xóa nội dung công việc &amp; KL đã có trên mọi ngày, viết lại từ bảng KL.
                </div>
              </button>
              <button
                type="button"
                onClick={() => setDiaryGenModal(null)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
