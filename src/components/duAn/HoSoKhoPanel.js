"use client";

import { useEffect, useRef, useState } from "react";
import {
  FolderOpen,
  FileText,
  LayoutGrid,
  List,
  AlignLeft,
  ChevronDown,
  Check,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  listFoldersForKho,
  itemsInFolder,
} from "../../lib/hoSoFolders";
import { formatNgayVi } from "../../lib/formatNgay";
import { openHoSoFile } from "../../lib/hoSoStorage";

/** 3 kiểu xem — mặc định lưới 3 cột */
export const HOSO_VIEW_MODES = [
  { id: "grid", label: "Lưới", hint: "3 thư mục / hàng", Icon: LayoutGrid },
  { id: "list", label: "Danh sách", hint: "Hàng dọc gọn", Icon: List },
  { id: "details", label: "Chi tiết", hint: "Tên + số file", Icon: AlignLeft },
];

export const DEFAULT_HOSO_VIEW = "grid";

/** Viền panel + nét cặp thư mục cùng màu; KS ≠ TK */
const HOSO_THEME = {
  khao_sat: {
    panelBorder: "border-amber-500/80",
    folder: "text-amber-700",
    openRing: "ring-amber-400",
    openRingSm: "ring-amber-400",
  },
  thiet_ke: {
    panelBorder: "border-violet-500/80",
    folder: "text-violet-700",
    openRing: "ring-violet-400",
    openRingSm: "ring-violet-400",
  },
};

function themeFor(loaiKho) {
  return HOSO_THEME[loaiKho] || HOSO_THEME.khao_sat;
}

