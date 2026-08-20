"use client";

import React, { createContext, useCallback, useContext, useState } from "react";

const AppDialogContext = createContext(null);

export function AppDialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);

  const showAlert = useCallback((message, title = "Thông báo") => {
    return new Promise((resolve) => {
      setDialog({
        type: "alert",
        title,
        message,
        onClose: () => {
          setDialog(null);
          resolve();
        },
      });
    });
  }, []);

  const showConfirm = useCallback((message, title = "Xác nhận") => {
    return new Promise((resolve) => {
      setDialog({
        type: "confirm",
        title,
        message,
        onOk: () => {
          setDialog(null);
          resolve(true);
        },
        onClose: () => {
          setDialog(null);
          resolve(false);
        },
      });
    });
  }, []);

  return (
    <AppDialogContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      {dialog ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-blue-950/40 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-2xl border border-sky-200 bg-white p-5 shadow-2xl shadow-blue-300/40">
            <h3 className="text-base font-black text-blue-950">{dialog.title}</h3>
            <p className="mt-2 text-sm font-medium text-teal-900 whitespace-pre-wrap">
              {dialog.message}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              {dialog.type === "confirm" ? (
                <button
                  type="button"
                  className="rounded-xl border border-sky-300 px-4 py-2 text-sm font-bold text-blue-800 hover:bg-sky-50"
                  onClick={dialog.onClose}
                >
                  Hủy
                </button>
              ) : null}
              <button
                type="button"
                className="rounded-xl bg-gradient-to-r from-blue-600 to-teal-600 px-4 py-2 text-sm font-black text-white"
                onClick={dialog.type === "confirm" ? dialog.onOk : dialog.onClose}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppDialogContext.Provider>
  );
}

export function useAppDialog() {
  const ctx = useContext(AppDialogContext);
  if (!ctx) throw new Error("useAppDialog must be used within AppDialogProvider");
  return ctx;
}
