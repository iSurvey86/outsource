"use client";

import React from "react";
import { formatHopDongShort, formatHopDongTitleLabel } from "../../lib/formatHopDong";
import {
  formatGiaiDoanBadge,
  formatGiaiDoanFullName,
  getGiaiDoanPhaseWeight,
  inferGiaiDoanFromMaDuAn,
} from "../../lib/giaiDoanOrder";
import {
  buildHopDongOtherCtTree,
  fetchGiaiDoanLinks,
  fetchHopDongBookForProject,
  filterHopDongChain,
  formatGiaTriHopDong,
  getCdtHieuLucInChain,
  HOP_DONG_LOAI,
  HOP_DONG_LY_DO_KY_LAI,
  HOP_DONG_LOAI_THAU_PHU,
  HOP_DONG_TRANG_THAI,
  loaiHopDongLabel,
  loaiThauPhuLabel,
  lyDoKyLaiLabel,
  mergeCdtHopDongChainsForDisplay,
  projectsByMaDuAns,
  resolveHopDongGocId,
  saveHopDongChinh,
  saveHopDongKyLai,
  saveHopDongPhuLucDc,
  saveHopDongThauPhu,
  siblingPhasesForProject,
  suggestMaDuAnFromHopDongScan,
  refineMaDuAnsAfterHopDongScan,
  findMaDuAnsOutsidePhaseSuggestion,
  formatSuggestedPhaseKeysLabel,
  trangThaiHopDongLabel,
  unlinkHopDongFromCongTrinh,
  isPlaceholderSoHopDong,
} from "../../lib/hopDong";
import { bgdGroupKeyForProject } from "../../lib/giaoViecInbox";
import { formatGiaoAShort } from "../../lib/formatGiaoA";
import { useAppDialog } from "../AppDialog";
import {
  formatMoneyInput,
  applyPhuLucCongTrinhToKhoiLuongRows,
  expandMaDuAnsFromPhuLucCongTrinh,
  chiPhiChungLoaiLabel,
  emptyChiPhiChungRow,
  normalizeChiPhiChungRows,
  rowFromThucHien,
  stripMoneyInput,
  sumChiPhiChung,
  sumPhaseGiaTri,
  sumPhanRa,
  syncKhoiLuongRowsWithPhases,
  thucHienPayloadFromRow,
} from "../../lib/hopDongKhoiLuong";
import {
  emptyHopDongNhanSuRow,
  fetchHopDongNhanSu,
  normalizeHopDongNhanSuRows,
  replaceHopDongNhanSu,
} from "../../lib/hopDongNhanSu";
import { fetchThucHienByHopDongIds, numOrNull, upsertThucHien } from "../../lib/hopDongThucHien";
import {
  emptyChietGiamTncttt,
  normalizeChietGiamTncttt,
  resolveChietGiamTnctttPhaseAmount,
  scaleKhoiLuongRowsByTncttt,
  shouldApplyTnctttScale,
} from "../../lib/hopDongTncttt";
import {
  buildHopDongTongMatchReport,
  formatHopDongMatchAlert,
} from "../../lib/hopDongScanMatch";
import HopDongKhoiLuongReviewTable from "./HopDongKhoiLuongReviewTable";
import { logHoatDong } from "../../lib/logger";
import {
  HopDongSoLieuCard,
  ImportHopDongXntvDialog,
  SoLieuHopDongModal,
  useThucHienMap,
} from "./HopDongSoLieuSection";

function autoResizeTextarea(el) {
  if (!el) return;
  el.style.height = "0";
  const next = el.scrollHeight + 4;
  el.style.height = `${next}px`;
  if (el.scrollHeight > next) {
    el.style.height = `${el.scrollHeight + 2}px`;
  }
}

function averageConfidence(values) {
  const valid = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value >= 0 && value <= 100);
  if (!valid.length) return null;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function fieldConfidence(field) {
  const value =
    field && typeof field === "object" && "value" in field ? field.value : field;
  if (value === null || value === undefined || String(value).trim() === "") return null;
  return field && typeof field === "object" ? field.confidence : null;
}

function getScanConfidence(data) {
  const thongTin = averageConfidence([
    fieldConfidence(data.so_hop_dong),
    fieldConfidence(data.hop_dong_day_du),
    fieldConfidence(data.ngay_hop_dong),
  ]);
  const giaTri = averageConfidence([
    fieldConfidence(data.gia_tri_truoc_vat),
    fieldConfidence(data.gia_tri_sau_vat),
  ]);
  const thoiHan = averageConfidence([
    fieldConfidence(data.thoi_han_ngay),
    fieldConfidence(data.moc_bat_dau),
  ]);
  const tongHop = averageConfidence([thongTin, giaTri, thoiHan]);
  return { tongHop, thongTin, giaTri, thoiHan };
}

/** Lấy text từ field AI `{ value }` hoặc chuỗi thô — tránh String(object) = "[object Object]". */
function scanFieldText(field) {
  if (field == null) return "";
  if (typeof field === "object" && "value" in field) return String(field.value ?? "").trim();
  if (typeof field === "object") return "";
  return String(field).trim();
}

