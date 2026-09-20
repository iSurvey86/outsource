"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { logHoatDong } from "../lib/logger";
import { useAppDialog } from "./AppDialog";
import {
  buildNtksDbPayload,
  buildNtksDoiTuongKiemTra,
  isAutoNtksDoiTuongKiemTra,
  mergeSavedNtksIntoForm,
  patchNtksFormDetail,
  patchNtksTableRow,
  addNtksTableRow,
  removeNtksTableRow,
  resolveNtksKiemTraGsToChuc,
  NTKS_LANH_DAO_TVTK_OPTIONS,
} from "../lib/ntksInit";
import { listNtksForms, normalizeNtksChiTiet } from "../lib/ntksFormRegistry";
import { exportNtksWord, exportAndUploadNtksWord, generateNtksWordBlob } from "../lib/ntksWordExport";
import { fetchNtksByMaDuAn, saveNtksToDb, updateNtksExportLinks } from "../lib/ntksHoSo";
import {
  buildNtksDownloadFileName,
  buildNtksExportStoragePath,
  uploadNtksExportBlob,
} from "../lib/ntksExportStorage";
import { printDocxBlob } from "../lib/nvksPrint";
import {
  EXPORT_REPLACE_CONFIRM_MSG,
  hasExistingExportFile,
  syncXuatBanTaiLieuSafe,
} from "../lib/hoSoTaiLieu";
import { exportDisplayNameFromUrl } from "../lib/hoSoTaiLieuBackfill";
import { getAuthUser } from "../lib/authSession";

const FIELD =
  "mt-1 w-full h-9 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-slate-800 text-justify leading-snug outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100";
const FIELD_RO = `${FIELD} bg-gray-50 text-slate-700`;
const TEXTAREA =
  "mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate-800 text-justify leading-snug resize-y min-h-[4rem] outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100";

/** Ô đánh giá / kết luận BB NT: khối chữ giữa chiều cao ô, đoạn căn trái */
const TEXTAREA_MIDDLE_WRAP =
  "mt-1 w-full min-h-9 rounded-lg border border-gray-200 bg-white px-3 py-1 flex items-center outline-none focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100";
const TEXTAREA_MIDDLE_INNER =
  "w-full block bg-transparent border-0 outline-none resize-none text-justify text-sm text-slate-800 leading-snug overflow-hidden";

function MiddleTextarea({ className = "", value, onChange, rows: _rows, ...props }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 22)}px`;
  }, [value]);

  return (
    <div className={`${TEXTAREA_MIDDLE_WRAP} ${className}`.trim()}>
      <textarea
        ref={ref}
        className={TEXTAREA_MIDDLE_INNER}
        rows={1}
        value={value ?? ""}
        onChange={onChange}
        {...props}
      />
    </div>
  );
}

/** Ô bảng: tự cao theo chữ, giữa dọc, căn trái, không scroll */
function CellAutoTextarea({ value, onChange, className = "" }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 18)}px`;
  }, [value]);

  return (
    <div
      className={`flex w-full items-center rounded border border-gray-200 bg-white px-2 py-0.5 ${className}`.trim()}
    >
      <textarea
        ref={ref}
        rows={1}
        className="block w-full resize-none overflow-hidden border-0 bg-transparent py-0.5 text-justify text-xs leading-snug text-slate-800 outline-none"
        value={value ?? ""}
        onChange={onChange}
      />
    </div>
  );
}

const TOOLBAR_BTN =
  "inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-45 disabled:cursor-not-allowed";

/** Viền mỏng lúc thường; focus: đậm cùng màu (ring), không nhảy layout */
const CHUNG_INPUT = {
  ten: "mt-1 block w-full min-w-0 h-9 box-border rounded-lg border border-indigo-200 bg-indigo-50/40 px-3 py-1.5 text-sm text-slate-700 truncate text-left leading-snug outline-none focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400",
  ma: "mt-1 w-full h-9 rounded-lg border border-indigo-100 bg-indigo-50/25 px-3 py-1.5 text-sm text-slate-700 text-left outline-none focus:outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300",
  cdt: "mt-1 w-full h-9 rounded-lg border border-amber-200 bg-amber-50/35 px-3 py-1.5 text-sm text-slate-700 text-left outline-none focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400",
  nhaThau: "mt-1 w-full h-9 rounded-lg border border-sky-200 bg-sky-50/35 px-3 py-1.5 text-sm text-slate-700 truncate text-left outline-none focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400",
  tvgs: "mt-1 w-full h-9 rounded-lg border border-violet-200 bg-violet-50/30 px-3 py-1.5 text-sm text-slate-700 text-left outline-none focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400",
  tvgsRo: "mt-1 w-full h-9 rounded-lg border border-violet-200 bg-violet-50/30 px-3 py-1.5 text-sm text-slate-700 text-left outline-none focus:outline-none focus:border-violet-300 focus:ring-1 focus:ring-violet-300",
  diaDiem: "mt-1 w-full h-9 rounded-lg border border-emerald-200 bg-emerald-50/35 px-3 py-1.5 text-sm text-slate-700 text-left outline-none focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400",
  giaiDoan: "mt-1 w-full h-9 rounded-lg border border-orange-200 bg-orange-50/35 px-3 py-1.5 text-sm text-slate-700 text-left outline-none focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400",
  trangThai: "mt-1 w-full h-9 rounded-lg border border-rose-200 bg-rose-50/35 px-3 py-1.5 text-sm text-slate-700 text-left outline-none focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400",
};

/** Màu nhận diện khu vực form NTKS */
const NTKS_ZONE = {
  chung: {
    wrap: "border-indigo-200 bg-white",
    badge: "bg-indigo-600 text-white",
    title: "text-indigo-900",
    bar: "border-l-4 border-indigo-700",
  },
  hien_truong: {
    tabIdle: "border-amber-200 text-amber-800/70 bg-white hover:bg-amber-50/50",
    tabActive: "border-amber-500 text-amber-950 bg-white shadow-sm ring-1 ring-amber-300",
    panel: "border-amber-300 bg-white",
    badge: "bg-amber-600 text-white",
    title: "text-amber-950",
    tableHead: "bg-amber-50 text-amber-950",
  },
  lay_mau: {
    tabIdle: "border-orange-200 text-orange-800/70 bg-white hover:bg-orange-50/50",
    tabActive: "border-orange-500 text-orange-950 bg-white shadow-sm ring-1 ring-orange-300",
    panel: "border-orange-300 bg-white",
    badge: "bg-orange-600 text-white",
    title: "text-orange-950",
    tableHead: "bg-orange-50 text-orange-950",
  },
  kiem_tra_nl_tb: {
    tabIdle: "border-sky-200 text-sky-800/70 bg-white hover:bg-sky-50/50",
    tabActive: "border-sky-500 text-sky-950 bg-white shadow-sm ring-1 ring-sky-300",
    panel: "border-sky-300 bg-white",
    badge: "bg-sky-600 text-white",
    title: "text-sky-950",
    tableHead: "bg-sky-50 text-sky-950",
  },
  nghiem_thu_kq: {
    tabIdle: "border-emerald-200 text-emerald-800/70 bg-white hover:bg-emerald-50/50",
    tabActive: "border-emerald-500 text-emerald-950 bg-white shadow-sm ring-1 ring-emerald-300",
    panel: "border-emerald-300 bg-white",
    badge: "bg-emerald-700 text-white",
    title: "text-emerald-950",
    tableHead: "bg-emerald-50 text-emerald-950",
  },
};

