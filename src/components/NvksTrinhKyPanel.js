"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getAuthUser } from "../lib/authSession";
import { formatExportDisplayTime } from "../lib/exportFileNaming";
import { VAI_TRO } from "../lib/trinhKy/constants";
import { useAppDialog } from "./AppDialog";

const STATUS_LABEL = {
  cho: "Chờ tới lượt",
  dang_cho: "Chờ ký",
  da_xem: "Chờ ký",
  da_ky: "Đã ký",
  tu_choi: "Từ chối",
};

const STATUS_TONE = {
  cho: "text-slate-500",
  dang_cho: "text-amber-700",
  da_xem: "text-amber-700",
  da_ky: "text-emerald-700",
  tu_choi: "text-rose-700",
};

/** Tiền tố ngắn trước tên người đang chờ ký */
const VAI_TRO_PREFIX = {
  [VAI_TRO.NGUOI_LAP]: "Người lập",
  [VAI_TRO.CNKS]: "CNKS",
  [VAI_TRO.NGUOI_LAP_CNKS]: "NL/CNKS",
  [VAI_TRO.LANH_DAO]: "PGĐ",
};

function formatBuocStatusLabel(buoc) {
  if (!buoc) return "—";
  const base = STATUS_LABEL[buoc.trang_thai] || buoc.trang_thai || "—";
  if (buoc.trang_thai === "da_ky" && buoc.signed_at) {
    const t = formatExportDisplayTime(buoc.signed_at);
    return t ? `${base} ${t}` : base;
  }
  return base;
}

function buildSignerColumns(buocs, formData) {
  const list = buocs || [];
  const byRole = Object.fromEntries(list.map((b) => [b.vai_tro, b]));
  const merged = byRole.nguoi_lap_cnks || null;

  const col = (key, title, nameFallback, buoc) => ({
    key,
    title,
    name: buoc?.ho_ten_snapshot || nameFallback || "—",
    status: buoc?.trang_thai || null,
    statusLabel: formatBuocStatusLabel(buoc),
    tone: buoc ? STATUS_TONE[buoc.trang_thai] || "text-slate-500" : "text-slate-400",
  });

  return [
    col(
      "nguoi_lap",
      "Người lập",
      formData?.nguoi_lap,
      byRole.nguoi_lap || merged
    ),
    col(
      "cnks",
      "CNKS",
      formData?.chu_nhiem_ks,
      byRole.cnks || merged
    ),
    col(
      "lanh_dao",
      "Lãnh đạo",
      formData?.lanh_dao_duyet,
      byRole.lanh_dao
    ),
  ];
}

/**
 * Panel trình ký nội bộ — NVKS / PAKTKS.
 * CTA «Trình ký» có thể đặt ngoài panel (cạnh file PDF) qua onActionsChange + showTrinhButton=false.
 */
