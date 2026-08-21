"use client";

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';

const AppDialogContext = createContext(null);

function inferVariant(message) {
  const msg = String(message || '');
  if (msg.includes('🎉') || /thành công/i.test(msg)) return 'success';
  if (msg.includes('⚠️') || /cảnh báo/i.test(msg)) return 'warning';
  if (/^lỗi|lỗi:|đã xảy ra lỗi|không thể|thất bại/i.test(msg.trim()) || msg.includes('❌')) return 'error';
  return 'info';
}

const VARIANT_STYLES = {
  success: {
    icon: CheckCircle,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    border: 'border-emerald-500/20',
    button: 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 shadow-emerald-200',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    border: 'border-amber-500/20',
    button: 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-200',
  },
  error: {
    icon: XCircle,
    iconBg: 'bg-red-50',
    iconColor: 'text-red-600',
    border: 'border-red-500/20',
    button: 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 shadow-red-200',
  },
  info: {
    icon: Info,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    border: 'border-blue-500/20',
    button: 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-200',
  },
};

const DEFAULT_TITLES = {
  success: 'Thành công',
  warning: 'Cảnh báo',
  error: 'Lỗi',
  info: 'Thông báo',
};

/** Nội dung dài → hộp rộng hơn, tránh cột hẹp phải zoom */
function isLongPlainMessage(message) {
  const msg = String(message || '');
  if (msg.length >= 280) return true;
  const lines = msg.split('\n').filter((l) => l.trim());
  return lines.length >= 6;
}

