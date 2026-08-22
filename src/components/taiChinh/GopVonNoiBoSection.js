"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  formatVnd,
  formatVndShort,
  listGopVonNoiBo,
  parseVndInput,
  applyVndLiveInput,
  quyGiuTheoNguoi,
  tongGopVonNoiBo,
} from "../../lib/finance";
import { formatNgayVi } from "../../lib/formatNgay";
import { openStoredFile, uploadGopVonBill } from "../../lib/pdfGiaoAStorage";
import { deleteRow, fetchDb, insertRow, logActivity, uid, updateRow } from "../../lib/store";
import { useAppDialog } from "../AppDialog";

/**
 * Góp vốn B↔B — nhập số → popup ngày + bill (giống sổ A↔B).
 */
export default function GopVonNoiBoSection({
  duAnId,
  maDuAn,
  rows = [],
  benBUiUsers = [],
  allBenBUsers = [],
  canEdit,
  user,
  onSaved,
}) {
  const { showAlert, showConfirm } = useAppDialog();
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const defaultId = benBUiUsers[0]?.id || "";

  const [draft, setDraft] = useState({
    nguoi_gop_id: defaultId,
    nguoi_giu_id: defaultId,
    soTienText: "",
  });

  const [modal, setModal] = useState(null);
  const [modalForm, setModalForm] = useState({ ngay: today, soTienText: "", ghi_chu: "" });
  const [billFile, setBillFile] = useState(null);

  const list = useMemo(
    () =>
      listGopVonNoiBo(rows, duAnId).sort((a, b) =>
        String(b.ngay || "").localeCompare(String(a.ngay || ""))
      ),
    [rows, duAnId]
  );

  const tongGop = tongGopVonNoiBo(rows, duAnId);
  const quyGiu = quyGiuTheoNguoi(rows, duAnId, allBenBUsers);

  function labelUser(id) {
    return allBenBUsers.find((u) => u.id === id)?.ho_ten || "—";
  }

  function openNewModal() {
    if (!canEdit) return;
    const so = Math.round(parseVndInput(draft.soTienText));
    if (!draft.nguoi_gop_id || !draft.nguoi_giu_id) {
      showAlert("Chọn người góp và người giữ quỹ.");
      return;
    }
    if (so <= 0) {
      showAlert("Nhập số tiền góp trước khi ghi nhận.");
      return;
    }
    setModalForm({ ngay: today, soTienText: formatVndShort(so), ghi_chu: "" });
    setBillFile(null);
    setModal({
      isEdit: false,
      nguoi_gop_id: draft.nguoi_gop_id,
      nguoi_giu_id: draft.nguoi_giu_id,
      existingLink: null,
      rowId: null,
    });
  }

  function openEditModal(row) {
    if (!canEdit) return;
    setModalForm({
      ngay: row.ngay ? String(row.ngay).slice(0, 10) : today,
      soTienText: formatVndShort(row.so_tien),
      ghi_chu: row.ghi_chu || "",
    });
    setBillFile(null);
    setModal({
      isEdit: true,
      nguoi_gop_id: row.nguoi_gop_id,
      nguoi_giu_id: row.nguoi_giu_id,
      existingLink: row.link_bill || null,
      rowId: row.id,
    });
  }

  async function saveModal() {
    if (!modal || !canEdit) return;
    const so = Math.round(parseVndInput(modalForm.soTienText));
    if (so <= 0) {
      await showAlert("Số tiền không hợp lệ.");
      return;
    }
    if (!modalForm.ngay) {
      await showAlert("Chọn ngày chuyển.");
      return;
    }

    setSaving(true);
    try {
      let linkBill = modal.existingLink || null;
      if (billFile) {
        linkBill = await uploadGopVonBill(billFile, maDuAn, modal.rowId || "moi");
      }

      if (modal.isEdit && modal.rowId) {
        await updateRow("gop_von_noi_bo", modal.rowId, {
          nguoi_gop_id: modal.nguoi_gop_id,
          nguoi_giu_id: modal.nguoi_giu_id,
          so_tien: so,
          ngay: modalForm.ngay,
          ghi_chu: modalForm.ghi_chu.trim() || null,
          link_bill: linkBill,
        });
        await logActivity({
          username: user?.username,
          ho_ten: user?.ho_ten,
          phan_he: "chia_noi_bo",
          hanh_dong: "SUA_GOP_VON",
          chi_tiet: `${maDuAn || duAnId} · ${formatVnd(so)}`,
        });
      } else {
        await insertRow("gop_von_noi_bo", {
          id: uid("gv"),
          du_an_id: duAnId,
          nguoi_gop_id: modal.nguoi_gop_id,
          nguoi_giu_id: modal.nguoi_giu_id,
          so_tien: so,
          ngay: modalForm.ngay,
          ghi_chu: modalForm.ghi_chu.trim() || null,
          link_bill: linkBill,
          nguoi_tao_id: user?.id || null,
        });
        await logActivity({
          username: user?.username,
          ho_ten: user?.ho_ten,
          phan_he: "chia_noi_bo",
          hanh_dong: "GOP_VON",
          chi_tiet: `${maDuAn || duAnId} · ${labelUser(modal.nguoi_gop_id)} → ${labelUser(modal.nguoi_giu_id)} · ${formatVnd(so)}`,
        });
        setDraft((d) => ({ ...d, soTienText: "" }));
      }

      setModal(null);
      onSaved?.(await fetchDb());
    } catch (err) {
      await showAlert(err.message || "Lỗi lưu góp vốn");
    } finally {
      setSaving(false);
    }
  }

  async function removeRow(row) {
    if (!canEdit) return;
    const ok = await showConfirm(
      `Xóa góp vốn ${formatVnd(row.so_tien)} (${labelUser(row.nguoi_gop_id)})?`
    );
    if (!ok) return;
    setSaving(true);
    try {
      await deleteRow("gop_von_noi_bo", row.id);
      await logActivity({
        username: user?.username,
        ho_ten: user?.ho_ten,
        phan_he: "chia_noi_bo",
        hanh_dong: "XOA_GOP_VON",
        chi_tiet: `${maDuAn || duAnId} · ${formatVnd(row.so_tien)}`,
      });
      onSaved?.(await fetchDb());
    } catch (err) {
      await showAlert(err.message || "Lỗi xóa");
    } finally {
      setSaving(false);
    }
  }

  async function openBill(link) {
    try {
      await openStoredFile(link);
    } catch (err) {
      await showAlert(err.message || "Không mở được bill.");
    }
  }

  return (
    <section className="flex h-full flex-col space-y-3 rounded-2xl border border-violet-200 bg-violet-50/40 p-4">
      <div>
        <h2 className="text-sm font-black uppercase tracking-wide text-violet-950">
          Góp vốn nội bộ (B↔B)
        </h2>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-violet-200 bg-white px-3 py-2">
          <p className="text-[10px] font-bold uppercase text-violet-800">Tổng đã góp</p>
          <p className="mt-0.5 text-right font-black tabular-nums text-violet-950">
            {tongGop > 0 ? formatVnd(tongGop) : "—"}
          </p>
        </div>
        {quyGiu.slice(0, 1).map((q) => (
          <div key={q.nguoi_dung_id} className="rounded-xl border border-violet-200 bg-white px-3 py-2">
            <p className="text-[10px] font-bold uppercase text-violet-800">
              Quỹ {q.ho_ten} giữ
            </p>
            <p className="mt-0.5 text-right font-black tabular-nums text-violet-950">{formatVnd(q.so_tien)}</p>
          </div>
        ))}
        {quyGiu.length > 1 ? (
          <div className="rounded-xl border border-violet-200 bg-white px-3 py-2 sm:col-span-2">
            <p className="text-[10px] font-bold uppercase text-violet-800">Quỹ các thành viên</p>
            <p className="mt-0.5 text-xs font-semibold text-violet-950">
              {quyGiu.map((q) => `${q.ho_ten}: ${formatVndShort(q.so_tien)}`).join(" · ")}
            </p>
          </div>
        ) : null}
      </div>

      {canEdit ? (
        <div className="rounded-xl border border-dashed border-violet-300 bg-white/80 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block min-w-0">
              <span className="mb-1 block text-[10px] font-bold uppercase text-violet-900">
                Người góp
              </span>
              <select
                className="w-full rounded-lg border border-violet-200 bg-violet-50/50 px-2 py-2 text-sm font-medium text-violet-950"
                value={draft.nguoi_gop_id}
                onChange={(e) => setDraft({ ...draft, nguoi_gop_id: e.target.value })}
              >
                {benBUiUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.ho_ten}
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-0">
              <span className="mb-1 block text-[10px] font-bold uppercase text-violet-900">
                Chuyển cho (giữ quỹ)
              </span>
              <select
                className="w-full rounded-lg border border-violet-200 bg-violet-50/50 px-2 py-2 text-sm font-medium text-violet-950"
                value={draft.nguoi_giu_id}
                onChange={(e) => setDraft({ ...draft, nguoi_giu_id: e.target.value })}
              >
                {benBUiUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.ho_ten}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="min-w-0 flex-1">
              <span className="mb-1 block text-[10px] font-bold uppercase text-violet-900">
                Số tiền góp
              </span>
              <input
                type="text"
                inputMode="numeric"
                className="w-full rounded-lg border border-sky-200 bg-sky-50/80 px-2 py-2 text-right text-sm font-black tabular-nums text-slate-900 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-200"
                placeholder="0"
                value={draft.soTienText}
                onChange={(e) => {
                  const { text } = applyVndLiveInput(e.target.value, e.target.selectionStart);
                  setDraft({ ...draft, soTienText: text });
                }}
              />
            </label>
            <button
              type="button"
              disabled={saving}
              onClick={openNewModal}
              className="shrink-0 rounded-lg bg-violet-700 px-4 py-2 text-sm font-black text-white hover:bg-violet-800 disabled:opacity-60"
            >
              Ghi nhận
            </button>
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-violet-200 bg-white">
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-violet-100 text-xs font-black uppercase text-violet-950">
              <tr>
                <th className="w-10 px-2 py-2">STT</th>
                <th className="px-2 py-2">Người góp</th>
                <th className="px-2 py-2">Giữ quỹ</th>
                <th className="px-2 py-2 text-center">Số tiền / bill</th>
                <th className="px-2 py-2">Ghi chú</th>
                {canEdit ? <th className="w-8 px-1 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {list.map((r, idx) => (
                <tr key={r.id} className="border-t border-violet-100">
                  <td className="px-2 py-2 tabular-nums text-violet-700">{idx + 1}</td>
                  <td className="px-2 py-2 text-xs font-bold text-violet-950">
                    {labelUser(r.nguoi_gop_id)}
                  </td>
                  <td className="px-2 py-2 text-xs font-semibold text-violet-900">
                    {labelUser(r.nguoi_giu_id)}
                  </td>
                  <td className="bg-amber-50/80 px-1 py-2 text-center text-xs tabular-nums">
                    {r.link_bill ? (
                      <button
                        type="button"
                        className="cursor-pointer font-black text-blue-700 underline-offset-2 hover:underline"
                        title="Mở bill"
                        onClick={() => openBill(r.link_bill)}
                      >
                        {formatVndShort(r.so_tien)}
                      </button>
                    ) : canEdit ? (
                      <button
                        type="button"
                        className="cursor-pointer font-black text-amber-950 hover:text-teal-800"
                        title="Sửa"
                        onClick={() => openEditModal(r)}
                      >
                        {formatVndShort(r.so_tien)}
                      </button>
                    ) : (
                      <span className="font-black">{formatVndShort(r.so_tien)}</span>
                    )}
                    {r.ngay ? (
                      canEdit ? (
                        <button
                          type="button"
                          title="Sửa"
                          className="mt-0.5 block w-full cursor-pointer text-[10px] font-medium text-slate-500 hover:text-teal-700"
                          onClick={() => openEditModal(r)}
                        >
                          {formatNgayVi(r.ngay)}
                        </button>
                      ) : (
                        <p className="mt-0.5 text-[10px] font-medium text-slate-500">
                          {formatNgayVi(r.ngay)}
                        </p>
                      )
                    ) : null}
                  </td>
                  <td className="px-2 py-2 text-[11px] text-violet-800">{r.ghi_chu || "—"}</td>
                  {canEdit ? (
                    <td className="px-1 py-2">
                      <button
                        type="button"
                        title="Xóa"
                        disabled={saving}
                        onClick={() => removeRow(r)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
              {!list.length ? (
                <tr>
                  <td
                    colSpan={canEdit ? 6 : 5}
                    className="px-4 py-8 text-center text-xs font-medium text-violet-800"
                  >
                    Chưa ghi nhận góp vốn nội bộ.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {modal ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="bg-violet-700 px-4 py-3 text-white">
              <h3 className="text-sm font-bold uppercase tracking-wide">
                {modal.isEdit ? "Sửa góp vốn nội bộ" : "Ghi nhận góp vốn nội bộ"}
              </h3>
              <p className="mt-0.5 text-[11px] font-medium text-violet-100">
                {labelUser(modal.nguoi_gop_id)} → {labelUser(modal.nguoi_giu_id)}
              </p>
            </div>
            <div className="space-y-3 p-4">
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase text-slate-600">
                  Số tiền
                </label>
                {modal.isEdit ? (
                  <input
                    type="text"
                    inputMode="numeric"
                    className="w-full rounded-lg border border-sky-200 px-3 py-2 text-sm font-black tabular-nums text-slate-900 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-300"
                    value={modalForm.soTienText}
                    onChange={(e) => {
                      const el = e.target;
                      const { text, caret } = applyVndLiveInput(el.value, el.selectionStart);
                      setModalForm({ ...modalForm, soTienText: text });
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
                    {modalForm.soTienText}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase text-slate-600">
                  Ngày chuyển <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  className="w-full rounded-lg border border-sky-200 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-300"
                  value={modalForm.ngay}
                  onChange={(e) => setModalForm({ ...modalForm, ngay: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase text-slate-600">
                  Bill chuyển khoản (PDF / ảnh)
                </label>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  disabled={saving}
                  className="w-full text-xs text-slate-700 file:mr-2 file:rounded-md file:border-0 file:bg-violet-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-violet-800"
                  onChange={(e) => setBillFile(e.target.files?.[0] || null)}
                />
                {billFile ? (
                  <p className="mt-1 text-[11px] text-slate-500">{billFile.name}</p>
                ) : modal.existingLink ? (
                  <p className="mt-1 text-[11px] text-violet-700">Đã có bill — chọn file mới để thay.</p>
                ) : null}
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase text-slate-600">
                  Ghi chú
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-sky-200 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-300"
                  value={modalForm.ghi_chu}
                  onChange={(e) => setModalForm({ ...modalForm, ghi_chu: e.target.value })}
                  placeholder="Tuỳ chọn…"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => setModal(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-white"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={saveModal}
                className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-bold text-white hover:bg-violet-800 disabled:opacity-60"
              >
                {saving ? "Đang lưu…" : modal.isEdit ? "Cập nhật" : "Ghi nhận"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
