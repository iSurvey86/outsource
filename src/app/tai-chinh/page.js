"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { loadAuthSession } from "../../lib/authSession";
import {
  canSeeTaiChinhAb,
  canSuaTaiChinhAb,
  filterDuAnForUser,
} from "../../lib/menuAccess";
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
  applyVndLiveInput,
  syncGiaTriTuVanFields,
  tamUngLan1KyVong,
} from "../../lib/finance";
import { openStoredFile, uploadTamUngBill } from "../../lib/pdfGiaoAStorage";
import { formatNgayVi } from "../../lib/formatNgay";
import { fetchDb, insertRow, logActivity, uid, updateRow } from "../../lib/store";
import { useAppDialog } from "../../components/AppDialog";

export default function TaiChinhPage() {
  const { showAlert } = useAppDialog();
  const [db, setDb] = useState(null);
  const [user, setUser] = useState(null);
  const [perms, setPerms] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [nhanModal, setNhanModal] = useState(null);
  const [nhanForm, setNhanForm] = useState({ ngay: "", soTienText: "" });
  const [nhanFile, setNhanFile] = useState(null);
  const [nhanSaving, setNhanSaving] = useState(false);

  async function reload() {
    setDb(await fetchDb());
  }

  useEffect(() => {
    function syncAuth() {
      const { user: u, perms: p } = loadAuthSession();
      setUser(u);
      setPerms(p);
    }
    syncAuth();
    reload().catch(console.error);
    window.addEventListener("outsrc-auth-session-changed", syncAuth);
    return () => window.removeEventListener("outsrc-auth-session-changed", syncAuth);
  }, []);

  const rows = useMemo(() => {
    if (!db) return [];
    return filterDuAnForUser(db.duAn, user).sort((a, b) =>
      String(a.ten || "").localeCompare(String(b.ten || ""), "vi")
    );
  }, [db, user]);

  const canView = canSeeTaiChinhAb(user, perms);
  const canEdit = canSuaTaiChinhAb(perms);

  if (user && perms && !canView) {
    return (
      <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 ring-1 ring-amber-200">
        Tài khoản của bạn không được xem sổ tài chính A↔B.
      </p>
    );
  }

  async function patchDuAn(duAn, patch) {
    if (!canSuaTaiChinhAb(perms)) {
      showAlert("Chỉ Admin được sửa sổ tài chính A↔B.");
      return;
    }
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

  function openNhanDot(duAn, gdList, dot, soTienNhap = null, opts = {}) {
    if (!canSuaTaiChinhAb(perms)) {
      showAlert("Chỉ Admin được nhận tạm ứng / thanh toán trên sổ A↔B.");
      return;
    }
    const meta = DOT_META[dot];
    if (!meta) return;
    const hien = dotHienThi(duAn, gdList, dot);
    const isEdit = Boolean(opts.isEdit || hien.locked);

    let soTien = Math.round(Number(soTienNhap) || 0);
    if (isEdit && hien.gd) {
      soTien = Math.round(Number(hien.gd.so_tien) || soTien);
    }
    if (!(soTien > 0) && dot === "lan1") {
      soTien = Math.round(tamUngLan1KyVong(duAn));
    }
    if (!(soTien > 0) && dot === "thanh_toan") {
      soTien = Math.max(0, Math.round(conLai(duAn, gdList)));
    }
    if (!(soTien > 0)) {
      showAlert("Vui lòng nhập số tiền trước.");
      return;
    }

    setNhanForm({
      ngay: isEdit && hien.gd?.ngay ? String(hien.gd.ngay).slice(0, 10) : new Date().toISOString().slice(0, 10),
      soTienText: formatVndShort(soTien),
    });
    setNhanFile(null);
    setNhanModal({
      duAn,
      dot,
      soTienGoiY: soTien,
      meta,
      isEdit,
      existingLink: hien.gd?.link_bill || null,
      gdId: hien.gd?.id || null,
    });
  }

  async function saveNhanDot() {
    if (!nhanModal || !user) return;
    const { duAn, dot, meta, isEdit, existingLink, gdId } = nhanModal;
    if (!nhanForm.ngay) {
      await showAlert("Vui lòng nhập ngày nhận.");
      return;
    }

    const soTien = Math.round(parseVndInput(nhanForm.soTienText));
    if (!(soTien > 0)) {
      await showAlert("Số tiền không hợp lệ.");
      return;
    }

    setNhanSaving(true);
    try {
      let linkBill = existingLink || null;
      if (nhanFile) {
        linkBill = await uploadTamUngBill(nhanFile, duAn.ma_du_an, dot);
      }

      const gdList = (db?.giaoDich || []).filter((g) => g.du_an_id === duAn.id);
      const existing =
        (gdId && gdList.find((g) => g.id === gdId)) || findGiaoDichByDot(gdList, dot);
      const noiDung = `${meta.title} — ${formatVnd(soTien)}`;

      if (existing) {
        await updateRow("giao_dich", existing.id, {
          so_tien: soTien,
          ngay: nhanForm.ngay,
          noi_dung: noiDung,
          loai: meta.loai,
          dot,
          link_bill: linkBill,
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
        if (!isEdit) duAnPatch.trang_thai = "da_tam_ung";
      } else if (dot === "thanh_toan" && !isEdit) {
        duAnPatch.trang_thai = "da_thanh_toan";
      }
      if (Object.keys(duAnPatch).length) {
        await updateRow("du_an", duAn.id, duAnPatch);
      }

      await logActivity({
        username: user.username,
        ho_ten: user.ho_ten,
        phan_he: "tai_chinh",
        hanh_dong: isEdit ? `SUA_${dot.toUpperCase()}` : `NHAN_${dot.toUpperCase()}`,
        chi_tiet: `${duAn.ma_du_an} · ${formatVnd(soTien)} · ${formatNgayVi(nhanForm.ngay)}`,
      });

      setNhanModal(null);
      await reload();
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
                Giá trị Tư vấn (Gtv)
              </th>
              <th
                rowSpan={2}
                className="border border-slate-300 px-1.5 py-2"
                title="25% × GT tư vấn hiệu lực"
              >
                Tổng phần B
                <span className="mt-0.5 block text-[10px] font-semibold text-slate-600">
                  (25%Gtv)
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
              <th className="border border-slate-300 px-1.5 py-1.5">Lần 1</th>
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
                  <td className="border border-slate-200 p-1 align-middle">
                    <MoneyCell
                      value={giaTriPadt(d)}
                      disabled={!canEdit || busy}
                      onCommit={(n) =>
                        patchDuAn(d, {
                          gia_tri_padt: n,
                          gia_tri_hop_dong: giaTriHopDongTv(d),
                        })
                      }
                    />
                  </td>
                  <td className="border border-slate-200 p-1 align-middle">
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
                  <td className="border border-slate-200 px-2 py-2 text-right align-middle text-xs font-bold tabular-nums text-blue-900">
                    {formatVndShort(giaTriBenB(d))}
                  </td>
                  <DotCell
                    mode="input"
                    hien={lan1}
                    canEdit={canEdit}
                    busy={busy}
                    requireNhan
                    placeholderGoiY={Math.round(tamUngLan1KyVong(d))}
                    onCommitSo={(n) => openNhanDot(d, gd, "lan1", n)}
                    onEdit={() => openNhanDot(d, gd, "lan1", null, { isEdit: true })}
                    onOpenBill={(link) =>
                      openStoredFile(link).catch((e) => showAlert(e.message))
                    }
                  />
                  <DotCell
                    mode="input"
                    hien={lan2}
                    canEdit={canEdit}
                    busy={busy}
                    requireNhan
                    onCommitSo={(n) => openNhanDot(d, gd, "lan2", n)}
                    onEdit={() => openNhanDot(d, gd, "lan2", null, { isEdit: true })}
                    onOpenBill={(link) =>
                      openStoredFile(link).catch((e) => showAlert(e.message))
                    }
                  />
                  <DotCell
                    mode="input"
                    hien={lan3}
                    canEdit={canEdit}
                    busy={busy}
                    requireNhan
                    onCommitSo={(n) => openNhanDot(d, gd, "lan3", n)}
                    onEdit={() => openNhanDot(d, gd, "lan3", null, { isEdit: true })}
                    onOpenBill={(link) =>
                      openStoredFile(link).catch((e) => showAlert(e.message))
                    }
                  />
                  <DotCell
                    mode="input"
                    hien={tt}
                    canEdit={canEdit}
                    busy={busy}
                    requireNhan
                    placeholderGoiY={Math.max(0, Math.round(conLai(d, gd)))}
                    onCommitSo={(n) => openNhanDot(d, gd, "thanh_toan", n)}
                    onEdit={() => openNhanDot(d, gd, "thanh_toan", null, { isEdit: true })}
                    onOpenBill={(link) =>
                      openStoredFile(link).catch((e) => showAlert(e.message))
                    }
                  />
                  <td className="border border-slate-200 p-1 align-middle">
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
          <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="bg-teal-700 px-4 py-3 text-white">
              <h3 className="text-sm font-bold uppercase tracking-wide">
                {nhanModal.isEdit ? `Sửa — ${nhanModal.meta.title}` : nhanModal.meta.title}
              </h3>
            </div>
            <div className="space-y-3 p-4">
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase text-slate-600">
                  Số tiền
                </label>
                {nhanModal.isEdit ? (
                  <input
                    type="text"
                    inputMode="numeric"
                    className="w-full rounded-lg border border-sky-200 px-3 py-2 text-sm font-black tabular-nums text-slate-900 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-300"
                    value={nhanForm.soTienText}
                    onChange={(e) => {
                      const el = e.target;
                      const { text, caret } = applyVndLiveInput(el.value, el.selectionStart);
                      setNhanForm({ ...nhanForm, soTienText: text });
                      requestAnimationFrame(() => {
                        try {
                          el.setSelectionRange(caret, caret);
                        } catch {
                          /* ignore */
                        }
                      });
                    }}
                  />
                ) : (
                  <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-black tabular-nums text-slate-900">
                    {nhanForm.soTienText}
                  </p>
                )}
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
                  Bill (PDF / ảnh)
                </label>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  disabled={nhanSaving}
                  className="w-full text-xs text-slate-700 file:mr-2 file:rounded-md file:border-0 file:bg-teal-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-teal-800"
                  onChange={(e) => setNhanFile(e.target.files?.[0] || null)}
                />
                {nhanFile ? (
                  <p className="mt-1 text-[11px] text-slate-500">{nhanFile.name}</p>
                ) : nhanModal.existingLink ? (
                  <p className="mt-1 text-[11px] text-teal-700">Đã có bill — chọn file mới để thay.</p>
                ) : null}
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
                {nhanSaving ? "Đang lưu…" : nhanModal.isEdit ? "Cập nhật" : "Nhận"}
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
  onEdit,
  onOpenBill,
  btnLabel = "Nhận",
  placeholderGoiY = 0,
  requireNhan = false,
}) {
  const [draft, setDraft] = useState(0);
  const [draftText, setDraftText] = useState("");
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (hien.locked) {
      setDraft(0);
      setDraftText("");
      setFocused(false);
    }
  }, [hien.locked, hien.soTien]);

  if (hien.locked) {
    const hasBill = Boolean(hien.gd?.link_bill);
    const canOpenEdit = canEdit && onEdit && !busy;

    return (
      <td className="border border-slate-200 bg-amber-50/80 px-2 py-2 text-center text-xs tabular-nums text-amber-950">
        <div>
          {hasBill ? (
            <button
              type="button"
              className="cursor-pointer font-black text-blue-700 underline-offset-2 hover:underline"
              title="Mở bill"
              onClick={() => onOpenBill(hien.gd.link_bill)}
            >
              {formatVndShort(hien.soTien)}
            </button>
          ) : canOpenEdit ? (
            <button
              type="button"
              className="cursor-pointer font-black text-amber-950 hover:text-teal-800"
              title="Sửa"
              onClick={onEdit}
            >
              {hien.soTien > 0 ? formatVndShort(hien.soTien) : "—"}
            </button>
          ) : (
            <span className="font-black">
              {hien.soTien > 0 ? formatVndShort(hien.soTien) : "—"}
            </span>
          )}
        </div>
        {hien.gd?.ngay ? (
          canOpenEdit ? (
            <button
              type="button"
              title="Sửa"
              className="mt-1 block w-full cursor-pointer text-[10px] font-medium text-slate-500 hover:text-teal-700"
              onClick={onEdit}
            >
              {formatNgayVi(hien.gd.ngay)}
            </button>
          ) : (
            <p className="mt-1 text-[10px] font-medium text-slate-500">
              {formatNgayVi(hien.gd.ngay)}
            </p>
          )
        ) : null}
      </td>
    );
  }

  if (mode === "input") {
    const hasTyped = draftText.trim().length > 0;
    const expanded = hasTyped || focused;
    const soNhan = draft > 0 ? draft : placeholderGoiY > 0 ? placeholderGoiY : 0;
    return (
      <td
        className={`border border-slate-200 p-1 ${expanded ? "align-top" : "align-middle"}`}
      >
        <div
          className={`flex min-h-[2.75rem] flex-col ${
            expanded ? "justify-start gap-0.5 pt-0.5" : "justify-center"
          }`}
        >
          <input
            type="text"
            inputMode="numeric"
            disabled={!canEdit || busy}
            placeholder={placeholderGoiY > 0 ? formatVndShort(placeholderGoiY) : ""}
            className="w-full rounded border border-sky-200/80 bg-white/80 px-1.5 py-1 text-right text-xs font-semibold tabular-nums text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400 hover:border-sky-300 focus:border-sky-400 focus:bg-white focus:ring-1 focus:ring-sky-200 disabled:cursor-default disabled:border-transparent disabled:bg-transparent"
            value={draftText}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              window.setTimeout(() => setFocused(false), 150);
            }}
            onChange={(e) => {
              const el = e.target;
              const { text, caret } = applyVndLiveInput(el.value, el.selectionStart);
              setDraftText(text);
              setDraft(parseVndInput(text));
              requestAnimationFrame(() => {
                try {
                  el.setSelectionRange(caret, caret);
                } catch {
                  /* ignore */
                }
              });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
          {expanded && requireNhan && canEdit && soNhan > 0 ? (
            <button
              type="button"
              disabled={busy}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onCommitSo?.(soNhan)}
              className="w-full text-[10px] font-bold text-teal-700 hover:underline disabled:opacity-50"
            >
              {btnLabel}
            </button>
          ) : null}
        </div>
      </td>
    );
  }

  return (
    <td className="border border-slate-200 px-2 py-2 text-center text-xs font-bold tabular-nums text-slate-900">
      <div>{hien.soTien > 0 ? formatVndShort(hien.soTien) : "—"}</div>
      {canEdit && hien.soTien > 0 ? (
        <button
          type="button"
          disabled={busy}
          onClick={onNhan}
          className="mt-1 text-[10px] font-semibold text-teal-700 hover:underline disabled:opacity-50"
        >
          {btnLabel}
        </button>
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
    <div className="flex min-h-[2.75rem] items-center">
      <input
        type="text"
        inputMode="numeric"
        disabled={disabled}
        placeholder={placeholder}
        className="w-full rounded border border-sky-200/80 bg-white/80 px-1.5 py-1 text-right text-xs font-semibold tabular-nums text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-300 hover:border-sky-300 focus:border-sky-400 focus:bg-white focus:ring-1 focus:ring-sky-200 disabled:cursor-default disabled:border-transparent disabled:bg-transparent"
        value={text}
        onChange={(e) => {
          const el = e.target;
          const { text: next, caret } = applyVndLiveInput(el.value, el.selectionStart);
          setText(next);
          requestAnimationFrame(() => {
            try {
              el.setSelectionRange(caret, caret);
            } catch {
              /* ignore */
            }
          });
        }}
        onBlur={() => {
          const n = parseVndInput(text);
          if (n !== Math.round(Number(value) || 0)) onCommit(n);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </div>
  );
}

function NoteCell({ value, disabled, onCommit }) {
  const [text, setText] = useState(value || "");
  useEffect(() => {
    setText(value || "");
  }, [value]);

  return (
    <div className="flex min-h-[2.75rem] items-center">
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
    </div>
  );
}