export default function NvksTrinhKyPanel({
  module = "nvks",
  hoSoRecordId,
  nvksRecordId,
  formData,
  isKlLocked,
  onStatusChange,
  onActionsChange,
  showTrinhButton = true,
  className = "",
  compact = false,
}) {
  const recordId = hoSoRecordId ?? nvksRecordId;
  const { showConfirm } = useAppDialog();
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;
  const onActionsChangeRef = useRef(onActionsChange);
  onActionsChangeRef.current = onActionsChange;

  const notifyParent = useCallback((data) => {
    if (!data) return;
    onStatusChangeRef.current?.(data);
  }, []);

  const load = useCallback(async () => {
    if (!recordId) return;
    setError("");
    try {
      const res = await fetch(
        `/api/trinh-ky/status?hoSoId=${encodeURIComponent(recordId)}&module=${encodeURIComponent(module)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không tải trạng thái.");
      setStatus(data);
      notifyParent(data);
    } catch (err) {
      setError(err.message || "Lỗi tải trạng thái ký.");
    }
  }, [recordId, module, notifyParent]);

  useEffect(() => {
    load();
  }, [recordId, formData?.link_pdf_xuat, formData?.trang_thai_ky_noi_bo, load]);

  const trangThai = status?.trangThai || formData?.trang_thai_ky_noi_bo || "chua_trinh";
  const dangTrinh = trangThai === "dang_trinh";
  const daKy = trangThai === "da_ky";
  const tuChoi = trangThai === "tu_choi";

  const user = typeof window !== "undefined" ? getAuthUser() : null;
  const currentBuoc = status?.buocs?.find(
    (b) =>
      status?.phien?.buoc_hien_tai === b.stt &&
      (b.trang_thai === "dang_cho" || b.trang_thai === "da_xem")
  );
  const isMyTurn = Boolean(user?.ma_nv && currentBuoc && currentBuoc.ma_nv === user.ma_nv);

  const missingPdf = !formData?.link_pdf_xuat;
  const missingCnks = !formData?.chu_nhiem_ks_ma_nv;
  const missingLd = !formData?.lanh_dao_duyet_ma_nv;

  /**
   * Đã ký xong + PDF xuất khác bản đã trình → cho «Trình lại» (thử stamp / sửa nội dung).
   * Đã ký + cùng PDF → khóa (luồng chuẩn).
   */
  const pdfPhatHanhCu = status?.phien?.pdf_phat_hanh_url || "";
  const pdfMoiSauKy = Boolean(
    daKy &&
      formData?.link_pdf_xuat &&
      pdfPhatHanhCu &&
      formData.link_pdf_xuat !== pdfPhatHanhCu
  );

  const canTrinh =
    recordId &&
    !missingPdf &&
    !missingCnks &&
    !missingLd &&
    !dangTrinh &&
    (!daKy || pdfMoiSauKy) &&
    !isKlLocked;

  const handleTrinh = useCallback(async () => {
    const auth = getAuthUser();
    if (!auth?.ma_nv) {
      setError("Chưa đăng nhập.");
      return;
    }
    if (!formData?.link_pdf_xuat) {
      setError("Chưa có PDF xuất — bấm Xuất PDF trước.");
      return;
    }
    if (!formData?.chu_nhiem_ks_ma_nv || !formData?.lanh_dao_duyet_ma_nv) {
      setError("Chọn CNKS và Lãnh đạo từ danh mục nhân sự.");
      return;
    }

    const phienPdf = status?.phien?.pdf_phat_hanh_url || "";
    const isTrinhLai =
      (status?.trangThai || formData?.trang_thai_ky_noi_bo) === "da_ky" &&
      Boolean(formData.link_pdf_xuat) &&
      Boolean(phienPdf) &&
      formData.link_pdf_xuat !== phienPdf;

    if (isTrinhLai) {
      const ok = await showConfirm(
        "Hồ sơ đã ký nội bộ. Trình lại trên PDF vừa xuất sẽ mở chuỗi ký mới từ đầu. Bản đã ký trước vẫn giữ trong «Hồ sơ đã ký».",
        {
          title: "Trình ký lại",
          confirmLabel: "Trình lại",
          cancelLabel: "Không",
          variant: "warning",
        }
      );
      if (!ok) return;
    }

    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/trinh-ky/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module,
          hoSoId: recordId,
          nguoiTrinhMaNv: auth.ma_nv,
          nguoiLapMaNv: formData.nguoi_lap_ma_nv || auth.ma_nv,
          cnksMaNv: formData.chu_nhiem_ks_ma_nv,
          lanhDaoMaNv: formData.lanh_dao_duyet_ma_nv,
          trinhLai: isTrinhLai,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Trình ký thất bại.");
      await load();
    } catch (err) {
      setError(err.message || "Trình ký thất bại.");
    } finally {
      setBusy(false);
    }
  }, [formData, module, recordId, load, showConfirm, status]);

  const handleCancel = async () => {
    if (!status?.phien?.id) return;
    const ok = await showConfirm("Hủy phiên trình ký hiện tại?", {
      title: "Hủy trình ký",
      confirmLabel: "Hủy phiên",
      cancelLabel: "Giữ nguyên",
      variant: "warning",
    });
    if (!ok) return;
    const auth = getAuthUser();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/trinh-ky/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trinhKyId: status.phien.id, maNv: auth?.ma_nv }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không hủy được.");
      await load();
    } catch (err) {
      setError(err.message || "Không hủy được.");
    } finally {
      setBusy(false);
    }
  };

  const handleSignHere = async () => {
    if (!currentBuoc?.id) return;
    const auth = getAuthUser();
    if (!auth?.ma_nv) {
      setError("Chưa đăng nhập.");
      return;
    }
    const ok = await showConfirm("", {
      title: "Xác nhận ký",
      confirmLabel: "Ký",
      cancelLabel: "Hủy",
      variant: "warning",
    });
    if (!ok) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/trinh-ky/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buocId: currentBuoc.id, maNv: auth.ma_nv }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ký thất bại.");
      await load();
    } catch (err) {
      setError(err.message || "Ký thất bại.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    let hint = "";
    if (missingPdf) hint = "Xuất PDF trước khi trình ký";
    else if (missingCnks || missingLd) hint = "Chọn CNKS và Lãnh đạo từ danh mục nhân sự";
    else if (dangTrinh) hint = "Đang trình ký";
    else if (pdfMoiSauKy) hint = "PDF mới sau đã ký — có thể trình lại";
    else if (daKy) hint = "Đã ký nội bộ — xuất PDF mới để mở vòng ký mới";
    else if (isKlLocked) hint = "Hồ sơ đã chốt — không trình ký";
    else if (!recordId) hint = "Lưu hồ sơ trước";
    else hint = "Trình ký nội bộ với PDF đã xuất";

    onActionsChangeRef.current?.({
      canTrinh: Boolean(canTrinh),
      busy,
      dangTrinh,
      daKy,
      pdfMoiSauKy,
      trangThai,
      missingPdf,
      missingCnks,
      missingLd,
      hint,
      buttonLabel: pdfMoiSauKy ? "Trình lại" : "Trình ký",
      trinhKy: handleTrinh,
      reload: load,
    });
  }, [
    canTrinh,
    busy,
    dangTrinh,
    daKy,
    pdfMoiSauKy,
    trangThai,
    missingPdf,
    missingCnks,
    missingLd,
    isKlLocked,
    recordId,
    handleTrinh,
    load,
  ]);

  const signerCols = buildSignerColumns(status?.buocs, formData);
  const showSignerGrid = Boolean(status?.buocs?.length) || dangTrinh || daKy || tuChoi;

  return (
    <div className={`space-y-2 min-w-0 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <label className="block text-[10px] font-bold text-teal-800 uppercase">Trình ký nội bộ</label>
        <Link href="/trinh-ky" className="text-[10px] font-bold text-teal-700 hover:underline shrink-0">
          Hộp chờ ký →
        </Link>
      </div>

      {showSignerGrid ? (
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {signerCols.map((c) => (
            <div
              key={c.key}
              className="rounded-lg border border-teal-100 bg-white/90 px-1.5 py-2 text-center min-w-0"
            >
              <p className="text-[9px] font-bold uppercase tracking-wide text-teal-800 truncate">
                {c.title}
              </p>
              <p
                className={`mt-0.5 font-semibold text-slate-700 truncate ${
                  compact ? "text-[9px]" : "text-[10px]"
                }`}
                title={c.name}
              >
                {c.name}
              </p>
              <p
                className={`mt-1 font-bold leading-snug ${c.tone} ${
                  compact ? "text-[9px]" : "text-[10px]"
                }`}
                title={c.statusLabel}
              >
                {c.statusLabel}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {pdfMoiSauKy ? (
        <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1">
          PDF xuất đã đổi so với bản đã ký — nhấn <strong>Trình lại</strong> để mở chuỗi ký mới. Bản đã ký
          trước vẫn giữ trong Hộp chờ ký.
        </p>
      ) : null}

      {tuChoi && status?.phien?.ly_do_tu_choi ? (
        <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-100 rounded px-2 py-1">
          Lý do từ chối: {status.phien.ly_do_tu_choi}
        </p>
      ) : null}

      {error ? <p className="text-[11px] text-rose-600">{error}</p> : null}

      <div className={`flex gap-2 ${compact ? "flex-col" : "flex-wrap"}`}>
        {showTrinhButton ? (
          <button
            type="button"
            disabled={!canTrinh || busy}
            onClick={handleTrinh}
            title={!canTrinh ? (missingPdf ? "Xuất PDF trước" : "Chọn CNKS và Lãnh đạo") : "Trình ký nội bộ"}
            className={`px-2.5 py-1.5 text-[10px] font-bold rounded bg-teal-600 text-white disabled:opacity-40 hover:bg-teal-700 ${
              compact ? "w-full" : ""
            }`}
          >
            {busy ? "Đang xử lý…" : pdfMoiSauKy ? "Trình lại" : "Trình ký"}
          </button>
        ) : null}
        {isMyTurn ? (
          <button
            type="button"
            disabled={busy}
            onClick={handleSignHere}
            className={`px-2.5 py-1.5 text-[10px] font-bold rounded bg-amber-500 text-white disabled:opacity-40 hover:bg-amber-600 ${
              compact ? "w-full" : ""
            }`}
          >
            Ký ngay
          </button>
        ) : null}
        {dangTrinh ? (
          <button
            type="button"
            disabled={busy}
            onClick={handleCancel}
            className={`px-2.5 py-1.5 text-[10px] font-bold rounded border border-slate-300 text-slate-700 bg-white disabled:opacity-40 ${
              compact ? "w-full" : ""
            }`}
          >
            Hủy trình ký
          </button>
        ) : null}
      </div>

      {(missingCnks || missingLd) && !dangTrinh && !daKy ? (
        <p className="text-[10px] text-amber-700">Chọn CNKS và Lãnh đạo từ danh mục nhân sự.</p>
      ) : null}
      {missingPdf && !dangTrinh && !daKy ? (
        <p className="text-[10px] text-amber-700">Xuất PDF trước khi trình ký.</p>
      ) : null}
      {dangTrinh && currentBuoc && !isMyTurn ? (
        <p className="text-[10px] text-slate-500">
          Đang chờ:{" "}
          {[VAI_TRO_PREFIX[currentBuoc.vai_tro], currentBuoc.ho_ten_snapshot || currentBuoc.ma_nv]
            .filter(Boolean)
            .join(" ")}{" "}
          ký.
        </p>
      ) : null}
    </div>
  );
}
