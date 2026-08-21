"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { formatChuDauTuDisplay, isKhachHangNgoai } from "../../lib/chuDauTuAlias";
import { formatGiaoATitleLabel } from "../../lib/formatGiaoA";
import { formatHopDongTitleLabel } from "../../lib/formatHopDong";
import { formatGiaiDoanBadge } from "../../lib/giaiDoanOrder";
import { formatVnd, giaTriTuVanHieuLuc } from "../../lib/finance";
import { openPdfGiaoA, uploadPdfGiaoAGoc } from "../../lib/pdfGiaoAStorage";

function Field({ label, value, labelClass = "text-gray-400", valueClassName = "font-semibold text-slate-800" }) {
  return (
    <div>
      <p className={`mb-0.5 text-[11px] font-bold uppercase tracking-wide ${labelClass}`}>{label}</p>
      <p className={`text-sm leading-snug ${valueClassName}`}>{value || "—"}</p>
    </div>
  );
}

function EyeIcon({ className = "h-4 w-4 shrink-0" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  );
}

function EyeOffIcon({ className = "h-4 w-4 shrink-0" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858 3.035a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
      />
    </svg>
  );
}

function GiaoATitleLink({ title, pdfUrl, onOpenPdf, linkClass, eyeClass, eyeInactiveClass }) {
  if (pdfUrl) {
    return (
      <button
        type="button"
        onClick={() => onOpenPdf?.(pdfUrl)}
        className={linkClass}
        title="Nhấn để xem PDF"
      >
        <span>{title}</span>
        <EyeIcon className={eyeClass} />
      </button>
    );
  }
  return (
    <p className="inline-flex items-center gap-1.5 text-sm leading-snug font-bold italic text-[#1d4ed8]">
      <span>{title}</span>
      {eyeInactiveClass ? <EyeOffIcon className={eyeInactiveClass} /> : null}
    </p>
  );
}

/** TMĐT lưu VND → hiển thị Tr.đ */
function formatTmdtTrieuNumber(tmdtVnd) {
  const n = Number(tmdtVnd) || 0;
  if (n <= 0) return null;
  const trieu = n / 1_000_000;
  return trieu.toLocaleString("vi-VN", { maximumFractionDigits: 3 });
}

export function WorkspaceSectionTitle({ icon, children }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <h2 className="flex items-center gap-2 text-sm font-black tracking-wide text-slate-800 uppercase">
        {icon ? <span className="text-base leading-none">{icon}</span> : null}
        {children}
      </h2>
    </div>
  );
}

/**
 * Khung đầu trang công trình — layout / style giống ksnpsc.
 * Giữ thêm dòng Giá trị tư vấn (đặc thù OUTSRC).
 */