function DetailTableBody({ table }) {
  const columns = table.columns || [];
  const rows = table.rows || [];
  if (!columns.length || !rows.length) return null;

  return (
    <div className="w-full min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col">
      {table.caption ? (
        <p className="shrink-0 border-b border-slate-100 bg-slate-50 px-3 py-2 text-[12px] font-medium text-slate-600 leading-relaxed">
          {table.caption}
        </p>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 z-[1]">
            <tr className="bg-slate-50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="border-b border-slate-200 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500 bg-slate-50"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.key || idx} className="odd:bg-white even:bg-slate-50/60">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`border-b border-slate-100 px-3 py-2.5 text-[13px] text-slate-800 align-top ${
                      col.align === "right" ? "text-right tabular-nums font-semibold" : ""
                    } ${col.mono ? "font-mono text-[12px] whitespace-nowrap" : "break-words"} ${
                      col.narrow ? "w-[1%] whitespace-nowrap" : ""
                    }`}
                  >
                    {row[col.key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CompareDialogBody({ compare }) {
  const detail = (compare.detail || '').replace(/^AI không tìm thấy/i, 'Hệ thống nhận dạng không tìm thấy');

  return (
    <div className="w-full text-left space-y-4">
      {compare.intro && (
        <p className="text-[13px] font-medium text-slate-600 bg-white p-3 sm:p-4 border border-slate-200 rounded-xl shadow-sm leading-relaxed break-words">
          {compare.intro}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm min-w-0">
          <div className="bg-slate-100/50 border-b border-slate-200 px-3 py-2.5">
            <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {compare.leftLabel || 'Tên công trình được đối chiếu'}
            </h4>
          </div>
          <div className="p-3">
            <div className="text-[13px] font-semibold text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-100 break-words leading-snug">
              {compare.leftValue || '—'}
            </div>
          </div>
        </div>

        <div className="border border-blue-200 rounded-xl overflow-hidden bg-white shadow-sm ring-2 ring-blue-50/80 min-w-0">
          <div className="bg-blue-50/50 border-b border-blue-100 px-3 py-2.5 flex items-center justify-between gap-2">
            <h4 className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
              {compare.rightLabel || 'Tên trong QĐPD (file upload)'}
            </h4>
            <span className="text-[10px] font-bold bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full shrink-0">File vừa quét</span>
          </div>
          <div className="p-3">
            <div className="text-[13px] font-semibold text-blue-800 bg-blue-50/50 p-2.5 rounded-lg border border-blue-50 break-words leading-snug">
              {compare.rightValue || '—'}
            </div>
          </div>
        </div>
      </div>

      {typeof compare.doKhop === 'number' && (
        <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
          <span className="text-[12px] font-bold text-amber-800 uppercase tracking-wide">Độ khớp tên công trình</span>
          <span className="text-lg font-black text-amber-700 tabular-nums">{compare.doKhop}%</span>
        </div>
      )}

      {detail && (
        <p className="text-[12px] font-medium text-amber-800/90 bg-amber-50/80 border border-amber-100 rounded-lg px-3 py-2 leading-relaxed break-words">
          {detail}
        </p>
      )}
    </div>
  );
}

function DialogActions({ dialog, styles, closeDialog, centered = false }) {
  return (
    <div
      className={`flex w-full shrink-0 gap-3 ${
        dialog.type === 'confirm'
          ? 'flex-col-reverse sm:flex-row'
          : centered
            ? 'justify-center'
            : 'flex-col-reverse sm:flex-row'
      }`}
    >
      {dialog.type === 'confirm' && (
        <button
          type="button"
          onClick={() => closeDialog(false)}
          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition-all active:scale-95 cursor-pointer"
        >
          {dialog.cancelLabel}
        </button>
      )}
      <button
        type="button"
        autoFocus
        onClick={() => closeDialog(dialog.type === 'confirm')}
        className={`${
          dialog.type === 'confirm' || !centered ? 'flex-1' : 'min-w-[7.5rem] px-6'
        } text-white font-bold py-2.5 rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer ${styles.button}`}
      >
        {dialog.confirmLabel}
      </button>
    </div>
  );
}

export function AppDialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const resolverRef = useRef(null);

  const closeDialog = useCallback((result) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setDialog(null);
    if (resolve) resolve(result);
  }, []);

  const showAlert = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      const variant = options.variant || inferVariant(message);
      resolverRef.current = () => resolve();
      setDialog({
        type: 'alert',
        message: String(message ?? ''),
        title: options.title || DEFAULT_TITLES[variant],
        variant,
        confirmLabel: options.confirmLabel || 'Đóng',
        compare: options.compare || null,
        table: options.table || null,
        size: options.size || null,
      });
    });
  }, []);

  const showConfirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      const inferred = inferVariant(message);
      const variant = options.variant || (inferred === 'success' ? 'warning' : inferred);
      resolverRef.current = resolve;
      setDialog({
        type: 'confirm',
        message: String(message ?? ''),
        title: options.title || 'Xác nhận',
        variant,
        confirmLabel: options.confirmLabel || 'Đồng ý',
        cancelLabel: options.cancelLabel || 'Hủy',
        compare: options.compare || null,
        table: options.table || null,
        size: options.size || null,
      });
    });
  }, []);

  const styles = dialog ? VARIANT_STYLES[dialog.variant] || VARIANT_STYLES.info : null;
  const Icon = styles?.icon;
  const useCompareLayout = Boolean(dialog?.compare);
  const useTableLayout = Boolean(dialog?.table) && !useCompareLayout;
  const longPlain = dialog && !useCompareLayout && !useTableLayout && isLongPlainMessage(dialog.message);
  const widePanel =
    useCompareLayout ||
    useTableLayout ||
    longPlain ||
    dialog?.size === 'lg' ||
    dialog?.size === 'xl';
  const panelMaxW =
    dialog?.size === 'xl' || useTableLayout
      ? 'max-w-4xl'
      : widePanel
        ? 'max-w-2xl'
        : 'max-w-md';

  const handleBackdropClick = () => {
    if (dialog?.type === 'confirm') closeDialog(false);
    else closeDialog(true);
  };

  return (
    <AppDialogContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      {dialog && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-3 sm:p-4"
          onClick={handleBackdropClick}
          role="presentation"
        >
          <div
            className={`bg-white rounded-2xl shadow-2xl ${panelMaxW} w-full border-2 ${styles.border} animate-in fade-in zoom-in duration-200 flex flex-col max-h-[min(92vh,880px)] overflow-hidden`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-dialog-title"
          >
            {useCompareLayout ? (
              <>
                <div className="bg-amber-50 border-b border-amber-100 p-4 sm:p-5 flex items-center gap-3 shrink-0">
                  <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-xl shadow-inner shrink-0">
                    ⚠️
                  </div>
                  <h3 id="app-dialog-title" className="text-[16px] sm:text-[17px] font-black text-amber-800 tracking-tight uppercase">
                    {dialog.title}
                  </h3>
                </div>
                <div className="p-4 sm:p-6 bg-slate-50/50 min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  <CompareDialogBody compare={dialog.compare} />
                </div>
                <div className="shrink-0 border-t border-slate-100 bg-white px-4 sm:px-6 py-3 sm:py-4">
                  <DialogActions dialog={dialog} styles={styles} closeDialog={closeDialog} />
                </div>
              </>
            ) : useTableLayout ? (
              <>
                <div
                  className={`border-b p-4 sm:p-5 flex items-center gap-3 shrink-0 ${
                    dialog.variant === 'error'
                      ? 'bg-red-50 border-red-100'
                      : 'bg-amber-50 border-amber-100'
                  }`}
                >
                  {Icon ? (
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shadow-inner shrink-0 ${styles.iconBg} ${styles.iconColor}`}
                    >
                      <Icon className="w-5 h-5" strokeWidth={2.5} />
                    </div>
                  ) : null}
                  <div className="min-w-0">
                    <h3
                      id="app-dialog-title"
                      className={`text-[16px] sm:text-[17px] font-black tracking-tight uppercase ${
                        dialog.variant === 'error' ? 'text-red-800' : 'text-amber-800'
                      }`}
                    >
                      {dialog.title}
                    </h3>
                    {dialog.message ? (
                      <p className="mt-0.5 text-[12px] font-medium text-slate-600 leading-relaxed whitespace-pre-line">
                        {dialog.message}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="p-4 sm:p-6 bg-slate-50/50 min-h-0 flex-1 flex flex-col overflow-hidden">
                  <DetailTableBody table={dialog.table} />
                </div>
                <div className="shrink-0 border-t border-slate-100 bg-white px-4 sm:px-6 py-3 sm:py-4">
                  {(dialog.table?.rows?.length || 0) > 4 ? (
                    <p className="mb-3 text-[11px] text-slate-500 text-center sm:text-left">
                      Danh sách dài — cuộn trong bảng để xem tiếp. Nút Đóng luôn hiện ở đây, không cần thu nhỏ trang.
                    </p>
                  ) : null}
                  <DialogActions dialog={dialog} styles={styles} closeDialog={closeDialog} />
                </div>
              </>
            ) : (
              <>
                <div
                  className={`p-5 sm:p-6 min-h-0 flex-1 overflow-y-auto overscroll-contain ${
                    longPlain ? 'text-left' : ''
                  }`}
                >
                  <div className={`flex flex-col ${longPlain ? 'items-stretch' : 'items-center text-center'}`}>
                    {Icon && (
                      <div
                        className={`w-14 h-14 ${styles.iconBg} ${styles.iconColor} rounded-full flex items-center justify-center mb-4 shadow-inner ${
                          longPlain ? 'self-center' : ''
                        }`}
                      >
                        <Icon className="w-7 h-7" strokeWidth={2.5} />
                      </div>
                    )}
                    <h3
                      id="app-dialog-title"
                      className={`text-[16px] font-black text-slate-800 mb-2 uppercase tracking-tight ${
                        longPlain ? 'text-center' : ''
                      }`}
                    >
                      {dialog.title}
                    </h3>
                    <p
                      className={`text-[13px] font-medium text-gray-600 leading-relaxed whitespace-pre-line w-full break-words ${
                        longPlain
                          ? 'text-left bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-3 max-h-[min(52vh,420px)] overflow-y-auto overscroll-contain'
                          : 'text-center'
                      }`}
                    >
                      {dialog.message}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 border-t border-slate-100 bg-white px-5 sm:px-6 py-3 sm:py-4">
                  <DialogActions
                    dialog={dialog}
                    styles={styles}
                    closeDialog={closeDialog}
                    centered={!longPlain && dialog.type !== 'confirm'}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </AppDialogContext.Provider>
  );
}

export function useAppDialog() {
  const ctx = useContext(AppDialogContext);
  if (!ctx) throw new Error('useAppDialog must be used within AppDialogProvider');
  return ctx;
}