/** Cộng số ngày lịch vào ngày yyyy-mm-dd, không phụ thuộc múi giờ trình duyệt. */
function addCalendarDays(dateText, daysText) {
  const match = String(dateText || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const days = Number(daysText);
  if (!match || !Number.isInteger(days) || days < 0) return "";

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Tổng hợp giá trị pháp lý (sau VAT) + nguồn trang sau khi quét AI. */
function ScanMetaPanel({ meta, rowsSumTruocVat, chiPhiChungSum = 0, chietGiam }) {
  if (!meta) return null;
  const truocVat = numOrNull(meta.truocVat);
  const sauVat = numOrNull(meta.sauVat);
  const vatTien = numOrNull(meta.vatTien);
  const rowsSum = numOrNull(rowsSumTruocVat);
  const chungSum = numOrNull(chiPhiChungSum) || 0;

  const chiet = normalizeChietGiamTncttt(chietGiam || meta.chietGiam);
  const match = buildHopDongTongMatchReport({
    rowsSum,
    chiPhiChungSum: chungSum,
    truocVat,
    chietGiam: chiet,
    coverageWarning: meta.thieuGiaiDoanWarning || "",
    likelyMissing: meta.thieuGiaiDoanLikely || "",
  });

  const ng = meta.nguonTrang || {};
  const trangItems = [
    ["Điều khoản", ng.gia_tri_dieu_khoan],
    ["Bảng giá", ng.bang_gia],
    ["Tiến độ", ng.tien_do],
    ["Nhân sự", ng.nhan_su],
  ].filter(([, p]) => p != null && p !== "");

  if (
    sauVat == null &&
    truocVat == null &&
    !trangItems.length &&
    !chiet.co_chiet_giam &&
    match.matched == null
  ) {
    return null;
  }

  const matchBoxClass =
    match.matched === true
      ? "border-teal-200 bg-teal-50/80 text-teal-900"
      : match.matched === false
        ? "border-amber-300 bg-amber-50 text-amber-950"
        : "border-slate-200 bg-slate-50/70 text-slate-700";

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5 space-y-2 text-[12px] text-slate-700">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        {sauVat != null ? (
          <span>
            Giá trị HĐ <span className="font-normal text-slate-500">(sau VAT{meta.vatPct ? ` ${meta.vatPct}%` : ""})</span>:{" "}
            <strong className="text-teal-800 tabular-nums">{formatGiaTriHopDong(sauVat)}</strong>
          </span>
        ) : null}
        {truocVat != null ? (
          <span className="text-slate-500">
            Trước VAT: <span className="tabular-nums">{formatGiaTriHopDong(truocVat)}</span>
          </span>
        ) : null}
        {vatTien != null ? (
          <span className="text-slate-500">
            VAT: <span className="tabular-nums">{formatGiaTriHopDong(vatTien)}</span>
          </span>
        ) : null}
      </div>

      {match.matched != null ? (
        <div className={`rounded-md border px-2.5 py-2 text-[11px] leading-snug ${matchBoxClass}`}>
          <p className="font-bold tracking-wide">{match.title}</p>
          {match.matched === false || match.reason ? (
            <>
              {match.reason ? (
                <p className="mt-1">
                  <span className="font-semibold">Lý do:</span> {match.reason}
                </p>
              ) : null}
              {match.fix ? (
                <p className="mt-0.5">
                  <span className="font-semibold">Cách xử lý:</span> {match.fix}
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-0.5 text-teal-800/90">
              Tổng giai đoạn{chungSum > 0 ? " + chi phí chung" : ""} = trước VAT.
            </p>
          )}
        </div>
      ) : null}

      {meta.vatWarning ? (
        <p className="text-[11px] text-amber-800 leading-snug">{meta.vatWarning}</p>
      ) : null}

      {trangItems.length || meta.thoiHanNgay || meta.nhanSuCount ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
          {trangItems.map(([label, p], i) => (
            <span key={label}>
              {i > 0 ? <span className="mr-3 text-slate-300">·</span> : null}
              {label}: tr.{p}
            </span>
          ))}
          {meta.thoiHanNgay ? (
            <span>
              <span className="mr-3 text-slate-300">·</span>Thời hạn: {meta.thoiHanNgay} ngày
            </span>
          ) : null}
          {meta.nhanSuCount ? (
            <span>
              <span className="mr-3 text-slate-300">·</span>Nhân sự: {meta.nhanSuCount} người
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function HopDongNhanSuReview({ rows, onChange, sourcePage }) {
  const setField = (index, field, value) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };
  const removeRow = (index) => {
    onChange(
      rows
        .filter((_, i) => i !== index)
        .map((row, i) => ({ ...row, stt: i + 1 }))
    );
  };
  const addRow = () => {
    onChange([
      ...rows,
      emptyHopDongNhanSuRow({
        stt: rows.length + 1,
        nguon_trang: Number(sourcePage) > 0 ? Number(sourcePage) : null,
      }),
    ]);
  };

  const inputClass =
    "w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-[12px] text-slate-800 outline-none focus:ring-1 focus:ring-sky-300";

  return (
    <div className="space-y-2">
      {rows.length ? (
        <div className="overflow-x-auto rounded-lg border border-slate-300">
          <table className="w-full min-w-[680px] border-collapse text-[12px]">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-700">
                <th className="w-12 border-b border-r border-slate-300 px-2 py-2 text-center">STT</th>
                <th className="w-[25%] border-b border-r border-slate-300 px-2 py-2 text-center">Họ tên</th>
                <th className="w-[30%] border-b border-r border-slate-300 px-2 py-2 text-center">Chuyên môn</th>
                <th className="border-b border-r border-slate-300 px-2 py-2 text-center">Chức danh trong gói thầu</th>
                <th className="w-12 border-b border-slate-300 px-2 py-2" aria-label="Xóa" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id || `new-${index}`}>
                  <td className="border-b border-r border-slate-300 px-2 py-2 text-center tabular-nums">
                    {index + 1}
                  </td>
                  {["ho_ten", "chuyen_mon", "chuc_danh"].map((field) => (
                    <td key={field} className="border-b border-r border-slate-300 p-1.5">
                      <input
                        className={inputClass}
                        value={row[field] || ""}
                        onChange={(e) => setField(index, field, e.target.value)}
                      />
                    </td>
                  ))}
                  <td className="border-b border-slate-300 px-1 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      className="rounded px-2 py-1 text-red-600 hover:bg-red-50"
                      title="Xóa nhân sự"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={addRow}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
        >
          + Thêm nhân sự
        </button>
        {sourcePage ? (
          <span className="text-[11px] text-slate-500">Nguồn: trang {sourcePage}</span>
        ) : null}
      </div>
    </div>
  );
}

/** Đọc-only nhân sự HĐ trên sổ (không thầu phụ) */
function HopDongNhanSuSoBlock({ supabase, hopDongId, canEdit, onEdit }) {
  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!hopDongId) {
        setRows([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const list = await fetchHopDongNhanSu(supabase, hopDongId);
        if (!cancelled) setRows(list || []);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setRows([]);
          setError(err?.message || "Không tải được danh sách nhân sự.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, hopDongId]);

  return (
    <div className="mt-4 w-full">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-0.5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-800">
          Nhân sự thực hiện
          {!loading && rows.length ? (
            <span className="ml-2 font-semibold normal-case tracking-normal text-teal-700">
              · {rows.length} người
            </span>
          ) : null}
        </p>
        {canEdit && onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="shrink-0 cursor-pointer text-[11px] font-semibold text-sky-700 hover:underline"
            title="Sửa danh sách trong form hợp đồng (mục 6)"
          >
            Sửa trong HĐ
          </button>
        ) : null}
      </div>

      {loading ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-3 py-3 text-xs text-slate-500 italic">
          Đang tải nhân sự…
        </p>
      ) : error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50/70 px-3 py-3 text-xs text-rose-700">
          {error}
        </p>
      ) : !rows.length ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-3 py-3 text-xs text-slate-600 italic">
          Chưa có nhân sự trên HĐ này — Quét AI hoặc nhập ở mục 6 khi sửa hợp đồng.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-teal-100 bg-white shadow-sm shadow-slate-900/5">
          <table className="w-full min-w-[560px] border-collapse text-[12px]">
            <thead>
              <tr className="bg-teal-50 text-[10px] font-bold uppercase tracking-wide text-teal-900">
                <th className="w-12 border-b border-r border-teal-100 px-2.5 py-2 text-center">STT</th>
                <th className="border-b border-r border-teal-100 px-2.5 py-2 text-center">Họ tên</th>
                <th className="border-b border-r border-teal-100 px-2.5 py-2 text-center">Chuyên môn</th>
                <th className="border-b border-teal-100 px-2.5 py-2 text-center">Chức danh trong gói thầu</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id || `ns-${index}`} className="odd:bg-white even:bg-slate-50/60">
                  <td className="border-b border-r border-slate-100 px-2.5 py-2 text-center tabular-nums text-slate-700">
                    {row.stt || index + 1}
                  </td>
                  <td className="border-b border-r border-slate-100 px-2.5 py-2 font-medium text-slate-900">
                    {row.ho_ten || "—"}
                  </td>
                  <td className="border-b border-r border-slate-100 px-2.5 py-2 text-slate-700">
                    {row.chuyen_mon || "—"}
                  </td>
                  <td className="border-b border-slate-100 px-2.5 py-2 text-slate-700">
                    {row.chuc_danh || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Modal lưu HĐ chính / PL-ĐC / thầu phụ vào sổ + chọn phạm vi giai đoạn (M3).
 * mode: "chinh" | "phu_luc_dc" | "thau_phu" | "ky_lai"
 * hopDongGocId: bắt buộc khi tạo PL mới; tuỳ chọn với thầu phụ
 */
export default function UpdateHopDongModal({
  open,
  project,
  allProjects = [],
  canEdit = false,
  onClose,
  onSaved,
  showAlert,
  showConfirm,
  supabase,
  hopDongId = null,
  mode = "chinh",
  hopDongGocId = null,
}) {
  const isPhuLuc = mode === "phu_luc_dc";
  const isThauPhu = mode === "thau_phu";
  const isKyLai = mode === "ky_lai";
  const [file, setFile] = React.useState(null);
  const [scanning, setScanning] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    so_hop_dong: "",
    hop_dong_day_du: "",
    link_pdf: "",
    gia_tri: "",
    ngay_ky: "",
    ben_a: "",
    ben_b: "",
    ly_do_ky_lai: HOP_DONG_LY_DO_KY_LAI.DOI_PHAP_NHAN,
    ghi_chu: "",
    loai_thau_phu: HOP_DONG_LOAI_THAU_PHU.DIA_CHAT,
    thoi_han_ngay: "",
    moc_bat_dau: "",
    ngay_bat_dau: "",
    ngay_het_han_du_kien: "",
    canh_bao_truoc_ngay: "15",
    nguon_trang_tien_do: "",
    chi_phi_chung: [],
    chiet_giam_tncttt: emptyChietGiamTncttt(),
  });
  const [selectedMa, setSelectedMa] = React.useState([]);
  const [pendingConflict, setPendingConflict] = React.useState(null);
  const [loadingInit, setLoadingInit] = React.useState(false);
  const [phaseScanHint, setPhaseScanHint] = React.useState("");
  const [phaseMismatchWarn, setPhaseMismatchWarn] = React.useState("");
  const [scanSuggestedKeys, setScanSuggestedKeys] = React.useState([]);
  const [khoiLuongRows, setKhoiLuongRows] = React.useState([]);
  const [scanMeta, setScanMeta] = React.useState(null);
  const [nhanSuRows, setNhanSuRows] = React.useState([]);
  const [gocLabel, setGocLabel] = React.useState("");
  const [gocOptions, setGocOptions] = React.useState([]);
  const [selectedGocId, setSelectedGocId] = React.useState(hopDongGocId || "");
  const [otherCtQuery, setOtherCtQuery] = React.useState("");
  const [otherCtDetailOpen, setOtherCtDetailOpen] = React.useState(false);
  /** Chỉ hiện khối HĐ khung sau khi quét nhận nhiều CT, hoặc HĐ đã gắn mã ngoài sibling. */
  const [showOtherCtPanel, setShowOtherCtPanel] = React.useState(false);
  const dayDuRef = React.useRef(null);

  const chiPhiChungSum = React.useMemo(
    () => sumChiPhiChung(form.chi_phi_chung),
    [form.chi_phi_chung]
  );
  /** Tổng cột Chiết giảm theo dòng trên bảng rà soát (không dùng so_tien lệch cấp cả HĐ). */
  const chietGiamTongDong = React.useMemo(() => {
    return (khoiLuongRows || [])
      .filter((r) => r.include !== false)
      .reduce((s, r) => {
        const amt = resolveChietGiamTnctttPhaseAmount({
          tongPhanRa: sumPhanRa(r),
          giaTriHd: numOrNull(r.gia_tri_hd),
          chietGiam: form.chiet_giam_tncttt,
        });
        return s + (amt || 0);
      }, 0);
  }, [khoiLuongRows, form.chiet_giam_tncttt]);

  const catalog = allProjects?.length ? allProjects : project ? [project] : [];
  const siblings = React.useMemo(
    () => siblingPhasesForProject(catalog, project),
    [allProjects, project]
  );
  const siblingMaSet = React.useMemo(
    () => new Set(siblings.map((p) => p.ma_du_an)),
    [siblings]
  );
  const extraSelectedProjects = React.useMemo(
    () => projectsByMaDuAns(catalog, selectedMa).filter((p) => !siblingMaSet.has(p.ma_du_an)),
    [catalog, selectedMa, siblingMaSet]
  );
  const extraSelectedCtCount = React.useMemo(() => {
    const keys = new Set();
    for (const p of extraSelectedProjects) {
      keys.add(bgdGroupKeyForProject(p) || p.ma_du_an || p.ten_du_an);
    }
    return keys.size;
  }, [extraSelectedProjects]);
  const otherCtTree = React.useMemo(
    () =>
      buildHopDongOtherCtTree(catalog, {
        query: otherCtQuery,
        excludeMaSet: siblingMaSet,
      }),
    [catalog, otherCtQuery, siblingMaSet]
  );

  const giaiDoanBadge = formatGiaiDoanBadge(project?.giai_doan_chuan || project?.giai_doan);
  const giaiDoanFull = formatGiaiDoanFullName(project?.giai_doan_chuan || project?.giai_doan);

  React.useEffect(() => {
    setForm((prev) => {
      const ngayHetHan = addCalendarDays(prev.ngay_bat_dau, prev.thoi_han_ngay);
      return ngayHetHan && ngayHetHan !== prev.ngay_het_han_du_kien
        ? { ...prev, ngay_het_han_du_kien: ngayHetHan }
        : prev;
    });
  }, [form.ngay_bat_dau, form.thoi_han_ngay]);

  React.useEffect(() => {
    if (!open || !project) return;
    let cancelled = false;

    (async () => {
      setLoadingInit(true);
      setFile(null);
      setPendingConflict(null);
      setPhaseScanHint("");
      setPhaseMismatchWarn("");
      setScanSuggestedKeys([]);
      setKhoiLuongRows([]);
      setScanMeta(null);
      setNhanSuRows([]);
      setGocLabel("");
      setSelectedGocId(hopDongGocId || "");
      setOtherCtQuery("");
      setOtherCtDetailOpen(false);
      setShowOtherCtPanel(false);
      try {
        const list = await fetchHopDongBookForProject(supabase, project, catalog);
        const chinhs = list.filter((h) => h.loai === HOP_DONG_LOAI.CHINH);
        if (!cancelled) setGocOptions(chinhs);

        const emptyForm = {
          so_hop_dong: "",
          hop_dong_day_du: "",
          link_pdf: "",
          gia_tri: "",
          ngay_ky: "",
          ben_a: "",
          ben_b: "",
          ly_do_ky_lai: HOP_DONG_LY_DO_KY_LAI.DOI_PHAP_NHAN,
          ghi_chu: "",
          loai_thau_phu: HOP_DONG_LOAI_THAU_PHU.DIA_CHAT,
          thoi_han_ngay: "",
          moc_bat_dau: "",
          ngay_bat_dau: "",
          ngay_het_han_du_kien: "",
          canh_bao_truoc_ngay: "15",
          nguon_trang_tien_do: "",
          chi_phi_chung: [],
          chiet_giam_tncttt: emptyChietGiamTncttt(),
        };

        if (hopDongId) {
          let hd = list.find((h) => h.id === hopDongId);
          if (!hd) {
            const { data: byId } = await supabase
              .from("HOP_DONG")
              .select("*")
              .eq("id", hopDongId)
              .maybeSingle();
            hd = byId || null;
          }
          if (!cancelled && hd) {
            setForm({
              so_hop_dong: hd.so_hop_dong || "",
              hop_dong_day_du: hd.hop_dong_day_du || "",
              link_pdf: hd.link_pdf || "",
              gia_tri: hd.gia_tri != null ? String(hd.gia_tri) : "",
              ngay_ky: hd.ngay_ky || "",
              ben_a: hd.ben_a || "",
              ben_b: hd.ben_b || "",
              ly_do_ky_lai: hd.ly_do_ky_lai || HOP_DONG_LY_DO_KY_LAI.DOI_PHAP_NHAN,
              ghi_chu: hd.ghi_chu || "",
              loai_thau_phu: hd.loai_thau_phu || HOP_DONG_LOAI_THAU_PHU.DIA_CHAT,
              thoi_han_ngay: hd.thoi_han_ngay != null ? String(hd.thoi_han_ngay) : "",
              moc_bat_dau: hd.moc_bat_dau || "",
              ngay_bat_dau: hd.ngay_bat_dau || hd.ngay_ky || "",
              ngay_het_han_du_kien: hd.ngay_het_han_du_kien || "",
              canh_bao_truoc_ngay:
                hd.canh_bao_truoc_ngay != null ? String(hd.canh_bao_truoc_ngay) : "15",
              nguon_trang_tien_do:
                hd.nguon_trang_tien_do != null ? String(hd.nguon_trang_tien_do) : "",
              chi_phi_chung: normalizeChiPhiChungRows(hd.chi_phi_chung),
              chiet_giam_tncttt: normalizeChietGiamTncttt(hd.chiet_giam_tncttt),
            });
            const links = await fetchGiaiDoanLinks(supabase, [hd.id]);
            let mas = links.map((l) => l.ma_du_an);
            if (!mas.length && (isPhuLuc || isThauPhu)) {
              const gocId = hd.hop_dong_goc_id || hopDongGocId;
              if (gocId) {
                const gocLinks = await fetchGiaiDoanLinks(supabase, [gocId]);
                mas = gocLinks.map((l) => l.ma_du_an);
              }
            }
            setSelectedMa(mas.length ? mas : [project.ma_du_an]);
            const siblingSet = new Set(
              siblingPhasesForProject(catalog, project).map((p) => p.ma_du_an)
            );
            const hasExtraCt = (mas.length ? mas : []).some((ma) => !siblingSet.has(ma));
            if (!cancelled && hasExtraCt) setShowOtherCtPanel(true);
            try {
              const thRows = await fetchThucHienByHopDongIds(supabase, [hd.id]);
              const masFinal = mas.length ? mas : [project.ma_du_an];
              const projectsSel = projectsByMaDuAns(catalog, masFinal);
              const base = syncKhoiLuongRowsWithPhases(
                [],
                projectsSel.length
                  ? projectsSel
                  : [{ ma_du_an: project.ma_du_an, giai_doan: project.giai_doan, ten_du_an: project.ten_du_an }]
              );
              const filled = base.map((r) => {
                const th = (thRows || []).find((t) => t.ma_du_an === r.ma_du_an);
                return th ? rowFromThucHien(th, r) : r;
              });
              if (!cancelled) setKhoiLuongRows(filled);
            } catch {
              /* bảng số liệu chưa có — bỏ qua */
            }
            try {
              const personnel = await fetchHopDongNhanSu(supabase, hd.id);
              if (!cancelled) setNhanSuRows(personnel);
            } catch {
              /* migration nhân sự chưa chạy — bỏ qua để vẫn sửa được HĐ cũ */
            }
            const gocId = hd.hop_dong_goc_id || hopDongGocId;
            if (gocId) {
              setSelectedGocId(gocId);
              const goc = list.find((h) => h.id === gocId);
              if (goc) setGocLabel(formatHopDongShort(goc.so_hop_dong, goc.hop_dong_day_du));
            }
          }
        } else if (isKyLai && hopDongGocId) {
          if (!cancelled) {
            const previous = list.find((h) => h.id === hopDongGocId);
            setForm({
              ...emptyForm,
              so_hop_dong: previous?.so_hop_dong || "",
              ben_a: previous?.ben_a || "",
              ben_b: previous?.ben_b || "",
            });
            if (previous) {
              setGocLabel(formatHopDongShort(previous.so_hop_dong, previous.hop_dong_day_du));
            }
            const previousLinks = await fetchGiaiDoanLinks(supabase, [hopDongGocId]);
            const mas = previousLinks.map((l) => l.ma_du_an);
            setSelectedMa(mas.length ? mas : [project.ma_du_an]);
          }
        } else if (isPhuLuc && hopDongGocId) {
          if (!cancelled) {
            setForm(emptyForm);
            const goc = list.find((h) => h.id === hopDongGocId);
            if (goc) setGocLabel(formatHopDongShort(goc.so_hop_dong, goc.hop_dong_day_du));
            const gocLinks = await fetchGiaiDoanLinks(supabase, [hopDongGocId]);
            const mas = gocLinks.map((l) => l.ma_du_an);
            setSelectedMa(mas.length ? mas : [project.ma_du_an]);
          }
        } else if (isThauPhu) {
          if (!cancelled) {
            setForm(emptyForm);
            const gocId = hopDongGocId || chinhs[0]?.id || "";
            setSelectedGocId(gocId);
            if (gocId) {
              const goc = list.find((h) => h.id === gocId);
              if (goc) setGocLabel(formatHopDongShort(goc.so_hop_dong, goc.hop_dong_day_du));
            }
            setSelectedMa([project.ma_du_an]);
          }
        } else {
          if (!cancelled) {
            setForm({
              ...emptyForm,
              so_hop_dong: project.hop_dong || "",
              hop_dong_day_du: project.hop_dong_day_du || "",
              link_pdf: project.link_pdf_hop_dong || "",
            });
            setSelectedMa([project.ma_du_an]);
          }
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setForm({
            so_hop_dong: project.hop_dong || "",
            hop_dong_day_du: project.hop_dong_day_du || "",
            link_pdf: project.link_pdf_hop_dong || "",
            gia_tri: "",
            ngay_ky: "",
            ben_a: "",
            ben_b: "",
            ly_do_ky_lai: HOP_DONG_LY_DO_KY_LAI.DOI_PHAP_NHAN,
            ghi_chu: "",
            loai_thau_phu: HOP_DONG_LOAI_THAU_PHU.DIA_CHAT,
          });
          setSelectedMa([project.ma_du_an]);
        }
      } finally {
        if (!cancelled) setLoadingInit(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, project, hopDongId, hopDongGocId, isPhuLuc, isThauPhu, isKyLai, supabase]);

  React.useLayoutEffect(() => {
    if (!open || loadingInit) return;
    autoResizeTextarea(dayDuRef.current);
  }, [open, loadingInit, form.hop_dong_day_du]);

  React.useEffect(() => {
    if (!open || loadingInit) return;
    const projectsSel = projectsByMaDuAns(catalog, selectedMa);
    setKhoiLuongRows((prev) => syncKhoiLuongRowsWithPhases(prev, projectsSel));
  }, [open, loadingInit, selectedMa.join("|"), catalog.map((p) => p.ma_du_an).join("|")]);

  if (!open || !project) return null;

  const deny = async () => {
    await showAlert(
      "Tài khoản không được phép cập nhật hợp đồng.\n\nChỉ Admin hoặc người được giao nhiệm vụ nhập/cập nhật Giao A mới thực hiện được."
    );
    onClose?.();
  };

  const toggleMa = (ma) => {
    setSelectedMa((prev) => (prev.includes(ma) ? prev.filter((x) => x !== ma) : [...prev, ma]));
    setPendingConflict(null);
    setPhaseScanHint("");
  };

  const addMas = (mas) => {
    const list = (mas || []).filter(Boolean);
    if (!list.length) return;
    setSelectedMa((prev) => [...new Set([...prev, ...list])]);
    setPendingConflict(null);
    setPhaseScanHint("");
  };

  const removeMas = (mas) => {
    const drop = new Set((mas || []).filter(Boolean));
    if (!drop.size) return;
    setSelectedMa((prev) => prev.filter((ma) => !drop.has(ma)));
    setPendingConflict(null);
    setPhaseScanHint("");
  };

  const selectAll = () => {
    setSelectedMa(siblings.map((p) => p.ma_du_an));
    setPendingConflict(null);
    setPhaseScanHint("");
  };

  const selectCurrentOnly = () => {
    setSelectedMa([project.ma_du_an]);
    setPendingConflict(null);
    setPhaseScanHint("");
  };

  const handleScan = async () => {
    if (!canEdit) {
      await deny();
      return;
    }
    if (!file) {
      await showAlert(
        isThauPhu
          ? "Vui lòng chọn file PDF hợp đồng thầu phụ!"
          : isPhuLuc
            ? "Vui lòng chọn file PDF phụ lục / điều chỉnh!"
            : "Vui lòng chọn file PDF hợp đồng!"
      );
      return;
    }
    setScanning(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/parse-hop-dong", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không quét được hợp đồng.");
      const scanConfidence = getScanConfidence(data);
      const short = scanFieldText(data.so_hop_dong);
      const full = scanFieldText(data.hop_dong_day_du)
        .replace(/dự\s*án\s*[“"«]([^”"»]+)[”"»]/gi, "dự án: $1")
        .replace(/dự\s*án:\s*[“"«]([^”"»]+)[”"»]/gi, "dự án: $1");
      const goiThau = scanFieldText(data.goi_thau);
      const ngayKy = scanFieldText(data.ngay_hop_dong);
      const benA = scanFieldText(data.ben_a);
      const benB = scanFieldText(data.ben_b);
      const thoiHanNgay = scanFieldText(data.thoi_han_ngay);
      const mocBatDau = scanFieldText(data.moc_bat_dau);
      const nguonTrangTienDo =
        Number(data.nguon_trang?.tien_do) > 0 ? String(data.nguon_trang.tien_do) : "";
      setForm((prev) => ({
        ...prev,
        so_hop_dong: short || prev.so_hop_dong,
        hop_dong_day_du: full || prev.hop_dong_day_du,
        ngay_ky: ngayKy || prev.ngay_ky,
        ngay_bat_dau: prev.ngay_bat_dau || ngayKy || prev.ngay_ky,
        ben_a: benA || prev.ben_a,
        ben_b: benB || prev.ben_b,
        thoi_han_ngay: thoiHanNgay || prev.thoi_han_ngay,
        moc_bat_dau: mocBatDau || prev.moc_bat_dau,
        nguon_trang_tien_do: nguonTrangTienDo || prev.nguon_trang_tien_do,
      }));

      // Trích khóa Giao A từ HĐ (theo Quyết định số …) → mặc định chọn DA thuộc QĐ đó.
      // Sau đó siết theo giai đoạn HĐ gợi ý (tránh gắn nhầm khi mở sai giai đoạn).
      const qdThamChieuRaw = scanFieldText(data.qd_giao_a_tham_chieu);
      const qdFromDayDu = (() => {
        const m = full.match(
          /theo\s+Quyết\s+định\s+số\s+(\d+\s*\/\s*Q[ĐđD][^\s,)]+(?:\s+ngày\s+[\d./-]+)?)/i
        );
        return m ? m[1].replace(/\s+/g, " ").trim() : "";
      })();
      const qdKey = qdThamChieuRaw || qdFromDayDu;
      let nextMas = selectedMa;
      let scopeHint = "";
      const scopeText = [goiThau, full, short].filter(Boolean).join("\n");
      if (qdKey) {
        setOtherCtQuery(qdKey);
        const tree = buildHopDongOtherCtTree(catalog, {
          query: qdKey,
          excludeMaSet: new Set(), // gồm cả sibling — chọn đủ phạm vi QĐ
        });
        const fromQd = tree.flatMap((g) => g.maDuAns);
        const merged = [...new Set([project.ma_du_an, ...fromQd].filter(Boolean))];
        if (merged.length) {
          nextMas = merged;
          const siblingSet = new Set(siblings.map((p) => p.ma_du_an));
          const hasExtraCt = merged.some((ma) => !siblingSet.has(ma));
          if (hasExtraCt) setShowOtherCtPanel(true);
          scopeHint = `Đã mặc định chọn mã DA thuộc Giao A «${qdKey}». Kiểm tra và xác nhận lại trước khi lưu.`;
          setPendingConflict(null);
        }
      } else {
        const suggestion = suggestMaDuAnFromHopDongScan(scopeText, siblings);
        nextMas = suggestion?.maDuAns?.length ? suggestion.maDuAns : selectedMa;
        if (suggestion?.hintLabel) scopeHint = suggestion.hintLabel;
        if (suggestion?.maDuAns?.length) setPendingConflict(null);
      }

      // Phụ lục từng TBA → mở rộng đủ CT/giai đoạn trong danh mục (nhà nào về nhà nấy)
      const phuLuc = Array.isArray(data.phu_luc_cong_trinh) ? data.phu_luc_cong_trinh : [];
      let phuLucExpandHint = "";
      if (phuLuc.length) {
        const expanded = expandMaDuAnsFromPhuLucCongTrinh(catalog, phuLuc);
        if (expanded.maDuAns.length) {
          nextMas = [
            ...new Set([project.ma_du_an, ...nextMas, ...expanded.maDuAns].filter(Boolean)),
          ];
          setPendingConflict(null);
          if (expanded.matchedCt >= 2 || phuLuc.length >= 2) setShowOtherCtPanel(true);
          phuLucExpandHint = `Phụ lục B → chọn ${expanded.matchedCt} công trình để phân bổ số liệu${
            expanded.unmatchedPl > 0 ? ` · ${expanded.unmatchedPl} dòng phụ lục chưa khớp tên danh mục` : ""
          }.`;
          scopeHint = scopeHint ? `${scopeHint}\n${phuLucExpandHint}` : phuLucExpandHint;
        } else if (phuLuc.length >= 2) {
          setShowOtherCtPanel(true);
          phuLucExpandHint =
            "Phụ lục có nhiều TBA nhưng chưa khớp được tên trong danh mục — kiểm tra khối HĐ khung / tên công trình.";
          scopeHint = scopeHint ? `${scopeHint}\n${phuLucExpandHint}` : phuLucExpandHint;
        }
      }

      const phaseValsEarly = Array.isArray(data.giai_doan_values) ? data.giai_doan_values : [];
      const refined = refineMaDuAnsAfterHopDongScan({
        candidateMas: nextMas,
        openMaDuAn: project.ma_du_an,
        projects: catalog,
        siblings,
        scopeText,
        giaiDoanValues: phaseValsEarly,
      });
      nextMas = refined.maDuAns.length
        ? refined.maDuAns
        : selectedMa.length
          ? selectedMa
          : [project.ma_du_an].filter(Boolean);
      setSelectedMa(nextMas);
      setScanSuggestedKeys(refined.suggestedKeys || []);
      setPhaseMismatchWarn(refined.warning || "");
      if (qdKey && nextMas.length && !refined.warning) {
        scopeHint =
          scopeHint ||
          `Đã chọn ${nextMas.length} mã DA thuộc Giao A «${qdKey}». Kiểm tra trước khi lưu.`;
      }
      setPhaseScanHint(scopeHint);

      const giaTriHd = scanFieldText(data.gia_tri_hd);
      const giaTriKs = scanFieldText(data.gia_tri_ks);
      const giaTriKsDiaHinh = scanFieldText(data.gia_tri_ks_dia_hinh);
      const giaTriKsDiaChat = scanFieldText(data.gia_tri_ks_dia_chat);
      const giaTriKsKhac = scanFieldText(data.gia_tri_ks_khac);
      const giaTriLap = scanFieldText(data.gia_tri_lap_hs);
      const giaTriCtdt = scanFieldText(data.gia_tri_ctdt);
      const phaseVals = Array.isArray(data.giai_doan_values) ? data.giai_doan_values : [];
      const byBadge = new Map();
      for (const g of phaseVals) {
        const badge = formatGiaiDoanBadge(g.giai_doan);
        if (badge && badge !== "—") byBadge.set(badge, g);
      }
      const projectsSel = projectsByMaDuAns(catalog, nextMas);
      let rows = syncKhoiLuongRowsWithPhases([], projectsSel);
      const badgeCounts = {};
      for (const r of rows) {
        const b = r.phaseBadge || formatGiaiDoanBadge(r.giai_doan);
        badgeCounts[b] = (badgeCounts[b] || 0) + 1;
      }
      // HĐ khung / phụ lục nhiều TBA: không đổ tổng HĐ vào 1 dòng
      const allowSingleRowDump = rows.length === 1 && phuLuc.length < 2;
      rows = rows.map((r) => {
        const b = r.phaseBadge || formatGiaiDoanBadge(r.giai_doan);
        const g = byBadge.get(b);
        // Chỉ đổ tổng theo giai đoạn khi đúng 1 dòng/badge — HĐ khung nhiều CT cùng GD thì để trống để nhập tay từng DA.
        if (g && badgeCounts[b] === 1) {
          return {
            ...r,
            gia_tri_hd: g.gia_tri_hd || r.gia_tri_hd,
            gia_tri_ks: g.gia_tri_ks || r.gia_tri_ks,
            gia_tri_ks_dia_hinh: g.gia_tri_ks_dia_hinh || r.gia_tri_ks_dia_hinh,
            gia_tri_ks_dia_chat: g.gia_tri_ks_dia_chat || r.gia_tri_ks_dia_chat,
            gia_tri_ks_khac: g.gia_tri_ks_khac || r.gia_tri_ks_khac,
            gia_tri_lap_hs: g.gia_tri_lap_hs || r.gia_tri_lap_hs,
            gia_tri_ctdt: g.gia_tri_ctdt || r.gia_tri_ctdt,
            nguonNote: g.nguon_ghi_chu || g.canh_bao || "",
            nguonNoteWarn: Boolean(g.canh_bao && !g.nguon_ghi_chu),
          };
        }
        if (allowSingleRowDump) {
          return {
            ...r,
            gia_tri_hd: giaTriHd || r.gia_tri_hd,
            gia_tri_ks: giaTriKs || r.gia_tri_ks,
            gia_tri_ks_dia_hinh: giaTriKsDiaHinh || r.gia_tri_ks_dia_hinh,
            gia_tri_ks_dia_chat: giaTriKsDiaChat || r.gia_tri_ks_dia_chat,
            gia_tri_ks_khac: giaTriKsKhac || r.gia_tri_ks_khac,
            gia_tri_lap_hs: giaTriLap || r.gia_tri_lap_hs,
            gia_tri_ctdt: giaTriCtdt || r.gia_tri_ctdt,
            nguonNote: data.nguon_ghi_chu || data.canh_bao_gia_tri || "",
            nguonNoteWarn: Boolean(data.canh_bao_gia_tri && !data.nguon_ghi_chu),
          };
        }
        return r;
      });

      let phuLucHint = "";
      let phuLucMatchedLabel = "";
      if (phuLuc.length) {
        if (phuLuc.length >= 2) setShowOtherCtPanel(true);
        const applied = applyPhuLucCongTrinhToKhoiLuongRows(rows, phuLuc);
        rows = applied.rows;
        const ctLabel =
          applied.matchedCt != null
            ? `${applied.matchedCt} CT · ${applied.matched} dòng bảng`
            : `${applied.matched} dòng`;
        phuLucMatchedLabel = `${ctLabel} / ${phuLuc.length} phụ lục`;
        const warnUnmatched =
          applied.unmatched > 0
            ? ` — còn ${applied.unmatched} dòng phụ lục chưa khớp tên TBA (ô đỏ / cảnh báo trên bảng).`
            : "";
        const warnEmpty = rows.some((r) => r.nguonNoteWarn)
          ? " Có giai đoạn chưa nhận được số từ phụ lục — đối chiếu Phụ lục B trước khi lưu."
          : "";
        phuLucHint = `Phụ lục TBA: khớp ${phuLucMatchedLabel}.${warnUnmatched}${warnEmpty} KS chung → Địa hình.`;
        if (!scopeHint) setPhaseScanHint(phuLucHint);
        else setPhaseScanHint(`${scopeHint}\n${phuLucHint}`);
      }

      setKhoiLuongRows(rows);
      let phaseSum = sumPhaseGiaTri(rows);
      const chungFromAi = normalizeChiPhiChungRows(data.chi_phi_chung);
      const chungSumAi = sumChiPhiChung(chungFromAi);
      const truocVat = String(data.gia_tri_truoc_vat?.value || "").trim();
      const sauVat = String(data.gia_tri_sau_vat?.value || "").trim();
      const vatTien = String(data.vat?.value || "").trim();
      const vatPct = String(data.vat_percent?.value || "").trim();
      let chietGiam = normalizeChietGiamTncttt(data.chiet_giam_tncttt);
      // Client fallback: nếu API chưa scale mà tổng CT vẫn là gross khớp công thức TNCTTT
      if (chietGiam.ty_le && shouldApplyTnctttScale(phaseSum, truocVat, chietGiam.ty_le)) {
        const grossBefore = Math.round(phaseSum);
        rows = scaleKhoiLuongRowsByTncttt(rows, chietGiam.ty_le);
        setKhoiLuongRows(rows);
        phaseSum = sumPhaseGiaTri(rows);
        chietGiam = normalizeChietGiamTncttt({
          ...chietGiam,
          so_tien_truoc_giam: chietGiam.so_tien_truoc_giam || grossBefore,
          so_tien:
            chietGiam.so_tien ||
            (numOrNull(truocVat) != null ? Math.round(grossBefore - numOrNull(truocVat)) : null),
          ghi_chu: chietGiam.ghi_chu || `Đã trừ ${chietGiam.ty_le}% TNCTTT chỉ trên cột Giá trị HĐ`,
        });
      }
      setForm((prev) => ({
        ...prev,
        chi_phi_chung: chungFromAi.length ? chungFromAi : prev.chi_phi_chung,
        chiet_giam_tncttt: chietGiam.co_chiet_giam ? chietGiam : prev.chiet_giam_tncttt,
        // Giá trị pháp lý ưu tiên sau VAT / trước VAT trên điều khoản — không lấy tổng bảng CT
        gia_tri: sauVat || truocVat || prev.gia_tri || (phaseSum ? String(phaseSum) : "") || giaTriHd,
      }));
      if (chungFromAi.length) {
        const chungHint = `Chi phí chung: ${chungFromAi.length} mục (${formatGiaTriHopDong(chungSumAi)}).`;
        setPhaseScanHint((prev) => (prev ? `${prev}\n${chungHint}` : chungHint));
      }
      const coverageWarn = String(data.thieu_giai_doan_warning || "").trim();
      const likelyMissing = String(data.thieu_giai_doan_likely || "").trim();
      const matchReport = buildHopDongTongMatchReport({
        rowsSum: phaseSum,
        chiPhiChungSum: chungSumAi,
        truocVat,
        chietGiam,
        coverageWarning: coverageWarn,
        likelyMissing,
      });
      if (matchReport.text) {
        setPhaseScanHint((prev) => (prev ? `${matchReport.text}\n${prev}` : matchReport.text));
      }
      setScanMeta({
        truocVat,
        sauVat,
        vatTien,
        vatPct,
        chietGiam,
        vatWarning: data.gia_tri_sau_vat?.warning || "",
        nguonTrang: data.nguon_trang || null,
        thoiHanNgay: String(data.thoi_han_ngay?.value || "").trim(),
        nhanSuCount: Array.isArray(data.nhan_su) ? data.nhan_su.length : 0,
        phuLucMatched: phuLucMatchedLabel,
        thieuGiaiDoanWarning: coverageWarn,
        thieuGiaiDoanLikely: likelyMissing,
      });
      if (Array.isArray(data.nhan_su) && data.nhan_su.length) {
        setNhanSuRows(
          normalizeHopDongNhanSuRows(data.nhan_su, data.nguon_trang?.nhan_su)
        );
      }

      const warn = data.so_hop_dong?.warning || data.hop_dong_day_du?.warning;
      const qualityWarn = String(data.phu_luc_quality_warning || "").trim();
      const alertExtra = [];
      if (refined.openMismatch && refined.warning) alertExtra.push(refined.warning);
      if (warn) alertExtra.push(String(warn));
      if (qualityWarn) alertExtra.push(qualityWarn);
      if (phuLucHint && /chưa khớp/i.test(phuLucHint)) alertExtra.push(phuLucHint);
      const alertBody = formatHopDongMatchAlert({
        matchReport,
        confidenceTongHop: scanConfidence.tongHop,
        extraLines: alertExtra,
      });

      const softFail =
        Boolean(warn) ||
        matchReport.matched === false ||
        (scanConfidence.tongHop != null && scanConfidence.tongHop <= 15 && !short) ||
        (scanConfidence.tongHop === 0 && !short && !giaTriHd);
      const confLabel =
        scanConfidence.tongHop != null ? ` · tin cậy ${scanConfidence.tongHop}%` : "";
      logHoatDong({
        phanHe: "HOP_DONG",
        hanhDong: softFail ? "AI_SCAN_FAIL" : "AI_SCAN",
        chiTietNgan: softFail
          ? `Quét HĐ kém: ${file.name}${confLabel}${warn ? ` — ${String(warn).slice(0, 120)}` : ""}`
          : `Quét HĐ: ${file.name}${short ? ` → ${short}` : ""}${confLabel}`,
        doiTuongId: project?.ma_du_an || hopDongId,
        trangThai: softFail ? "Cảnh báo" : "Thành công",
        duLieuDong: {
          file_name: file.name,
          file_ext: String(file.name || "").split(".").pop() || "",
          ma_du_an: project?.ma_du_an || "",
          so_hop_dong: short || "",
          confidence: scanConfidence.tongHop,
          warning: warn || qualityWarn || coverageWarn || "",
          match: matchReport.matched,
        },
      });

      if (alertBody)
        await showAlert(alertBody);
      else if (warn)
        await showAlert(`⚠️ ${warn}`);
      else if (giaTriHd || phaseVals.length || phuLuc.length)
        await showAlert("Đã điền tạm từ AI — kiểm tra bảng giá trị trước khi lưu.");
    } catch (err) {
      const msg = err?.message || "Lỗi quét AI.";
      logHoatDong({
        phanHe: "HOP_DONG",
        hanhDong: "AI_SCAN_FAIL",
        chiTietNgan: `Quét HĐ lỗi: ${file?.name || "—"} — ${String(msg).slice(0, 180)}`,
        doiTuongId: project?.ma_du_an || hopDongId,
        trangThai: "Thất bại",
        duLieuDong: {
          file_name: file?.name || "",
          file_ext: String(file?.name || "").split(".").pop() || "",
          ma_du_an: project?.ma_du_an || "",
          error: msg,
        },
      });
      await showAlert(msg);
    } finally {
      setScanning(false);
    }
  };

  const doSave = async (forceOverwrite) => {
    if (!canEdit) {
      await deny();
      return;
    }
    if (!isThauPhu && scanSuggestedKeys.length) {
      const extras = findMaDuAnsOutsidePhaseSuggestion(
        selectedMa,
        catalog,
        scanSuggestedKeys
      );
      if (extras.length) {
        const sug = formatSuggestedPhaseKeysLabel(scanSuggestedKeys);
        const extraLabels = extras
          .map((ma) => {
            const p = catalog.find((x) => x.ma_du_an === ma);
            const badge =
              formatGiaiDoanBadge(p?.giai_doan_chuan || p?.giai_doan) || ma;
            return badge;
          })
          .join(", ");
        const ok = showConfirm
          ? await showConfirm(
              `HĐ gợi ý ${sug} nhưng đang tích thêm giai đoạn: ${extraLabels}.\n\nVẫn lưu với các giai đoạn này?`
            )
          : true;
        if (!ok) return;
      }
    }
    setSaving(true);
    try {
      let fileUrl = null;
      if (file) {
        const timestamp = Date.now();
        const fileExt = file.name.split(".").pop() || "pdf";
        const safeName = String(project.ma_du_an || "da").replace(/[^a-zA-Z0-9]/g, "_");
        const prefix = isThauPhu ? "HopDongTP" : isPhuLuc ? "HopDongPL" : isKyLai ? "HopDongKyLai" : "HopDong";
        const fileName = `${prefix}_${safeName}_${timestamp}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from("pdfs_giao_a").upload(fileName, file);
        if (uploadError) throw new Error("Lỗi tải file lên mây: " + uploadError.message);
        const { data: publicUrlData } = supabase.storage.from("pdfs_giao_a").getPublicUrl(fileName);
        fileUrl = publicUrlData.publicUrl;
      }

      const legalFromRows = isThauPhu ? 0 : sumPhaseGiaTri(khoiLuongRows) + chiPhiChungSum;
      const formPayload = {
        so_hop_dong: form.so_hop_dong,
        hop_dong_day_du: form.hop_dong_day_du,
        link_pdf: form.link_pdf,
        // Ưu tiên giá trị đang nhập (thường là sau VAT từ điều khoản); fallback tổng CT+chung
        gia_tri: form.gia_tri || (legalFromRows ? String(legalFromRows) : ""),
        ngay_ky: form.ngay_ky,
        ben_a: form.ben_a,
        ben_b: form.ben_b,
        ly_do_ky_lai: form.ly_do_ky_lai,
        ghi_chu: form.ghi_chu,
        loai_thau_phu: form.loai_thau_phu,
        thoi_han_ngay: form.thoi_han_ngay,
        moc_bat_dau: form.moc_bat_dau,
        ngay_bat_dau: form.ngay_bat_dau,
        ngay_het_han_du_kien: form.ngay_het_han_du_kien,
        canh_bao_truoc_ngay: form.canh_bao_truoc_ngay,
        nguon_trang_tien_do: form.nguon_trang_tien_do,
        chi_phi_chung: form.chi_phi_chung,
        chiet_giam_tncttt: normalizeChietGiamTncttt({
          ...form.chiet_giam_tncttt,
          so_tien:
            chietGiamTongDong > 0
              ? chietGiamTongDong
              : form.chiet_giam_tncttt?.so_tien,
        }),
      };

      const common = {
        project,
        allProjects: catalog,
        form: formPayload,
        selectedMaDuAns: selectedMa,
        existingId: hopDongId,
        forceOverwrite,
        fileUrl,
      };

      let result;
      if (isKyLai) {
        result = await saveHopDongKyLai(supabase, {
          project,
          form: formPayload,
          selectedMaDuAns: selectedMa,
          hopDongTruocId: hopDongGocId,
          fileUrl,
        });
      } else if (isThauPhu) {
        result = await saveHopDongThauPhu(supabase, {
          ...common,
          hopDongGocId: selectedGocId || hopDongGocId || null,
        });
      } else if (isPhuLuc) {
        result = await saveHopDongPhuLucDc(supabase, { ...common, hopDongGocId });
      } else {
        result = await saveHopDongChinh(supabase, common);
      }

      if (!result.ok && result.conflict) {
        setPendingConflict(result);
        await showAlert(result.alertMessage || result.message);
        return;
      }

      const savedHdId = result.hopDong?.id || hopDongId;
      if (savedHdId && !isThauPhu) {
        for (const row of khoiLuongRows) {
          if (row.include === false || !row.ma_du_an) continue;
          const hasAny =
            numOrNull(row.gia_tri_hd) != null ||
            numOrNull(row.gia_tri_ks) != null ||
            numOrNull(row.gia_tri_lap_hs) != null ||
            numOrNull(row.gia_tri_ctdt) != null ||
            String(row.hien_trang || "").trim();
          if (!hasAny) continue;
          await upsertThucHien(supabase, {
            ...thucHienPayloadFromRow(row, savedHdId),
            ghi_chu: row.ghi_chu || "[nhập từ form HĐ / quét AI]",
          });
        }
      }
      if (savedHdId) {
        await replaceHopDongNhanSu(supabase, savedHdId, nhanSuRows);
      }

      const kind = isThauPhu
        ? "hợp đồng thầu phụ"
        : isKyLai
          ? "hợp đồng ký lại"
        : isPhuLuc
          ? "phụ lục / điều chỉnh"
          : "hợp đồng chính";
      await showAlert(
        forceOverwrite
          ? `Đã ghi đè và lưu ${kind} cho ${result.maDuAns?.length || 0} giai đoạn.`
          : isThauPhu
            ? `Đã lưu ${kind} (${result.maDuAns?.length || 0} giai đoạn). Không ghi đè cột Hợp đồng trên danh sách dự án.`
            : `Đã lưu ${kind} (${result.maDuAns?.length || 0} giai đoạn). Bản hiệu lực trên danh sách dự án đã cập nhật.`
      );
      logHoatDong({
        phanHe: "HOP_DONG",
        hanhDong: hopDongId ? "UPDATE" : "CREATE",
        chiTietNgan: `Lưu ${kind}: ${form.so_hop_dong || "—"} · ${result.maDuAns?.length || 0} CT`,
        doiTuongId: savedHdId || project?.ma_du_an,
        trangThai: "Thành công",
        duLieuDong: {
          ma_du_an: project?.ma_du_an || "",
          so_hop_dong: form.so_hop_dong || "",
          hop_dong_id: savedHdId || null,
          ma_du_ans: result.maDuAns || [],
          force_overwrite: Boolean(forceOverwrite),
          mode: isThauPhu ? "thau_phu" : isKyLai ? "ky_lai" : isPhuLuc ? "phu_luc" : "chinh",
        },
      });
      setPendingConflict(null);
      onSaved?.();
      onClose?.();
    } catch (err) {
      const msg = err?.message || String(err);
      logHoatDong({
        phanHe: "HOP_DONG",
        hanhDong: hopDongId ? "UPDATE" : "CREATE",
        chiTietNgan: `Lưu HĐ lỗi: ${form.so_hop_dong || file?.name || "—"} — ${String(msg).slice(0, 160)}`,
        doiTuongId: project?.ma_du_an || hopDongId,
        trangThai: "Thất bại",
        duLieuDong: {
          ma_du_an: project?.ma_du_an || "",
          so_hop_dong: form.so_hop_dong || "",
          error: msg,
        },
      });
      await showAlert("Lỗi lưu: " + msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => doSave(false);

  const handleForceOverwrite = async () => {
    if (!showConfirm) {
      await doSave(true);
      return;
    }
    const ok = await showConfirm(
      isPhuLuc
        ? "Ghi đè Hợp đồng trên TẤT CẢ giai đoạn đã chọn bằng phụ lục / ĐC đang nhập?\n\nThao tác này thay thế số HĐ / PDF cache trên các giai đoạn đó."
        : "Ghi đè Hợp đồng chính trên TẤT CẢ giai đoạn đã chọn bằng nội dung đang nhập?\n\nThao tác này thay thế số HĐ / PDF cache trên các giai đoạn đó."
    );
    if (ok) await doSave(true);
  };

  const title = isThauPhu
    ? hopDongId
      ? "SỬA HỢP ĐỒNG THẦU PHỤ"
      : "THÊM HỢP ĐỒNG THẦU PHỤ"
    : isPhuLuc
      ? hopDongId
        ? "SỬA PHỤ LỤC / ĐIỀU CHỈNH"
        : "THÊM PHỤ LỤC / ĐIỀU CHỈNH"
      : isKyLai
        ? "KÝ LẠI HỢP ĐỒNG — ĐỔI PHÁP NHÂN"
      : hopDongId
        ? "SỬA HỢP ĐỒNG CHÍNH"
        : "THÊM HỢP ĐỒNG CHÍNH";

  const headerTone = isThauPhu ? "bg-amber-700" : isPhuLuc ? "bg-violet-600" : isKyLai ? "bg-sky-700" : "bg-teal-600";
  const closeHover = isThauPhu ? "hover:bg-amber-800" : isPhuLuc ? "hover:bg-violet-700" : "hover:bg-teal-700";
  const saveBtn = isThauPhu
    ? "bg-amber-700 hover:bg-amber-800"
    : isPhuLuc
      ? "bg-violet-600 hover:bg-violet-700"
      : "bg-teal-600 hover:bg-teal-700";
  const cardBorder = isThauPhu ? "border-amber-100" : isPhuLuc ? "border-violet-100" : "border-teal-100";
  const cardBg = isThauPhu
    ? "bg-gradient-to-br from-amber-50/90 via-white to-orange-50/40"
    : isPhuLuc
      ? "bg-gradient-to-br from-violet-50/90 via-white to-fuchsia-50/40"
      : "bg-gradient-to-br from-teal-50/90 via-white to-emerald-50/40";
  const metaBorder = isThauPhu ? "border-amber-100/80" : isPhuLuc ? "border-violet-100/80" : "border-teal-100/80";
  const metaText = isThauPhu ? "text-amber-900/70" : isPhuLuc ? "text-violet-800/70" : "text-teal-800/70";
  const accentLink = isThauPhu ? "text-amber-800" : isPhuLuc ? "text-violet-700" : "text-teal-700";
  const focusRing = isThauPhu
    ? "focus-within:ring-amber-500 focus-within:border-amber-500"
    : isPhuLuc
      ? "focus-within:ring-violet-500 focus-within:border-violet-500"
      : "focus-within:ring-teal-500 focus-within:border-teal-500";

  // Nhãn bao ngoài dùng font-semibold nên ô nhập phải ghi rõ font-normal để giá trị không bị đậm.
  const thoiHanInputCls =
    "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-[13px] font-normal text-slate-800 outline-none";

  const kindLabel = isThauPhu ? "thầu phụ" : isPhuLuc ? "phụ lục / ĐC" : isKyLai ? "hợp đồng ký lại" : "hợp đồng";
  const metaNote = isThauPhu
    ? "HĐ thầu phụ (địa chất / địa hình…). Không ghi đè cột Hợp đồng trên danh sách dự án."
    : isKyLai
      ? "HĐ chính mới thay thế HĐ trước do đổi pháp nhân / sáp nhập / chuyển chủ đầu tư. HĐ và phụ lục cũ được giữ trong lịch sử."
    : isPhuLuc
      ? "Phụ lục / điều chỉnh. Sau khi lưu, bản này là hiệu lực; HĐ gốc và PL cũ trong chuỗi chuyển sang «đã thay thế»."
      : "";
  const multiCongTrinhWide = khoiLuongRows.some((r) => r.multiCongTrinh) || extraSelectedProjects.length > 0;
  const needsWideValueTable = !isThauPhu && (khoiLuongRows || []).length > 0;
  const modalWidthClass =
    multiCongTrinhWide || needsWideValueTable ? "max-w-7xl" : "max-w-3xl";

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] overflow-y-auto overscroll-contain p-3 sm:p-4">
      <div className="flex min-h-full items-start sm:items-center justify-center py-2 sm:py-4">
        <div className={`bg-white rounded-xl shadow-2xl w-full ${modalWidthClass} max-h-[calc(100dvh-1.5rem)] overflow-hidden flex flex-col my-auto`}>
          <div className={`${headerTone} p-4 flex justify-between items-center text-white shrink-0`}>
            <h3 className="font-bold text-lg">{title}</h3>
            <button type="button" onClick={onClose} className={`${closeHover} p-1.5 rounded-md cursor-pointer`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 space-y-5">
            {loadingInit ? (
              <p className="text-sm text-gray-500 italic">Đang tải…</p>
            ) : (
              <>
                <div className={`rounded-xl border ${cardBorder} ${cardBg} p-4 sm:p-5 shadow-sm`}>
                  <p className="text-center text-[15px] sm:text-base leading-snug font-bold text-slate-900">
                    Dự án: {project.ten_du_an}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                    <span className="font-mono text-xs sm:text-sm text-slate-500 tracking-tight break-all">
                      {project.ma_du_an}
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="text-sm leading-snug font-medium text-slate-900">
                      Giai đoạn: {giaiDoanFull || giaiDoanBadge}
                    </span>
                  </div>
                  {((isPhuLuc || isThauPhu || isKyLai) && gocLabel) || isThauPhu ? (
                    <div className="mt-2 space-y-2">
                      {isThauPhu ? (
                        <label className="block text-xs text-amber-950/80">
                          <span className="font-semibold">Gắn HĐ chính CĐT (tuỳ chọn)</span>
                          <select
                            className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-2.5 py-2 text-sm outline-none"
                            value={selectedGocId || ""}
                            onChange={(e) => {
                              const id = e.target.value;
                              setSelectedGocId(id);
                              const goc = gocOptions.find((h) => h.id === id);
                              setGocLabel(
                                goc ? formatHopDongShort(goc.so_hop_dong, goc.hop_dong_day_du) : ""
                              );
                            }}
                          >
                            <option value="">— Không gắn —</option>
                            {gocOptions.map((h) => (
                              <option key={h.id} value={h.id}>
                                {formatHopDongShort(h.so_hop_dong, h.hop_dong_day_du)}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <p className="text-xs text-violet-900/80 leading-relaxed">
                          {isKyLai ? "Thay thế HĐ trước" : "Gắn với HĐ gốc"}:{" "}
                          <span className="font-semibold">{gocLabel}</span>
                        </p>
                      )}
                    </div>
                  ) : null}
                  {metaNote ? (
                    <p className={`mt-3 text-[11px] ${metaText} leading-relaxed border-t ${metaBorder} pt-2.5`}>
                      {metaNote}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    1. Tải lên PDF / Word {kindLabel}
                  </label>
                  <div className="flex gap-3 flex-wrap">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="flex-1 min-w-[180px] border border-gray-300 p-2.5 rounded-lg text-sm bg-gray-50 outline-none cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={handleScan}
                      disabled={scanning || !file}
                      className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-indigo-700 disabled:bg-indigo-300 cursor-pointer"
                    >
                      {scanning ? "Đang quét…" : "Quét AI"}
                    </button>
                  </div>
                  {form.link_pdf && !file && (
                    <a
                      href={form.link_pdf}
                      target="_blank"
                      rel="noreferrer"
                      className={`inline-block mt-2 text-xs font-bold ${accentLink} hover:underline`}
                    >
                      Xem PDF đã lưu
                    </a>
                  )}
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-bold text-gray-800">2. Thông tin {kindLabel}</p>
                  {isThauPhu && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="block text-xs font-semibold text-gray-700">
                        Loại dịch vụ
                        <select
                          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm bg-white outline-none"
                          value={form.loai_thau_phu}
                          onChange={(e) => setForm({ ...form, loai_thau_phu: e.target.value })}
                        >
                          <option value={HOP_DONG_LOAI_THAU_PHU.DIA_CHAT}>Địa chất</option>
                          <option value={HOP_DONG_LOAI_THAU_PHU.DIA_HINH}>Địa hình</option>
                          <option value={HOP_DONG_LOAI_THAU_PHU.KHAC}>Khác</option>
                        </select>
                      </label>
                      <label className="block text-xs font-semibold text-gray-700">
                        Nhà thầu phụ (Bên B)
                        <input
                          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none"
                          value={form.ben_b}
                          onChange={(e) => setForm({ ...form, ben_b: e.target.value })}
                          placeholder="Tên đơn vị thầu phụ"
                        />
                      </label>
                    </div>
                  )}
                  <div className={`rounded-lg border border-gray-300 bg-white overflow-hidden focus-within:ring-2 ${focusRing}`}>
                    <input
                      className="w-full border-0 bg-transparent px-3 py-3 text-sm font-semibold text-green-800 outline-none placeholder:text-green-700/45"
                      value={form.so_hop_dong}
                      onChange={(e) => {
                        setForm({ ...form, so_hop_dong: e.target.value });
                        setPendingConflict(null);
                      }}
                      placeholder={
                        isThauPhu
                          ? "Vd: 15/2024/HĐKT-Địa chất ngày …"
                          : isPhuLuc
                            ? "Vd: PL01 HĐ 308/2020/HĐTV… ngày …"
                            : "Vd: 308/2020/HĐTV-BDAĐL-KHVT ngày 07/12/2020"
                      }
                    />
                    <div className="mx-3 border-t border-gray-200/80" aria-hidden />
                    <textarea
                      ref={dayDuRef}
                      rows={1}
                      className="w-full min-h-[4.5rem] box-border border-0 bg-transparent px-3 pt-3 pb-3 text-sm leading-relaxed text-justify outline-none overflow-y-hidden resize-none placeholder:text-gray-400"
                      style={{ fieldSizing: "content" }}
                      value={form.hop_dong_day_du}
                      onChange={(e) => {
                        setForm({ ...form, hop_dong_day_du: e.target.value });
                        setPendingConflict(null);
                        autoResizeTextarea(e.target);
                      }}
                      placeholder={
                        isThauPhu
                          ? "Hợp đồng thầu phụ số … ngày … giữa … và … (nội dung dịch vụ…)"
                          : isPhuLuc
                            ? "Phụ lục / điều chỉnh số … ngày … của Hợp đồng số … (nội dung điều chỉnh…)"
                            : "Hợp đồng số … ngày … gói thầu: … dự án: … giữa … và …"
                      }
                    />
                  </div>
                  {isKyLai && (
                    <div className="space-y-3">
                      <label className="block text-xs font-semibold text-gray-700">
                        Lý do ký lại
                        <select
                          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm bg-white outline-none sm:max-w-md"
                          value={form.ly_do_ky_lai}
                          onChange={(e) => setForm({ ...form, ly_do_ky_lai: e.target.value })}
                        >
                          <option value={HOP_DONG_LY_DO_KY_LAI.DOI_PHAP_NHAN}>Đổi pháp nhân</option>
                          <option value={HOP_DONG_LY_DO_KY_LAI.SAP_NHAP}>Sáp nhập</option>
                          <option value={HOP_DONG_LY_DO_KY_LAI.CHUYEN_CHU_DAU_TU}>Chuyển chủ đầu tư</option>
                          <option value={HOP_DONG_LY_DO_KY_LAI.KHAC}>Khác</option>
                        </select>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="block text-xs font-semibold text-gray-700">
                          Bên A / Chủ đầu tư
                          <input
                            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none"
                            value={form.ben_a || ""}
                            onChange={(e) => setForm({ ...form, ben_a: e.target.value })}
                            placeholder="Tên pháp nhân ký hợp đồng"
                          />
                        </label>
                        <label className="block text-xs font-semibold text-gray-700">
                          Bên B / Đơn vị tư vấn
                          <input
                            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none"
                            value={form.ben_b || ""}
                            onChange={(e) => setForm({ ...form, ben_b: e.target.value })}
                            placeholder="Tên pháp nhân ký hợp đồng"
                          />
                        </label>
                      </div>
                    </div>
                  )}
                  {isKyLai ? (
                    <label className="block text-xs font-semibold text-gray-700">
                      Ghi chú thay đổi pháp nhân
                      <textarea
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none resize-y"
                        value={form.ghi_chu || ""}
                        onChange={(e) => setForm({ ...form, ghi_chu: e.target.value })}
                        placeholder="Ví dụ: Ban A sáp nhập vào Ban B từ ngày…"
                      />
                    </label>
                  ) : null}
                  {isThauPhu ? (
                    <div className="flex flex-wrap items-end gap-3">
                      <label className="block text-xs font-semibold text-gray-700">
                        Ngày ký hợp đồng
                        <input
                          type="date"
                          className="mt-1 w-full min-w-[11rem] rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none"
                          value={form.ngay_ky || ""}
                          onChange={(e) => {
                            const ngayKyMoi = e.target.value;
                            setForm({
                              ...form,
                              ngay_ky: ngayKyMoi,
                              ngay_bat_dau:
                                !form.ngay_bat_dau || form.ngay_bat_dau === form.ngay_ky
                                  ? ngayKyMoi
                                  : form.ngay_bat_dau,
                            });
                          }}
                        />
                      </label>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-700 pb-0.5">
                        <span>Giá trị hợp đồng thầu phụ (tuỳ chọn)</span>
                        <span className="text-slate-400">=</span>
                        <input
                          className="w-44 rounded-lg border border-gray-300 px-3 py-2 text-sm text-right outline-none tabular-nums"
                          value={formatMoneyInput(form.gia_tri)}
                          onChange={(e) => setForm({ ...form, gia_tri: stripMoneyInput(e.target.value) })}
                          placeholder="……"
                          inputMode="numeric"
                        />
                        <span className="text-sm font-bold text-slate-700">đ</span>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <label className="block text-sm font-bold text-gray-700">
                      3. Áp dụng giai đoạn <span className="text-red-600">*</span>
                    </label>
                    <div className="flex gap-2 text-xs">
                      <button
                        type="button"
                        onClick={selectCurrentOnly}
                        className={`${accentLink} hover:underline cursor-pointer font-medium`}
                      >
                        Chỉ giai đoạn đang mở
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        type="button"
                        onClick={selectAll}
                        className={`${accentLink} hover:underline cursor-pointer font-medium`}
                      >
                        Tất cả giai đoạn công trình
                      </button>
                    </div>
                  </div>
                  <ul className="flex flex-wrap items-center gap-x-3 gap-y-2 border border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50">
                    {siblings.map((p, idx) => {
                      const checked = selectedMa.includes(p.ma_du_an);
                      const cacheLabel = formatHopDongShort(p.hop_dong, p.hop_dong_day_du);
                      const badge = formatGiaiDoanBadge(p.giai_doan_chuan || p.giai_doan);
                      const fullName = formatGiaiDoanFullName(p.giai_doan_chuan || p.giai_doan);
                      return (
                        <li key={p.ma_du_an} className="flex items-center gap-3">
                          {idx > 0 ? <span className="text-gray-300 select-none">|</span> : null}
                          <label
                            className="flex items-center gap-2 cursor-pointer text-sm whitespace-nowrap"
                            title={`${p.ma_du_an} · HĐ CĐT hiện tại: ${cacheLabel === "-" ? "— (trống)" : cacheLabel}`}
                          >
                            <input
                              type="checkbox"
                              className="cursor-pointer"
                              checked={checked}
                              onChange={() => toggleMa(p.ma_du_an)}
                            />
                            <span className={`font-black ${accentLink}`}>{badge}</span>
                            {fullName ? (
                              <span className="text-slate-600 text-xs">= {fullName}</span>
                            ) : null}
                          </label>
                        </li>
                      );
                    })}
                  </ul>

                  {showOtherCtPanel ? (
                  <div className="mt-3 rounded-lg border border-teal-100 bg-teal-50/40 px-3 py-2.5 space-y-2">
                    <p className="text-xs font-bold text-teal-900">
                      Công trình khác (HĐ khung nhiều công trình)
                    </p>
                    <p className="text-[11px] text-teal-800/80 leading-snug">
                      Tìm theo <span className="font-semibold">số Giao A</span>, tên công trình hoặc mã
                      dự án — chọn cả QĐ / cả CT, rồi bỏ tích giai đoạn HĐ không bao gồm.
                    </p>
                    {extraSelectedProjects.length ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-teal-200 bg-white px-3 py-2">
                        <label className="inline-flex items-center gap-2 text-sm font-semibold text-teal-900 cursor-pointer">
                          <input
                            type="checkbox"
                            className="cursor-pointer"
                            checked
                            onChange={() => {
                              removeMas(extraSelectedProjects.map((p) => p.ma_du_an));
                              setOtherCtDetailOpen(false);
                            }}
                            title="Bỏ toàn bộ công trình / giai đoạn ngoài công trình đang mở"
                          />
                          <span>
                            Đã gắn{" "}
                            <span className="font-black tabular-nums">{extraSelectedCtCount}</span>{" "}
                            công trình ·{" "}
                            <span className="font-black tabular-nums">
                              {extraSelectedProjects.length}
                            </span>{" "}
                            giai đoạn ngoài công trình đang mở
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setOtherCtDetailOpen((v) => !v)}
                          className="text-[11px] font-bold text-teal-700 hover:underline cursor-pointer"
                        >
                          {otherCtDetailOpen ? "Thu gọn" : "Xem / chỉnh chi tiết"}
                        </button>
                      </div>
                    ) : null}
                    {otherCtDetailOpen && extraSelectedProjects.length ? (
                      <ul className="max-h-40 overflow-y-auto space-y-1 rounded-lg border border-teal-100 bg-white p-2 text-[11px]">
                        {extraSelectedProjects.map((p) => {
                          const badge = formatGiaiDoanBadge(p.giai_doan_chuan || p.giai_doan);
                          return (
                            <li key={p.ma_du_an} className="flex items-start justify-between gap-2">
                              <span className="min-w-0 leading-snug text-slate-700">
                                <span className="font-black text-teal-800">{badge}</span>{" "}
                                {p.ten_du_an || p.ma_du_an}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleMa(p.ma_du_an)}
                                className="shrink-0 font-bold text-red-700 hover:underline cursor-pointer"
                              >
                                Bỏ
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                    <input
                      type="search"
                      value={otherCtQuery}
                      onChange={(e) => setOtherCtQuery(e.target.value)}
                      placeholder="Tìm theo Giao A / công trình / mã dự án…"
                      className="w-full rounded-lg border border-teal-200 bg-white px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-teal-400"
                    />
                    {otherCtQuery.trim().length >= 2 ? (
                      otherCtTree.length ? (
                        <ul className="max-h-64 overflow-y-auto space-y-2 rounded-lg border border-teal-100 bg-white p-2">
                          {otherCtTree.map((ga) => {
                            const gaLabel =
                              formatGiaoAShort(ga.qd_giao_a, ga.qd_giao_a_day_du) ||
                              "Chưa có số Giao A";
                            const gaAllSelected = ga.maDuAns.every((ma) => selectedMa.includes(ma));
                            return (
                              <li
                                key={ga.key}
                                className="rounded-lg border border-slate-100 bg-slate-50/80 p-2 space-y-2"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-900 leading-snug">
                                      {gaLabel}
                                    </p>
                                    <p className="text-[10px] text-slate-500 mt-0.5">
                                      {ga.congTrinhCount} công trình · {ga.maCount} mã DA
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (gaAllSelected) removeMas(ga.maDuAns);
                                      else {
                                        addMas(ga.maDuAns);
                                        setOtherCtDetailOpen(false);
                                      }
                                    }}
                                    className={`${accentLink} text-[11px] font-bold hover:underline cursor-pointer shrink-0`}
                                  >
                                    {gaAllSelected ? "Bỏ cả Giao A" : "Chọn cả Giao A"}
                                  </button>
                                </div>
                                <ul className="space-y-2">
                                  {ga.congTrinhs.map((ct) => {
                                    const ctAllSelected = ct.maDuAns.every((ma) =>
                                      selectedMa.includes(ma)
                                    );
                                    return (
                                      <li
                                        key={ct.key}
                                        className="rounded-md border border-white bg-white px-2 py-1.5"
                                      >
                                        <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                                          <p className="text-[11px] font-semibold text-slate-800 leading-snug line-clamp-2 min-w-0 flex-1">
                                            {ct.ten_du_an || "—"}
                                          </p>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              ctAllSelected
                                                ? removeMas(ct.maDuAns)
                                                : addMas(ct.maDuAns)
                                            }
                                            className="text-[10px] font-bold text-teal-700 hover:underline cursor-pointer shrink-0"
                                          >
                                            {ctAllSelected ? "Bỏ CT" : "Chọn cả CT"}
                                          </button>
                                        </div>
                                        <ul className="flex flex-wrap gap-x-3 gap-y-1">
                                          {ct.phases.map((p) => {
                                            const checked = selectedMa.includes(p.ma_du_an);
                                            const badge = formatGiaiDoanBadge(
                                              p.giai_doan_chuan || p.giai_doan
                                            );
                                            return (
                                              <li key={p.ma_du_an}>
                                                <label
                                                  className="inline-flex items-center gap-1.5 cursor-pointer text-[11px]"
                                                  title={p.ma_du_an}
                                                >
                                                  <input
                                                    type="checkbox"
                                                    className="cursor-pointer"
                                                    checked={checked}
                                                    onChange={() => toggleMa(p.ma_du_an)}
                                                  />
                                                  <span className={`font-black ${accentLink}`}>
                                                    {badge}
                                                  </span>
                                                  <span className="text-slate-400 font-mono text-[10px]">
                                                    {p.ma_du_an}
                                                  </span>
                                                </label>
                                              </li>
                                            );
                                          })}
                                        </ul>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="text-[11px] text-amber-800 italic">
                          Không khớp Giao A / công trình / mã DA nào (ngoài công trình đang mở).
                        </p>
                      )
                    ) : (
                      <p className="text-[11px] text-slate-500 italic">
                        Gõ ít nhất 2 ký tự — ưu tiên số Giao A (vd. 67/QĐ hoặc BESS).
                      </p>
                    )}
                  </div>
                  ) : null}

                  {!selectedMa.length && (
                    <p className="mt-1.5 text-xs text-red-600 font-medium">Chọn ít nhất một giai đoạn.</p>
                  )}
                  {phaseMismatchWarn ? (
                    <p className="mt-2 text-xs rounded-lg px-3 py-2 leading-relaxed border whitespace-pre-line text-amber-950 bg-amber-50 border-amber-300 font-medium">
                      {phaseMismatchWarn}
                    </p>
                  ) : null}
                  {phaseScanHint ? (
                    <p
                      className={`mt-2 text-xs rounded-lg px-3 py-2 leading-relaxed border whitespace-pre-line ${
                        isThauPhu
                          ? "text-amber-900/90 bg-amber-50 border-amber-100"
                          : isPhuLuc
                            ? "text-violet-800/90 bg-violet-50 border-violet-100"
                            : "text-teal-800/90 bg-teal-50 border-teal-100"
                      }`}
                    >
                      {phaseScanHint}
                    </p>
                  ) : null}
                </div>

                {!isThauPhu ? (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-gray-700">
                      4. Bảng giá trị hợp đồng — rà soát trước khi lưu <span className="text-red-600">*</span>
                    </p>
                    <HopDongKhoiLuongReviewTable
                      rows={khoiLuongRows}
                      showInclude={false}
                      chietGiam={form.chiet_giam_tncttt}
                      onChange={(next) => {
                        setKhoiLuongRows(next);
                      }}
                    />

                    {(form.chi_phi_chung || []).length > 0 ? (
                    <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 px-3 py-2.5 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-bold text-indigo-950">
                          Chi phí chung của HĐ (không phân bổ theo công trình)
                        </p>
                        <button
                          type="button"
                          className="text-[11px] font-bold text-indigo-700 hover:underline cursor-pointer"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              chi_phi_chung: [...(f.chi_phi_chung || []), emptyChiPhiChungRow()],
                            }))
                          }
                        >
                          + Thêm mục
                        </button>
                      </div>
                      <ul className="space-y-1.5">
                        {(form.chi_phi_chung || []).map((row, idx) => (
                            <li
                              key={row.key || idx}
                              className="flex flex-wrap items-center gap-2 rounded-md border border-indigo-100 bg-white px-2 py-1.5"
                            >
                              <select
                                className="rounded border border-slate-200 px-1.5 py-1 text-[11px] font-semibold text-indigo-900"
                                value={row.loai || "khac"}
                                onChange={(e) => {
                                  const loai = e.target.value;
                                  setForm((f) => {
                                    const next = [...(f.chi_phi_chung || [])];
                                    next[idx] = { ...next[idx], loai };
                                    return { ...f, chi_phi_chung: next };
                                  });
                                }}
                              >
                                <option value="hsmt">{chiPhiChungLoaiLabel("hsmt")}</option>
                                <option value="dich_thuat_hsmt">
                                  {chiPhiChungLoaiLabel("dich_thuat_hsmt")}
                                </option>
                                <option value="khac">{chiPhiChungLoaiLabel("khac")}</option>
                              </select>
                              <input
                                className="min-w-[12rem] flex-1 rounded border border-slate-200 px-2 py-1 text-[12px] text-slate-800"
                                placeholder="Mô tả (vd. Chi phí lập HSMT… × 10 bộ)"
                                value={row.mo_ta || ""}
                                onChange={(e) => {
                                  const mo_ta = e.target.value;
                                  setForm((f) => {
                                    const next = [...(f.chi_phi_chung || [])];
                                    next[idx] = { ...next[idx], mo_ta };
                                    return { ...f, chi_phi_chung: next };
                                  });
                                }}
                              />
                              <input
                                className="w-36 rounded border border-slate-200 px-2 py-1 text-right text-[12px] tabular-nums font-semibold text-slate-900"
                                placeholder="Giá trị"
                                inputMode="numeric"
                                value={formatMoneyInput(row.gia_tri)}
                                onChange={(e) => {
                                  const gia_tri = stripMoneyInput(e.target.value);
                                  setForm((f) => {
                                    const next = [...(f.chi_phi_chung || [])];
                                    next[idx] = { ...next[idx], gia_tri };
                                    return { ...f, chi_phi_chung: next };
                                  });
                                }}
                              />
                              <button
                                type="button"
                                className="text-[11px] font-bold text-red-700 hover:underline cursor-pointer"
                                onClick={() =>
                                  setForm((f) => ({
                                    ...f,
                                    chi_phi_chung: (f.chi_phi_chung || []).filter((_, i) => i !== idx),
                                  }))
                                }
                              >
                                Bỏ
                              </button>
                            </li>
                          ))}
                      </ul>
                      {chiPhiChungSum > 0 ? (
                        <p className="text-[11px] font-bold text-indigo-950 tabular-nums text-right">
                          Tổng chi phí chung: {formatGiaTriHopDong(chiPhiChungSum)}
                        </p>
                      ) : null}
                    </div>
                    ) : null}

                    {(form.chiet_giam_tncttt?.co_chiet_giam ||
                      form.chiet_giam_tncttt?.ty_le ||
                      scanMeta?.chietGiam?.co_chiet_giam ||
                      chietGiamTongDong > 0) && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50/40 px-3 py-2 space-y-2">
                        <p className="text-[11px] font-bold text-amber-950">
                          Chiết giảm TNCTTT — cột trên bảng theo từng công trình; lưu tỷ lệ cùng HĐ
                        </p>
                        <div className="flex flex-wrap items-end gap-2">
                          <label className="text-[11px] text-amber-950">
                            Tỷ lệ %
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={0.1}
                              className="ml-1 w-16 rounded border border-amber-200 px-1.5 py-1 text-right tabular-nums"
                              value={form.chiet_giam_tncttt?.ty_le ?? ""}
                              onChange={(e) => {
                                const ty_le = e.target.value === "" ? null : Number(e.target.value);
                                setForm((f) => ({
                                  ...f,
                                  chiet_giam_tncttt: normalizeChietGiamTncttt({
                                    ...f.chiet_giam_tncttt,
                                    co_chiet_giam: true,
                                    ty_le,
                                  }),
                                }));
                              }}
                            />
                          </label>
                          <label className="text-[11px] text-amber-950">
                            Tổng giảm (các dòng)
                            <input
                              className="ml-1 w-40 rounded border border-amber-200 bg-amber-50/80 px-1.5 py-1 text-right tabular-nums font-semibold text-amber-950"
                              inputMode="numeric"
                              readOnly
                              title="Tự cộng từ cột Chiết giảm TNCTTT trên bảng"
                              value={
                                chietGiamTongDong > 0
                                  ? formatMoneyInput(String(chietGiamTongDong))
                                  : form.chiet_giam_tncttt?.so_tien != null
                                    ? formatMoneyInput(String(form.chiet_giam_tncttt.so_tien))
                                    : ""
                              }
                            />
                          </label>
                          <button
                            type="button"
                            className="text-[11px] font-bold text-amber-900 underline cursor-pointer"
                            onClick={() => {
                              const ty = form.chiet_giam_tncttt?.ty_le;
                              const sum = sumPhaseGiaTri(khoiLuongRows);
                              const legal = numOrNull(scanMeta?.truocVat);
                              if (!ty || !shouldApplyTnctttScale(sum, legal, ty)) {
                                return;
                              }
                              const gross = Math.round(sum);
                              const nextRows = scaleKhoiLuongRowsByTncttt(khoiLuongRows, ty);
                              const tongGiam = nextRows
                                .filter((r) => r.include !== false)
                                .reduce((s, r) => {
                                  const amt = resolveChietGiamTnctttPhaseAmount({
                                    tongPhanRa: sumPhanRa(r),
                                    giaTriHd: numOrNull(r.gia_tri_hd),
                                    chietGiam: { co_chiet_giam: true, ty_le: ty },
                                  });
                                  return s + (amt || 0);
                                }, 0);
                              setKhoiLuongRows(nextRows);
                              setForm((f) => ({
                                ...f,
                                chiet_giam_tncttt: normalizeChietGiamTncttt({
                                  ...f.chiet_giam_tncttt,
                                  so_tien_truoc_giam: gross,
                                  so_tien:
                                    tongGiam > 0
                                      ? tongGiam
                                      : legal != null
                                        ? Math.round(gross - legal)
                                        : f.chiet_giam_tncttt?.so_tien,
                                  ghi_chu: `Đã trừ ${ty}% TNCTTT chỉ trên cột Giá trị HĐ (KS/Lập giữ gross)`,
                                }),
                              }));
                            }}
                          >
                            Áp dụng % lên cột HĐ
                          </button>
                        </div>
                      </div>
                    )}

                    <ScanMetaPanel
                      meta={scanMeta}
                      rowsSumTruocVat={sumPhaseGiaTri(khoiLuongRows)}
                      chiPhiChungSum={chiPhiChungSum}
                      chietGiam={form.chiet_giam_tncttt}
                    />
                  </div>
                ) : null}

                {!isThauPhu ? (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-gray-700">5. Thời hạn hợp đồng</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <label className="block text-xs font-semibold text-gray-700">
                        Ngày ký hợp đồng
                        {isKyLai ? <span className="text-red-600"> *</span> : null}
                        <input
                          type="date"
                          className={thoiHanInputCls}
                          value={form.ngay_ky || ""}
                          onChange={(e) => {
                            const ngayKyMoi = e.target.value;
                            setForm({
                              ...form,
                              ngay_ky: ngayKyMoi,
                              ngay_bat_dau:
                                !form.ngay_bat_dau || form.ngay_bat_dau === form.ngay_ky
                                  ? ngayKyMoi
                                  : form.ngay_bat_dau,
                            });
                          }}
                        />
                      </label>
                      <label className="block text-xs font-semibold text-gray-700">
                        Thời hạn (ngày)
                        <input
                          type="number"
                          min="0"
                          className={thoiHanInputCls}
                          value={form.thoi_han_ngay || ""}
                          onChange={(e) => setForm({ ...form, thoi_han_ngay: e.target.value })}
                        />
                      </label>
                      <label className="block text-xs font-semibold text-gray-700">
                        Cảnh báo trước (ngày)
                        <input
                          type="number"
                          min="0"
                          className={thoiHanInputCls}
                          value={form.canh_bao_truoc_ngay ?? "15"}
                          onChange={(e) =>
                            setForm({ ...form, canh_bao_truoc_ngay: e.target.value })
                          }
                        />
                      </label>
                      <label className="block text-xs font-semibold text-gray-700">
                        Mốc bắt đầu tính thời hạn
                        <input
                          className={thoiHanInputCls}
                          value={form.moc_bat_dau || ""}
                          onChange={(e) => setForm({ ...form, moc_bat_dau: e.target.value })}
                          placeholder="VD: Từ ngày HĐ có hiệu lực"
                        />
                      </label>
                      <label className="block text-xs font-semibold text-gray-700">
                        Ngày bắt đầu thực tế
                        <input
                          type="date"
                          className={thoiHanInputCls}
                          value={form.ngay_bat_dau || ""}
                          onChange={(e) => setForm({ ...form, ngay_bat_dau: e.target.value })}
                        />
                      </label>
                      <label className="block text-xs font-semibold text-gray-700">
                        Ngày hết hạn dự kiến
                        <input
                          type="date"
                          className={thoiHanInputCls}
                          value={form.ngay_het_han_du_kien || ""}
                          onChange={(e) =>
                            setForm({ ...form, ngay_het_han_du_kien: e.target.value })
                          }
                        />
                      </label>
                    </div>
                  </div>
                ) : null}

                {!isThauPhu ? (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-gray-700">
                      6. Nhân sự tham gia thực hiện hợp đồng
                    </p>
                    <HopDongNhanSuReview
                      rows={nhanSuRows}
                      onChange={setNhanSuRows}
                      sourcePage={
                        scanMeta?.nguonTrang?.nhan_su ||
                        nhanSuRows.find((row) => row.nguon_trang)?.nguon_trang
                      }
                    />
                  </div>
                ) : null}

                {pendingConflict?.conflict && !isThauPhu && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 space-y-2">
                    <p className="font-bold">Phát hiện xung đột HĐ giữa các giai đoạn</p>
                    <div className="max-h-40 overflow-y-auto rounded border border-amber-200 bg-white/70 px-2 py-1.5 text-xs whitespace-pre-line leading-relaxed">
                      {pendingConflict.message}
                    </div>
                    <p className="text-[11px] text-amber-900/90 leading-snug">
                      HĐ khung nhiều công trình thường gặp khi một phần giai đoạn đã gắn số HĐ cũ / khác chữ.
                      Nếu nội dung đang nhập là đúng — bấm ghi đè bên dưới.
                    </p>
                    <button
                      type="button"
                      onClick={handleForceOverwrite}
                      disabled={saving || !canEdit}
                      className="w-full sm:w-auto px-4 py-2 rounded-lg font-bold text-white bg-amber-700 hover:bg-amber-800 disabled:opacity-60 cursor-pointer"
                    >
                      Ghi đè tất cả bằng nội dung đang nhập
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="bg-gray-50 p-4 border-t border-gray-200 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg font-bold text-gray-600 border border-gray-300 hover:bg-gray-100 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={
                saving ||
                loadingInit ||
                !selectedMa.length ||
                (isPhuLuc && !hopDongId && !hopDongGocId) ||
                (isKyLai && (!hopDongGocId || !form.ngay_ky))
              }
              className={`w-full sm:w-auto px-6 py-2.5 rounded-lg font-bold text-white ${saveBtn} disabled:opacity-60 cursor-pointer`}
            >
              {saving ? "Đang lưu…" : "Lưu vào sổ HĐ"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M2.5 12S6 5.75 12 5.75 21.5 12 21.5 12 18 18.25 12 18.25 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.75" />
    </svg>
  );
}

function HopDongCard({
  h,
  mas,
  siblings,
  canEdit,
  accent = "teal",
  onEdit,
  extraActions = null,
  showStatus = false,
  soLieuSlot = null,
  /** Ẩn nhãn loại HĐ + số HĐ + link PDF khi tiêu đề chuỗi đã hiển thị */
  hideIdentity = false,
}) {
  const linkedProjects = (siblings || []).filter((p) => (mas || []).includes(p.ma_du_an));
  const congTrinhCount = new Set(
    linkedProjects.map((p) => bgdGroupKeyForProject(p) || p.ten_du_an || p.ma_du_an)
  ).size;
  const phaseLabels = linkedProjects.map((p) => {
    const badge = formatGiaiDoanBadge(p.giai_doan_chuan || p.giai_doan);
    if (congTrinhCount > 1 && p.ten_du_an) {
      const ten = String(p.ten_du_an).trim();
      const short = ten.length > 28 ? `${ten.slice(0, 26)}…` : ten;
      return `${short} · ${badge}`;
    }
    return badge;
  });
  const shortLabel = formatHopDongTitleLabel(h.so_hop_dong, h.hop_dong_day_du, "Hợp đồng", {
    wrapDate: true,
  });
  const fullText = String(h.hop_dong_day_du || "").trim();
  const fullTextEqualsShort =
    fullText.toLowerCase() ===
    String(formatHopDongShort(h.so_hop_dong, h.hop_dong_day_du) || "")
      .trim()
      .toLowerCase();
  const labelColor =
    accent === "violet"
      ? "text-violet-600"
      : accent === "amber"
        ? "text-amber-800"
        : accent === "slate"
          ? "text-slate-500"
          : "text-teal-600";
  const linkColor =
    accent === "violet"
      ? "text-violet-700"
      : accent === "amber"
        ? "text-amber-800"
        : accent === "slate"
          ? "text-slate-600"
          : "text-teal-700";

  return (
    <li className={soLieuSlot ? "py-1" : "rounded-xl border border-slate-200/70 bg-white p-4"}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0 flex-1">
          {hideIdentity ? null : (
            <>
              <p className={`text-[10px] font-bold uppercase ${labelColor} mb-1`}>
                {loaiHopDongLabel(h.loai)}
                {showStatus ? ` · ${trangThaiHopDongLabel(h.trang_thai)}` : null}
              </p>
              <p className="font-bold text-slate-900 text-sm leading-snug whitespace-pre-line text-center">{shortLabel}</p>
            </>
          )}
          {fullText && !fullTextEqualsShort && !soLieuSlot && (
            <p className="mt-1.5 whitespace-pre-line text-justify text-xs italic leading-relaxed text-teal-900/75">
              {fullText}
            </p>
          )}
          {!soLieuSlot && (
            <p className="text-xs text-gray-500 mt-2">
              Áp dụng: {phaseLabels.length ? phaseLabels.join(" · ") : mas.join(", ") || "—"}
            </p>
          )}
          {h.ky_lai_tu_id ? (
            <p className="mt-1 text-xs font-semibold text-sky-800">
              HĐ ký lại · {lyDoKyLaiLabel(h.ly_do_ky_lai)}
              {h.ngay_ky ? ` · ngày ${new Date(`${h.ngay_ky}T00:00:00`).toLocaleDateString("vi-VN")}` : ""}
            </p>
          ) : null}
          {h.loai === HOP_DONG_LOAI.THAU_PHU && (
            <p className="text-xs text-amber-900/80 mt-1">
              {loaiThauPhuLabel(h.loai_thau_phu)}
              {h.ben_b ? ` · ${h.ben_b}` : ""}
              {h.gia_tri != null ? ` · ${formatGiaTriHopDong(h.gia_tri)}` : ""}
            </p>
          )}
          {h.loai !== HOP_DONG_LOAI.THAU_PHU && !soLieuSlot && h.gia_tri != null && (
            <p className="text-xs text-slate-500 mt-1">Giá trị: {formatGiaTriHopDong(h.gia_tri)}</p>
          )}
          {h.link_pdf && !hideIdentity && (
            <a
              href={h.link_pdf}
              target="_blank"
              rel="noreferrer"
              className={`inline-block mt-2 text-xs font-bold ${linkColor} hover:underline`}
            >
              Xem PDF
            </a>
          )}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-2">
          {extraActions}
          {canEdit && onEdit && (
            <button type="button" onClick={onEdit} className={`text-xs font-bold ${linkColor} hover:underline cursor-pointer`}>
              Sửa
            </button>
          )}
        </div>
      </div>
      {soLieuSlot ? <div className="w-full mt-1">{soLieuSlot}</div> : null}
    </li>
  );
}

function HopDongPhaseDataList({
  hopDong,
  gocId,
  maDuAns,
  siblings,
  thucHienByKey,
  xuatByKey = {},
  canEdit,
  onEdit,
  /** Chỉ hiện số liệu của mã DA / giai đoạn đang mở trên workspace. */
  focusMaDuAn = "",
  /** Các bản HĐ trùng số (import tách giai đoạn) — để đọc đúng số liệu theo ma_du_an. */
  relatedHopDongs = [],
}) {
  const focusMa = String(focusMaDuAn || "").trim();

  const lookupHopDongs = React.useMemo(() => {
    const map = new Map();
    for (const hd of [hopDong, ...(relatedHopDongs || [])]) {
      if (hd?.id) map.set(hd.id, hd);
    }
    return [...map.values()];
  }, [hopDong, relatedHopDongs]);

  const resolveThForMa = React.useCallback(
    (ma) => {
      for (const hd of lookupHopDongs) {
        const direct = thucHienByKey[`${hd.id}||${ma}`];
        if (direct) return { th: direct, owner: hd };
      }
      if (gocId) {
        const viaGoc = thucHienByKey[`${gocId}||${ma}`];
        if (viaGoc) {
          const owner = lookupHopDongs.find((h) => h.id === gocId) || hopDong;
          return { th: viaGoc, owner };
        }
      }
      return { th: null, owner: hopDong };
    },
    [lookupHopDongs, thucHienByKey, gocId, hopDong]
  );

  const resolveXuatForMa = React.useCallback(
    (ma, owner) => {
      const list = [];
      const seen = new Set();
      const pushAll = (arr) => {
        for (const x of arr || []) {
          if (!x?.id || seen.has(x.id)) continue;
          seen.add(x.id);
          list.push(x);
        }
      };
      const owners = [owner, ...lookupHopDongs].filter(Boolean);
      const ownerIds = [...new Set(owners.map((h) => h.id).filter(Boolean))];
      for (const id of ownerIds) {
        pushAll(xuatByKey[`${id}||${ma}`]);
      }
      if (!list.length) {
        for (const id of ownerIds) {
          pushAll(xuatByKey[`${id}||`]);
          pushAll(xuatByKey[`${id}||*`]);
        }
      }
      return list;
    },
    [lookupHopDongs, xuatByKey]
  );

  const linked = new Set((maDuAns || []).filter(Boolean));
  const catalogByMa = new Map((siblings || []).map((p) => [p.ma_du_an, p]));

  // Nhà nào về nhà nấy: chỉ mã giai đoạn đang mở (không kéo CT / giai đoạn anh em).
  const scopeMas = focusMa ? [focusMa] : [...linked];

  const phaseRows = scopeMas.map((ma_du_an) => {
    const fromCat = catalogByMa.get(ma_du_an);
    const inferred = inferGiaiDoanFromMaDuAn(ma_du_an);
    return {
      ma_du_an,
      ten_du_an: fromCat?.ten_du_an || "",
      giai_doan: fromCat?.giai_doan_chuan || fromCat?.giai_doan || inferred || "",
      giai_doan_chuan: fromCat?.giai_doan_chuan || inferred || "",
    };
  });

  if (!phaseRows.length) return null;

  return (
    <div className="space-y-4">
      {phaseRows.map((phase) => {
        const { th, owner } = resolveThForMa(phase.ma_du_an);
        const xuatList = resolveXuatForMa(phase.ma_du_an, owner);
        const badge =
          formatGiaiDoanBadge(phase.giai_doan_chuan || phase.giai_doan) || "—";
        const phaseTitle = `Giá trị hợp đồng giai đoạn ${badge}`;
        return (
          <HopDongSoLieuCard
            key={phase.ma_du_an}
            th={th}
            canEdit={canEdit}
            phaseLabel={phaseTitle}
            sectionTitle={phaseTitle}
            xuatList={xuatList}
            chietGiam={owner?.chiet_giam_tncttt ?? hopDong?.chiet_giam_tncttt}
            onEdit={() =>
              onEdit?.({
                hopDong: owner || hopDong,
                maDuAn: phase.ma_du_an,
                phaseLabel: phaseTitle,
              })
            }
          />
        );
      })}
    </div>
  );
}

/** Panel sổ HĐ trong workspace */
export function HopDongSoPanel({
  project,
  allProjects = [],
  canEdit = false,
  /** Chỉ Admin — nút Import Excel số liệu */
  canImportExcel = false,
  onBack,
  onOpenEditor,
  supabase,
  refreshKey = 0,
}) {
  const { showAlert, showConfirm } = useAppDialog();
  const [rows, setRows] = React.useState([]);
  const [linksByHd, setLinksByHd] = React.useState({});
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [soLieuRefresh, setSoLieuRefresh] = React.useState(0);
  const [importOpen, setImportOpen] = React.useState(false);
  const [soLieuEdit, setSoLieuEdit] = React.useState(null);
  const [unlinkingId, setUnlinkingId] = React.useState("");

  const load = React.useCallback(async () => {
    if (!project) return;
    setLoading(true);
    setError("");
    try {
      const list = await fetchHopDongBookForProject(
        supabase,
        project,
        allProjects?.length ? allProjects : [project]
      );
      setRows(list);
      const links = await fetchGiaiDoanLinks(
        supabase,
        list.map((h) => h.id)
      );
      const map = {};
      for (const l of links) {
        if (!map[l.hop_dong_id]) map[l.hop_dong_id] = [];
        map[l.hop_dong_id].push(l.ma_du_an);
      }
      setLinksByHd(map);
      setSoLieuRefresh((n) => n + 1);
    } catch (err) {
      console.error(err);
      setError(
        err?.message?.includes("HOP_DONG") || err?.code === "42P01"
          ? "Chưa tạo bảng sổ Hợp đồng trên Supabase. Chạy scripts/sql/create-hop-dong.sql."
          : err.message || "Không tải được sổ hợp đồng."
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [project, allProjects, supabase]);

  const handleUnlinkFromCongTrinh = React.useCallback(
    async (hopDong) => {
      if (!hopDong?.id || !project) return;
      const label = formatHopDongShort(hopDong.so_hop_dong, hopDong.hop_dong_day_du);
      const isPlaceholder = isPlaceholderSoHopDong(hopDong.so_hop_dong);
      const ok = await showConfirm(
        isPlaceholder
          ? `«${label}» là bản ghi tạm (import). Gỡ khỏi công trình này và xóa hẳn nếu không còn gắn dự án khác.`
          : `Gỡ «${label}» khỏi công trình đang mở.\nChỉ xóa liên kết giai đoạn và số liệu gắn mã của công trình này — không xóa hẳn bản ghi hợp đồng (nếu còn gắn dự án khác).`,
        {
          title: isPlaceholder ? "Gỡ bản ghi thừa?" : "Gỡ hợp đồng khỏi sổ công trình này?",
          variant: "error",
          confirmLabel: isPlaceholder ? "Gỡ bản ghi thừa" : "Gỡ khỏi sổ",
          cancelLabel: "Hủy",
        }
      );
      if (!ok) return;
      setUnlinkingId(hopDong.id);
      try {
        await unlinkHopDongFromCongTrinh(supabase, {
          hopDongId: hopDong.id,
          project,
          allProjects: allProjects?.length ? allProjects : [project],
        });
        await load();
        await showAlert(`Đã gỡ «${label}» khỏi sổ công trình này.`, {
          title: "Đã gỡ",
          variant: "success",
        });
      } catch (err) {
        console.error(err);
        await showAlert(err?.message || "Không gỡ được hợp đồng khỏi sổ.", {
          title: "Gỡ thất bại",
          variant: "error",
        });
      } finally {
        setUnlinkingId("");
      }
    },
    [project, allProjects, supabase, load, showConfirm, showAlert]
  );

  React.useEffect(() => {
    load();
  }, [load, refreshKey]);

  const { byKey: thucHienByKey, xuatByKey, error: thucHienErr } = useThucHienMap(
    supabase,
    rows.map((h) => h.id),
    soLieuRefresh
  );

  const catalog = allProjects?.length ? allProjects : [project];
  const siblings = siblingPhasesForProject(catalog, project);

  const chinhRows = rows.filter((h) => h.loai === HOP_DONG_LOAI.CHINH);
  const thauPhu = rows.filter((h) => h.loai === HOP_DONG_LOAI.THAU_PHU);

  const chains = React.useMemo(() => {
    const chinhById = new Map(chinhRows.map((h) => [h.id, h]));
    const replacedRoots = new Set(chinhRows.map((h) => h.ky_lai_tu_id).filter(Boolean));
    const currentRoots = chinhRows.filter((h) => !replacedRoots.has(h.id));

    const rawChains = currentRoots.map((currentRoot) => {
      const gocId = currentRoot.id;
      const chain = filterHopDongChain(rows, gocId);
      const goc = chain.find((h) => h.id === gocId);
      const hieuLuc = getCdtHieuLucInChain(chain);
      const plList = chain
        .filter((h) => h.loai === HOP_DONG_LOAI.PHU_LUC_DC)
        .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
      const currentHistory = chain
        .filter((h) => h.id !== hieuLuc?.id)
        .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));

      const priorRows = [];
      let previousId = currentRoot.ky_lai_tu_id;
      const visited = new Set();
      while (previousId && !visited.has(previousId)) {
        visited.add(previousId);
        const previous = chinhById.get(previousId);
        if (!previous) break;
        priorRows.push(previous, ...filterHopDongChain(rows, previous.id).filter((h) => h.id !== previous.id));
        previousId = previous.ky_lai_tu_id;
      }

      const history = [...currentHistory, ...priorRows].sort((a, b) =>
        String(b.updated_at || "").localeCompare(String(a.updated_at || ""))
      );
      return { gocId, goc, hieuLuc, plList, history, chain };
    });

    return mergeCdtHopDongChainsForDisplay(rawChains, linksByHd, project?.ma_du_an || "");
  }, [rows, chinhRows, linksByHd, project?.ma_du_an]);

  /** Phạm vi giai đoạn của HĐ tư vấn CĐT hiệu lực (ưu tiên chuỗi gắn mã DA đang mở) */
  const loaiHopDongLabelHeader = React.useMemo(() => {
    if (!chains.length) return "Chưa có HĐ";
    const maHienTai = project?.ma_du_an;
    let mas = [];
    for (const c of chains) {
      if (!c.hieuLuc) continue;
      const linked = linksByHd[c.hieuLuc.id] || linksByHd[c.gocId] || [];
      if (maHienTai && linked.includes(maHienTai)) {
        mas = linked;
        break;
      }
    }
    if (!mas.length) {
      const c0 = chains.find((c) => c.hieuLuc) || chains[0];
      mas = linksByHd[c0?.hieuLuc?.id] || linksByHd[c0?.gocId] || [];
    }
    const uniqueMas = [...new Set((mas || []).filter(Boolean))];
    if (!uniqueMas.length) return "Chưa gắn giai đoạn";

    const phaseWeight = new Map();
    const congTrinhKeys = new Set();
    for (const ma of uniqueMas) {
      const p = catalog.find((x) => x.ma_du_an === ma) || siblings.find((x) => x.ma_du_an === ma);
      if (p) congTrinhKeys.add(bgdGroupKeyForProject(p) || p.ten_du_an || ma);
      const gd = p?.giai_doan_chuan || p?.giai_doan || inferGiaiDoanFromMaDuAn(ma);
      const badge = formatGiaiDoanBadge(gd);
      if (badge && badge !== "—" && !phaseWeight.has(badge)) {
        phaseWeight.set(badge, getGiaiDoanPhaseWeight(gd));
      }
    }
    const phases = [...phaseWeight.entries()].sort((a, b) => a[1] - b[1]).map(([badge]) => badge);
    const ctCount = congTrinhKeys.size;
    const countLabel =
      ctCount > 1
        ? `${uniqueMas.length} giai đoạn · ${ctCount} công trình`
        : uniqueMas.length === 1
          ? "1 giai đoạn"
          : `${uniqueMas.length} giai đoạn`;
    return phases.length ? `${countLabel} (${phases.join(" + ")})` : countLabel;
  }, [chains, linksByHd, project?.ma_du_an, siblings, catalog]);

  return (
    <div className="max-w-5xl mx-auto w-full">
      <header className="mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-teal-800 via-teal-700 to-emerald-600 shadow-lg shadow-teal-900/15">
        <div className="flex flex-wrap items-start justify-between gap-4 px-4 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-black uppercase tracking-widest text-white sm:text-lg">
              Sổ hợp đồng
            </h2>
            <p className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm leading-snug text-teal-50/80">
              <span>
                Dự án:{" "}
                <span className="font-semibold text-white">{project?.ten_du_an}</span>
              </span>
              <span>
                Giai đoạn:{" "}
                <span className="font-semibold text-amber-200">
                  {formatGiaiDoanBadge(project?.giai_doan_chuan || project?.giai_doan) || "—"}
                </span>
              </span>
            </p>
            <p className="mt-1 text-sm leading-snug text-teal-50/80">
              Loại hợp đồng:{" "}
              <span className="font-semibold text-amber-200">{loaiHopDongLabelHeader}</span>
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-bold text-white ring-1 ring-inset ring-white/25 transition hover:bg-white/20"
              title="Về tổng quan công trình"
            >
              <span aria-hidden>←</span>
              Quay lại
            </button>
            {canEdit && (
              <>
                <button
                  type="button"
                  onClick={() => onOpenEditor?.(null, { mode: "chinh" })}
                  className="inline-flex cursor-pointer items-center rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-teal-800 shadow-sm transition hover:bg-teal-50"
                >
                  + HĐ chính
                </button>
                <button
                  type="button"
                  onClick={() => onOpenEditor?.(null, { mode: "thau_phu" })}
                  className="inline-flex cursor-pointer items-center rounded-lg bg-amber-400 px-2.5 py-1.5 text-xs font-bold text-amber-950 shadow-sm transition hover:bg-amber-300"
                >
                  + HĐ thầu phụ
                </button>
                {canImportExcel ? (
                  <button
                    type="button"
                    onClick={() => setImportOpen(true)}
                    className="inline-flex cursor-pointer items-center rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-bold text-white ring-1 ring-inset ring-white/25 transition hover:bg-white/20"
                    title="Import Tổng hợp doanh thu (Excel) — chỉ Admin"
                  >
                    Import Excel
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>
      </header>

      {thucHienErr ? (
        <p className="mb-3 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          {thucHienErr}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-gray-500 italic">Đang tải sổ…</p>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      ) : (
        <div className="space-y-8">
          <section className="space-y-4">
            <h3 className="flex items-center gap-2.5 border-b border-teal-200/70 pb-2 text-sm font-black tracking-wide text-teal-900">
              <span aria-hidden className="h-4 w-1.5 rounded-full bg-teal-600" />
              I. Hợp đồng Tư vấn - CĐT
            </h3>

            {chains.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-teal-300 bg-white/70 p-6 text-center">
                <p className="text-sm text-gray-500 mb-3">Chưa có hợp đồng tư vấn với CĐT trong sổ.</p>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => onOpenEditor?.(null, { mode: "chinh" })}
                    className="text-sm font-bold text-teal-700 hover:text-teal-900 hover:underline cursor-pointer"
                  >
                    « Nhập hợp đồng »
                  </button>
                )}
              </div>
            ) : (
              chains.map(({ gocId, goc, hieuLuc, plList, history, mergedMaDuAns, relatedHopDongs }, idx) => {
                const hieuLucMas =
                  mergedMaDuAns || linksByHd[hieuLuc?.id] || linksByHd[gocId] || [];
                const isPlHieuLuc = hieuLuc?.loai === HOP_DONG_LOAI.PHU_LUC_DC;
                const stt = idx + 1;

                return (
                  <div
                    key={gocId}
                    className="space-y-4 rounded-2xl border border-white/60 bg-white p-4 shadow-sm shadow-slate-900/5 ring-1 ring-slate-900/5 sm:p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="flex min-w-0 items-start gap-2 text-sm font-bold text-teal-900">
                        <span className="min-w-0">
                          <span className="mr-1 tabular-nums">{stt}.</span>
                          <span className="inline-block font-semibold text-slate-800 whitespace-pre-line text-center align-top">
                            {formatHopDongTitleLabel(goc?.so_hop_dong, goc?.hop_dong_day_du, "Hợp đồng", {
                              wrapDate: true,
                            })}
                          </span>
                          {isPlaceholderSoHopDong(hieuLuc?.so_hop_dong || goc?.so_hop_dong) ? (
                            <span className="ml-1 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-800 align-top">
                              Tạm / thừa
                            </span>
                          ) : null}
                        </span>
                        {hieuLuc?.link_pdf || goc?.link_pdf ? (
                          <a
                            href={hieuLuc?.link_pdf || goc?.link_pdf}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex shrink-0 items-center gap-1 rounded border-b border-transparent text-[11px] font-bold uppercase tracking-wide text-red-700 transition hover:border-red-800 hover:text-red-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-1"
                            title="Xem bản PDF hợp đồng"
                          >
                            <EyeIcon />
                            <span>PDF</span>
                          </a>
                        ) : null}
                      </h4>
                      {canEdit && (
                        <div className="flex flex-wrap items-center gap-2">
                          {!isPlaceholderSoHopDong(hieuLuc?.so_hop_dong || goc?.so_hop_dong) ? (
                            <>
                              <button
                                type="button"
                                onClick={() => onOpenEditor?.(null, { mode: "phu_luc_dc", gocId })}
                                className="px-2.5 py-1 rounded-md bg-violet-600 text-white text-[11px] font-bold hover:bg-violet-700 cursor-pointer"
                              >
                                + PL / ĐC
                              </button>
                              <button
                                type="button"
                                onClick={() => onOpenEditor?.(null, { mode: "ky_lai", gocId })}
                                className="px-2.5 py-1 rounded-md bg-sky-700 text-white text-[11px] font-bold hover:bg-sky-800 cursor-pointer"
                                title="Ký HĐ chính mới do đổi pháp nhân / sáp nhập / chuyển CĐT"
                              >
                                Ký lại HĐ
                              </button>
                              {hieuLuc ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onOpenEditor?.(hieuLuc.id, {
                                      mode: isPlHieuLuc ? "phu_luc_dc" : "chinh",
                                      gocId: resolveHopDongGocId(hieuLuc),
                                    })
                                  }
                                  className="px-2.5 py-1 rounded-md bg-teal-700 text-white text-[11px] font-bold hover:bg-teal-800 cursor-pointer"
                                >
                                  Sửa
                                </button>
                              ) : null}
                            </>
                          ) : null}
                          {hieuLuc ? (
                            <button
                              type="button"
                              disabled={unlinkingId === hieuLuc.id}
                              onClick={() => handleUnlinkFromCongTrinh(hieuLuc)}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-bold text-white disabled:opacity-60 cursor-pointer ${
                                isPlaceholderSoHopDong(hieuLuc.so_hop_dong)
                                  ? "bg-rose-600 hover:bg-rose-700 ring-2 ring-rose-300"
                                  : "bg-rose-700 hover:bg-rose-800"
                              }`}
                              title={
                                isPlaceholderSoHopDong(hieuLuc.so_hop_dong)
                                  ? "Gỡ và xóa bản ghi tạm «Chưa ký HĐ» khỏi sổ"
                                  : "Gỡ HĐ khỏi sổ công trình đang mở (không xóa hẳn bản ghi)"
                              }
                            >
                              {unlinkingId === hieuLuc.id
                                ? "Đang gỡ…"
                                : isPlaceholderSoHopDong(hieuLuc.so_hop_dong)
                                  ? "Gỡ bản ghi thừa"
                                  : "Gỡ khỏi sổ"}
                            </button>
                          ) : null}
                        </div>
                      )}
                    </div>

                    {isPlaceholderSoHopDong(hieuLuc?.so_hop_dong || goc?.so_hop_dong) ? (
                      <p className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-900">
                        Đây là dòng tạm từ Excel/import («Chưa ký HĐ»), không phải hợp đồng đã ký. Sau khi đã có HĐ
                        thật (scan/nhập số), bấm <strong>Gỡ bản ghi thừa</strong>.
                      </p>
                    ) : null}

                    <div>
                      {hieuLuc ? (
                        <>
                          <ul className="space-y-3">
                            <HopDongCard
                              h={hieuLuc}
                              mas={hieuLucMas}
                              siblings={catalog}
                              canEdit={false}
                              accent={isPlHieuLuc ? "violet" : "teal"}
                              hideIdentity
                              soLieuSlot={
                                hieuLucMas.length ? (
                                  <HopDongPhaseDataList
                                    hopDong={hieuLuc}
                                    gocId={gocId}
                                    maDuAns={
                                      project?.ma_du_an
                                        ? [project.ma_du_an]
                                        : hieuLucMas
                                    }
                                    siblings={catalog}
                                    thucHienByKey={thucHienByKey}
                                    xuatByKey={xuatByKey}
                                    canEdit={canEdit}
                                    onEdit={setSoLieuEdit}
                                    focusMaDuAn={project?.ma_du_an || ""}
                                    relatedHopDongs={relatedHopDongs || []}
                                  />
                                ) : null
                              }
                            />
                          </ul>
                          <HopDongNhanSuSoBlock
                            supabase={supabase}
                            hopDongId={hieuLuc.id}
                            canEdit={canEdit}
                            onEdit={() =>
                              onOpenEditor?.(hieuLuc.id, {
                                mode: isPlHieuLuc ? "phu_luc_dc" : "chinh",
                                gocId: resolveHopDongGocId(hieuLuc),
                              })
                            }
                          />
                        </>
                      ) : (
                        <p className="text-sm text-gray-500 italic">Không có bản hiệu lực trong chuỗi.</p>
                      )}
                    </div>

                    {plList.length > 0 && (
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wide text-violet-700 mb-2">
                          Phụ lục / điều chỉnh ({plList.length})
                        </p>
                        <ul className="space-y-3">
                          {plList.map((h) => (
                            <HopDongCard
                              key={h.id}
                              h={h}
                              mas={linksByHd[h.id] || []}
                              siblings={catalog}
                              canEdit={canEdit}
                              accent={h.trang_thai === HOP_DONG_TRANG_THAI.HIEU_LUC ? "violet" : "slate"}
                              showStatus
                              onEdit={() =>
                                onOpenEditor?.(h.id, { mode: "phu_luc_dc", gocId: h.hop_dong_goc_id || gocId })
                              }
                            />
                          ))}
                        </ul>
                      </div>
                    )}

                    {history.length > 0 && (
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">
                          Lịch sử (đã thay thế / hết hiệu lực)
                        </p>
                        <ul className="space-y-2">
                          {history.map((h) => (
                            <li
                              key={h.id}
                              className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600 flex flex-wrap items-center justify-between gap-2"
                            >
                              <span>
                                <span className="font-bold">{loaiHopDongLabel(h.loai)}</span>
                                {" — "}
                                {formatHopDongShort(h.so_hop_dong, h.hop_dong_day_du)}
                                {" · "}
                                {trangThaiHopDongLabel(h.trang_thai)}
                                {chinhRows.find((next) => next.ky_lai_tu_id === h.id) ? (
                                  <>
                                    {" · "}
                                    <span className="font-semibold text-sky-700">
                                      Ký lại do{" "}
                                      {lyDoKyLaiLabel(
                                        chinhRows.find((next) => next.ky_lai_tu_id === h.id)?.ly_do_ky_lai
                                      ).toLowerCase()}
                                    </span>
                                  </>
                                ) : null}
                              </span>
                              <span className="flex items-center gap-3">
                                {h.link_pdf ? (
                                  <a
                                    href={h.link_pdf}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-bold text-slate-600 hover:underline"
                                  >
                                    PDF
                                  </a>
                                ) : null}
                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onOpenEditor?.(h.id, {
                                        mode: h.loai === HOP_DONG_LOAI.PHU_LUC_DC ? "phu_luc_dc" : "chinh",
                                        gocId: resolveHopDongGocId(h) || gocId,
                                      })
                                    }
                                    className="font-bold text-teal-700 hover:underline cursor-pointer"
                                  >
                                    Sửa
                                  </button>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </section>

          <section>
            <h3 className="mb-3 flex items-center gap-2.5 border-b border-amber-200/70 pb-2 text-sm font-black tracking-wide text-amber-900">
              <span aria-hidden className="h-4 w-1.5 rounded-full bg-amber-500" />
              II. Hợp đồng thầu phụ
            </h3>
            {thauPhu.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-amber-300 bg-white/70 p-5 text-center">
                <p className="text-sm text-gray-500">Chưa có hợp đồng thầu phụ trong sổ.</p>
                <p className="text-[11px] text-slate-400 mt-2 mb-3">
                  Không hiển thị ở cột Hợp đồng trên Quản lý dự án.
                </p>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => onOpenEditor?.(null, { mode: "thau_phu" })}
                    className="text-sm font-bold text-amber-800 hover:text-amber-950 hover:underline cursor-pointer"
                  >
                    « Nhập hợp đồng »
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {thauPhu.map((h, idx) => (
                  <div key={h.id} className="space-y-1">
                    <p className="text-xs font-bold text-amber-900/80 px-0.5">{idx + 1}.</p>
                    <ul>
                      <HopDongCard
                        h={h}
                        mas={linksByHd[h.id] || []}
                        siblings={catalog}
                        canEdit={canEdit}
                        accent="amber"
                        showStatus
                        onEdit={() =>
                          onOpenEditor?.(h.id, {
                            mode: "thau_phu",
                            gocId: h.hop_dong_goc_id || null,
                          })
                        }
                        extraActions={
                          canEdit ? (
                            <button
                              type="button"
                              disabled={unlinkingId === h.id}
                              onClick={() => handleUnlinkFromCongTrinh(h)}
                              className="text-xs font-bold text-rose-700 hover:underline disabled:opacity-60 cursor-pointer"
                              title="Gỡ HĐ khỏi sổ công trình đang mở"
                            >
                              {unlinkingId === h.id ? "Đang gỡ…" : "Gỡ khỏi sổ"}
                            </button>
                          ) : null
                        }
                      />
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {canImportExcel ? (
        <ImportHopDongXntvDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
          supabase={supabase}
          project={project}
          onDone={() => {
            setSoLieuRefresh((n) => n + 1);
            load();
          }}
        />
      ) : null}

      <SoLieuHopDongModal
        open={Boolean(soLieuEdit)}
        onClose={() => setSoLieuEdit(null)}
        supabase={supabase}
        hopDong={soLieuEdit?.hopDong}
        maDuAn={soLieuEdit?.maDuAn}
        phaseLabel={soLieuEdit?.phaseLabel}
        onSaved={() => setSoLieuRefresh((n) => n + 1)}
      />
    </div>
  );
}