function Field({ label, children, className = "" }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="text-[11px] font-bold uppercase tracking-wide text-teal-700">
        {label}
      </span>
      {children}
    </label>
  );
}

function SimpleTable({
  columns,
  rows,
  onCellChange,
  onAddRow,
  onRemoveRow,
  emptyRow,
  headClass,
  showStt = false,
  centerHead = false,
  fixedLayout = false,
}) {
  const thAlign = centerHead ? "text-center" : "text-left";
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className={`min-w-full text-xs ${fixedLayout ? "w-full table-fixed" : ""}`}>
        <thead className={headClass || "bg-slate-100 text-slate-800"}>
          <tr>
            {showStt ? (
              <th className={`w-10 px-1 py-2 font-bold ${thAlign}`}>STT</th>
            ) : null}
            {columns.map((c) => (
              <th
                key={c.key}
                className={`px-2 py-2 font-bold ${thAlign} ${c.thClass || ""} ${
                  c.wrap ? "whitespace-normal" : "whitespace-nowrap"
                }`}
              >
                {c.label}
              </th>
            ))}
            {onRemoveRow ? <th className="w-9 px-1" /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-t border-gray-100">
              {showStt ? (
                <td className="px-1 py-1 text-center align-middle text-xs font-semibold text-slate-600">
                  {ri + 1}
                </td>
              ) : null}
              {columns.map((c) => (
                <td key={c.key} className={`px-1 py-1 align-middle ${c.tdClass || ""}`}>
                  {c.wrap ? (
                    <CellAutoTextarea
                      value={row[c.key] || ""}
                      onChange={(e) => onCellChange(ri, c.key, e.target.value)}
                      className={c.inputClass || ""}
                    />
                  ) : (
                    <input
                      className={`w-full rounded border border-gray-200 px-2 py-1 text-xs ${
                        c.inputClass || "min-w-[5rem]"
                      }`}
                      value={row[c.key] || ""}
                      onChange={(e) => onCellChange(ri, c.key, e.target.value)}
                    />
                  )}
                </td>
              ))}
              {onRemoveRow ? (
                <td className="px-1 py-1 text-center align-middle">
                  <button
                    type="button"
                    className="text-red-500 hover:text-red-700 text-xs font-bold"
                    onClick={() => onRemoveRow(ri)}
                    disabled={rows.length <= 1}
                  >
                    ×
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      {onAddRow ? (
        <div className="border-t border-gray-100 p-2">
          <button
            type="button"
            className="text-[11px] font-bold text-green-700 hover:text-green-900"
            onClick={() => onAddRow(emptyRow)}
          >
            + Thêm dòng
          </button>
        </div>
      ) : null}
    </div>
  );
}

function HienTruongPanel({ formData, onPatchDetail, onTableChange, onAddRow, onRemoveRow, tableHeadClass }) {
  const d = formData.chi_tiet_ntks.hien_truong;
  const bind = (field) => ({
    value: d[field] || "",
    onChange: (e) => onPatchDetail(field, e.target.value),
  });
  const th = tableHeadClass || "bg-amber-100 text-amber-950";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Địa điểm lập BB">
          <input className={FIELD} {...bind("dia_diem_lap")} />
        </Field>
        <Field label="Bắt đầu">
          <input type="date" className={FIELD} {...bind("ngay_bat_dau")} />
        </Field>
        <Field label="Kết thúc">
          <input type="date" className={FIELD} {...bind("ngay_ket_thuc")} />
        </Field>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Căn cứ — Hợp đồng">
          <input className={FIELD} {...bind("can_cu_hop_dong")} />
        </Field>
        <Field label="Căn cứ — QĐ giao nhiệm vụ GS">
          <input className={FIELD} {...bind("can_cu_qd_giam_sat")} />
        </Field>
        <Field label="Căn cứ — NV/PAKTKS được duyệt">
          <input className={FIELD} {...bind("can_cu_nv_paktks")} />
        </Field>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
          <SubSectionTitle>Đại diện giám sát khảo sát</SubSectionTitle>
          <Field label="Tổ chức / cá nhân">
            <input className={FIELD} {...bind("gs_to_chuc")} />
          </Field>
          <Field label="Ông 1 — Họ tên / Chức vụ">
            <div className="grid grid-cols-2 gap-2">
              <input className={FIELD} placeholder="Họ tên" {...bind("ten_gs_1")} />
              <input className={FIELD} placeholder="Chức vụ" {...bind("cv_gs_1")} />
            </div>
          </Field>
          <Field label="Ông 2 — Họ tên / Chức vụ">
            <div className="grid grid-cols-2 gap-2">
              <input className={FIELD} placeholder="Họ tên" {...bind("ten_gs_2")} />
              <input className={FIELD} placeholder="Chức vụ" {...bind("cv_gs_2")} />
            </div>
          </Field>
          <Field label="Ông 3 — Họ tên / Chức vụ">
            <div className="grid grid-cols-2 gap-2">
              <input className={FIELD} placeholder="Họ tên" {...bind("ten_gs_3")} />
              <input className={FIELD} placeholder="Chức vụ" {...bind("cv_gs_3")} />
            </div>
          </Field>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
          <SubSectionTitle>Đại diện nhà thầu khảo sát</SubSectionTitle>
          <Field label="Tổ chức / cá nhân">
            <input className={FIELD} {...bind("nt_to_chuc")} />
          </Field>
          <Field label="Ông 1 — Họ tên / Chức vụ">
            <div className="grid grid-cols-2 gap-2">
              <input className={FIELD} placeholder="Họ tên" {...bind("ten_nt_1")} />
              <input className={FIELD} placeholder="Chức vụ" {...bind("cv_nt_1")} />
            </div>
          </Field>
          <Field label="Ông 2 — Họ tên / Chức vụ">
            <div className="grid grid-cols-2 gap-2">
              <input className={FIELD} placeholder="Họ tên" {...bind("ten_nt_2")} />
              <input className={FIELD} placeholder="Chức vụ" {...bind("cv_nt_2")} />
            </div>
          </Field>
          <Field label="Ông 3 — Họ tên / Chức vụ">
            <div className="grid grid-cols-2 gap-2">
              <input className={FIELD} placeholder="Họ tên" {...bind("ten_nt_3")} />
              <input className={FIELD} placeholder="Chức vụ" {...bind("cv_nt_3")} />
            </div>
          </Field>
        </div>
      </div>
      <Field label="4.1a — Khoan địa chất">
        <SimpleTable
          columns={[
            { key: "vi_tri", label: "Vị trí lỗ khoan" },
            { key: "chieu_sau", label: "Chiều sâu" },
            { key: "duong_kinh", label: "Đường kính" },
            { key: "danh_gia", label: "Đánh giá" },
          ]}
          rows={d.khoan_dia_chat}
          onCellChange={(ri, f, v) => onTableChange("khoan_dia_chat", ri, f, v)}
          onAddRow={(empty) => onAddRow("khoan_dia_chat", empty)}
          onRemoveRow={(ri) => onRemoveRow("khoan_dia_chat", ri)}
          emptyRow={{ vi_tri: "", chieu_sau: "", duong_kinh: "", danh_gia: "" }}
          headClass={th}
        />
      </Field>
      <Field label="4.1b — Lấy mẫu">
        <SimpleTable
          columns={[
            { key: "ten_mau", label: "Tên mẫu" },
            { key: "vi_tri", label: "Vị trí / hố khoan" },
            { key: "quy_cach", label: "Quy cách" },
            { key: "so_luong", label: "Số lượng" },
            { key: "ngay_bb", label: "Ngày BB lấy mẫu" },
            { key: "yeu_cau", label: "Yêu cầu TN / đánh giá" },
          ]}
          rows={d.lay_mau}
          onCellChange={(ri, f, v) => onTableChange("lay_mau", ri, f, v)}
          onAddRow={(empty) => onAddRow("lay_mau", empty)}
          onRemoveRow={(ri) => onRemoveRow("lay_mau", ri)}
          emptyRow={{
            ten_mau: "",
            vi_tri: "",
            quy_cach: "",
            so_luong: "",
            ngay_bb: "",
            yeu_cau: "",
            danh_gia: "",
          }}
          headClass={th}
        />
      </Field>
      <Field label="4.2 — Đo điện trở suất đất">
        <SimpleTable
          columns={[
            { key: "noi_dung", label: "Nội dung" },
            { key: "ngay_do", label: "Ngày đo" },
            { key: "ghi_chu", label: "Ghi chú" },
          ]}
          rows={d.do_dien_tro_suat}
          onCellChange={(ri, f, v) => onTableChange("do_dien_tro_suat", ri, f, v)}
          onAddRow={(empty) => onAddRow("do_dien_tro_suat", empty)}
          onRemoveRow={(ri) => onRemoveRow("do_dien_tro_suat", ri)}
          emptyRow={{ noi_dung: "", ngay_do: "", ghi_chu: "" }}
          headClass={th}
        />
      </Field>
      <Field label="4.3 — Khảo sát địa hình">
        <SimpleTable
          columns={[
            { key: "noi_dung", label: "Nội dung" },
            { key: "don_vi", label: "ĐVT" },
            { key: "khoi_luong", label: "Khối lượng" },
            { key: "ghi_chu", label: "Ghi chú" },
          ]}
          rows={d.khao_sat_dia_hinh}
          onCellChange={(ri, f, v) => onTableChange("khao_sat_dia_hinh", ri, f, v)}
          onAddRow={(empty) => onAddRow("khao_sat_dia_hinh", empty)}
          onRemoveRow={(ri) => onRemoveRow("khao_sat_dia_hinh", ri)}
          emptyRow={{ noi_dung: "", don_vi: "", khoi_luong: "", ghi_chu: "" }}
          headClass={th}
        />
      </Field>
      <Field label="5 — Kết luận / kiến nghị">
        <textarea className={TEXTAREA} rows={3} {...bind("kien_nghi")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Số bản BB">
          <input className={FIELD} {...bind("so_ban")} />
        </Field>
        <Field label="Mỗi bên giữ">
          <input className={FIELD} {...bind("so_ban_moi_ben")} />
        </Field>
      </div>
    </div>
  );
}

function LayMauPanel({ formData, onPatchDetail, onTableChange, onAddRow, onRemoveRow, tableHeadClass }) {
  const d = formData.chi_tiet_ntks.lay_mau;
  const bind = (field) => ({
    value: d[field] || "",
    onChange: (e) => onPatchDetail(field, e.target.value),
  });
  const th = tableHeadClass || "bg-orange-100 text-orange-950";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Địa điểm lập BB">
          <input className={FIELD} {...bind("dia_diem_lap")} />
        </Field>
        <Field label="Bắt đầu">
          <input type="date" className={FIELD} {...bind("ngay_bat_dau")} />
        </Field>
        <Field label="Kết thúc">
          <input type="date" className={FIELD} {...bind("ngay_ket_thuc")} />
        </Field>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
          <SubSectionTitle>Nhà thầu giám sát khảo sát</SubSectionTitle>
          <Field label="Tổ chức">
            <input className={FIELD} {...bind("gs_to_chuc")} />
          </Field>
          <Field label="Ông 1 — Họ tên / Chức vụ">
            <div className="grid grid-cols-2 gap-2">
              <input className={FIELD} placeholder="Họ tên" {...bind("ten_gs_1")} />
              <input className={FIELD} placeholder="Chức vụ" {...bind("cv_gs_1")} />
            </div>
          </Field>
          <Field label="Ông 2 — Họ tên / Chức vụ">
            <div className="grid grid-cols-2 gap-2">
              <input className={FIELD} placeholder="Họ tên" {...bind("ten_gs_2")} />
              <input className={FIELD} placeholder="Chức vụ" {...bind("cv_gs_2")} />
            </div>
          </Field>
          <Field label="Ông 3 — Họ tên / Chức vụ">
            <div className="grid grid-cols-2 gap-2">
              <input className={FIELD} placeholder="Họ tên" {...bind("ten_gs_3")} />
              <input className={FIELD} placeholder="Chức vụ" {...bind("cv_gs_3")} />
            </div>
          </Field>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
          <SubSectionTitle>Nhà thầu khảo sát</SubSectionTitle>
          <Field label="Tổ chức">
            <input className={FIELD} {...bind("nt_to_chuc")} />
          </Field>
          <Field label="Ông 1 — Họ tên / Chức vụ">
            <div className="grid grid-cols-2 gap-2">
              <input className={FIELD} placeholder="Họ tên" {...bind("ten_nt_1")} />
              <input className={FIELD} placeholder="Chức vụ" {...bind("cv_nt_1")} />
            </div>
          </Field>
          <Field label="Ông 2 — Họ tên / Chức vụ">
            <div className="grid grid-cols-2 gap-2">
              <input className={FIELD} placeholder="Họ tên" {...bind("ten_nt_2")} />
              <input className={FIELD} placeholder="Chức vụ" {...bind("cv_nt_2")} />
            </div>
          </Field>
          <Field label="Ông 3 — Họ tên / Chức vụ">
            <div className="grid grid-cols-2 gap-2">
              <input className={FIELD} placeholder="Họ tên" {...bind("ten_nt_3")} />
              <input className={FIELD} placeholder="Chức vụ" {...bind("cv_nt_3")} />
            </div>
          </Field>
        </div>
      </div>
      <Field label="Bảng lấy mẫu thí nghiệm">
        <SimpleTable
          columns={[
            { key: "vi_tri", label: "Tên hố khoan" },
            { key: "ten_mau", label: "Tên mẫu" },
            { key: "quy_cach", label: "Quy cách", wrap: true },
            { key: "so_luong", label: "Số lượng" },
            { key: "yeu_cau", label: "Yêu cầu thí nghiệm", wrap: true },
          ]}
          rows={d.lay_mau}
          onCellChange={(ri, f, v) => onTableChange("lay_mau", ri, f, v)}
          onAddRow={(empty) => onAddRow("lay_mau", empty)}
          onRemoveRow={(ri) => onRemoveRow("lay_mau", ri)}
          emptyRow={{
            vi_tri: "",
            ten_mau: "",
            quy_cach: "",
            so_luong: "",
            yeu_cau: "",
            ngay_bb: "",
            danh_gia: "",
          }}
          headClass={th}
          showStt
        />
      </Field>
      <Field label="Kết luận">
        <textarea className={TEXTAREA} rows={3} {...bind("kien_nghi")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Số bản BB">
          <input className={FIELD} {...bind("so_ban")} />
        </Field>
        <Field label="Mỗi bên giữ">
          <input className={FIELD} {...bind("so_ban_moi_ben")} />
        </Field>
      </div>
    </div>
  );
}

function KiemTraPanel({ formData, onPatchDetail, onTableChange, onAddRow, onRemoveRow, tableHeadClass }) {
  const d = formData.chi_tiet_ntks.kiem_tra_nl_tb;
  const bind = (field) => ({
    value: d[field] || "",
    onChange: (e) => onPatchDetail(field, e.target.value),
  });
  const th = tableHeadClass || "bg-sky-100 text-sky-950";
  // BB NL/TB luôn có khối giám sát (TVGS hoặc tên Chủ đầu tư)
  const labelGs = "a";
  const labelNt = "b";
  const giaiDoan = (formData.giai_doan || "").trim();
  const gsFallback = resolveNtksKiemTraGsToChuc({
    tvgs: formData.nha_thau_tvgs,
    chuDauTu: formData.chu_dau_tu,
  });
  const gsToChuc = d.gs_to_chuc || gsFallback;

  useEffect(() => {
    if (!giaiDoan) return;
    if (!isAutoNtksDoiTuongKiemTra(d.noi_dung_kiem_tra)) return;
    const next = buildNtksDoiTuongKiemTra(giaiDoan);
    if (String(d.noi_dung_kiem_tra || "").trim() === next) return;
    onPatchDetail("noi_dung_kiem_tra", next);
  }, [giaiDoan, d.noi_dung_kiem_tra, onPatchDetail]);

  useEffect(() => {
    const cur = String(d.gs_to_chuc || "").trim();
    if (cur && cur !== "Chủ đầu tư tự giám sát") return;
    const next = resolveNtksKiemTraGsToChuc({
      tvgs: formData.nha_thau_tvgs,
      chuDauTu: formData.chu_dau_tu,
    });
    if (!next || cur === next) return;
    onPatchDetail("gs_to_chuc", next);
  }, [d.gs_to_chuc, formData.nha_thau_tvgs, formData.chu_dau_tu, onPatchDetail]);

  return (
    <div className="space-y-6">
      {/* 1. Đối tượng */}
      <section>
        <SectionTitle>1. Đối tượng kiểm tra</SectionTitle>
        <MiddleTextarea {...bind("noi_dung_kiem_tra")} />
      </section>

      {/* 2. Thành phần */}
      <section className="space-y-3">
        <SectionTitle>2. Thành phần tham gia</SectionTitle>

        <div className="space-y-3">
          <SubSectionTitle>{labelGs}) Nhà thầu giám sát khảo sát</SubSectionTitle>
          <Field label="Tên tổ chức">
            <input
              className={FIELD}
              value={gsToChuc}
              onChange={(e) => onPatchDetail("gs_to_chuc", e.target.value)}
            />
          </Field>
          <PersonPair
            labelTen="Ông (bà) — Giám sát trưởng"
            labelCv="Chức vụ"
            tenField="ten_gs_1"
            cvField="cv_gs_1"
            d={d}
            onPatchDetail={onPatchDetail}
          />
          <PersonPair
            labelTen="Ông (bà) — Giám sát KS địa hình"
            labelCv="Chức vụ"
            tenField="ten_gs_2"
            cvField="cv_gs_2"
            d={d}
            onPatchDetail={onPatchDetail}
          />
          <PersonPair
            labelTen="Ông (bà) — Giám sát KS địa chất"
            labelCv="Chức vụ"
            tenField="ten_gs_3"
            cvField="cv_gs_3"
            d={d}
            onPatchDetail={onPatchDetail}
          />
        </div>

        <div className="space-y-3">
          <SubSectionTitle>{labelNt}) Nhà thầu khảo sát</SubSectionTitle>
          <MiddleTextarea
            value={d.nt_to_chuc || ""}
            onChange={(e) => onPatchDetail("nt_to_chuc", e.target.value)}
          />
          <PersonPair
            labelTen="Ông"
            labelCv="Chức vụ"
            tenField="ten_nt_1"
            cvField="cv_nt_1"
            d={d}
            onPatchDetail={onPatchDetail}
            middle
          />
          <PersonPair
            labelTen="Ông"
            labelCv="Chức vụ"
            tenField="ten_nt_2"
            cvField="cv_nt_2"
            d={d}
            onPatchDetail={onPatchDetail}
            middle
          />
          <PersonPair
            labelTen="Ông"
            labelCv="Chức vụ"
            tenField="ten_nt_3"
            cvField="cv_nt_3"
            d={d}
            onPatchDetail={onPatchDetail}
            middle
          />
        </div>
      </section>

      {/* 3. Thời gian & địa điểm */}
      <section>
        <SectionTitle>3. Thời gian và địa điểm kiểm tra</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Bắt đầu">
            <input type="date" lang="vi" className={FIELD} {...bind("ngay_bat_dau")} />
          </Field>
          <Field label="Kết thúc">
            <input type="date" lang="vi" className={FIELD} {...bind("ngay_ket_thuc")} />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Tại">
            <input className={FIELD} {...bind("dia_diem_kiem_tra")} />
          </Field>
        </div>
      </section>

      {/* 4. Nội dung kiểm tra */}
      <section className="space-y-3">
        <SectionTitle>4. Nội dung kiểm tra</SectionTitle>
        <SubSectionTitle>4.1. Nhân lực tham gia khảo sát</SubSectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Chủ nhiệm khảo sát">
            <input className={FIELD} {...bind("nl_chu_nhiem")} />
          </Field>
          <Field label="Khảo sát địa hình">
            <input className={FIELD} {...bind("nl_ks_dia_hinh")} />
          </Field>
          <Field label="Khảo sát địa chất">
            <input className={FIELD} {...bind("nl_ks_dia_chat")} />
          </Field>
          <Field label="Công nhân khảo sát">
            <MiddleTextarea {...bind("nl_cong_nhan")} />
          </Field>
        </div>

        <SubSectionTitle>4.2. Thiết bị khảo sát</SubSectionTitle>
        <SimpleTable
          showStt
          centerHead
          fixedLayout
          columns={[
            {
              key: "ten_may",
              label: "Loại thiết bị",
              wrap: true,
              thClass: "w-[52%]",
            },
            {
              key: "cong_suat_ma",
              label: "Đơn vị",
              thClass: "w-[10%]",
              inputClass: "min-w-0 text-center",
            },
            {
              key: "so_luong",
              label: "Số lượng",
              thClass: "w-[10%]",
              inputClass: "min-w-0 text-center",
            },
            {
              key: "tinh_trang",
              label: "Tình trạng hoạt động",
              thClass: "w-[18%]",
              inputClass: "min-w-0 text-center",
            },
          ]}
          rows={d.may_moc}
          onCellChange={(ri, f, v) => onTableChange("may_moc", ri, f, v)}
          onAddRow={(empty) => onAddRow("may_moc", empty)}
          onRemoveRow={(ri) => onRemoveRow("may_moc", ri)}
          emptyRow={{ ten_may: "", cong_suat_ma: "", so_luong: "", tinh_trang: "" }}
          headClass={th}
        />
      </section>

      {/* 5. Kết luận */}
      <section className="space-y-3">
        <SectionTitle>5. Kết luận</SectionTitle>
        <MiddleTextarea {...bind("ket_luan")} />
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <Field label="Số bản">
            <input className={FIELD} {...bind("so_ban")} />
          </Field>
          <Field label="Mỗi bên giữ">
            <input className={FIELD} {...bind("so_ban_moi_ben")} />
          </Field>
        </div>
      </section>
    </div>
  );
}

