"use client";

import React from "react";
import { bgdGroupKeyForProject } from "../../lib/giaoViecInbox";
import { formatGiaiDoanBadge } from "../../lib/giaiDoanOrder";
import { formatGiaTriHopDong } from "../../lib/hopDong";
import { formatNgayVi } from "../../lib/formatNgay";
import {
  DEFAULT_IMPORT_TEMPLATE_PATH,
  formatImportSummaryText,
  groupImportDraftsByContract,
  prepareImportDraft,
  applyImportDrafts,
} from "../../lib/importHopDongXntv";
import HopDongKhoiLuongReviewTable from "./HopDongKhoiLuongReviewTable";
import {
  fetchThucHienByHopDongIds,
  fetchXuatHdByHopDongIds,
  insertXuatHd,
  updateXuatHd,
  deleteXuatHd,
  upsertThucHien,
  HOP_DONG_XUAT_LOAI,
  resolveHienTrangHopDong,
} from "../../lib/hopDongThucHien";
import { normalizeChietGiamTncttt, resolveChietGiamTnctttPhaseAmount } from "../../lib/hopDongTncttt";
import { useAppDialog } from "../AppDialog";

function cellVal(v, { money = false, empty = "—" } = {}) {
  if (v === null || v === undefined || v === "") return empty;
  if (money) return formatGiaTriHopDong(v);
  return String(v);
}

/** Gross phân rã giai đoạn: ưu tiên cột KS chi tiết đang hiện trên sổ. */
function sumPhanRaGross(th) {
  if (!th) return null;
  if (th.gia_tri_tong_phan_ra != null && th.gia_tri_tong_phan_ra !== "") {
    const n = Number(th.gia_tri_tong_phan_ra);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const hasKsDetail =
    th.gia_tri_ks_dia_hinh != null ||
    th.gia_tri_ks_dia_chat != null ||
    th.gia_tri_ks_khac != null;
  const ksParts = hasKsDetail
    ? [th.gia_tri_ks_dia_hinh, th.gia_tri_ks_dia_chat, th.gia_tri_ks_khac]
    : [th.gia_tri_ks];
  const ks = ksParts
    .filter((n) => n != null && n !== "")
    .reduce((s, n) => s + Number(n), 0);
  const lap =
    th.gia_tri_lap_hs != null && th.gia_tri_lap_hs !== "" ? Number(th.gia_tri_lap_hs) : 0;
  const ctdt =
    th.gia_tri_ctdt != null && th.gia_tri_ctdt !== "" ? Number(th.gia_tri_ctdt) : 0;
  const sum = ks + lap + ctdt;
  return sum > 0 ? sum : null;
}

function isoDateOnly(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

/** Năm hợp lệ cho ngày xuất HĐ (tránh 0002 từ import/gõ lỗi). */
function isPlausibleInvoiceIso(iso) {
  const y = Number(String(iso || "").slice(0, 4));
  return Number.isFinite(y) && y >= 1990 && y <= 2100;
}

function formatNgayXuatVi(value) {
  const iso = isoDateOnly(value);
  if (!iso || !isPlausibleInvoiceIso(iso)) return "";
  const [, y, m, d] = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/) || [];
  return y ? `${d}/${m}/${y}` : "";
}

/** Nhận 15/01/2026 · 15/1/2026 · 2026-01-15 → ISO; trả "" nếu không hợp lệ. */
export function parseNgayXuatInput(raw) {
  const text = String(raw || "").trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return isPlausibleInvoiceIso(text) ? text : "";
  }
  const m = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (!m) return "";
  const day = m[1].padStart(2, "0");
  const month = m[2].padStart(2, "0");
  let year = m[3];
  if (year.length === 2) {
    const n = Number(year);
    year = String(n >= 70 ? 1900 + n : 2000 + n);
  }
  const iso = `${year}-${month}-${day}`;
  if (!isPlausibleInvoiceIso(iso)) return "";
  const dt = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return "";
  if (dt.getFullYear() !== Number(year) || dt.getMonth() + 1 !== Number(month) || dt.getDate() !== Number(day)) {
    return "";
  }
  return iso;
}

/** Tóm tắt ngày/tháng xuất từ danh sách sự kiện (khớp cột Excel). */
export function summarizeXuatHdDates(xuatList = []) {
  const dated = (xuatList || [])
    .map((x) => isoDateOnly(x?.ngay_xuat))
    .filter((d) => d && isPlausibleInvoiceIso(d))
    .sort();
  if (dated.length) {
    const last = dated[dated.length - 1];
    const month = Number(last.slice(5, 7));
    return {
      ngayDisplay: [...new Set(dated.map(formatNgayXuatVi).filter(Boolean))].join("\n"),
      thang: Number.isFinite(month) ? month : null,
      hasDate: true,
    };
  }
  const years = [
    ...new Set(
      (xuatList || [])
        .map((x) => (x?.nam_xuat != null ? String(x.nam_xuat) : ""))
        .filter(Boolean)
    ),
  ].sort();
  return {
    ngayDisplay: years.length ? years.map((y) => `Năm ${y}`).join("\n") : "",
    thang: null,
    hasDate: false,
  };
}

