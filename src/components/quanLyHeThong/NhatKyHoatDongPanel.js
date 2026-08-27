"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppDialog } from "../AppDialog";
import { useResizableTableColumns } from "../../hooks/useResizableTableColumns";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import ResizableTh from "../table/ResizableTh";
import { fetchDb, hasSupabase, logActivity } from "../../lib/store";
import { supabase } from "../../lib/supabase";

const LOGS_COL_WIDTHS = [52, 220, 115, 158, 300, 155];
const LOGS_TABLE_MIN = LOGS_COL_WIDTHS.reduce((s, w) => s + w, 0);

/** Màu chữ HÀNH ĐỘNG — mỗi loại một màu */
function getActionBadgeClass(hanhDong) {
  const exact = {
    LOGIN: "text-blue-700",
    LOGIN_FAIL: "text-red-700",
    LOGOUT: "text-slate-700",
    AUTO_LOGOUT: "text-orange-700",
    CREATE: "text-emerald-700",
    UPDATE: "text-amber-800",
    DELETE: "text-rose-700",
    XOA: "text-rose-700",
    SUA: "text-amber-800",
    NHAP_DA: "text-emerald-700",
    TAO_USER: "text-emerald-700",
    SUA_USER: "text-amber-800",
    XOA_USER: "text-rose-700",
    KHOA_USER: "text-rose-700",
    MO_USER: "text-teal-700",
    AI_SCAN: "text-violet-700",
    AI_SCAN_FAIL: "text-red-800",
    EXPORT_WORD: "text-fuchsia-700",
    UPLOAD: "text-sky-700",
    UPLOAD_FILE: "text-sky-700",
    UPLOAD_FILE_FAIL: "text-red-800",
    EXPORT: "text-teal-700",
    SUBMIT: "text-violet-700",
    LUU: "text-emerald-700",
    GHI_GD: "text-blue-800",
    SUA_GT: "text-amber-800",
    SEED: "text-slate-600",
  };
  if (exact[hanhDong]) return exact[hanhDong];
  if (!hanhDong) return "text-gray-600";
  if (hanhDong.endsWith("_FAIL")) return "text-red-700";
  if (hanhDong.startsWith("NHAN_")) return "text-emerald-700";
  if (hanhDong.includes("AI_SCAN")) return "text-violet-700";
  if (hanhDong.includes("EXPORT")) return "text-fuchsia-700";
  if (hanhDong.includes("UPLOAD")) return "text-sky-700";
  if (hanhDong.includes("AUTO_LOGOUT")) return "text-orange-700";
  if (hanhDong.includes("LOGOUT")) return "text-slate-700";
  if (hanhDong.includes("LOGIN")) return "text-blue-700";
  return "text-teal-700";
}

/** Màu chữ phân hệ */
function getPhanHeClass(phanHe) {
  const map = {
    auth: "text-indigo-700",
    XAC_THUC: "text-indigo-700",
    du_an: "text-emerald-700",
    DA: "text-emerald-700",
    tai_chinh: "text-blue-800",
    chia_noi_bo: "text-cyan-800",
    qlht: "text-orange-700",
    SYSTEM: "text-orange-700",
    khao_sat: "text-violet-700",
    ho_so: "text-sky-700",
  };
  return map[phanHe] || "text-slate-700";
}

const PHAN_HE_OPTIONS = [
  { value: "ALL", label: "Tất cả phân hệ" },
  { value: "auth", label: "auth — Xác thực" },
  { value: "du_an", label: "du_an — Dự án" },
  { value: "tai_chinh", label: "tai_chinh — Tài chính A↔B" },
  { value: "chia_noi_bo", label: "chia_noi_bo — Tài chính nội bộ" },
  { value: "khao_sat", label: "khao_sat — Hồ sơ KS" },
  { value: "ho_so", label: "ho_so — Tài liệu" },
  { value: "qlht", label: "qlht — Quản trị hệ thống" },
];