function PersonPair({ labelTen, labelCv, tenField, cvField, d, onPatchDetail, middle = false }) {
  const Input = middle ? MiddleTextarea : "input";
  const inputClass = middle ? undefined : FIELD;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <Field label={labelTen}>
        <Input
          className={inputClass}
          value={d[tenField] || ""}
          onChange={(e) => onPatchDetail(tenField, e.target.value)}
        />
      </Field>
      <Field label={labelCv}>
        <Input
          className={inputClass}
          value={d[cvField] || ""}
          onChange={(e) => onPatchDetail(cvField, e.target.value)}
        />
      </Field>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h3 className="mb-3 border-b border-teal-100 pb-1.5 text-sm font-bold normal-case tracking-normal text-teal-800">
      {children}
    </h3>
  );
}

function SubSectionTitle({ children }) {
  return <p className="text-sm font-bold normal-case text-teal-800">{children}</p>;
}

function NghiemThuPanel({ formData, onPatchDetail }) {
  const d = formData.chi_tiet_ntks.nghiem_thu_kq;
  const bind = (field) => ({
    value: d[field] || "",
    onChange: (e) => onPatchDetail(field, e.target.value),
  });
  const hasGiamSat = Boolean(String(formData.nha_thau_tvgs || d.giam_sat_ks || "").trim());
  const labelCdt = "a";
  const labelGs = "b";
  const labelTvtk = hasGiamSat ? "c" : "b";
  const giaiDoan = (formData.giai_doan || "").trim();

  return (
    <div className="space-y-6">
      {/* 1. Thời gian */}
      <section>
        <SectionTitle>1. Thời gian nghiệm thu</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Bắt đầu">
            <input type="date" className={FIELD} {...bind("ngay_bat_dau")} />
          </Field>
          <Field label="Kết thúc">
            <input type="date" className={FIELD} {...bind("ngay_ket_thuc")} />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Tại (địa điểm lập BB)">
            <input className={FIELD} {...bind("dia_diem_lap")} />
          </Field>
        </div>
      </section>

      {/* 2. Đối tượng */}
      <section>
        <SectionTitle>2. Đối tượng nghiệm thu</SectionTitle>
        <p className="text-sm text-slate-800 text-justify leading-relaxed">
          Khảo sát xây dựng phục vụ lập{" "}
          <span className="font-semibold text-slate-900">{giaiDoan || "…"}</span>.
        </p>
      </section>

      {/* 3. Thành phần */}
      <section className="space-y-3">
        <SectionTitle>3. Thành phần trực tiếp nghiệm thu</SectionTitle>

        <div className="space-y-3">
          <SubSectionTitle>
            {labelCdt}) Đại diện Chủ đầu tư
          </SubSectionTitle>
          <Field label="Tên tổ chức / cá nhân">
            <input className={FIELD} {...bind("cdt_to_chuc")} />
          </Field>
          <PersonPair
            labelTen="Ông (bà) — Phó GĐ"
            labelCv="Chức vụ"
            tenField="ten_pgd_cdt"
            cvField="cv_pgd_cdt"
            d={d}
            onPatchDetail={onPatchDetail}
          />
          <PersonPair
            labelTen="Ông (bà) — Trưởng phòng"
            labelCv="Chức vụ"
            tenField="ten_tr_phong_cdt"
            cvField="cv_tr_phong_cdt"
            d={d}
            onPatchDetail={onPatchDetail}
          />
          <PersonPair
            labelTen="Ông (bà) — Chuyên viên"
            labelCv="Chức vụ"
            tenField="ten_chuyen_vien_cdt"
            cvField="cv_chuyen_vien_cdt"
            d={d}
            onPatchDetail={onPatchDetail}
          />
        </div>

        {hasGiamSat ? (
          <div className="space-y-3">
            <SubSectionTitle>
              {labelGs}) Đại diện nhà thầu giám sát KS
            </SubSectionTitle>
            <Field label="Tên tổ chức">
              <input
                className={FIELD}
                value={d.giam_sat_ks || formData.nha_thau_tvgs || ""}
                onChange={(e) => onPatchDetail("giam_sat_ks", e.target.value)}
              />
            </Field>
            <PersonPair
              labelTen="Ông (bà) — Lãnh đạo"
              labelCv="Chức vụ"
              tenField="ten_lanh_dao_gsks"
              cvField="cv_lanh_dao_gsks"
              d={d}
              onPatchDetail={onPatchDetail}
            />
            <PersonPair
              labelTen="Ông (bà) — Chủ nhiệm KS"
              labelCv="Chức vụ"
              tenField="ten_cnks_gsks"
              cvField="cv_cnks_gsks"
              d={d}
              onPatchDetail={onPatchDetail}
            />
            <PersonPair
              labelTen="Ông (bà) — Chuyên viên"
              labelCv="Chức vụ"
              tenField="ten_cvien_gsks"
              cvField="cv_cvien_gsks"
              d={d}
              onPatchDetail={onPatchDetail}
            />
          </div>
        ) : null}

        <div className="space-y-3">
          <SubSectionTitle>
            {labelTvtk}) Đại diện nhà thầu khảo sát (TVTK)
          </SubSectionTitle>
          <Field label="Tên tổ chức">
            <input className={FIELD} {...bind("tu_van_thiet_ke")} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field label="1. Ông (bà) — Lãnh đạo">
              <select
                className={FIELD}
                value={d.ten_lanh_dao_tvtk || NTKS_LANH_DAO_TVTK_OPTIONS[0]}
                onChange={(e) => {
                  onPatchDetail("ten_lanh_dao_tvtk", e.target.value);
                  if (!(d.cv_lanh_dao_tvtk || "").trim()) {
                    onPatchDetail("cv_lanh_dao_tvtk", "Phó Giám đốc");
                  }
                }}
              >
                {[
                  ...NTKS_LANH_DAO_TVTK_OPTIONS,
                  ...(d.ten_lanh_dao_tvtk &&
                  !NTKS_LANH_DAO_TVTK_OPTIONS.includes(d.ten_lanh_dao_tvtk)
                    ? [d.ten_lanh_dao_tvtk]
                    : []),
                ].map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Chức vụ">
              <input className={FIELD} {...bind("cv_lanh_dao_tvtk")} />
            </Field>
          </div>
          <PersonPair
            labelTen="2. Ông (bà) — Kinh doanh"
            labelCv="Chức vụ"
            tenField="ten_kdoanh_cty"
            cvField="cv_kdoanh_cty"
            d={d}
            onPatchDetail={onPatchDetail}
          />
          <PersonPair
            labelTen="3. Ông (bà) — GĐ XN TV"
            labelCv="Chức vụ"
            tenField="ten_gdxntv_tvtk"
            cvField="cv_gdxntv_tvtk"
            d={d}
            onPatchDetail={onPatchDetail}
          />
          <PersonPair
            labelTen="4. Ông (bà) — Chủ nhiệm KS"
            labelCv="Chức vụ"
            tenField="ten_cnks_tvtk"
            cvField="cv_cnks_tvtk"
            d={d}
            onPatchDetail={onPatchDetail}
          />
        </div>
      </section>

      {/* 4. Căn cứ */}
      <section className="space-y-3">
        <SectionTitle>4. Căn cứ nghiệm thu</SectionTitle>
        <Field label="QĐ Giao A">
          <textarea className={TEXTAREA} rows={3} {...bind("can_cu_hop_dong")} />
        </Field>
        {hasGiamSat ? (
          <Field label="QĐ giao nhiệm vụ giám sát">
            <textarea className={TEXTAREA} rows={2} {...bind("can_cu_qd_giam_sat")} />
          </Field>
        ) : null}
        <Field label="QĐ phê duyệt NVKS">
          <textarea className={TEXTAREA} rows={2} {...bind("can_cu_qdpd_nvks")} />
        </Field>
        <Field label="QĐ phê duyệt PAKTKS">
          <textarea className={TEXTAREA} rows={2} {...bind("can_cu_qdpd_paktks")} />
        </Field>
      </section>

      {/* 5. Đánh giá */}
      <section className="space-y-3">
        <SectionTitle>5. Đánh giá báo cáo kết quả khảo sát xây dựng</SectionTitle>
        <Field label="5a — Về chất lượng công tác khảo sát xây dựng">
          <MiddleTextarea rows={2} {...bind("danh_gia_chat_luong")} />
        </Field>
        <Field label="5b — Về quy mô và phạm vi khảo sát">
          <MiddleTextarea rows={2} {...bind("danh_gia_quy_mo")} />
        </Field>
        <Field label="5c — Khối lượng khảo sát xây dựng">
          <MiddleTextarea rows={2} {...bind("danh_gia_khoi_luong")} />
        </Field>
        <Field label="5d — Về số lượng, hình thức báo cáo kết quả KS">
          <MiddleTextarea rows={2} {...bind("danh_gia_bao_cao")} />
        </Field>
        <Field label="5e — Các vấn đề khác">
          <MiddleTextarea rows={2} {...bind("danh_gia_khac")} />
        </Field>
      </section>

      {/* 6. Kết luận */}
      <section className="space-y-3">
        <SectionTitle>6. Kết luận</SectionTitle>
        <Field label="6A- Kết luận">
          <MiddleTextarea rows={3} {...bind("ket_luan")} />
        </Field>
        <Field label="6B-Yêu cầu bổ sung / kiến nghị">
          <MiddleTextarea rows={2} {...bind("yeu_cau_bo_sung")} />
        </Field>
        <div className="grid grid-cols-3 gap-3 max-w-lg">
          <Field label="Tổng số bản">
            <input className={FIELD} {...bind("so_ban")} />
          </Field>
          <Field label="Bên A giữ">
            <input className={FIELD} {...bind("so_ban_ben_a")} />
          </Field>
          <Field label="Bên B giữ">
            <input className={FIELD} {...bind("so_ban_ben_b")} />
          </Field>
        </div>
      </section>
    </div>
  );
}