/**
 * Lọc sự kiện xuất theo giai đoạn: ưu tiên dòng đã gắn ma_du_an;
 * chỉ lấy dòng không gắn mã khi giai đoạn chưa có sự kiện riêng (tránh nhân đôi).
 */
export function filterXuatForPhase(xuatRows = [], maDuAn = "") {
  const ma = String(maDuAn || "").trim();
  const all = Array.isArray(xuatRows) ? xuatRows : [];
  const tagged = all.filter((x) => String(x.ma_du_an || "").trim() === ma);
  if (tagged.length) return tagged;
  return all.filter((x) => !String(x.ma_du_an || "").trim());
}

/**
 * Dòng hiển thị phần «Đã xuất / Ngày xuất» trên thẻ số liệu sổ HĐ.
 * Chỉ tách nhiều dòng khi có ≥2 ngày xuất khác nhau (gom cùng ngày thành 1 dòng).
 */
export function buildSoLieuXuatDisplayRows(xuatList = [], th = null) {
  const datedEvents = (xuatList || [])
    .map((x) => {
      const iso = isoDateOnly(x?.ngay_xuat);
      if (!iso || !isPlausibleInvoiceIso(iso)) return null;
      return { iso, so_tien: Number(x?.so_tien) || 0, id: x?.id };
    })
    .filter(Boolean)
    .sort((a, b) => a.iso.localeCompare(b.iso) || a.so_tien - b.so_tien);

  // Gom theo ngày; bỏ trùng (cùng ngày + cùng số tiền) — tránh nhân đôi từ import/gắn mã.
  const byDate = new Map();
  for (const ev of datedEvents) {
    if (!byDate.has(ev.iso)) {
      byDate.set(ev.iso, { so_tien: ev.so_tien, seenAmounts: new Set([ev.so_tien]) });
      continue;
    }
    const bucket = byDate.get(ev.iso);
    if (bucket.seenAmounts.has(ev.so_tien)) continue;
    bucket.seenAmounts.add(ev.so_tien);
    bucket.so_tien += ev.so_tien;
  }

  const dates = [...byDate.keys()].sort();
  if (dates.length >= 2) {
    return dates.map((iso, index) => ({
      key: `xuat-${iso}-${index}`,
      da_xuat_hd: byDate.get(iso).so_tien,
      ngayDisplay: formatNgayXuatVi(iso),
      showPhaseTotals: index === 0,
    }));
  }

  const summary = summarizeXuatHdDates(xuatList);
  const singleAmount =
    dates.length === 1 ? byDate.get(dates[0]).so_tien : th?.da_xuat_hd;
  return [
    {
      key: "xuat-single",
      da_xuat_hd: singleAmount,
      ngayDisplay: summary.ngayDisplay,
      showPhaseTotals: true,
    },
  ];
}

/**
 * Bảng số liệu dạng lưới (gần khung Excel Tổng hợp doanh thu).
 * Giữ nút Cập nhật số liệu trên header.
 */
