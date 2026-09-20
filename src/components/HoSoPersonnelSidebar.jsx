"use client";

import React from "react";
import { hasChuKyImages } from "../lib/trinhKy/steps";

const THEMES = {
  blue: {
    card: "border-gray-200",
    title: "text-blue-800 border-blue-100",
    focus: "focus:border-blue-500",
    exportLabel: "text-blue-700",
    exportBox: "bg-blue-50/40 border-blue-100",
    exportBorder: "border-blue-100",
    addOption: "text-blue-600 bg-blue-50",
  },
  purple: {
    card: "border-purple-200",
    title: "text-purple-800 border-purple-100",
    focus: "focus:border-purple-500",
    exportLabel: "text-indigo-700",
    exportBox: "bg-indigo-50/40 border-indigo-100",
    exportBorder: "border-indigo-100",
    addOption: "text-purple-600 bg-purple-50",
  },
};

/**
 * Cột phải II. Nhân sự & Phê duyệt — dùng chung NVKS / PAKTKS.
 * @param {boolean} [usePersonnelCatalog] — true: chọn ma_nv từ NHAN_SU (ẩn thêm tay)
 * @param {(field: 'chu_nhiem_ks'|'lanh_dao_duyet', maNv: string, hoTen: string) => void} [onSelectNhanSu]
 */