export default function FormNTKS({
  project,
  nvksRecord,
  nkksRecord,
  paktksRecord,
  ntksRecord,
  onClose,
  onSaved,
}) {
  const { showAlert, showConfirm } = useAppDialog();
  const forms = useMemo(() => listNtksForms(), []);
  const [activeTab, setActiveTab] = useState("nghiem_thu_kq");
  const [formData, setFormData] = useState(() =>
    mergeSavedNtksIntoForm(ntksRecord, project, nvksRecord, nkksRecord, paktksRecord)
  );
  const [recordId, setRecordId] = useState(ntksRecord?.id || null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [printingPdf, setPrintingPdf] = useState(false);
  const readOnly = formData.trang_thai_ntks === "da_chot";

  useEffect(() => {
    setFormData(
      mergeSavedNtksIntoForm(ntksRecord, project, nvksRecord, nkksRecord, paktksRecord)
    );
    setRecordId(ntksRecord?.id || null);
  }, [ntksRecord, project, nvksRecord, nkksRecord, paktksRecord]);

  const patchHeader = (field, value) => setFormData((prev) => ({ ...prev, [field]: value }));

  const patchDetail = useCallback(
    (field, value) => {
      setFormData((prev) => patchNtksFormDetail(prev, activeTab, { [field]: value }));
    },
    [activeTab]
  );

  const onTableChange = useCallback(
    (tableKey, rowIndex, field, value) => {
      setFormData((prev) => patchNtksTableRow(prev, activeTab, tableKey, rowIndex, field, value));
    },
    [activeTab]
  );

  const onAddRow = useCallback(
    (tableKey, emptyRow) => {
      setFormData((prev) => addNtksTableRow(prev, activeTab, tableKey, emptyRow));
    },
    [activeTab]
  );

  const onRemoveRow = useCallback(
    (tableKey, rowIndex) => {
      setFormData((prev) => removeNtksTableRow(prev, activeTab, tableKey, rowIndex));
    },
    [activeTab]
  );

  const handleSave = async ({ chot = false, closeAfter = false } = {}) => {
    if (!nvksRecord?.id) {
      showAlert("Thiếu hồ sơ NVKS.");
      return;
    }
    setSaving(true);
    try {
      const payload = buildNtksDbPayload(
        {
          ...formData,
          trang_thai_ntks: chot ? "da_chot" : formData.trang_thai_ntks || "dang_lap",
        },
        { nvksId: nvksRecord.id, nkksId: nkksRecord?.id || null }
      );
      const { id, created } = await saveNtksToDb(supabase, {
        payload,
        recordId,
        maDuAn: formData.ma_du_an,
      });
      setRecordId(id);
      setFormData((prev) => ({
        ...prev,
        trang_thai_ntks: payload.trang_thai_ntks,
        chi_tiet_ntks: normalizeNtksChiTiet(payload.chi_tiet_ntks),
      }));
      await logHoatDong({
        hanh_dong: created ? "tao_ntks" : chot ? "chot_ntks" : "luu_ntks",
        ma_du_an: formData.ma_du_an,
        chi_tiet: chot ? "Chốt hồ sơ NTKS" : "Lưu hồ sơ NTKS",
      });
      onSaved?.();
      if (closeAfter) onClose?.();
      else showAlert(chot ? "Đã chốt hồ sơ NTKS." : "Đã lưu hồ sơ NTKS.");
    } catch (err) {
      showAlert(`Lỗi lưu NTKS: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    if (!recordId) {
      showAlert("Vui lòng Lưu hồ sơ NTKS trước khi xuất Word.");
      return;
    }
    const kind = `docx_${activeTab}`;
    const tabLink =
      normalizeNtksChiTiet(formData.chi_tiet_ntks)?.[activeTab]?.link_docx_xuat ||
      formData.link_docx_xuat ||
      "";
    const hadDocx = await hasExistingExportFile(supabase, {
      maDuAn: formData.ma_du_an,
      moduleLoai: "nghiem_thu",
      kind,
      formLink: tabLink,
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
    setExporting(true);
    try {
      await exportNtksWord(formData, activeTab);
      const { publicUrl, exported_at, fileName } = await exportAndUploadNtksWord(
        supabase,
        formData,
        activeTab,
        recordId
      );
      const chi = normalizeNtksChiTiet(formData.chi_tiet_ntks);
      chi[activeTab] = { ...chi[activeTab], link_docx_xuat: publicUrl, exported_at };
      await updateNtksExportLinks(supabase, recordId, {
        link_docx_xuat: publicUrl,
        exported_at,
      });

      const user = getAuthUser();
      await syncXuatBanTaiLieuSafe(supabase, {
        maDuAn: formData.ma_du_an,
        moduleLoai: "nghiem_thu",
        kind,
        storagePath: publicUrl,
        displayName: exportDisplayNameFromUrl(publicUrl) || fileName,
        thoiGian: exported_at,
        nguoiUpMaNv: user?.ma_nv,
      });

      setFormData((prev) => ({
        ...prev,
        chi_tiet_ntks: chi,
        link_docx_xuat: publicUrl,
        exported_at,
      }));
    } catch (err) {
      showAlert(`Lỗi xuất Word: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  const handlePrintPdf = async () => {
    if (!recordId) {
      showAlert("Vui lòng Lưu hồ sơ NTKS trước khi In/PDF.");
      return;
    }
    setPrintingPdf(true);
    try {
      const outBlob = await generateNtksWordBlob(formData, activeTab);
      const tabLabel = forms.find((f) => f.key === activeTab)?.label || activeTab;
      await printDocxBlob(outBlob, { title: `${formData.ten_du_an || "NTKS"} — ${tabLabel}` });
      await logHoatDong({
        hanh_dong: "print_pdf_ntks",
        ma_du_an: formData.ma_du_an,
        chi_tiet: `In/PDF NTKS — ${tabLabel}`,
      });
    } catch (err) {
      showAlert(`Lỗi In/PDF: ${err.message}`);
    } finally {
      setPrintingPdf(false);
    }
  };

  const handleUploadPdfPhatHanh = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!recordId) {
      showAlert("Lưu hồ sơ NTKS trước khi upload PDF để trình ký.");
      e.target.value = "";
      return;
    }
    const isPdf =
      file.type === "application/pdf" || String(file.name || "").toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      showAlert("Chọn file PDF (.pdf).");
      e.target.value = "";
      return;
    }
    const kind = `pdf_${activeTab}`;
    const tabLink =
      normalizeNtksChiTiet(formData.chi_tiet_ntks)?.[activeTab]?.link_pdf_xuat || "";
    const hadPdf = await hasExistingExportFile(supabase, {
      maDuAn: formData.ma_du_an,
      moduleLoai: "nghiem_thu",
      kind,
      formLink: tabLink,
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
      const ts = Date.now();
      const pdfName = buildNtksDownloadFileName(formData, activeTab, { timestamp: ts, ext: "pdf" });
      const pdfPath = buildNtksExportStoragePath(formData, pdfName);
      const pdfUrl = await uploadNtksExportBlob(supabase, file, pdfPath, "application/pdf");
      const exportedAt = new Date(ts).toISOString();
      const chi = normalizeNtksChiTiet(formData.chi_tiet_ntks);
      chi[activeTab] = { ...chi[activeTab], link_pdf_xuat: pdfUrl, exported_at: exportedAt };
      const nextForm = { ...formData, chi_tiet_ntks: chi };
      const payload = buildNtksDbPayload(nextForm, {
        nvksId: nvksRecord.id,
        nkksId: nkksRecord?.id || null,
      });
      await saveNtksToDb(supabase, { payload, recordId, maDuAn: formData.ma_du_an });
      const user = getAuthUser();
      await syncXuatBanTaiLieuSafe(supabase, {
        maDuAn: formData.ma_du_an,
        moduleLoai: "nghiem_thu",
        kind,
        storagePath: pdfUrl,
        displayName: exportDisplayNameFromUrl(pdfUrl) || pdfName,
        thoiGian: exportedAt,
        nguoiUpMaNv: user?.ma_nv,
      });
      setFormData(nextForm);
    } catch (err) {
      showAlert(`Lỗi upload PDF để trình ký: ${err.message}`);
    } finally {
      e.target.value = "";
    }
  };

  const activeForm = forms.find((f) => f.key === activeTab);
  const tabTheme = NTKS_ZONE[activeTab] || NTKS_ZONE.nghiem_thu_kq;
  const chungTheme = NTKS_ZONE.chung;

  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      <div className="shrink-0 border-b border-gray-200 bg-gradient-to-r from-green-700 to-emerald-600 px-4 py-3 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onClose}
              title="Quay lại"
              aria-label="Quay lại"
              className="p-1.5 rounded hover:bg-white/15 text-white transition shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div className="min-w-0">
              <h1 className="text-lg font-black tracking-tight truncate">NTKS — Nghiệm thu khảo sát</h1>
              <p className="text-green-100 text-xs mt-0.5 truncate">{formData.ten_du_an || formData.ma_du_an}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!readOnly && (
              <button
                type="button"
                disabled={saving}
                className={`${TOOLBAR_BTN} bg-white text-green-800 hover:bg-green-50 shadow-sm`}
                onClick={() => handleSave()}
              >
                Lưu
              </button>
            )}
            {!readOnly && (
              <button
                type="button"
                disabled={saving}
                className={`${TOOLBAR_BTN} bg-white/15 border border-white/40 text-white hover:bg-white/25`}
                onClick={() => handleSave({ closeAfter: true })}
              >
                Lưu &amp; đóng
              </button>
            )}
            <button
              type="button"
              disabled={exporting || printingPdf}
              className={`${TOOLBAR_BTN} bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md`}
              onClick={handleExport}
            >
              Xuất Word
            </button>
            <button
              type="button"
              disabled={exporting || printingPdf}
              className={`${TOOLBAR_BTN} bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-md`}
              onClick={handlePrintPdf}
            >
              {printingPdf ? "In…" : "In/PDF"}
            </button>
            {!readOnly && recordId ? (
              <label
                className={`${TOOLBAR_BTN} bg-white/15 border border-white/40 text-white hover:bg-white/25 cursor-pointer`}
                title="Upload PDF để trình ký (sau In/PDF)"
              >
                ↑ PDF
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handleUploadPdfPhatHanh}
                />
              </label>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className={`mx-4 mt-3 rounded-xl border-2 px-4 py-3 shadow-sm ${chungTheme.wrap}`}>
          <div className={`mb-3 flex items-center gap-2 ${chungTheme.bar} pl-3`}>
            <h2 className="text-sm font-black uppercase tracking-wide text-teal-800">
              Thông tin chung
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-x-3 gap-y-2 lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1.35fr)_minmax(0,1.25fr)_minmax(0,0.72fr)]">
            <Field label="Tên dự án">
              <input
                className={CHUNG_INPUT.ten}
                readOnly
                title={formData.ten_du_an || ""}
                value={formData.ten_du_an || ""}
              />
            </Field>
            <Field label="Chủ đầu tư">
              <input className={CHUNG_INPUT.cdt} readOnly value={formData.chu_dau_tu || ""} />
            </Field>
            <Field label="TVGS">
              <input
                className={readOnly ? CHUNG_INPUT.tvgsRo : CHUNG_INPUT.tvgs}
                readOnly={readOnly}
                value={formData.nha_thau_tvgs || ""}
                onChange={(e) => patchHeader("nha_thau_tvgs", e.target.value)}
              />
            </Field>
            <Field label="Giai đoạn">
              <input className={CHUNG_INPUT.giaiDoan} readOnly value={formData.giai_doan || ""} />
            </Field>
            <Field label="Mã dự án">
              <input className={CHUNG_INPUT.ma} readOnly value={formData.ma_du_an || ""} />
            </Field>
            <Field label="Nhà thầu khảo sát">
              <input className={CHUNG_INPUT.nhaThau} readOnly value={formData.nha_thau_ks || ""} />
            </Field>
            <Field label="Địa điểm">
              <input className={CHUNG_INPUT.diaDiem} readOnly value={formData.dia_diem || ""} />
            </Field>
            <Field label="Trạng thái">
              <input
                className={CHUNG_INPUT.trangThai}
                readOnly
                value={formData.trang_thai_ntks === "da_chot" ? "Đã chốt" : "Đang lập"}
              />
            </Field>
          </div>
        </div>

        <div className="sticky top-0 z-20 mx-4 mt-3 flex flex-wrap gap-2 border-b border-slate-200/80 bg-white/95 py-2.5 backdrop-blur-sm">
          {forms.map((f) => {
            const theme = NTKS_ZONE[f.key];
            const active = activeTab === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setActiveTab(f.key)}
                className={`shrink-0 rounded-lg border-2 px-3.5 py-2 text-xs font-black uppercase tracking-wide transition ${
                  active ? theme.tabActive : theme.tabIdle
                }`}
              >
                {f.shortLabel}
              </button>
            );
          })}
        </div>

        <div className="p-4 pt-3 pb-8">
          <div
            className={`mx-auto w-full max-w-[210mm] rounded-xl border-2 px-5 py-5 shadow-sm sm:px-8 sm:py-6 ${tabTheme.panel}`}
          >
            <div className="mb-5 border-b border-teal-100 pb-4 text-center">
              {activeTab === "nghiem_thu_kq" ? (
                <div className="flex flex-col items-center gap-1.5">
                  <h2 className="text-sm font-black uppercase leading-snug tracking-wide text-teal-800 sm:text-[15px]">
                    Biên bản nghiệm thu kết quả khảo sát xây dựng
                  </h2>
                  <p className="text-sm font-bold uppercase tracking-wide text-teal-800">
                    (Giai đoạn lập {(formData.giai_doan || "").trim().toUpperCase() || "…"})
                  </p>
                  <span className="text-sm font-bold uppercase tracking-wide text-teal-800">
                    Số biên bản
                  </span>
                  <input
                    className="mt-0.5 h-8 w-28 rounded-lg border border-gray-200 bg-white px-2 text-center text-sm font-semibold text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    readOnly={readOnly}
                    value={formData.chi_tiet_ntks?.nghiem_thu_kq?.so_bien_ban || ""}
                    onChange={(e) => patchDetail("so_bien_ban", e.target.value)}
                  />
                </div>
              ) : activeTab === "kiem_tra_nl_tb" ? (
                <div className="flex flex-col items-center gap-1">
                  <h2 className="text-sm font-black uppercase leading-snug tracking-wide text-teal-800 sm:text-[15px]">
                    Biên bản kiểm tra nhân lực, thiết bị trước thi công
                  </h2>
                  <p className="text-sm font-bold leading-snug text-teal-800">
                    Dự án: {(formData.ten_du_an || "").trim() || "…"}
                  </p>
                  <p className="text-sm font-bold leading-snug text-teal-800">
                    Giai đoạn: {(formData.giai_doan || "").trim() || "…"}
                  </p>
                </div>
              ) : activeTab === "lay_mau" ? (
                <div className="flex flex-col items-center gap-1">
                  <h2 className="text-sm font-black uppercase leading-snug tracking-wide text-teal-800 sm:text-[15px]">
                    Biên bản lấy mẫu tại hiện trường
                  </h2>
                  <p className="text-xs font-semibold text-slate-600">(Hạng mục khảo sát địa chất)</p>
                  <p className="text-sm font-bold leading-snug text-teal-800">
                    Dự án: {(formData.ten_du_an || "").trim() || "…"}
                  </p>
                  <p className="text-sm font-bold leading-snug text-teal-800">
                    Giai đoạn: {(formData.giai_doan || "").trim() || "…"}
                  </p>
                </div>
              ) : (
                <h2 className="text-sm font-black uppercase leading-snug tracking-wide text-teal-800 sm:text-[15px]">
                  {activeForm?.label}
                </h2>
              )}
            </div>
            {readOnly && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                Hồ sơ đã chốt — chỉ xem và xuất Word.
              </p>
            )}
            {activeTab === "hien_truong" && (
              <fieldset disabled={readOnly} className={readOnly ? "opacity-90 pointer-events-none" : ""}>
                <HienTruongPanel
                  formData={formData}
                  onPatchDetail={patchDetail}
                  onTableChange={onTableChange}
                  onAddRow={onAddRow}
                  onRemoveRow={readOnly ? null : onRemoveRow}
                  tableHeadClass={tabTheme.tableHead}
                />
              </fieldset>
            )}
            {activeTab === "lay_mau" && (
              <fieldset disabled={readOnly} className={readOnly ? "opacity-90 pointer-events-none" : ""}>
                <LayMauPanel
                  formData={formData}
                  onPatchDetail={patchDetail}
                  onTableChange={onTableChange}
                  onAddRow={onAddRow}
                  onRemoveRow={readOnly ? null : onRemoveRow}
                  tableHeadClass={tabTheme.tableHead}
                />
              </fieldset>
            )}
            {activeTab === "kiem_tra_nl_tb" && (
              <fieldset disabled={readOnly} className={readOnly ? "opacity-90 pointer-events-none" : ""}>
                <KiemTraPanel
                  formData={formData}
                  onPatchDetail={patchDetail}
                  onTableChange={onTableChange}
                  onAddRow={onAddRow}
                  onRemoveRow={readOnly ? null : onRemoveRow}
                  tableHeadClass={tabTheme.tableHead}
                />
              </fieldset>
            )}
            {activeTab === "nghiem_thu_kq" && (
              <fieldset disabled={readOnly} className={readOnly ? "opacity-90 pointer-events-none" : ""}>
                <NghiemThuPanel formData={formData} onPatchDetail={patchDetail} />
              </fieldset>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