const HANH_DONG_OPTIONS = [
  { value: "ALL", label: "Tất cả hành động" },
  { value: "LOGIN", label: "LOGIN — Đăng nhập" },
  { value: "LOGIN_FAIL", label: "LOGIN_FAIL — Đăng nhập thất bại" },
  { value: "LOGOUT", label: "LOGOUT — Đăng xuất" },
  { value: "NHAP_DA", label: "NHAP_DA — Nhập dự án" },
  { value: "SUA", label: "SUA — Sửa" },
  { value: "XOA", label: "XOA — Xóa" },
  { value: "UPLOAD", label: "UPLOAD — Tải file" },
  { value: "GHI_GD", label: "GHI_GD — Ghi giao dịch" },
  { value: "SUA_GT", label: "SUA_GT — Sửa giá trị" },
  { value: "TAO_USER", label: "TAO_USER — Tạo tài khoản" },
  { value: "SUA_USER", label: "SUA_USER — Sửa tài khoản" },
  { value: "XOA_USER", label: "XOA_USER — Xóa tài khoản" },
  { value: "KHOA_USER", label: "KHOA_USER — Khóa tài khoản" },
  { value: "MO_USER", label: "MO_USER — Mở tài khoản" },
  { value: "EXPORT", label: "EXPORT — Xuất dữ liệu" },
  { value: "LUU", label: "LUU — Lưu" },
];

function formatLogTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function toDateInputValue(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toMonthInputValue(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function resolveExportDateRange(mode, { exportDay, exportMonth, exportFrom, exportTo }) {
  if (mode === "day") {
    const [y, m, d] = exportDay.split("-").map(Number);
    const start = new Date(y, m - 1, d, 0, 0, 0, 0);
    const end = new Date(y, m - 1, d, 23, 59, 59, 999);
    return { start, end, label: `ngay_${exportDay}` };
  }
  if (mode === "month") {
    const [y, m] = exportMonth.split("-").map(Number);
    const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const end = new Date(y, m, 0, 23, 59, 59, 999);
    return { start, end, label: `thang_${exportMonth}` };
  }
  const [y1, m1, d1] = exportFrom.split("-").map(Number);
  const [y2, m2, d2] = exportTo.split("-").map(Number);
  const start = new Date(y1, m1 - 1, d1, 0, 0, 0, 0);
  const end = new Date(y2, m2 - 1, d2, 23, 59, 59, 999);
  if (start > end) throw new Error("Ngày bắt đầu không được sau ngày kết thúc.");
  return { start, end, label: `${exportFrom}_${exportTo}` };
}

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function chiTietLog(log) {
  return log.chi_tiet_ngan || log.chi_tiet || "";
}

function actorId(log) {
  return String(log.username || log.email || "")
    .trim()
    .toLowerCase();
}

function LogStatusBadge({ trangThai }) {
  const status = trangThai || "Thành công";
  if (status === "Thành công") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-bold text-green-700">
        <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" />
        Thành công
      </span>
    );
  }
  if (status === "Cảnh báo") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-bold text-amber-700">
        <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
        Cảnh báo
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-bold text-red-700">
      <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
      {status}
    </span>
  );
}

function LogMobileCard({ log, stt }) {
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-bold tabular-nums text-gray-400">#{stt}</p>
          <p className="font-bold text-gray-900">{log.ho_ten || "—"}</p>
          <p className="text-xs text-gray-500">{log.username || log.email || "—"}</p>
        </div>
        <LogStatusBadge trangThai={log.trang_thai} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className={`font-bold ${getPhanHeClass(log.phan_he)}`}>
          {String(log.phan_he || "").toUpperCase() || "—"}
        </span>
        <span className={`font-bold ${getActionBadgeClass(log.hanh_dong)}`}>{log.hanh_dong}</span>
        <span className="text-gray-500">{formatLogTime(log.thoi_gian)}</span>
      </div>
      <p className="mt-2 break-words text-sm leading-snug text-gray-800">{chiTietLog(log)}</p>
      {log.du_lieu_dong &&
      typeof log.du_lieu_dong === "object" &&
      Object.keys(log.du_lieu_dong).length > 0 ? (
        <pre className="mt-2 max-h-24 overflow-auto break-all rounded-lg bg-gray-50 p-2 font-mono text-[10px] leading-relaxed text-gray-600">
          {JSON.stringify(log.du_lieu_dong, null, 2)}
        </pre>
      ) : null}
    </article>
  );
}