export default function HoSoPersonnelSidebar({
  theme = "blue",
  thoiDiemLabel = "Thời điểm lập",
  formData = {},
  listCNKS = [],
  listLanhDao = [],
  nhanSuCatalog = null,
  onSelectNhanSu = null,
  isKlLocked = false,
  onInputChange,
  showAddPersonnel = true,
  usePersonnelCatalog = false,
  exportLinks = null,
  exportSectionTitle = "FILE XUẤT & KHO HỒ SƠ",
  pdfDaKySection = null,
  quyetDinhSection = null,
  className = "",
}) {
  const t = THEMES[theme] || THEMES.blue;
  const useCatalog =
    usePersonnelCatalog &&
    Array.isArray(nhanSuCatalog) &&
    nhanSuCatalog.length > 0 &&
    typeof onSelectNhanSu === "function";

  const selectClass = (extra = "") =>
    `w-full border p-2 rounded text-sm outline-none bg-white ${
      isKlLocked
        ? "bg-gray-100 text-gray-500 cursor-not-allowed"
        : `${t.focus} ${extra}`
    }`;

  const catalogOptionsCnks = (nhanSuCatalog || []).map((ns) => {
    const ready = hasChuKyImages(ns, { asLanhDao: false });
    return {
      ma_nv: ns.ma_nv,
      label: `${ns.ho_ten}${ready ? "" : " (thiếu ký nháy)"}`,
      ho_ten: ns.ho_ten,
    };
  });
  const catalogOptionsLd = (nhanSuCatalog || []).map((ns) => {
    const ready = hasChuKyImages(ns, { asLanhDao: true });
    return {
      ma_nv: ns.ma_nv,
      label: `${ns.ho_ten}${ready ? "" : " (thiếu ký chính/ký dấu)"}`,
      ho_ten: ns.ho_ten,
    };
  });

  return (
    <div className={`bg-white p-5 rounded border shadow-sm flex flex-col h-full ${t.card} ${className}`}>
      <h4 className={`font-bold border-b pb-2 mb-4 shrink-0 ${t.title}`}>II. NHÂN SỰ VÀ PHÊ DUYỆT</h4>

      <div className="space-y-4 flex-1 flex flex-col">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-semibold text-gray-600 uppercase mb-1">
              Chủ nhiệm khảo sát
            </label>
            {useCatalog ? (
              <select
                name="chu_nhiem_ks_ma_nv"
                value={formData.chu_nhiem_ks_ma_nv || ""}
                onChange={(e) => {
                  const ma = e.target.value;
                  const row = (nhanSuCatalog || []).find((n) => n.ma_nv === ma);
                  onSelectNhanSu("chu_nhiem_ks", ma, row?.ho_ten || "");
                }}
                disabled={isKlLocked}
                className={selectClass()}
              >
                <option value="">-- Chọn từ danh mục --</option>
                {catalogOptionsCnks.map((o) => (
                  <option key={o.ma_nv} value={o.ma_nv}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <select
                name="chu_nhiem_ks"
                value={formData.chu_nhiem_ks || ""}
                onChange={onInputChange}
                disabled={isKlLocked}
                className={selectClass()}
              >
                {listCNKS.map((n, i) => (
                  <option key={i} value={n}>
                    {n}
                  </option>
                ))}
                {showAddPersonnel && !isKlLocked ? (
                  <option value="ADD_NEW" className={`font-bold ${t.addOption}`}>
                    + Thêm chủ nhiệm mới...
                  </option>
                ) : null}
              </select>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-gray-600 uppercase mb-1">
              Lãnh đạo phê duyệt
            </label>
            {useCatalog ? (
              <select
                name="lanh_dao_duyet_ma_nv"
                value={formData.lanh_dao_duyet_ma_nv || ""}
                onChange={(e) => {
                  const ma = e.target.value;
                  const row = (nhanSuCatalog || []).find((n) => n.ma_nv === ma);
                  onSelectNhanSu("lanh_dao_duyet", ma, row?.ho_ten || "");
                }}
                disabled={isKlLocked}
                className={selectClass()}
              >
                <option value="">-- Chọn từ danh mục --</option>
                {catalogOptionsLd.map((o) => (
                  <option key={`ld-${o.ma_nv}`} value={o.ma_nv}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <select
                name="lanh_dao_duyet"
                value={formData.lanh_dao_duyet || ""}
                onChange={onInputChange}
                disabled={isKlLocked}
                className={selectClass()}
              >
                {listLanhDao.map((n, i) => (
                  <option key={i} value={n}>
                    {n}
                  </option>
                ))}
                {showAddPersonnel && !isKlLocked ? (
                  <option value="ADD_NEW" className={`font-bold ${t.addOption}`}>
                    + Thêm lãnh đạo mới...
                  </option>
                ) : null}
              </select>
            )}
          </div>
        </div>

        <div className="pt-3 border-t border-gray-100">
          <div className="flex flex-nowrap items-center gap-x-2 text-sm overflow-x-auto">
            <span className="text-gray-600 shrink-0">Người lập:</span>
            <span className="text-gray-800 shrink-0 whitespace-nowrap">{formData.nguoi_lap || "—"}</span>
            <span className="text-gray-300 shrink-0 px-0.5">|</span>
            <span className="text-gray-600 shrink-0 whitespace-nowrap">{thoiDiemLabel}:</span>
            <input
              type="date"
              name="thoi_diem_lap"
              value={formData.thoi_diem_lap || ""}
              onChange={onInputChange}
              readOnly={isKlLocked}
              className={`border rounded px-2 py-1 text-sm outline-none w-[9.5rem] shrink-0 ${
                isKlLocked ? "bg-gray-100 text-gray-500 cursor-not-allowed" : t.focus
              }`}
            />
          </div>
        </div>

        {quyetDinhSection ? (
          <div className="pt-3 border-t border-gray-100">
            <label className="block text-[11px] font-bold text-red-600 uppercase mb-2">
              {quyetDinhSection.title || "QUYẾT ĐỊNH PHÊ DUYỆT"}
            </label>
            {quyetDinhSection.content}
          </div>
        ) : null}

        {pdfDaKySection ? (
          <div className="pt-3 border-t border-gray-100">
            <label className="block text-[11px] font-bold text-emerald-700 uppercase mb-2">
              PDF ĐÃ KÝ NỘI BỘ
            </label>
            <div className="rounded-xl p-3 space-y-2 border bg-emerald-50/40 border-emerald-100">{pdfDaKySection}</div>
          </div>
        ) : null}

        {exportLinks ? (
          <div className="pt-3 border-t border-gray-100">
            <label className={`block text-[11px] font-bold uppercase mb-2 ${t.exportLabel}`}>
              {exportSectionTitle}
            </label>
            <div className={`rounded-xl p-3 space-y-2 border ${t.exportBox}`}>{exportLinks}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
