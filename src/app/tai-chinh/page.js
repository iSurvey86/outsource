"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { loadAuthSession } from "../../lib/authSession";
import { canSuaDuAn } from "../../lib/menuAccess";
import { formatTmdtTrieuSo } from "../../lib/duAnMeta";
import {
  DOT_META,
  conLai,
  dotHienThi,
  findGiaoDichByDot,
  formatVnd,
  formatVndShort,
  giaTriBenB,
  giaTriHopDongTv,
  giaTriPadt,
  parseVndInput,
  syncGiaTriTuVanFields,
  tamUngLan1KyVong,
} from "../../lib/finance";
import { openStoredFile, uploadTamUngBill } from "../../lib/pdfGiaoAStorage";
import { fetchDb, insertRow, logActivity, uid, updateRow } from "../../lib/store";
import { useAppDialog } from "../../components/AppDialog";

export default function TaiChinhPage() {
  const { showAlert } = useAppDialog();
  const [db, setDb] = useState(null);
  const [user, setUser] = useState(null);
  const [perms, setPerms] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [nhanModal, setNhanModal] = useState(null);
  const [nhanForm, setNhanForm] = useState({ ngay: "", ghiChu: "", soTienText: "" });
  const [nhanFile, setNhanFile] = useState(null);
  const [nhanSaving, setNhanSaving] = useState(false);

  async function reload() {
    setDb(await fetchDb());
  }

  useEffect(() => {
    const { user: u, perms: p } = loadAuthSession();
    setUser(u);
    setPerms(p);
    reload().catch(console.error);
  }, []);

  const rows = useMemo(() => {
    if (!db) return [];
    return [...db.duAn].sort((a, b) =>
      String(a.ten || "").localeCompare(String(b.ten || ""), "vi")
    );
  }, [db]);

  const canEdit = canSuaDuAn(perms);

  async function patchDuAn(duAn, patch) {
    setSavingId(duAn.id);
    try {
      const synced = syncGiaTriTuVanFields(patch);
      await updateRow("du_an", duAn.id, synced);
      await logActivity({
        username: user.username,
        ho_ten: user.ho_ten,
        phan_he: "tai_chinh",
        hanh_dong: "SUA_GT",
        chi_tiet: duAn.ma_du_an,
      });
      await reload();
    } catch (err) {
      showAlert(err.message || "Lỗi lưu");
    } finally {
      setSavingId(null);
    }
  }

  function openNhanDot(duAn, gdList, dot, soTienNhap = null) {
    const meta = DOT_META[dot];
    if (!meta) return;
    const hien = dotHienThi(duAn, gdList, dot);
    if (hien.locked) return;

    let soTien = 0;
    if (dot === "lan1") {
      soTien = Math.round(tamUngLan1KyVong(duAn));
      if (soTien <= 0) {
        showAlert("Chưa có số tạm ứng lần 1 — nhập PAĐT hoặc Hợp đồng trước.");
        return;
      }
    } else {
      soTien = Math.round(Number(soTienNhap) || 0);
      if (soTien <= 0) {
        showAlert("Vui lòng nhập số tiền trước.");
        return;
      }
    }

    setNhanForm({
      ngay: new Date().toISOString().slice(0, 10),
      ghiChu: "",
      soTienText: formatVndShort(soTien),
    });
    setNhanFile(null);
    setNhanModal({ duAn, dot, soTienGoiY: soTien, meta });
  }

  async function saveNhanDot() {
    if (!nhanModal || !user) return;
    const { duAn, dot, meta, soTienGoiY } = nhanModal;
    if (!nhanForm.ngay) {
      await showAlert("Vui lòng nhập ngày nhận.");
      return;
    }

    const soTien = Math.round(nhanModal.soTienGoiY || parseVndInput(nhanForm.soTienText));
    if (!(soTien > 0)) {
      await showAlert("Số tiền không hợp lệ.");
      return;
    }

    setNhanSaving(true);
    try {
      let linkBill = null;
      if (nhanFile) {
        linkBill = await uploadTamUngBill(nhanFile, duAn.ma_du_an, dot);
      }

      const gdList = (db?.giaoDich || []).filter((g) => g.du_an_id === duAn.id);
      const existing = findGiaoDichByDot(gdList, dot);
      const noiDung =
        nhanForm.ghiChu.trim() || `${meta.title} — ${formatVnd(soTien)}`;

      if (existing) {
        await updateRow("giao_dich", existing.id, {
          so_tien: soTien,
          ngay: nhanForm.ngay,
          noi_dung: noiDung,
          loai: meta.loai,
          dot,
          ...(linkBill ? { link_bill: linkBill } : {}),
        });
      } else {
        await insertRow("giao_dich", {
          id: uid("gd"),
          du_an_id: duAn.id,
          loai: meta.loai,
          so_tien: soTien,
          ngay: nhanForm.ngay,
          noi_dung: noiDung,
          dot,
          link_bill: linkBill,
          nguoi_tao_id: user.id,
        });
      }

      const duAnPatch = {};
      if (dot === "lan1") {
        duAnPatch.tam_ung_lan1_khoa = true;
        duAnPatch.trang_thai = "da_tam_ung";
      } else if (dot === "thanh_toan") {
        duAnPatch.trang_thai = "da_thanh_toan";
      }
      if (Object.keys(duAnPatch).length) {
        await updateRow("du_an", duAn.id, duAnPatch);
      }

      await logActivity({
        username: user.username,
        ho_ten: user.ho_ten,
        phan_he: "tai_chinh",
        hanh_dong: `NHAN_${dot.toUpperCase()}`,
        chi_tiet: `${duAn.ma_du_an} · ${formatVnd(soTien)} · ${nhanForm.ngay}`,
      });

      setNhanModal(null);
      await reload();
      await showAlert(`Đã ghi nhận và khóa: ${meta.title}.`);
    } catch (err) {
      showAlert(err.message || "Lỗi ghi nhận");
    } finally {
      setNhanSaving(false);
    }
  }

  if (!db) {
    return <p className="text-sm font-semibold text-slate-600">Đang tải…</p>;
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-black text-slate-900">Tài chính A↔B</h1>
        <p className="mt-1 text-sm text-slate-600">
          Bảng theo dõi Giá trị tư vấn (PAĐT / Hợp đồng) và tạm ứng, thanh toán
        </p>
      </header>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[1080px] table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-10" />
            <col className="w-[28%]" />
            <col className="w-[5rem]" />
            <col className="w-[6.5rem]" />
            <col className="w-[6.5rem]" />
            <col className="w-[6.5rem]" />
            <col className="w-[6.5rem]" />
            <col className="w-[5.75rem]" />
            <col className="w-[5.75rem]" />
            <col className="w-[6.5rem]" />
            <col className="w-[12%]" />
          </colgroup>
          <thead>
            <tr className="bg-[#fde8e0] text-center text-xs font-bold text-slate-900">
              <th rowSpan={2} className="border border-slate-300 px-1.5 py-2">
                STT
              </th>
              <th rowSpan={2} className="border border-slate-300 px-3 py-2 text-center">
                Tên dự án
              </th>
              <th rowSpan={2} className="border border-slate-300 px-1.5 py-2">
                TMĐT
                <span className="mt-0.5 block text-[10px] font-semibold text-slate-600">(Trđ)</span>
              </th>
              <th colSpan={2} className="border border-slate-300 px-1.5 py-2">
                Giá trị Tư vấn
              </th>
              <th
                rowSpan={2}
                className="border border-slate-300 px-1.5 py-2"
                title="25% × GT tư vấn hiệu lực"
              >
                Tổng phần B
                <span className="mt-0.5 block text-[10px] font-semibold text-slate-600">
                  (25% GTV)
                </span>
              </th>
              <th colSpan={3} className="border border-slate-300 px-1.5 py-2">
                Tạm ứng
              </th>
              <th rowSpan={2} className="border border-slate-300 px-1.5 py-2">
                Thanh toán
              </th>
              <th rowSpan={2} className="border border-slate-300 px-2 py-2">
                Ghi chú
              </th>
            </tr>
            <tr className="bg-[#fde8e0] text-center text-[11px] font-bold text-slate-800">
              <th className="border border-slate-300 px-1.5 py-1.5">PAĐT</th>
              <th className="border border-slate-300 px-1.5 py-1.5">Hợp đồng</th>
              <th className="border border-slate-300 px-1.5 py-1.5">Lần 1 (30%)</th>
              <th className="border border-slate-300 px-1.5 py-1.5">Lần 2</th>
              <th className="border border-slate-300 px-1.5 py-1.5">Lần 3</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d, idx) => {
              const gd = db.giaoDich.filter((g) => g.du_an_id === d.id);
              const lan1 = dotHienThi(d, gd, "lan1");
              const lan2 = dotHienThi(d, gd, "lan2");
              const lan3 = dotHienThi(d, gd, "lan3");
              const tt = dotHienThi(d, gd, "thanh_toan");
              const busy = savingId === d.id;
              return (
                <tr key={d.id} className="odd:bg-white even:bg-slate-50/60 hover:bg-sky-50/50">
                  <td className="border border-slate-200 px-2 py-2 text-center tabular-nums text-slate-600">
                    {idx + 1}
                  </td>
                  <td className="border border-slate-200 px-3 py-2 text-left align-top">
                    <Link
                      href={`/du-an/${encodeURIComponent(d.ma_du_an)}`}
                      className="font-semibold leading-snug text-blue-700 hover:underline"
                    >
                      {d.ten}
                    </Link>
                    <p className="mt-0.5 break-all font-mono text-[11px] text-slate-500">
                      {d.ma_du_an}
                    </p>
                  </td>
                  <td className="border border-slate-200 px-2 py-2 text-right text-xs font-medium tabular-nums text-slate-800">
                    {formatTmdtTrieuSo(d.tmdt)}
                  </td>
                  <td className="border border-slate-200 p-1">
                    <MoneyCell
                      value={giaTriPadt(d)}
                      disabled={!canEdit || busy || lan1.locked}
                      onCommit={(n) =>
                        patchDuAn(d, {
                          gia_tri_padt: n,
                          gia_tri_hop_dong: giaTriHopDongTv(d),
                        })
                      }
                    />
                  </td>
                  <td className="border border-slate-200 p-1">
                    <MoneyCell
                      value={giaTriHopDongTv(d)}
                      disabled={!canEdit || busy}
                      onCommit={(n) =>
                        patchDuAn(d, {
                          gia_tri_hop_dong: n,
                          gia_tri_padt: giaTriPadt(d),
                        })
                      }
                    />
                  </td>
                  <td className="border border-slate-200 px-2 py-2 text-right text-xs font-bold tabular-nums text-blue-900">
                    {formatVndShort(giaTriBenB(d))}
                  </td>
                  <DotCell
                    mode="auto"
                    hien={lan1}
                    canEdit={canEdit}
                    busy={busy}
                    onNhan={() => openNhanDot(d, gd, "lan1")}
                    onOpenBill={(link) =>
                      openStoredFile(link).catch((e) => showAlert(e.message))
                    }
                  />
                  <DotCell
                    mode="input"
                    hien={lan2}
                    canEdit={canEdit}
                    busy={busy}
                    onCommitSo={(n) => openNhanDot(d, gd, "lan2", n)}
                    onOpenBill={(link) =>
                      openStoredFile(link).catch((e) => showAlert(e.message))
                    }
                  />
                  <DotCell
                    mode="input"
                    hien={lan3}
                    canEdit={canEdit}
                    busy={busy}
                    onCommitSo={(n) => openNhanDot(d, gd, "lan3", n)}
                    onOpenBill={(link) =>
                      openStoredFile(link).catch((e) => showAlert(e.message))
                    }
                  />
                  <DotCell
                    mode="input"
                    hien={tt}
                    canEdit={canEdit}
                    busy={busy}
                    placeholderGoiY={Math.max(0, Math.round(conLai(d, gd)))}
                    onCommitSo={(n) => openNhanDot(d, gd, "thanh_toan", n)}
                    onOpenBill={(link) =>
                      openStoredFile(link).catch((e) => showAlert(e.message))
                    }
                  />
                  <td className="border border-slate-200 p-1">
                    <NoteCell
                      value={d.ghi_chu_tai_chinh || ""}
                      disabled={!canEdit || busy}
                      onCommit={(text) => patchDuAn(d, { ghi_chu_tai_chinh: text })}
                    />
                  </td>
                </tr>
              );
            })}
            {!rows.length ? (
              <tr>
                <td
                  colSpan={11}
                  className="border border-slate-200 px-4 py-8 text-center text-slate-500"
                >
                  Chưa có dự án.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {nhanModal ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="bg-teal-700 px-4 py-3 text-white">
              <h3 className="text-sm font-bold uppercase tracking-wide">{nhanModal.meta.title}</h3>
              <p className="mt-0.5 truncate text-xs text-teal-100">{nhanModal.duAn.ten}</p>
            </div>
            <div className="space-y-3 p-4">
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase text-slate-600">
                  Số tiền ghi nhận
                </label>
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-black tabular-nums text-slate-900">
                  {formatVnd(nhanModal.soTienGoiY)}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {nhanModal.dot === "lan1"
                    ? "= 30% × phần B. Sau khi lưu sẽ khóa số này."
                    : "Xác nhận số đã nhập — sau khi lưu sẽ khóa."}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase text-slate-600">
                  Ngày nhận <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-sky-200 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-300"
                  value={nhanForm.ngay}
                  onChange={(e) => setNhanForm({ ...nhanForm, ngay: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase text-slate-600">
                  Bill (nếu có)
                </label>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  className="w-full text-xs text-slate-700 file:mr-2 file:rounded-md file:border-0 file:bg-teal-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-teal-800"
                  onChange={(e) => setNhanFile(e.target.files?.[0] || null)}
                />
                {nhanFile ? (
                  <p className="mt-1 text-[11px] text-slate-500">{nhanFile.name}</p>
                ) : null}
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase text-slate-600">
                  Ghi chú
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-sky-200 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-300"
                  value={nhanForm.ghiChu}
                  onChange={(e) => setNhanForm({ ...nhanForm, ghiChu: e.target.value })}
                  placeholder="Tuỳ chọn"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3">
              <button
                type="button"
                disabled={nhanSaving}
                onClick={() => setNhanModal(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-white"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={nhanSaving}
                onClick={saveNhanDot}
                className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-60"
              >
                {nhanSaving ? "Đang lưu…" : "Lưu & khóa"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DotCell({
  mode = "auto",
  hien,
  canEdit,
  busy,
  onNhan,
  onCommitSo,
  onOpenBill,
  btnLabel = "Nhận tạm ứng",
  placeholderGoiY = 0,
}) {
  if (mode === "input" && !hien.locked) {
    return (
      <td className="border border-slate-200 p-1">
        <MoneyCell
          value={0}
          disabled={!canEdit || busy}
          placeholder={placeholderGoiY > 0 ? formatVndShort(placeholderGoiY) : ""}
          onCommit={(n) => {
            if (n > 0) onCommitSo?.(n);
          }}
        />
      </td>
    );
  }

  return (
    <td
      className={`border border-slate-200 px-2 py-2 text-center text-xs font-bold tabular-nums ${
        hien.locked ? "bg-amber-50/80 text-amber-950" : "text-slate-900"
      }`}
    >
      <div>{hien.soTien > 0 ? formatVndShort(hien.soTien) : "—"}</div>
      {mode === "auto" && canEdit && !hien.locked && hien.soTien > 0 ? (
        <button
          type="button"
          disabled={busy}
          onClick={onNhan}
          className="mt-1 text-[10px] font-semibold text-teal-700 hover:underline disabled:opacity-50"
        >
          {btnLabel}
        </button>
      ) : null}
      {hien.locked ? (
        <div className="mt-1 space-y-0.5">
          <p className="text-[10px] font-semibold text-amber-800">đã khóa</p>
          {hien.gd?.ngay ? (
            <p className="text-[10px] font-medium text-slate-500">{hien.gd.ngay}</p>
          ) : null}
          {hien.gd?.link_bill ? (
            <button
              type="button"
              className="text-[10px] font-semibold text-blue-700 hover:underline"
              onClick={() => onOpenBill(hien.gd.link_bill)}
            >
              Xem bill
            </button>
          ) : null}
        </div>
      ) : null}
    </td>
  );
}

function MoneyCell({ value, disabled, onCommit, placeholder = "" }) {
  const [text, setText] = useState(value > 0 ? formatVndShort(value) : "");
  useEffect(() => {
    setText(value > 0 ? formatVndShort(value) : "");
  }, [value]);

  return (
    <input
      type="text"
      inputMode="numeric"
      disabled={disabled}
      placeholder={placeholder}
      className="w-full rounded border border-sky-200/80 bg-white/80 px-1.5 py-1 text-right text-xs font-semibold tabular-nums text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-300 hover:border-sky-300 focus:border-sky-400 focus:bg-white focus:ring-1 focus:ring-sky-200 disabled:cursor-default disabled:border-transparent disabled:bg-transparent"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const n = parseVndInput(text);
        if (n !== Math.round(Number(value) || 0)) onCommit(n);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}

function NoteCell({ value, disabled, onCommit }) {
  const [text, setText] = useState(value || "");
  useEffect(() => {
    setText(value || "");
  }, [value]);

  return (
    <input
      type="text"
      disabled={disabled}
      className="w-full rounded border border-sky-200/80 bg-white/80 px-1.5 py-1 text-xs text-slate-800 outline-none hover:border-sky-300 focus:border-sky-400 focus:bg-white focus:ring-1 focus:ring-sky-200 disabled:cursor-default disabled:border-transparent disabled:bg-transparent"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if ((text || "") !== (value || "")) onCommit(text.trim());
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}