function buildLogsCsv(rows) {
  const headers = [
    "STT",
    "Thời gian",
    "Họ tên",
    "User/Email",
    "Phân hệ",
    "Hành động",
    "Chi tiết",
    "Trạng thái",
    "Dữ liệu JSON",
  ];
  const lines = [headers.map(csvEscape).join(",")];
  rows.forEach((log, index) => {
    lines.push(
      [
        index + 1,
        formatLogTime(log.thoi_gian),
        log.ho_ten || "",
        log.username || log.email || "",
        log.phan_he || "",
        log.hanh_dong || "",
        chiTietLog(log),
        log.trang_thai || "Thành công",
        log.du_lieu_dong ? JSON.stringify(log.du_lieu_dong) : "",
      ]
        .map(csvEscape)
        .join(",")
    );
  });
  return lines.join("\r\n");
}

function downloadCsvFile(content, filename) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Nhật ký hoạt động — mẫu UI từ ksnpsc (QLHT tab LOGS).
 */
export default function NhatKyHoatDongPanel({ currentUser }) {
  const { showAlert } = useAppDialog();
  const isMdUp = useMediaQuery("(min-width: 768px)");
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [filterPhanHe, setFilterPhanHe] = useState("ALL");
  const [filterHanhDong, setFilterHanhDong] = useState("ALL");
  const [filterSearch, setFilterSearch] = useState("");
  const [hideAdmin, setHideAdmin] = useState(true);
  const [adminIds, setAdminIds] = useState(() => new Set());

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportMode, setExportMode] = useState("day");
  const [exportDay, setExportDay] = useState(() => toDateInputValue());
  const [exportMonth, setExportMonth] = useState(() => toMonthInputValue());
  const [exportFrom, setExportFrom] = useState(() => toDateInputValue());
  const [exportTo, setExportTo] = useState(() => toDateInputValue());
  const [exporting, setExporting] = useState(false);

  const {
    widths: logsColWidths,
    startResize: startLogsColResize,
    totalWidth: logsTableWidth,
    containerRef: logsContainerRef,
    fitContainer: logsFit,
  } = useResizableTableColumns("admin-logs", LOGS_COL_WIDTHS, {
    fitContainer: isMdUp,
  });

  const resolveAdminIds = useCallback(async () => {
    if (adminIds.size > 0) return adminIds;
    try {
      const db = await fetchDb();
      const roles = Object.values(db.roles || {});
      const adminRoleKeys = new Set(
        roles
          .filter(
            (r) =>
              r.phan_quyen === "admin" ||
              Number(r.q_admin) === 1 ||
              Number(r.q_system_log) === 1
          )
          .map((r) => r.phan_quyen)
          .filter(Boolean)
      );
      if (adminRoleKeys.size === 0) adminRoleKeys.add("admin");

      const next = new Set(
        (db.users || [])
          .filter((u) => adminRoleKeys.has(u.phan_quyen))
          .map((u) => String(u.username || "").trim().toLowerCase())
          .filter(Boolean)
      );
      setAdminIds(next);
      return next;
    } catch (err) {
      console.error("Lỗi lấy danh sách Admin:", err);
      return adminIds;
    }
  }, [adminIds]);

  const filterOutAdminLogs = (rows, adminSet) => {
    if (!adminSet || adminSet.size === 0) return rows;
    return rows.filter((log) => !adminSet.has(actorId(log)));
  };

  const applyClientFilters = (rows, adminSet) => {
    let filtered = rows || [];
    if (filterPhanHe !== "ALL") {
      filtered = filtered.filter((l) => l.phan_he === filterPhanHe);
    }
    if (filterHanhDong !== "ALL") {
      filtered = filtered.filter((l) => l.hanh_dong === filterHanhDong);
    }
    if (filterSearch.trim()) {
      const q = filterSearch.trim().toLowerCase();
      filtered = filtered.filter(
        (log) =>
          (log.ho_ten && log.ho_ten.toLowerCase().includes(q)) ||
          (log.username && log.username.toLowerCase().includes(q)) ||
          (log.email && log.email.toLowerCase().includes(q)) ||
          chiTietLog(log).toLowerCase().includes(q)
      );
    }
    if (hideAdmin && adminSet) {
      filtered = filterOutAdminLogs(filtered, adminSet);
    }
    return filtered;
  };

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      let rows = [];
      if (hasSupabase) {
        let query = supabase
          .from("lich_su_hoat_dong")
          .select("*")
          .order("thoi_gian", { ascending: false });
        if (filterPhanHe !== "ALL") query = query.eq("phan_he", filterPhanHe);
        if (filterHanhDong !== "ALL") query = query.eq("hanh_dong", filterHanhDong);
        const { data, error } = await query;
        if (error) throw error;
        rows = data || [];
      } else {
        const db = await fetchDb();
        rows = [...(db.lichSu || [])].sort(
          (a, b) => new Date(b.thoi_gian).getTime() - new Date(a.thoi_gian).getTime()
        );
      }

      let adminSet = null;
      if (hideAdmin) adminSet = await resolveAdminIds();
      setLogs(applyClientFilters(rows, adminSet));
    } catch (err) {
      console.error("Lỗi lấy logs:", err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filters applied inside; deps listed below
  }, [filterPhanHe, filterHanhDong, filterSearch, hideAdmin, resolveAdminIds]);

  useEffect(() => {
    fetchLogs();
    setCurrentPage(1);
  }, [fetchLogs]);

  const totalPages = Math.max(1, Math.ceil(logs.length / itemsPerPage));
  const currentData = useMemo(
    () => logs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
    [logs, currentPage]
  );

  const handleExportLogs = async () => {
    setExporting(true);
    try {
      const { start, end, label } = resolveExportDateRange(exportMode, {
        exportDay,
        exportMonth,
        exportFrom,
        exportTo,
      });

      let rows = [];
      if (hasSupabase) {
        let query = supabase
          .from("lich_su_hoat_dong")
          .select("*")
          .gte("thoi_gian", start.toISOString())
          .lte("thoi_gian", end.toISOString())
          .order("thoi_gian", { ascending: false });
        if (filterPhanHe !== "ALL") query = query.eq("phan_he", filterPhanHe);
        if (filterHanhDong !== "ALL") query = query.eq("hanh_dong", filterHanhDong);
        const { data, error } = await query;
        if (error) throw error;
        rows = data || [];
      } else {
        const db = await fetchDb();
        rows = (db.lichSu || []).filter((l) => {
          const t = new Date(l.thoi_gian).getTime();
          return t >= start.getTime() && t <= end.getTime();
        });
      }

      let adminSet = null;
      if (hideAdmin) adminSet = await resolveAdminIds();
      rows = applyClientFilters(rows, adminSet);

      if (rows.length === 0) {
        await showAlert(
          "Không có bản ghi nào trong khoảng thời gian đã chọn (và bộ lọc hiện tại)."
        );
        return;
      }

      downloadCsvFile(buildLogsCsv(rows), `NhatKyHoatDong_${label}.csv`);
      setExportModalOpen(false);

      await logActivity({
        username: currentUser?.username,
        ho_ten: currentUser?.ho_ten,
        phan_he: "qlht",
        hanh_dong: "EXPORT",
        chi_tiet: `Xuất nhật ký CSV — ${rows.length} dòng`,
        du_lieu_dong: {
          che_do: exportMode,
          khoang: label,
          so_ban_ghi: rows.length,
          loc_phan_he: filterPhanHe,
          loc_hanh_dong: filterHanhDong,
        },
      });

      await showAlert(
        `Đã xuất ${rows.length} bản ghi ra file CSV.\nMở bằng Excel hoặc trình soạn thảo văn bản.`
      );
      await fetchLogs();
    } catch (err) {
      console.error("Lỗi xuất log:", err);
      await showAlert(err.message || "Không thể xuất nhật ký. Vui lòng thử lại.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex min-h-[28rem] min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-slate-50 shadow-sm">
      <div className="flex shrink-0 flex-col gap-3 border-b border-gray-200 bg-white px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-6">
        <div className="relative min-w-0 w-full flex-1 sm:max-w-md">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </span>
          <input
            type="search"
            name="outsrc-log-filter"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            data-lpignore="true"
            data-1p-ignore="true"
            data-form-type="other"
            placeholder="Tìm kiếm theo tên hoặc mô tả..."
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <select
          value={filterPhanHe}
          onChange={(e) => setFilterPhanHe(e.target.value)}
          className="w-full cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 sm:min-w-[190px] sm:w-auto"
        >
          {PHAN_HE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={filterHanhDong}
          onChange={(e) => setFilterHanhDong(e.target.value)}
          className="w-full cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 sm:min-w-[210px] sm:w-auto"
        >
          {HANH_DONG_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setExportModalOpen(true)}
          className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100 sm:w-auto"
          title="Xuất nhật ký ra CSV (mở được bằng Excel)"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Xuất CSV
        </button>

        <label
          className="inline-flex w-full shrink-0 cursor-pointer select-none items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 sm:w-auto"
          title="Ẩn hoạt động của tài khoản Admin — chỉ xem non-admin"
        >
          <input
            type="checkbox"
            checked={hideAdmin}
            onChange={(e) => setHideAdmin(e.target.checked)}
            className="h-4 w-4 cursor-pointer rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          Hide Admin
        </label>
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden p-3 sm:p-6">
        <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {/* Mobile — thẻ */}
          <div className="flex-1 overflow-y-auto p-3 md:hidden">
            {loading ? (
              <p className="py-8 text-center text-sm text-gray-500">Đang tải dữ liệu...</p>
            ) : currentData.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">Không có dữ liệu</p>
            ) : (
              <div className="space-y-3">
                {currentData.map((log, index) => (
                  <LogMobileCard
                    key={log.id}
                    log={log}
                    stt={(currentPage - 1) * itemsPerPage + index + 1}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Desktop — bảng */}
          <div ref={logsContainerRef} className="hidden w-full flex-1 overflow-x-auto md:block">
            <table
              className="w-full table-fixed border-collapse text-left"
              style={
                logsFit
                  ? { width: "100%", minWidth: 0 }
                  : { width: logsTableWidth, minWidth: LOGS_TABLE_MIN }
              }
            >
              <colgroup>
                {logsColWidths.map((w, i) => (
                  <col key={i} style={{ width: w }} />
                ))}
              </colgroup>
              <thead className="sticky top-0 z-10 bg-[#1e40af] text-center text-xs font-semibold uppercase text-white shadow-sm">
                <tr>
                  <ResizableTh
                    columnIndex={0}
                    onResizeStart={startLogsColResize}
                    className="border-r border-[#1e3a8a] px-3 py-3.5 text-center"
                  >
                    STT
                  </ResizableTh>
                  <ResizableTh
                    columnIndex={1}
                    onResizeStart={startLogsColResize}
                    className="border-r border-[#1e3a8a] px-3 py-3.5 text-center"
                  >
                    Người thực hiện
                  </ResizableTh>
                  <ResizableTh
                    columnIndex={2}
                    onResizeStart={startLogsColResize}
                    className="border-r border-[#1e3a8a] px-3 py-3.5 text-center"
                  >
                    Phân hệ
                  </ResizableTh>
                  <ResizableTh
                    columnIndex={3}
                    onResizeStart={startLogsColResize}
                    className="border-r border-[#1e3a8a] px-3 py-3.5 text-center"
                  >
                    Hành động
                  </ResizableTh>
                  <ResizableTh
                    columnIndex={4}
                    onResizeStart={startLogsColResize}
                    className="border-r border-[#1e3a8a] px-3 py-3.5 text-center"
                  >
                    Chi tiết
                  </ResizableTh>
                  <ResizableTh
                    columnIndex={5}
                    onResizeStart={startLogsColResize}
                    className="px-3 py-3.5 text-center"
                  >
                    Trạng thái
                  </ResizableTh>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white text-[13px] font-medium text-gray-800">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      Đang tải dữ liệu...
                    </td>
                  </tr>
                ) : currentData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      Không có dữ liệu
                    </td>
                  </tr>
                ) : (
                  currentData.map((log, index) => (
                    <tr
                      key={log.id}
                      className="odd:bg-white even:bg-[#f0f4f8] border-b border-gray-100 transition-colors hover:bg-[#e8eef5]"
                    >
                      <td className="px-3 py-3.5 text-center align-middle text-[13px] font-bold text-gray-500">
                        {(currentPage - 1) * itemsPerPage + index + 1}
                      </td>
                      <td className="px-3 py-3.5 align-middle">
                        <div className="break-words text-[13px] font-bold text-gray-800">
                          {log.ho_ten}
                        </div>
                        <div className="mt-0.5 break-all text-xs text-gray-500">
                          {log.username || log.email || "—"}
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-center align-middle">
                        <span
                          className={`inline-block text-xs font-bold ${getPhanHeClass(log.phan_he)}`}
                        >
                          {String(log.phan_he || "").toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-center align-middle">
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className={`inline-block whitespace-nowrap text-xs font-bold ${getActionBadgeClass(log.hanh_dong)}`}
                          >
                            {log.hanh_dong}
                          </span>
                          <span className="whitespace-nowrap text-[12px] font-medium leading-tight text-gray-500">
                            {formatLogTime(log.thoi_gian)}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 align-middle">
                        <div
                          className="break-words text-[13px] leading-snug text-gray-800"
                          title={chiTietLog(log)}
                        >
                          {chiTietLog(log)}
                        </div>
                        {log.du_lieu_dong &&
                          typeof log.du_lieu_dong === "object" &&
                          Object.keys(log.du_lieu_dong).length > 0 && (
                            <div
                              className="mt-1 break-all font-mono text-xs leading-relaxed text-gray-500"
                              title={JSON.stringify(log.du_lieu_dong)}
                            >
                              {JSON.stringify(log.du_lieu_dong)}
                            </div>
                          )}
                      </td>
                      <td className="px-3 py-3.5 text-center align-middle">
                        <LogStatusBadge trangThai={log.trang_thai} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex shrink-0 flex-col gap-2 border-t border-gray-200 bg-gray-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
              <span className="text-xs font-semibold text-gray-500">
                Trang {currentPage} / {totalPages}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Trước
                </button>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Tiếp
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {exportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 bg-emerald-50 px-6 py-4">
              <h3 className="text-sm font-black uppercase text-emerald-900">Xuất nhật ký CSV</h3>
              <button
                type="button"
                onClick={() => !exporting && setExportModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="space-y-4 p-6">
              <p className="text-xs leading-relaxed text-gray-500">
                File <span className="font-bold text-gray-700">.csv</span> (UTF-8) — mở trực tiếp
                bằng Excel. Áp dụng thêm bộ lọc phân hệ / hành động / tìm kiếm đang chọn trên thanh
                công cụ.
              </p>

              <div className="space-y-2">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="exportMode"
                    checked={exportMode === "day"}
                    onChange={() => setExportMode("day")}
                    className="text-emerald-600"
                  />
                  <span className="text-sm font-semibold text-gray-800">Theo ngày</span>
                </label>
                {exportMode === "day" && (
                  <input
                    type="date"
                    value={exportDay}
                    onChange={(e) => setExportDay(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                )}

                <label className="flex cursor-pointer items-center gap-2 pt-1">
                  <input
                    type="radio"
                    name="exportMode"
                    checked={exportMode === "month"}
                    onChange={() => setExportMode("month")}
                    className="text-emerald-600"
                  />
                  <span className="text-sm font-semibold text-gray-800">Theo tháng</span>
                </label>
                {exportMode === "month" && (
                  <input
                    type="month"
                    value={exportMonth}
                    onChange={(e) => setExportMonth(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                )}

                <label className="flex cursor-pointer items-center gap-2 pt-1">
                  <input
                    type="radio"
                    name="exportMode"
                    checked={exportMode === "custom"}
                    onChange={() => setExportMode("custom")}
                    className="text-emerald-600"
                  />
                  <span className="text-sm font-semibold text-gray-800">
                    Khoảng thời gian tùy chỉnh
                  </span>
                </label>
                {exportMode === "custom" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-gray-400">Từ ngày</span>
                      <input
                        type="date"
                        value={exportFrom}
                        onChange={(e) => setExportFrom(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-gray-400">Đến ngày</span>
                      <input
                        type="date"
                        value={exportTo}
                        onChange={(e) => setExportTo(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
              <button
                type="button"
                disabled={exporting}
                onClick={() => setExportModalOpen(false)}
                className="rounded-lg px-4 py-2 text-xs font-bold text-gray-600 transition hover:bg-gray-200 disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={exporting}
                onClick={handleExportLogs}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {exporting ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Đang xuất...
                  </>
                ) : (
                  "Tải file CSV"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