export default function DuAnWorkspaceHeader({
  project,
  benAUser,
  benAUsers,
  canAttachPdf = false,
  onPdfAttached,
  onAlert,
  onUpdateHopDong,
}) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  if (!project) return null;

  const benAList =
    Array.isArray(benAUsers) && benAUsers.length
      ? benAUsers
      : benAUser
        ? [benAUser]
        : [];

  const giaoADayDu = (project.qd_giao_a_day_du || "").trim();
  const pdfGiaoAGoc = (project.link_pdf_giao_a_goc || "").trim();
  const tenCongTrinh = (project.ten || "ĐANG CẬP NHẬT").toLocaleUpperCase("vi-VN");
  const giaoATitle = formatGiaoATitleLabel(project.qd_giao_a, project.qd_giao_a_day_du);
  const giaiDoanBadge = formatGiaiDoanBadge(project.giai_doan);
  const capDienAp = (project.cap_dien_ap || "").trim() || "—";

  const hopDongShort = (project.hop_dong || "").trim();
  const hopDongDayDu = (project.hop_dong_day_du || "").trim();
  const hopDongPdf = project.link_pdf_hop_dong;
  const hasHopDong = Boolean(hopDongShort || hopDongDayDu || hopDongPdf);
  const hopDongTitle = formatHopDongTitleLabel(project.hop_dong, project.hop_dong_day_du, "Hợp đồng", {
    wrapDate: true,
  });
  const isKhn = isKhachHangNgoai(project.chu_dau_tu);
  const chuDauTuDisplay = formatChuDauTuDisplay(project.chu_dau_tu, {
    hopDongDayDu: hopDongDayDu || project.hop_dong_day_du,
  });

  const tmdtDisplay = formatTmdtTrieuNumber(project.tmdt);
  const tmdtDc = project.tmdt_dieu_chinh != null ? formatTmdtTrieuNumber(project.tmdt_dieu_chinh) : null;

  const sectionLabelClass = "text-[#2563eb]";
  const pairTitleClass = "font-bold italic text-[#1d4ed8] text-sm leading-snug";
  const hopDongTitleClass =
    "font-bold italic text-[#1d4ed8] text-sm leading-snug whitespace-pre-line text-center";
  const hopDongLinkClass =
    "inline-flex w-full justify-center whitespace-pre-line text-center text-sm font-bold italic leading-snug text-[#1d4ed8] transition-colors hover:text-[#1e3a8a] hover:underline cursor-pointer group";
  const hopDongUpdateClass = "text-xs leading-snug text-teal-700/90 font-medium not-italic";
  const giaoABodyClass = "text-xs text-[#15803d] italic leading-relaxed whitespace-pre-line text-justify";
  const quyMoBodyClass = "text-xs text-slate-700 whitespace-pre-line leading-relaxed text-justify";
  const tmdtValueClass = "text-lg sm:text-xl font-black text-[#1e3a8a] tracking-tight leading-tight";
  const tmdtUnitClass = "ml-1 text-[10px] font-bold text-blue-600/80 sm:text-sm";
  const metaSepClass = "mx-1.5 hidden select-none text-slate-300 sm:inline";
  const giaoALinkClass =
    "inline-flex items-center gap-1.5 font-bold italic text-[#1d4ed8] hover:text-[#1e3a8a] hover:underline text-sm leading-snug transition-colors cursor-pointer group text-left";
  const giaoAPdfEyeClass = "w-4 h-4 shrink-0 text-[#c2410c] group-hover:text-[#9a3412] transition-colors";
  const giaoAEyeInactiveClass = "w-4 h-4 shrink-0 text-gray-400";

  async function handleOpenPdf(link) {
    try {
      await openPdfGiaoA(link);
    } catch (err) {
      onAlert?.(err.message || "Không mở được PDF");
    }
  }

  async function handlePickPdf(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !onPdfAttached) return;
    setUploading(true);
    try {
      const url = await uploadPdfGiaoAGoc(file, project.qd_giao_a);
      if (!url) throw new Error("Không lưu được file PDF.");
      await onPdfAttached(url, file.name);
    } catch (err) {
      onAlert?.(err.message || "Lỗi gắn PDF");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="mb-6">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-base leading-snug font-black tracking-tight text-[#1e3a8a] uppercase sm:text-lg">
            Công trình: {tenCongTrinh}
          </h1>
          <p className="mt-2 flex flex-wrap items-baseline gap-x-0 gap-y-1 text-sm leading-relaxed text-slate-700">
            <span>
              <span className="font-semibold text-slate-800">Mã dự án:</span>{" "}
              <span className="font-mono font-semibold text-slate-600">{project.ma_du_an}</span>
            </span>
            <span className={metaSepClass} aria-hidden>
              |
            </span>
            <span>
              <span className="font-semibold text-slate-800">Cấp điện áp:</span>{" "}
              <span className="font-bold text-slate-900">{capDienAp}</span>
            </span>
            <span className={metaSepClass} aria-hidden>
              |
            </span>
            <span>
              <span className="font-semibold text-slate-800">Giai đoạn:</span>{" "}
              <span className="font-bold text-teal-700">{giaiDoanBadge}</span>
            </span>
            {benAList.length ? (
              <>
                <span className={metaSepClass} aria-hidden>
                  |
                </span>
                <span>
                  <span className="font-semibold text-slate-800">Bên A:</span>{" "}
                  <span className="font-semibold text-slate-700">
                    {benAList
                      .map((u) =>
                        u.username ? `${u.ho_ten} (${u.username})` : u.ho_ten
                      )
                      .join(", ")}
                  </span>
                </span>
              </>
            ) : null}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            href="/du-an"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-900 shadow-sm transition-colors hover:bg-amber-100"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
            </svg>
            Trở về danh mục
          </Link>
        </div>
      </div>

      <WorkspaceSectionTitle icon="📊">Tổng quan dự án</WorkspaceSectionTitle>

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={handlePickPdf}
      />

      <div className="rounded-xl bg-gradient-to-r from-blue-400 via-teal-400 to-emerald-400 p-[1.5px] shadow-sm">
        <div className="overflow-hidden rounded-[10px] bg-white">
          <div className="grid grid-cols-1 divide-y divide-sky-100/90 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
            <div className="flex flex-col gap-3.5 bg-gradient-to-b from-blue-50/30 to-white p-4 sm:p-5">
              <Field label="Chủ đầu tư" value={chuDauTuDisplay} labelClass={sectionLabelClass} />
              <Field
                label="Địa điểm KS"
                value={project.dia_diem}
                labelClass={sectionLabelClass}
                valueClassName="font-semibold text-slate-900"
              />
              <div>
                <p className={`mb-1.5 text-[11px] font-bold uppercase tracking-wide ${sectionLabelClass}`}>
                  Hợp đồng
                </p>
                {hasHopDong ? (
                  <>
                    <div className="mb-1.5 text-center">
                      {onUpdateHopDong ? (
                        <button
                          type="button"
                          onClick={onUpdateHopDong}
                          className={hopDongLinkClass}
                          title="Mở sổ hợp đồng"
                        >
                          {hopDongTitle}
                        </button>
                      ) : (
                        <p className={hopDongTitleClass}>{hopDongTitle}</p>
                      )}
                    </div>
                    <div className={giaoABodyClass}>{hopDongDayDu || hopDongShort || "—"}</div>
                    {!hopDongPdf ? (
                      <p className="mt-1.5 text-xs italic text-gray-400">Chưa có file PDF hợp đồng</p>
                    ) : null}
                  </>
                ) : (
                  <div className="space-y-1">
                    {onUpdateHopDong ? (
                      <button
                        type="button"
                        onClick={onUpdateHopDong}
                        className="group inline-flex flex-wrap items-center gap-x-1.5 text-left text-sm leading-snug cursor-pointer"
                      >
                        <span className="font-bold italic text-[#1d4ed8] group-hover:text-[#1e3a8a]">
                          Hợp đồng
                        </span>
                        <span className="text-slate-400">—</span>
                        <span className={hopDongUpdateClass}>Nhấn để mở sổ hợp đồng</span>
                      </button>
                    ) : (
                      <p className="inline-flex flex-wrap items-center gap-x-1.5 text-left text-sm leading-snug">
                        <span className="font-bold italic text-[#1d4ed8]">Hợp đồng</span>
                        <span className="text-slate-400">—</span>
                        <span className={hopDongUpdateClass}>Nhấn để mở sổ hợp đồng</span>
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-auto border-t border-dashed border-blue-200/70 pt-3">
                {isKhn ? (
                  <div className="min-w-0">
                    <p className="mb-1 text-sm font-semibold text-slate-600">Giá trị tư vấn:</p>
                    <p className={tmdtValueClass}>{formatVnd(giaTriTuVanHieuLuc(project))}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:gap-0 sm:divide-x sm:divide-blue-100/80">
                    <div className="min-w-0 sm:pr-3">
                      <p className={`mb-1 text-[11px] font-bold tracking-wide uppercase ${sectionLabelClass}`}>
                        TMĐT gốc
                      </p>
                      {tmdtDisplay ? (
                        <p className={tmdtValueClass}>
                          {tmdtDisplay}
                          <span className={tmdtUnitClass}>Tr.đ</span>
                        </p>
                      ) : (
                        <p className="text-xs leading-snug text-gray-400 italic">Chưa có TMĐT</p>
                      )}
                    </div>
                    <div className="min-w-0 sm:pl-3">
                      <p className={`mb-1 text-[11px] font-bold tracking-wide uppercase ${sectionLabelClass}`}>
                        TMĐT điều chỉnh
                      </p>
                      {tmdtDc ? (
                        <p className={tmdtValueClass}>
                          {tmdtDc}
                          <span className={tmdtUnitClass}>Tr.đ</span>
                        </p>
                      ) : (
                        <p className="text-xs leading-snug text-gray-400 italic">Chưa có TMĐT điều chỉnh</p>
                      )}
                    </div>
                  </div>
                )}

                {!isKhn ? (
                  <div className="mt-3 border-t border-dashed border-blue-200/70 pt-3 min-w-0">
                    <p className="mb-1 text-sm font-semibold text-slate-600">Giá trị tư vấn:</p>
                    <p className={tmdtValueClass}>{formatVnd(giaTriTuVanHieuLuc(project))}</p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col bg-gradient-to-b from-teal-50/15 via-white to-emerald-50/20 lg:col-span-2">
              {isKhn ? (
                <>
                  <div className="grid flex-1 grid-cols-1 divide-y divide-sky-100/90 md:grid-cols-2 md:divide-x md:divide-y-0">
                    <div className="p-4 sm:p-5">
                      <p className={`mb-2 ${pairTitleClass}`}>Căn cứ hợp đồng</p>
                      <div className={`${giaoABodyClass} text-slate-700 not-italic`}>
                        Dự án khách hàng ngoài — không có QĐ Giao A nội bộ. Căn cứ pháp lý là hợp đồng tư vấn
                        2 bên (cột Hợp đồng bên trái).
                      </div>
                      {hasHopDong && onUpdateHopDong ? (
                        <button
                          type="button"
                          onClick={onUpdateHopDong}
                          className="mt-2 cursor-pointer text-xs font-semibold text-teal-700 hover:text-teal-900 hover:underline"
                        >
                          Mở sổ hợp đồng
                        </button>
                      ) : null}
                    </div>
                    <div className="p-4 sm:p-5">
                      <p className={`mb-2 ${pairTitleClass}`}>Quy mô / hạng mục theo HĐ</p>
                      <div className={quyMoBodyClass}>{project.quy_mo || "—"}</div>
                    </div>
                  </div>
                  <div className="border-t border-dashed border-teal-200/70" aria-hidden />
                  <div className="grid flex-1 grid-cols-1 divide-y divide-sky-100/90 md:grid-cols-2 md:divide-x md:divide-y-0">
                    <div className="p-4 sm:p-5">
                      <p className={`${pairTitleClass} mb-1.5`}>Giao A điều chỉnh</p>
                      <p className={`${giaoABodyClass} text-gray-400 not-italic`}>
                        Không áp dụng (khách hàng ngoài)
                      </p>
                    </div>
                    <div className="p-4 sm:p-5">
                      <p className={`mb-2 ${pairTitleClass}`}>Quy mô theo Giao A điều chỉnh</p>
                      <p className={`${quyMoBodyClass} text-gray-400 italic`}>
                        Không áp dụng (khách hàng ngoài)
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid flex-1 grid-cols-1 divide-y divide-sky-100/90 md:grid-cols-2 md:divide-x md:divide-y-0">
                    <div className="p-4 sm:p-5">
                      <div className="mb-2">
                        <GiaoATitleLink
                          title={giaoATitle}
                          pdfUrl={pdfGiaoAGoc}
                          onOpenPdf={handleOpenPdf}
                          linkClass={giaoALinkClass}
                          eyeClass={giaoAPdfEyeClass}
                          eyeInactiveClass={giaoAEyeInactiveClass}
                        />
                      </div>
                      <div className={giaoABodyClass}>
                        {giaoADayDu || project.qd_giao_a || "—"}
                      </div>
                      {pdfGiaoAGoc ? null : canAttachPdf ? (
                        <button
                          type="button"
                          disabled={uploading}
                          onClick={() => fileRef.current?.click()}
                          className="mt-2 text-xs font-semibold text-teal-700 hover:text-teal-900 hover:underline disabled:opacity-60"
                        >
                          {uploading ? "Đang tải…" : "Gắn file PDF Giao A"}
                        </button>
                      ) : (
                        <p className="mt-2 text-xs text-gray-400 italic">Chưa có file PDF Giao A</p>
                      )}
                    </div>
                    <div className="p-4 sm:p-5">
                      <p className={`mb-2 ${pairTitleClass}`}>Quy mô theo Giao A</p>
                      <div className={quyMoBodyClass}>{project.quy_mo || "—"}</div>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-teal-200/70" aria-hidden />

                  <div className="grid flex-1 grid-cols-1 divide-y divide-sky-100/90 md:grid-cols-2 md:divide-x md:divide-y-0">
                    <div className="p-4 sm:p-5">
                      <p className="mb-1.5 inline-flex flex-wrap items-center gap-x-1.5 text-sm leading-snug">
                        <span className="font-bold italic text-[#1d4ed8]">Giao A điều chỉnh</span>
                        <span className="font-normal text-slate-400 not-italic">—</span>
                        <span className="font-medium text-amber-700/85 not-italic">
                          Nhấn vào đây để cập nhật
                        </span>
                        <EyeOffIcon className="h-4 w-4 shrink-0 text-gray-400" />
                      </p>
                      <p className={`${giaoABodyClass} text-gray-400 not-italic`}>
                        Công trình chưa/không có giao A điều chỉnh
                      </p>
                    </div>
                    <div className="p-4 sm:p-5">
                      <p className={`mb-2 ${pairTitleClass}`}>Quy mô theo Giao A điều chỉnh</p>
                      <p className={`${quyMoBodyClass} text-gray-400 italic`}>
                        Công trình chưa/không có quy mô điều chỉnh
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