function ViewDropdown({ viewMode, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = HOSO_VIEW_MODES.find((m) => m.id === viewMode) || HOSO_VIEW_MODES[0];
  const CurrentIcon = current.Icon;

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-sm hover:bg-slate-50"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <CurrentIcon className="h-3.5 w-3.5 text-slate-500" />
        View
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <ul
          role="menu"
          className="absolute right-0 z-20 mt-1 min-w-[11rem] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {HOSO_VIEW_MODES.map(({ id, label, Icon }) => {
            const active = viewMode === id;
            return (
              <li key={id} role="none">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onChange?.(id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold transition ${
                    active
                      ? "bg-sky-50 text-blue-900"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  <span className="flex-1">{label}</span>
                  {active ? <Check className="h-3.5 w-3.5 text-blue-600" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Một cột hồ sơ — header: tiêu đề | + folder | View
 */
export default function HoSoKhoPanel({
  loaiKho,
  title,
  items,
  users,
  customFolders = [],
  canUpload,
  onUpload,
  onDeleteFile,
  canDeleteFile,
  onAddFolder,
  onRenameFolder,
  onDeleteFolder,
  uploading = false,
  addingFolder = false,
}) {
  const customKeys = (customFolders || []).map((f) => f.key);
  const folders = listFoldersForKho(loaiKho, customFolders, items);

  const [viewMode, setViewMode] = useState(DEFAULT_HOSO_VIEW);
  const [openKey, setOpenKey] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameLabel, setRenameLabel] = useState("");

  async function uploadFiles(folderKey, fileList) {
    const files = [...(fileList || [])].filter(Boolean);
    if (!files.length || !onUpload) return;
    await onUpload({
      loaiKho,
      moduleLoai: folderKey === "chua_phan_loai" ? null : folderKey,
      files,
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function onPickFiles(folderKey, e) {
    uploadFiles(folderKey, e.target.files);
  }

  function onDropFiles(folderKey, e) {
    e.preventDefault();
    setDragOver(false);
    uploadFiles(folderKey, e.dataTransfer?.files);
  }

  async function handleOpenFile(item) {
    if (!item?.storage_path) return;
    try {
      await openHoSoFile(item.storage_path);
    } catch (err) {
      alert(err?.message || "Không mở được file.");
    }
  }

  async function submitNewFolder(e) {
    e?.preventDefault?.();
    const label = newLabel.trim();
    if (!label || !onAddFolder) return;
    await onAddFolder({ loaiKho, label });
    setNewLabel("");
    setAdding(false);
  }

  async function submitRename(e) {
    e?.preventDefault?.();
    const label = renameLabel.trim();
    if (!label || !openKey || !onRenameFolder) return;
    await onRenameFolder({ loaiKho, key: openKey, label });
    setRenaming(false);
  }

  async function confirmDelete() {
    if (!openKey || !onDeleteFolder) return;
    const folder = folders.find((f) => f.key === openKey);
    const ok = await onDeleteFolder({
      loaiKho,
      key: openKey,
      label: folder?.label,
    });
    if (ok !== false) {
      setOpenKey(null);
      setRenaming(false);
    }
  }

  function toggleFolder(key) {
    setOpenKey((prev) => (prev === key ? null : key));
    setRenaming(false);
    setDragOver(false);
  }

  const openFolder = folders.find((f) => f.key === openKey);
  const openFiles = openKey
    ? itemsInFolder(items, openKey, loaiKho, customKeys)
    : [];
  const openIsMisc = openKey === "chua_phan_loai";
  const openIsCustom = Boolean(openFolder?.custom);
  const theme = themeFor(loaiKho);

  const folderShell =
    viewMode === "grid" ? "grid grid-cols-2 gap-2 sm:grid-cols-3" : "flex flex-col gap-1";

  return (
    <section
      className={`flex h-full flex-col rounded-2xl border bg-white p-4 shadow-sm sm:p-5 ${theme.panelBorder}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-black uppercase tracking-wide text-blue-900">{title}</h2>
        <div className="flex items-center gap-1.5">
          {canUpload && onAddFolder ? (
            <button
              type="button"
              title="Thêm thư mục tùy chọn"
              disabled={addingFolder}
              onClick={() => {
                setAdding((v) => !v);
                setRenaming(false);
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-sky-50 hover:text-blue-800 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
            </button>
          ) : null}
          <ViewDropdown viewMode={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {adding ? (
        <form
          onSubmit={submitNewFolder}
          className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-sky-300 bg-sky-50/60 p-2"
        >
          <input
            autoFocus
            className="min-w-0 flex-1 rounded-lg border border-sky-300 bg-white px-2.5 py-1.5 text-sm font-medium text-blue-950"
            placeholder="Tên thư mục mới…"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
          <button
            type="submit"
            disabled={addingFolder || !newLabel.trim()}
            className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-black text-white disabled:opacity-50"
          >
            Tạo
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setNewLabel("");
            }}
            className="rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white"
          >
            Hủy
          </button>
        </form>
      ) : null}

      <div className={`mt-3 ${folderShell}`}>
        {folders.map((folder) => {
          const files = itemsInFolder(items, folder.key, loaiKho, customKeys);
          const isOpen = openKey === folder.key;
          return (
            <FolderTile
              key={folder.key}
              folder={folder}
              count={files.length}
              isOpen={isOpen}
              viewMode={viewMode}
              theme={theme}
              onClick={() => toggleFolder(folder.key)}
            />
          );
        })}
      </div>

      {openFolder ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/40 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <FolderOpen className="h-4 w-4 text-amber-700" />
            <p className="min-w-0 flex-1 text-sm font-black text-amber-950">{openFolder.label}</p>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-teal-800 ring-1 ring-amber-200">
              {openFiles.length} file
            </span>
            {canUpload && openIsCustom ? (
              <div className="flex items-center gap-1">
                {onRenameFolder ? (
                  <button
                    type="button"
                    title="Đổi tên"
                    disabled={addingFolder}
                    onClick={() => {
                      setRenaming(true);
                      setRenameLabel(openFolder.label || "");
                      setAdding(false);
                    }}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-amber-200 bg-white text-amber-900 hover:bg-amber-50 disabled:opacity-50"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                {onDeleteFolder ? (
                  <button
                    type="button"
                    title="Xóa thư mục"
                    disabled={addingFolder}
                    onClick={confirmDelete}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {renaming && openIsCustom ? (
            <form
              onSubmit={submitRename}
              className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-amber-300 bg-white/80 p-2"
            >
              <input
                autoFocus
                className="min-w-0 flex-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-sm font-medium text-blue-950"
                value={renameLabel}
                onChange={(e) => setRenameLabel(e.target.value)}
              />
              <button
                type="submit"
                disabled={addingFolder || !renameLabel.trim()}
                className="rounded-lg bg-amber-800 px-3 py-1.5 text-xs font-black text-white disabled:opacity-50"
              >
                Lưu tên
              </button>
              <button
                type="button"
                onClick={() => setRenaming(false)}
                className="rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-amber-50"
              >
                Hủy
              </button>
            </form>
          ) : null}

          <ul className="divide-y divide-amber-100/80 rounded-lg bg-white px-2">
            {openFiles.map((t) => {
              const u = users.find((x) => x.id === t.nguoi_up_id);
              return (
                <li
                  key={t.id}
                  className="flex flex-wrap items-start justify-between gap-2 py-2 text-sm"
                >
                  <span className="flex min-w-0 flex-1 items-start gap-1.5 font-bold text-blue-950">
                    <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600" />
                    <span className="break-all">
                      {t.storage_path ? (
                        <button
                          type="button"
                          onClick={() => handleOpenFile(t)}
                          className="text-left font-bold text-blue-800 underline decoration-blue-300 underline-offset-2 hover:text-blue-950"
                          title="Mở file"
                        >
                          {t.ten_file}
                        </button>
                      ) : (
                        t.ten_file
                      )}{" "}
                      <span className="text-xs font-semibold text-teal-700">
                        ({t.nguon === "xuat_ban" ? "xuất bản" : "upload"}
                        {!t.storage_path ? " · chưa có file" : ""})
                      </span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-[11px] font-medium text-teal-800">
                      {u?.ho_ten || "—"} ·{" "}
                      {t.thoi_gian ? formatNgayVi(t.thoi_gian) || t.thoi_gian.slice(0, 10) : "—"}
                    </span>
                    {canDeleteFile?.(t) ? (
                      <button
                        type="button"
                        title="Xóa file"
                        disabled={uploading}
                        onClick={() => onDeleteFile({ item: t, loaiKho })}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </span>
                </li>
              );
            })}
            {!openFiles.length && (!canUpload || openIsMisc) ? (
              <li className="py-2 text-xs font-medium text-teal-700">
                Chưa có tài liệu trong thư mục này.
              </li>
            ) : null}
            {canUpload && !openIsMisc ? (
              <li
                role="button"
                tabIndex={uploading ? -1 : 0}
                aria-disabled={uploading}
                onKeyDown={(e) => {
                  if (uploading) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onClick={() => {
                  if (uploading) return;
                  fileInputRef.current?.click();
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                }}
                onDrop={(e) => onDropFiles(openKey, e)}
                className={`flex items-center gap-2 py-2 text-xs transition ${
                  uploading
                    ? "cursor-not-allowed text-blue-800"
                    : "cursor-pointer text-teal-800 hover:bg-teal-50/60"
                } ${dragOver ? "bg-blue-50/90 ring-1 ring-inset ring-blue-200" : ""}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.dwg,.dxf,.zip,.rar,.7z,.jpg,.jpeg,.png"
                  disabled={uploading}
                  className="sr-only"
                  onChange={(e) => onPickFiles(openKey, e)}
                />
                {uploading ? (
                  "Đang tải lên…"
                ) : (
                  <>
                    <span className="shrink-0 rounded-md bg-white px-2 py-1 text-xs font-bold text-blue-900">
                      Chọn tệp
                    </span>
                    <span className="min-w-0">
                      Kéo thả nhiều file vào đây, hoặc bấm chọn file (pdf, doc/x, xls/x, dwg, zip, ảnh…)
                    </span>
                  </>
                )}
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function FolderWithCount({ count, isOpen, size = "lg", folderClass }) {
  const big = size !== "sm";
  const w = big ? 40 : 22;
  const h = big ? 32 : 18;
  const stroke = big ? 1.25 : 1;
  const numCls = big
    ? "text-[11px] font-black leading-none"
    : "text-[8px] font-black leading-none";

  return (
    <span
      className={`relative inline-flex shrink-0 ${folderClass || "text-amber-700"}`}
      style={{ width: w, height: h }}
      aria-hidden
    >
      <svg width={w} height={h} viewBox="0 0 40 32" fill="none" className="absolute inset-0">
        <path
          d={isOpen ? "M2 8.5h11l2.2-2.8H20" : "M2 9h12l2.5-3H22"}
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={
            isOpen
              ? "M2 8.5v18.5c0 1.1.9 2 2 2h32c1.1 0 2-.9 2-2V10.5c0-1.1-.9-2-2-2H22"
              : "M2 9v18c0 1.1.9 2 2 2h32c1.1 0 2-.9 2-2V11c0-1.1-.9-2-2-2H16.5"
          }
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className={`pointer-events-none absolute inset-x-0 flex items-center justify-center tabular-nums text-teal-800 ${numCls}`}
        style={{ top: big ? "42%" : "40%" }}
      >
        {count}
      </span>
    </span>
  );
}

function FolderTile({ folder, count, isOpen, viewMode, theme, onClick }) {
  if (viewMode === "list") {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition hover:bg-slate-50 ${
          isOpen ? `ring-1 ${theme.openRingSm}` : ""
        }`}
      >
        <FolderWithCount
          count={count}
          isOpen={isOpen}
          size="sm"
          folderClass={theme.folder}
        />
        <span className="min-w-0 flex-1 truncate text-xs font-bold text-blue-950">
          {folder.label}
        </span>
      </button>
    );
  }

  if (viewMode === "details") {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`grid w-full grid-cols-[1fr_auto] items-center gap-2 rounded-lg px-3 py-2 text-left transition hover:bg-slate-50 ${
          isOpen ? `ring-1 ${theme.openRingSm}` : ""
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <FolderWithCount
            count={count}
            isOpen={isOpen}
            size="sm"
            folderClass={theme.folder}
          />
          <span className="truncate text-sm font-bold text-blue-950">{folder.label}</span>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[4.25rem] flex-col items-center justify-center gap-1 rounded-xl p-2 text-center transition hover:bg-slate-50/80 ${
        isOpen ? `ring-2 ${theme.openRing}` : ""
      }`}
    >
      <FolderWithCount
        count={count}
        isOpen={isOpen}
        size="lg"
        folderClass={theme.folder}
      />
      <span className="w-full truncate text-[11px] font-black text-blue-950">
        {folder.label}
      </span>
    </button>
  );
}