export function HopDongSoLieuCard({
  th,
  canEdit,
  onEdit,
  phaseLabel = "",
  /** Tiêu đề khối — mặc định «Giá trị hợp đồng»; sổ giai đoạn truyền «Giá trị hợp đồng giai đoạn …». */
  sectionTitle = "",
  xuatList = [],
  /** Chiết giảm TNCTTT trên HĐ (jsonb) — cột trừ trên bảng sổ. */
  chietGiam = null,
}) {
  if (!th && !canEdit) return null;
  const uncertain = /\[CHƯA CHẮC CHẮN\]/i.test(String(th?.ghi_chu || ""));
  const title = String(sectionTitle || "").trim() || "Giá trị hợp đồng";

  const tongPhanRa = sumPhanRaGross(th);
  const giaHd = th?.gia_tri_hd != null ? Number(th.gia_tri_hd) : null;
  const chenhLech =
    giaHd != null && tongPhanRa != null && tongPhanRa !== 0 ? tongPhanRa - giaHd : null;
  const xuatRows = buildSoLieuXuatDisplayRows(xuatList, th);
  const chiet = normalizeChietGiamTncttt(chietGiam);
  const tyLeTncttt = chiet.ty_le != null && chiet.ty_le > 0 ? chiet.ty_le : 6;
  // Theo giai đoạn đang xem — không lấy so_tien tổng cả HĐ (vd. 208Tr).
  const chietGiamAmount = resolveChietGiamTnctttPhaseAmount({
    tongPhanRa,
    giaTriHd: giaHd,
    chietGiam,
    defaultTyLe: tyLeTncttt,
  });

  const cellFrame = "border-b border-r border-slate-200";
  const thBase = `${cellFrame} px-2.5 py-2 text-[11px] font-bold uppercase tracking-wide align-middle leading-snug text-center bg-teal-50 text-teal-900`;
  const tdBase = `${cellFrame} px-2.5 py-2 text-[13px] font-normal leading-snug tabular-nums align-middle bg-white text-slate-800`;
  // Cột chiết giảm: màu ấm — đánh dấu số sẽ trừ (khác cột cộng phân rã).
  const thDeduct = `${cellFrame} px-2.5 py-2 text-[11px] font-bold uppercase tracking-wide align-middle leading-snug text-center bg-amber-100 text-amber-950`;
  const tdDeduct = `${cellFrame} px-2.5 py-2 text-[13px] font-semibold leading-snug tabular-nums align-middle text-right bg-amber-50 text-amber-950`;

  const thCls = thBase;
  const tdCls = `${tdBase} text-right`;
  const tdCenter = `${tdBase} text-center`;
  const tdMuted = `${tdBase} text-right text-slate-400`;

  return (
    <div className="mt-3 w-full">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-0.5">
        <p
          className={`flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wide ${
            uncertain ? "text-amber-800" : "text-slate-800"
          }`}
        >
          <span>{title}</span>
          {uncertain ? (
            <span className="font-semibold normal-case tracking-normal text-amber-700">
              · Chưa chắc chắn
            </span>
          ) : null}
        </p>
        {canEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="text-[11px] font-semibold text-sky-700 hover:underline cursor-pointer shrink-0"
            title="Nhập/sửa giá trị và ngày xuất hóa đơn"
          >
            {th ? "Cập nhật số liệu / ngày xuất" : "Nhập số liệu"}
          </button>
        )}
      </div>

      {!th ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-3 py-4 text-xs text-slate-600 italic">
          Chưa có số liệu — import Excel hoặc nhập tay.
        </p>
      ) : (
        <div className="w-full min-w-0">
          <div className="w-full overflow-hidden rounded-xl border border-teal-100 bg-white shadow-sm shadow-slate-900/5">
          <table className="w-full border-collapse table-fixed">
            <thead>
              <tr>
                <th className={thCls} style={{ width: "18%" }}>
                  <span className="block leading-tight">GTHĐ sau chiết giảm</span>
                  <span className="mt-0.5 block font-normal normal-case tracking-normal text-teal-700/80">
                    (trước VAT)
                  </span>
                </th>
                <th className={thCls} style={{ width: "16%" }}>
                  Đã xuất HĐ
                </th>
                <th className={thCls} style={{ width: "14%" }}>
                  Ngày xuất HĐ
                </th>
                <th className={thCls} style={{ width: "16%" }}>
                  Còn lại
                </th>
                <th className={thCls} style={{ width: "16%" }}>
                  Chênh lệch
                </th>
                <th className={thCls} style={{ width: "20%" }}>
                  Lý do
                </th>
              </tr>
            </thead>
            <tbody>
              {xuatRows.map((row) => (
                <tr key={row.key}>
                  <td className={tdCls}>{cellVal(th.gia_tri_hd, { money: true })}</td>
                  <td className={tdCls}>{cellVal(row.da_xuat_hd, { money: true })}</td>
                  <td className={`${tdCenter} whitespace-pre-line text-[12px]`}>
                    {cellVal(row.ngayDisplay || null)}
                  </td>
                  <td className={row.showPhaseTotals ? tdCls : tdMuted}>
                    {row.showPhaseTotals ? cellVal(th.con_lai, { money: true }) : "—"}
                  </td>
                  <td className={row.showPhaseTotals ? tdCls : tdMuted}>
                    {row.showPhaseTotals ? cellVal(chenhLech, { money: true }) : "—"}
                  </td>
                  <td
                    className={`${tdCenter} text-[12px] text-slate-600 leading-snug`}
                    title={
                      row.showPhaseTotals
                        ? String(th.tinh_hinh_xuat_hd || th.ton_tai_kt || "")
                        : undefined
                    }
                  >
                    {row.showPhaseTotals ? (
                      <span className="line-clamp-2">
                        {cellVal(th.tinh_hinh_xuat_hd || th.ton_tai_kt || null)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <thead>
              <tr>
                <th className={thCls} colSpan={3}>
                  Giá trị khảo sát
                </th>
                <th className={thCls} rowSpan={2}>
                  Lập Hồ sơ Thiết kế
                </th>
                <th className={thCls} rowSpan={2}>
                  Chủ trương Đầu tư
                </th>
                <th
                  className={thDeduct}
                  rowSpan={2}
                  title="Số trừ TNCTTT — gross KS/Lập trừ đi để ra giá trị HĐ sau chiết giảm"
                >
                  {`Chiết giảm TNCTTT (${tyLeTncttt}%)`}
                </th>
              </tr>
              <tr>
                <th className={thCls}>Địa hình</th>
                <th className={thCls}>Địa chất</th>
                <th className={`${thCls} whitespace-pre-line leading-tight`}>
                  {"Khác/\nThỏa thuận"}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={tdCls}>{cellVal(th.gia_tri_ks_dia_hinh, { money: true })}</td>
                <td className={tdCls}>{cellVal(th.gia_tri_ks_dia_chat, { money: true })}</td>
                <td
                  className={tdCls}
                  title={
                    th.gia_tri_ks_khac == null &&
                    th.gia_tri_ks_dia_hinh == null &&
                    th.gia_tri_ks_dia_chat == null
                      ? "Dữ liệu cũ chưa tách chi tiết khảo sát"
                      : undefined
                  }
                >
                  {cellVal(
                    th.gia_tri_ks_khac ??
                      (th.gia_tri_ks_dia_hinh == null && th.gia_tri_ks_dia_chat == null
                        ? th.gia_tri_ks
                        : null),
                    { money: true }
                  )}
                </td>
                <td className={tdCls}>{cellVal(th.gia_tri_lap_hs, { money: true })}</td>
                <td className={tdCls}>{cellVal(th.gia_tri_ctdt, { money: true })}</td>
                <td className={tdDeduct} title={chiet.ghi_chu || undefined}>
                  {cellVal(chietGiamAmount, { money: true })}
                </td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>
      )}

      {uncertain && th?.ghi_chu ? (
        <p className="mt-2 px-0.5 text-[10px] text-amber-800/90 leading-relaxed">{th.ghi_chu}</p>
      ) : null}
    </div>
  );
}

function XuatNgayTextInput({
  initialIso = "",
  disabled = false,
  className = "",
  onCommit,
  placeholder = "15/01/2026",
}) {
  const [text, setText] = React.useState(() => formatNgayXuatVi(initialIso) || "");
  const [localError, setLocalError] = React.useState("");

  React.useEffect(() => {
    setText(formatNgayXuatVi(initialIso) || "");
    setLocalError("");
  }, [initialIso]);

  const commit = () => {
    const trimmed = String(text || "").trim();
    if (!trimmed) {
      setLocalError("Nhập ngày, vd. 15/01/2026");
      return;
    }
    const iso = parseNgayXuatInput(trimmed);
    if (!iso) {
      setLocalError("Sai định dạng — dùng 15/01/2026");
      return;
    }
    setLocalError("");
    setText(formatNgayXuatVi(iso));
    const prev = isoDateOnly(initialIso);
    if (iso !== prev) onCommit?.(iso);
  };

  return (
    <div className="min-w-0 flex-1">
      <input
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        disabled={disabled}
        className={className}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (localError) setLocalError("");
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
      />
      {localError ? <p className="mt-0.5 text-[10px] font-medium text-red-600">{localError}</p> : null}
    </div>
  );
}

export function SoLieuHopDongModal({
  open,
  onClose,
  supabase,
  hopDong,
  maDuAn,
  phaseLabel,
  onSaved,
}) {
  const { showConfirm } = useAppDialog();
  const [form, setForm] = React.useState({});
  const [xuatList, setXuatList] = React.useState([]);
  const [xuatForm, setXuatForm] = React.useState({ so_tien: "", ngay_xuat: "", so_hoa_don: "", nam_xuat: "" });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!open || !hopDong?.id || !maDuAn) return;
    let cancelled = false;
    (async () => {
      setError("");
      try {
        const thRows = await fetchThucHienByHopDongIds(supabase, [hopDong.id]);
        const th = (thRows || []).find((r) => r.ma_du_an === maDuAn) || null;
        const xuat = filterXuatForPhase(
          await fetchXuatHdByHopDongIds(supabase, [hopDong.id]),
          maDuAn
        );
        if (cancelled) return;
        const ngayDisp = summarizeXuatHdDates(xuat).ngayDisplay;
        const daXuat =
          xuat.reduce((s, r) => s + (Number(r.so_tien) || 0), 0) || th?.da_xuat_hd;
        setForm({
          hien_trang: resolveHienTrangHopDong({
            hienTrang: th?.hien_trang || "",
            daXuatHd: daXuat,
            xuatList: xuat,
            ngayDisplay: ngayDisp,
          }),
          gia_tri_hd: th?.gia_tri_hd ?? "",
          gia_tri_ks: th?.gia_tri_ks ?? "",
          gia_tri_ks_dia_hinh: th?.gia_tri_ks_dia_hinh ?? "",
          gia_tri_ks_dia_chat: th?.gia_tri_ks_dia_chat ?? "",
          gia_tri_ks_khac:
            th?.gia_tri_ks_khac ??
            (th?.gia_tri_ks_dia_hinh == null && th?.gia_tri_ks_dia_chat == null
              ? th?.gia_tri_ks ?? ""
              : ""),
          gia_tri_lap_hs: th?.gia_tri_lap_hs ?? "",
          gia_tri_ctdt: th?.gia_tri_ctdt ?? "",
          da_xuat_hd: th?.da_xuat_hd ?? "",
          con_lai: th?.con_lai ?? "",
          thang_nt_du_kien: th?.thang_nt_du_kien ?? "",
          thang_nt_thuc_te: th?.thang_nt_thuc_te ?? "",
          nam_nt: th?.nam_nt ?? "",
          hsnt_trang_thai: th?.hsnt_trang_thai || "",
          ghi_chu: th?.ghi_chu || "",
        });
        setXuatList(xuat);
      } catch (err) {
        if (!cancelled) {
          setError(
            err?.message?.includes("HOP_DONG_THUC_HIEN") || err?.code === "42P01"
              ? "Chưa tạo bảng số liệu trên Supabase. Chạy scripts/sql/create-hop-dong-thuc-hien.sql."
              : err.message || "Không tải số liệu."
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, hopDong?.id, maDuAn, supabase]);

  if (!open) return null;

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const ngayDisp = summarizeXuatHdDates(xuatList).ngayDisplay;
      const hienTrang = resolveHienTrangHopDong({
        hienTrang: form.hien_trang,
        daXuatHd: form.da_xuat_hd,
        xuatList,
        ngayDisplay: ngayDisp,
      });
      await upsertThucHien(supabase, {
        hop_dong_id: hopDong.id,
        ma_du_an: maDuAn,
        ...form,
        hien_trang: hienTrang,
        resyncFromXuat: xuatList.length > 0,
      });
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err.message || "Lưu thất bại.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddXuat = async () => {
    setSaving(true);
    setError("");
    try {
      if (!String(xuatForm.so_tien || "").trim()) {
        throw new Error("Nhập số tiền xuất hóa đơn.");
      }
      const ngayIso = parseNgayXuatInput(xuatForm.ngay_xuat);
      if (!ngayIso) {
        throw new Error("Nhập ngày xuất hóa đơn dạng 15/01/2026.");
      }
      await insertXuatHd(supabase, {
        hop_dong_id: hopDong.id,
        ma_du_an: maDuAn,
        so_tien: xuatForm.so_tien,
        ngay_xuat: ngayIso,
        nam_xuat: ngayIso.slice(0, 4),
        so_hoa_don: xuatForm.so_hoa_don || null,
        loai: Number(xuatForm.so_tien) < 0 ? HOP_DONG_XUAT_LOAI.DIEU_CHINH : HOP_DONG_XUAT_LOAI.THUONG,
      });
      const xuat = filterXuatForPhase(
        await fetchXuatHdByHopDongIds(supabase, [hopDong.id]),
        maDuAn
      );
      setXuatList(xuat);
      const sum = xuat.reduce((s, r) => s + (Number(r.so_tien) || 0), 0);
      const ngayDisp = summarizeXuatHdDates(xuat).ngayDisplay;
      const hienTrang = resolveHienTrangHopDong({
        hienTrang: form.hien_trang,
        daXuatHd: sum,
        xuatList: xuat,
        ngayDisplay: ngayDisp,
      });
      setForm((f) => ({ ...f, da_xuat_hd: sum, hien_trang: hienTrang }));
      await upsertThucHien(supabase, {
        hop_dong_id: hopDong.id,
        ma_du_an: maDuAn,
        hien_trang: hienTrang,
        resyncFromXuat: true,
      });
      setXuatForm({ so_tien: "", ngay_xuat: "", so_hoa_don: "", nam_xuat: "" });
      onSaved?.();
    } catch (err) {
      setError(err.message || "Thêm sự kiện xuất thất bại.");
    } finally {
      setSaving(false);
    }
  };

  const reloadXuatList = async () => {
    const xuat = filterXuatForPhase(
      await fetchXuatHdByHopDongIds(supabase, [hopDong.id]),
      maDuAn
    );
    setXuatList(xuat);
    const sum = xuat.reduce((s, r) => s + (Number(r.so_tien) || 0), 0);
    setForm((f) => ({ ...f, da_xuat_hd: sum }));
    return xuat;
  };

  const handleUpdateXuatNgay = async (xuatId, ngayRaw) => {
    setSaving(true);
    setError("");
    try {
      const iso = parseNgayXuatInput(ngayRaw);
      if (!iso) {
        throw new Error("Ngày xuất không hợp lệ. Nhập dạng 15/01/2026.");
      }
      await updateXuatHd(supabase, xuatId, {
        ngay_xuat: iso,
        nam_xuat: iso.slice(0, 4),
      });
      await reloadXuatList();
      onSaved?.();
    } catch (err) {
      setError(err.message || "Cập nhật ngày xuất thất bại.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteXuat = async (xuat) => {
    const ngay =
      formatNgayXuatVi(xuat?.ngay_xuat) ||
      (xuat?.nam_xuat != null ? `Năm ${xuat.nam_xuat}` : "—");
    const ok = await showConfirm("Thao tác này không hoàn tác. Đã xuất HĐ trên sổ sẽ được tính lại.", {
      title: "Xóa sự kiện xuất hóa đơn?",
      variant: "error",
      confirmLabel: "Xóa sự kiện",
      cancelLabel: "Giữ lại",
      table: {
        caption: `${phaseLabel || maDuAn} · ${hopDong?.so_hop_dong || "HĐ"}`,
        columns: [
          { key: "so_tien", label: "Số tiền", align: "right" },
          { key: "ngay_xuat", label: "Ngày xuất HĐ" },
          { key: "so_hoa_don", label: "Số hóa đơn" },
        ],
        rows: [
          {
            key: xuat?.id || "xuat",
            so_tien: formatGiaTriHopDong(xuat?.so_tien),
            ngay_xuat: ngay,
            so_hoa_don: xuat?.so_hoa_don || "—",
          },
        ],
      },
    });
    if (!ok) return;
    setSaving(true);
    setError("");
    try {
      await deleteXuatHd(supabase, xuat.id, hopDong.id, maDuAn);
      await reloadXuatList();
      onSaved?.();
    } catch (err) {
      setError(err.message || "Xóa sự kiện xuất thất bại.");
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-200";

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/40 p-3">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-black text-sky-900 uppercase">Giá trị hợp đồng</h3>
            <p className="text-xs text-slate-600 mt-0.5">
              {phaseLabel || maDuAn} · {hopDong?.so_hop_dong || "HĐ"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800 text-sm font-bold cursor-pointer">
            Đóng
          </button>
        </div>

        <div className="p-4 space-y-3">
          {error ? <div className="rounded-md bg-red-50 text-red-800 text-xs p-2">{error}</div> : null}

          <label className="block text-xs font-bold text-slate-600">
            Hiện trạng
            <input className={`${inputCls} mt-1`} value={form.hien_trang || ""} onChange={(e) => setField("hien_trang", e.target.value)} />
          </label>

          <div className="grid grid-cols-2 gap-2">
            {[
              ["gia_tri_hd", "Giá trị HĐ"],
              ["da_xuat_hd", "Đã xuất HĐ"],
              ["gia_tri_ks_dia_hinh", "Khảo sát địa hình"],
              ["gia_tri_ks_dia_chat", "Khảo sát địa chất"],
              ["gia_tri_ks_khac", "Khảo sát khác/thỏa thuận"],
              ["gia_tri_lap_hs", "Lập Hồ sơ Thiết kế"],
              ["gia_tri_ctdt", "Chủ trương Đầu tư"],
              ["nam_nt", "Năm NT"],
              ["thang_nt_du_kien", "Tháng NT DK"],
              ["thang_nt_thuc_te", "Tháng NT TT"],
            ].map(([k, lab]) => (
              <label key={k} className="block text-xs font-bold text-slate-600">
                {lab}
                <input
                  className={`${inputCls} mt-1`}
                  value={form[k] ?? ""}
                  onChange={(e) => setField(k, e.target.value)}
                />
              </label>
            ))}
          </div>

          <label className="block text-xs font-bold text-slate-600">
            Hiện trạng HSNT
            <input className={`${inputCls} mt-1`} value={form.hsnt_trang_thai || ""} onChange={(e) => setField("hsnt_trang_thai", e.target.value)} />
          </label>

          <div className="rounded-lg border border-slate-100 p-3 space-y-2">
            <p className="text-[11px] font-black uppercase text-slate-600">Sự kiện xuất hóa đơn</p>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Đây là chỗ nhập/sửa <span className="font-semibold text-slate-700">ngày xuất hóa đơn</span>{" "}
              (nút «Sửa» trên sổ chỉ sửa thông tin pháp lý HĐ).
            </p>
            {xuatList.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Chưa có sự kiện — thêm bên dưới.</p>
            ) : (
              <ul className="space-y-2 max-h-40 overflow-y-auto">
                {xuatList.map((x) => (
                  <li
                    key={x.id}
                    className="rounded-md border border-slate-100 bg-slate-50/80 px-2 py-1.5 text-xs text-slate-700"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold tabular-nums">{formatGiaTriHopDong(x.so_tien)}</span>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleDeleteXuat(x)}
                        className="text-[10px] font-semibold text-red-600 hover:underline cursor-pointer disabled:opacity-50"
                      >
                        Xóa
                      </button>
                    </div>
                    <label className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      Ngày xuất
                      <XuatNgayTextInput
                        initialIso={
                          isPlausibleInvoiceIso(isoDateOnly(x.ngay_xuat))
                            ? isoDateOnly(x.ngay_xuat)
                            : ""
                        }
                        disabled={saving}
                        className={`${inputCls} mt-0 max-w-[11rem] py-1 text-xs font-medium normal-case tracking-normal`}
                        onCommit={(iso) => handleUpdateXuatNgay(x.id, iso)}
                      />
                      {x.so_hoa_don ? (
                        <span className="font-medium normal-case tracking-normal text-slate-600">
                          · {x.so_hoa_don}
                        </span>
                      ) : null}
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Số tiền <span className="text-red-600">*</span>
                <input
                  placeholder="VD: 409340371"
                  className={`${inputCls} mt-1`}
                  value={xuatForm.so_tien}
                  onChange={(e) => setXuatForm((f) => ({ ...f, so_tien: e.target.value }))}
                />
              </label>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Ngày xuất HĐ <span className="text-red-600">*</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="15/01/2026"
                  className={`${inputCls} mt-1`}
                  value={xuatForm.ngay_xuat}
                  onChange={(e) => setXuatForm((f) => ({ ...f, ngay_xuat: e.target.value }))}
                  onBlur={() => {
                    const iso = parseNgayXuatInput(xuatForm.ngay_xuat);
                    if (iso) {
                      setXuatForm((f) => ({
                        ...f,
                        ngay_xuat: formatNgayXuatVi(iso),
                        nam_xuat: iso.slice(0, 4),
                      }));
                    }
                  }}
                />
              </label>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 col-span-2 sm:col-span-1">
                Số hóa đơn
                <input
                  placeholder="Số HĐ / hóa đơn (tuỳ chọn)"
                  className={`${inputCls} mt-1`}
                  value={xuatForm.so_hoa_don}
                  onChange={(e) => setXuatForm((f) => ({ ...f, so_hoa_don: e.target.value }))}
                />
              </label>
              <button
                type="button"
                disabled={saving || !xuatForm.so_tien || !parseNgayXuatInput(xuatForm.ngay_xuat)}
                onClick={handleAddXuat}
                className="rounded-md bg-slate-700 text-white text-xs font-bold px-2 py-1.5 disabled:opacity-50 cursor-pointer self-end"
              >
                + Thêm xuất HĐ
              </button>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-4 py-3 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs font-bold text-slate-600 cursor-pointer">
            Hủy
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-3 py-1.5 rounded-lg bg-sky-700 text-white text-xs font-bold hover:bg-sky-800 disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Đang lưu…" : "Lưu số liệu"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Dialog import Excel → rà soát bảng khối lượng → ghi DB từ bản nháp. */
export function ImportHopDongXntvDialog({ open, onClose, supabase, project, onDone }) {
  const { showConfirm } = useAppDialog();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [summary, setSummary] = React.useState(null);
  const [drafts, setDrafts] = React.useState([]);
  const [scopeOnlyNhom, setScopeOnlyNhom] = React.useState(true);
  const [fileBuf, setFileBuf] = React.useState(null);
  const [fileName, setFileName] = React.useState("");

  React.useEffect(() => {
    if (!open) {
      setSummary(null);
      setDrafts([]);
      setError("");
      setFileBuf(null);
      setFileName("");
    }
  }, [open]);

  if (!open) return null;

  const nhom = bgdGroupKeyForProject(project);
  const groups = groupImportDraftsByContract(drafts);
  const savableCount = drafts.filter((d) => d.include !== false && d.canSave !== false).length;

  const loadTemplate = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(DEFAULT_IMPORT_TEMPLATE_PATH);
      if (!res.ok) throw new Error("Không tải được file mẫu trong public/templates.");
      const buf = await res.arrayBuffer();
      setFileBuf(buf);
      setFileName("hopdongxntv.xlsx (mẫu hệ thống)");
      setSummary(null);
      setDrafts([]);
    } catch (err) {
      setError(err.message || "Lỗi tải mẫu.");
    } finally {
      setBusy(false);
    }
  };

  const onPickFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileBuf(await f.arrayBuffer());
    setFileName(f.name);
    setSummary(null);
    setDrafts([]);
  };

  const runDry = async () => {
    if (!fileBuf) {
      setError("Chọn file Excel hoặc dùng mẫu hệ thống.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const prepared = await prepareImportDraft(supabase, fileBuf, {
        scopeNhomKey: scopeOnlyNhom ? nhom : null,
      });
      setSummary(prepared.summary);
      setDrafts(prepared.drafts || []);
    } catch (err) {
      setError(
        err?.message?.includes("HOP_DONG_THUC_HIEN") || err?.code === "42P01"
          ? "Chưa tạo bảng số liệu. Chạy scripts/sql/create-hop-dong-thuc-hien.sql trên Supabase."
          : err.message || "Phân tích Excel thất bại."
      );
    } finally {
      setBusy(false);
    }
  };

  const runApply = async () => {
    if (!drafts.length) return;
    if (savableCount === 0) {
      setError("Không có dòng nào được chọn để lưu.");
      return;
    }
    if (
      !(await showConfirm(
        "Hợp đồng thiếu sẽ được tạo mới; giá trị pháp lý = tổng các giai đoạn đã chọn.",
        {
          title: "Ghi số liệu vào sổ?",
          variant: "warning",
          confirmLabel: "Ghi vào sổ",
          cancelLabel: "Hủy",
          table: {
            caption: "Tóm tắt trước khi lưu",
            columns: [
              { key: "muc", label: "Hạng mục" },
              { key: "gia_tri", label: "Giá trị", align: "right" },
            ],
            rows: [
              { key: "n", muc: "Số dòng sẽ ghi", gia_tri: String(savableCount) },
              {
                key: "file",
                muc: "Nguồn",
                gia_tri: fileName || "Excel đã phân tích",
              },
            ],
          },
        }
      ))
    ) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const applied = await applyImportDrafts(supabase, drafts, { replaceXuat: true });
      const merged = { ...(summary || {}), applied: applied.applied };
      setSummary(merged);
      onDone?.(merged);
    } catch (err) {
      setError(err.message || "Import thất bại.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/40 p-3">
      <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3 flex justify-between gap-2">
          <div>
            <h3 className="text-sm font-black text-teal-900 uppercase">Import số liệu Excel</h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Phân tích → rà soát bảng khối lượng → xác nhận mới ghi DB
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-sm font-bold text-slate-500 cursor-pointer">
            Đóng
          </button>
        </div>

        <div className="p-4 space-y-3 text-sm">
          {error ? <div className="rounded-md bg-red-50 text-red-800 text-xs p-2 whitespace-pre-wrap">{error}</div> : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={loadTemplate}
              className="rounded-lg bg-teal-700 text-white text-xs font-bold px-3 py-1.5 hover:bg-teal-800 disabled:opacity-50 cursor-pointer"
            >
              Dùng file mẫu hệ thống
            </button>
            <label className="rounded-lg border border-slate-200 bg-white text-xs font-bold px-3 py-1.5 cursor-pointer hover:bg-slate-50">
              Chọn file .xlsx
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={onPickFile} />
            </label>
          </div>
          {fileName ? <p className="text-xs text-slate-600">File: {fileName}</p> : null}

          <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={scopeOnlyNhom}
              onChange={(e) => setScopeOnlyNhom(e.target.checked)}
            />
            <span>
              Chỉ import dòng thuộc <strong>công trình đang mở sổ</strong> (an toàn). Bỏ chọn để import toàn bộ dòng khớp danh mục.
            </span>
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !fileBuf}
              onClick={runDry}
              className="rounded-lg border border-teal-300 text-teal-800 text-xs font-bold px-3 py-1.5 disabled:opacity-50 cursor-pointer"
            >
              {busy ? "Đang xử lý…" : "1. Phân tích & hiện bảng"}
            </button>
            <button
              type="button"
              disabled={busy || !drafts.length || savableCount === 0}
              onClick={runApply}
              className="rounded-lg bg-orange-600 text-white text-xs font-bold px-3 py-1.5 hover:bg-orange-700 disabled:opacity-50 cursor-pointer"
            >
              2. Xác nhận lưu DB ({savableCount})
            </button>
          </div>

          {summary ? (
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-2">
              <pre className="text-[11px] whitespace-pre-wrap text-slate-800 font-mono">
                {formatImportSummaryText(summary)}
              </pre>
            </div>
          ) : null}

          {groups.length > 0 ? (
            <div className="space-y-5">
              <p className="text-xs font-bold text-slate-700">
                Rà soát / sửa số liệu trước khi lưu. HĐ nhiều giai đoạn hiện đủ dòng (FS → TKBVTC).
              </p>
              {groups.map((g) => (
                <div key={g.key} className="rounded-xl border border-teal-100 bg-teal-50/30 p-3 space-y-2">
                  <p className="text-xs font-bold text-teal-900">
                    {g.so_hop_dong || "(chưa có số HĐ)"}
                    {g.ngay_ky ? ` · ngày ${formatNgayVi(g.ngay_ky) || g.ngay_ky}` : ""}
                    {g.cong_trinh ? (
                      <span className="font-semibold text-slate-700"> · {g.cong_trinh}</span>
                    ) : null}
                  </p>
                  <HopDongKhoiLuongReviewTable
                    rows={g.rows}
                    onChange={(nextRows) => {
                      setDrafts((prev) => {
                        const byKey = new Map(nextRows.map((r) => [r.key, r]));
                        return prev.map((d) => byKey.get(d.key) || d);
                      });
                    }}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Hook tải map thuc_hien + sự kiện xuất theo hop_dong_id cho panel sổ. */
export function useThucHienMap(supabase, hopDongIds, refreshKey = 0) {
  const [byKey, setByKey] = React.useState({});
  const [xuatByKey, setXuatByKey] = React.useState({});
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    const ids = (hopDongIds || []).filter(Boolean);
    if (!ids.length) {
      setByKey({});
      setXuatByKey({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [rows, xuatRows] = await Promise.all([
          fetchThucHienByHopDongIds(supabase, ids),
          fetchXuatHdByHopDongIds(supabase, ids),
        ]);
        if (cancelled) return;
        const map = {};
        for (const r of rows || []) {
          map[`${r.hop_dong_id}||${r.ma_du_an}`] = r;
        }
        const xuatMap = {};
        for (const x of xuatRows || []) {
          const ma = String(x.ma_du_an || "").trim();
          const key = `${x.hop_dong_id}||${ma}`;
          if (!xuatMap[key]) xuatMap[key] = [];
          xuatMap[key].push(x);
          if (!ma) {
            const wild = `${x.hop_dong_id}||*`;
            if (!xuatMap[wild]) xuatMap[wild] = [];
            xuatMap[wild].push(x);
          }
        }
        setByKey(map);
        setXuatByKey(xuatMap);
        setError("");
      } catch (err) {
        if (!cancelled) {
          setByKey({});
          setXuatByKey({});
          if (err?.code === "42P01" || /HOP_DONG_THUC_HIEN/i.test(err?.message || "")) {
            setError("Chưa có bảng số liệu (chạy SQL create-hop-dong-thuc-hien).");
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, refreshKey, (hopDongIds || []).join(",")]);

  return { byKey, xuatByKey, error };
}

export function phaseLabelForMa(siblings, maDuAn) {
  const p = (siblings || []).find((x) => x.ma_du_an === maDuAn);
  return p ? formatGiaiDoanBadge(p.giai_doan_chuan || p.giai_doan) : maDuAn;
}
