"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { loadAuthSession, isBenA } from "../../lib/authSession";
import { canSuaDuAn, canXoaDuAn, filterDuAnForUser } from "../../lib/menuAccess";
import { normalizeChuDauTu } from "../../lib/chuDauTuAlias";
import {
  GIAI_DOAN_OPTIONS,
  formatGiaoAShort,
  formatHopDongShort,
  giaiDoanBadgeClass,
} from "../../lib/duAnMeta";
import { formatGiaoAShort as formatGiaoAShortRaw, normalizeVietnameseGiaoADate } from "../../lib/formatGiaoA";
import { deleteDuAnCascade, fetchDb, logActivity, updateRow } from "../../lib/store";
import { useAppDialog } from "../../components/AppDialog";
import BenAUserSelect from "../../components/duAn/BenAUserSelect";
import {
  benAAssignPatch,
  getBenAUserIds,
  labelBenAGroup,
} from "../../lib/benAUsers";

const GIAI_DOAN_EDIT_OPTIONS = [
  { value: "BCNCKT", label: "BCNCKT (Nghiên cứu khả thi / FS)" },
  { value: "BCKTKT", label: "Báo cáo Kinh tế kỹ thuật" },
  { value: "TKBVTC", label: "Thiết kế Bản vẽ thi công" },
];

export default function DuAnListPage() {
  const { showAlert, showConfirm } = useAppDialog();
  const [db, setDb] = useState(null);
  const [user, setUser] = useState(null);
  const [perms, setPerms] = useState(null);
  const [q, setQ] = useState("");
  const [filterGiaiDoan, setFilterGiaiDoan] = useState("");
  const [filterChuDauTu, setFilterChuDauTu] = useState("");
  const [filterNam, setFilterNam] = useState("");
  const [filterDiaDiem, setFilterDiaDiem] = useState("");
  const [filterQd, setFilterQd] = useState("");
  const [sortBy, setSortBy] = useState("ngay_giao_a");
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

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

  const showBenACol = Boolean(perms?.q_admin);
  const showActionsCol = canSuaDuAn(perms) || canXoaDuAn(perms);

  const listChuDauTu = useMemo(() => {
    if (!db) return [];
    return [...new Set(filterDuAnForUser(db.duAn, user).map((d) => d.chu_dau_tu).filter(Boolean))].sort();
  }, [db, user]);

  const listNam = useMemo(() => {
    if (!db) return [];
    return [...new Set(filterDuAnForUser(db.duAn, user).map((d) => String(d.nam_giao_a || "")).filter(Boolean))].sort(
      (a, b) => Number(b) - Number(a)
    );
  }, [db, user]);

  const stats = useMemo(() => {
    if (!db) return { total: 0, BCNCKT: 0, BCKTKT: 0, TKBVTC: 0 };
    const visible = filterDuAnForUser(db.duAn, user);
    const s = { total: visible.length, BCNCKT: 0, BCKTKT: 0, TKBVTC: 0 };
    for (const d of visible) {
      if (s[d.giai_doan] != null) s[d.giai_doan] += 1;
    }
    return s;
  }, [db, user]);

  const filtered = useMemo(() => {
    if (!db) return [];
    let rows = filterDuAnForUser(db.duAn, user);
    const s = q.trim().toLowerCase();
    if (s) {
      rows = rows.filter(
        (d) =>
          d.ten?.toLowerCase().includes(s) ||
          d.ma_du_an?.toLowerCase().includes(s) ||
          (d.chu_dau_tu || "").toLowerCase().includes(s) ||
          (d.qd_giao_a || "").toLowerCase().includes(s) ||
          (d.hop_dong || "").toLowerCase().includes(s)
      );
    }
    if (filterGiaiDoan) rows = rows.filter((d) => d.giai_doan === filterGiaiDoan);
    if (filterChuDauTu) rows = rows.filter((d) => d.chu_dau_tu === filterChuDauTu);
    if (filterNam) rows = rows.filter((d) => String(d.nam_giao_a || "") === filterNam);
    if (filterDiaDiem.trim()) {
      const dd = filterDiaDiem.trim().toLowerCase();
      rows = rows.filter((d) => (d.dia_diem || "").toLowerCase().includes(dd));
    }
    if (filterQd.trim()) {
      const qd = filterQd.trim().toLowerCase();
      rows = rows.filter(
        (d) =>
          (d.qd_giao_a || "").toLowerCase().includes(qd) ||
          (d.qd_giao_a_day_du || "").toLowerCase().includes(qd)
      );
    }

    rows.sort((a, b) => {
      if (sortBy === "ten_cong_trinh") {
        return String(a.ten || "").localeCompare(String(b.ten || ""), "vi");
      }
      if (sortBy === "ngay_hop_dong") {
        return String(b.hop_dong_day_du || b.hop_dong || "").localeCompare(
          String(a.hop_dong_day_du || a.hop_dong || ""),
          "vi"
        );
      }
      const ta = a.ngay_giao_a || "";
      const tb = b.ngay_giao_a || "";
      if (ta === tb) return String(a.ten || "").localeCompare(String(b.ten || ""), "vi");
      return tb.localeCompare(ta);
    });
    return rows;
  }, [db, user, q, filterGiaiDoan, filterChuDauTu, filterNam, filterDiaDiem, filterQd, sortBy]);

  async function handleDelete(d) {
    if (!canXoaDuAn(perms)) return;
    const ok = await showConfirm(`Xóa dự án «${d.ten}»? Không hoàn tác được.`);
    if (!ok) return;
    try {
      await deleteDuAnCascade(d.id);
      await logActivity({
        username: user.username,
        ho_ten: user.ho_ten,
        phan_he: "du_an",
        hanh_dong: "XOA",
        chi_tiet: d.ma_du_an,
      });
      await reload();
    } catch (err) {
      showAlert(err.message || "Lỗi xóa dự án");
    }
  }

  async function handleOpenEditModal(project) {
    if (!canSuaDuAn(perms)) {
      await showAlert("Tài khoản của Anh/Chị không có quyền sửa dự án.");
      return;
    }
    setEditData({
      id: project.id,
      ma_du_an_goc: project.ma_du_an,
      ma_du_an: project.ma_du_an || "",
      ten_du_an: project.ten || "",
      giai_doan: project.giai_doan === "FS" ? "BCNCKT" : project.giai_doan || "BCNCKT",
      chu_dau_tu: project.chu_dau_tu || "",
      qd_giao_a: project.qd_giao_a || project.qd_giao_a_day_du || "",
      qd_giao_a_day_du: project.qd_giao_a_day_du || "",
      nam_giao_a: project.nam_giao_a || "",
      dia_diem_ks: project.dia_diem || "",
      hop_dong: project.hop_dong || "",
      hop_dong_day_du: project.hop_dong_day_du || "",
      ben_a_user_ids: getBenAUserIds(project),
    });
    setShowEditModal(true);
  }

  function handleCloseEditModal() {
    setShowEditModal(false);
    setEditData(null);
    setIsEditing(false);
  }

  async function handleSaveEdit() {
    if (!canSuaDuAn(perms)) {
      await showAlert("Tài khoản của Anh/Chị không có quyền sửa dự án.");
      return;
    }
    if (!editData?.ten_du_an?.trim() || !editData?.ma_du_an?.trim()) {
      await showAlert("Tên dự án và Mã dự án không được để trống!");
      return;
    }
    if (!getBenAUserIds({ ben_a_user_ids: editData.ben_a_user_ids }).length) {
      await showAlert(
        "Vui lòng chọn ít nhất một Tài khoản Bên A.\nCó thể chọn nhiều người (nhóm) — mỗi người đều thấy dự án."
      );
      return;
    }
    const newMa = editData.ma_du_an.trim();
    const oldMa = String(editData.ma_du_an_goc || "").trim();
    if (
      newMa !== oldMa &&
      db.duAn.some(
        (d) => d.id !== editData.id && String(d.ma_du_an).toUpperCase() === newMa.toUpperCase()
      )
    ) {
      await showAlert(`Mã dự án «${newMa}» đã tồn tại.`);
      return;
    }

    setIsEditing(true);
    try {
      const qdRaw = String(editData.qd_giao_a || "").trim();
      const qdNorm = formatGiaoAShortRaw(qdRaw, editData.qd_giao_a_day_du);
      const qdShort =
        qdNorm && qdNorm !== "-"
          ? qdNorm.replace(/\n/g, " ").trim()
          : normalizeVietnameseGiaoADate(qdRaw);
      const patch = {
        ten: editData.ten_du_an.trim(),
        ma_du_an: newMa,
        giai_doan: editData.giai_doan || "BCNCKT",
        chu_dau_tu: normalizeChuDauTu(editData.chu_dau_tu),
        dia_diem: String(editData.dia_diem_ks || "").trim(),
        qd_giao_a: qdShort,
        qd_giao_a_day_du: normalizeVietnameseGiaoADate(
          editData.qd_giao_a_day_du?.trim() || qdRaw
        ),
        nam_giao_a: String(editData.nam_giao_a || "").trim(),
        hop_dong: String(editData.hop_dong || "").trim(),
        hop_dong_day_du: String(editData.hop_dong_day_du || "").trim() || null,
        ...benAAssignPatch(editData.ben_a_user_ids),
      };
      await updateRow("du_an", editData.id, patch);
      await logActivity({
        username: user.username,
        ho_ten: user.ho_ten,
        phan_he: "du_an",
        hanh_dong: "SUA",
        chi_tiet: `${oldMa}${oldMa !== newMa ? ` → ${newMa}` : ""}`,
      });
      await showAlert("🎉 Đã cập nhật thông tin dự án.");
      handleCloseEditModal();
      await reload();
    } catch (err) {
      await showAlert("Lỗi khi lưu: " + (err.message || err));
    } finally {
      setIsEditing(false);
    }
  }

  if (!db) return <p className="text-sm font-bold text-teal-800">Đang tải…</p>;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-wide text-blue-950">
            Quản lý dự án
          </h1>
          <p className="mt-1 text-sm font-medium text-teal-800">
            {isBenA(user) ? "Dự án gắn tài khoản Bên A của Anh/Chị" : "Danh mục dự án toàn hệ thống"}
          </p>
        </div>
        {canSuaDuAn(perms) ? (
          <Link
            href="/nhap-du-an"
            className="inline-flex items-center gap-2 rounded-xl border-2 border-teal-500 bg-white px-4 py-2.5 text-sm font-black text-teal-800 shadow-sm transition hover:bg-teal-50"
          >
            <Plus className="h-4 w-4" />
            Nhập Dự án
          </Link>
        ) : null}
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Tổng dự án"
          value={stats.total}
          hint="Số công trình"
          active={!filterGiaiDoan}
          tone="blue"
          onClick={() => setFilterGiaiDoan("")}
        />
        {GIAI_DOAN_OPTIONS.map((gd) => (
          <KpiCard
            key={gd}
            label={gd}
            value={stats[gd]}
            hint="Theo giai đoạn"
            active={filterGiaiDoan === gd}
            tone={gd === "BCNCKT" ? "sky" : gd === "BCKTKT" ? "amber" : "violet"}
            onClick={() => setFilterGiaiDoan((v) => (v === gd ? "" : gd))}
          />
        ))}
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
        <div className="shrink-0 rounded-2xl border border-sky-200 bg-white p-2.5 shadow-sm lg:min-w-[12rem] lg:max-w-[22rem] lg:flex-[2.2]">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sky-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm tên…"
              className="w-full rounded-xl border border-sky-300 bg-sky-50 py-2 pl-8 pr-2 text-sm font-medium text-blue-950 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
            />
          </div>
        </div>

        <div className="min-w-0 flex-1 rounded-2xl border border-amber-200 bg-white p-2.5 shadow-sm">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-[minmax(7rem,1fr)_minmax(7rem,1fr)_minmax(6rem,0.85fr)_minmax(5.5rem,0.7fr)_minmax(4.25rem,0.55fr)_minmax(9rem,1.15fr)]">
        <input
          value={filterQd}
          onChange={(e) => setFilterQd(e.target.value)}
          placeholder="Số QĐ Giao A…"
          className="min-w-0 w-full rounded-xl border border-amber-200 bg-amber-50/80 px-2.5 py-2 text-sm font-medium text-blue-950"
        />
        <input
          value={filterDiaDiem}
          onChange={(e) => setFilterDiaDiem(e.target.value)}
          placeholder="Địa điểm KS…"
          className="min-w-0 w-full rounded-xl border border-amber-200 bg-amber-50/80 px-2.5 py-2 text-sm font-medium text-blue-950"
        />
        <select
          value={filterChuDauTu}
          onChange={(e) => setFilterChuDauTu(e.target.value)}
          className="min-w-0 w-full rounded-xl border border-amber-200 bg-amber-50/80 px-2.5 py-2 text-sm font-medium text-blue-950"
        >
          <option value="">Chủ đầu tư</option>
          {listChuDauTu.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={filterGiaiDoan}
          onChange={(e) => setFilterGiaiDoan(e.target.value)}
          className="min-w-0 w-full rounded-xl border border-amber-200 bg-amber-50/80 px-2.5 py-2 text-sm font-medium text-blue-950"
        >
          <option value="">Giai đoạn</option>
          {GIAI_DOAN_OPTIONS.map((gd) => (
            <option key={gd} value={gd}>
              {gd}
            </option>
          ))}
        </select>
        <select
          value={filterNam}
          onChange={(e) => setFilterNam(e.target.value)}
          className="min-w-0 w-full rounded-xl border border-amber-200 bg-amber-50/80 px-2.5 py-2 text-sm font-medium text-blue-950"
        >
          <option value="">Năm</option>
          {listNam.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="min-w-0 w-full rounded-xl border border-amber-200 bg-amber-50/80 px-2.5 py-2 text-sm font-medium text-blue-950"
        >
          <option value="ngay_giao_a">Sắp xếp: Ngày Giao A</option>
          <option value="ten_cong_trinh">Sắp xếp: Tên công trình</option>
          <option value="ngay_hop_dong">Sắp xếp: Hợp đồng</option>
        </select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-sky-200 bg-white shadow-sm">
        <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead className="bg-[#1e40af] text-xs font-black uppercase tracking-wide text-white">
              <tr>
                <th className="w-12 border-r border-[#1e3a8a] px-3 py-3 text-center">STT</th>
                <th className="border-r border-[#1e3a8a] px-3 py-3 text-center">Tên công trình</th>
                {showBenACol ? (
                  <th className="w-40 border-r border-[#1e3a8a] px-3 py-3 text-center">Bên A</th>
                ) : null}
                <th className="w-28 border-r border-[#1e3a8a] px-3 py-3 text-center">Giai đoạn</th>
                <th className="w-56 border-r border-[#1e3a8a] px-3 py-3 text-center">Giao A</th>
                <th className="w-64 border-r border-[#1e3a8a] px-3 py-3 text-center">Hợp đồng</th>
                {showActionsCol ? (
                  <th className="w-24 px-3 py-3 text-center">Thao tác</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {filtered.map((d, idx) => {
                const giaoAHienThi = formatGiaoAShort(d, { wrapDate: true });
                const hopDongHienThi = formatHopDongShort(d);
                const benALabel = labelBenAGroup(db.users, d);
                return (
                <tr
                  key={d.id}
                  className="border-t border-sky-100 odd:bg-white even:bg-sky-50/70 hover:bg-teal-50/70"
                >
                  <td className="px-3 py-3 text-center font-bold tabular-nums text-blue-900">
                    {idx + 1}
                  </td>
                  <td className="px-3 py-3 text-left">
                    <Link
                      href={`/du-an/${encodeURIComponent(d.ma_du_an)}`}
                      className="font-bold text-blue-700 hover:text-teal-700"
                    >
                      {d.ten}
                    </Link>
                    <p className="mt-0.5 text-xs font-semibold text-slate-500">{d.ma_du_an}</p>
                  </td>
                  {showBenACol ? (
                    <td className="px-3 py-3 text-center text-xs font-semibold text-blue-950">
                      {benALabel ? (
                        <span title={benALabel}>{benALabel}</span>
                      ) : (
                        <span className="font-bold text-amber-700">Chưa gán</span>
                      )}
                    </td>
                  ) : null}
                  <td className="px-3 py-3 text-center">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-black ring-1 ${giaiDoanBadgeClass(
                        d.giai_doan
                      )}`}
                    >
                      {d.giai_doan || "—"}
                    </span>
                  </td>
                  <td
                    className="px-3 py-3 text-center text-xs font-semibold leading-snug whitespace-pre-line text-blue-950"
                    title={d.qd_giao_a_day_du || d.qd_giao_a || ""}
                  >
                    {giaoAHienThi}
                  </td>
                  <td
                    className="px-3 py-3 text-center text-xs font-medium leading-snug text-blue-900"
                    title={d.hop_dong_day_du || d.hop_dong || ""}
                  >
                    {hopDongHienThi}
                  </td>
                  {showActionsCol ? (
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {canSuaDuAn(perms) ? (
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(d)}
                            className="rounded-lg p-1.5 text-blue-700 hover:bg-blue-50"
                            title="Sửa thông tin dự án"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        ) : null}
                        {canXoaDuAn(perms) ? (
                          <button
                            type="button"
                            onClick={() => handleDelete(d)}
                            className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
                            title="Xóa"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
                );
              })}
              {!filtered.length ? (
                <tr>
                  <td
                    colSpan={4 + (showBenACol ? 1 : 0) + (showActionsCol ? 1 : 0)}
                    className="px-4 py-8 text-center text-sm font-medium text-teal-700"
                  >
                    {isBenA(user)
                      ? "Chưa có dự án gắn tài khoản Bên A của Anh/Chị."
                      : "Không có dự án khớp bộ lọc."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {showEditModal && editData ? (
        <div className="fixed inset-0 z-[60] overflow-y-auto overscroll-contain bg-black/60 p-3 sm:p-4">
          <div className="flex min-h-full items-start justify-center py-2 sm:items-center sm:py-4">
            <div className="my-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
              <div className="relative flex shrink-0 items-center justify-center bg-blue-600 p-4 text-white">
                <h3 className="flex items-center gap-2 text-center text-lg font-bold uppercase tracking-wide">
                  <Pencil className="h-5 w-5 shrink-0" />
                  Chỉnh sửa thông tin dự án
                </h3>
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 transition hover:bg-blue-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="col-span-2">
                    <label className="mb-1 block text-xs font-bold uppercase text-gray-700">
                      Tên Dự án <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={2}
                      className="w-full rounded-lg border border-gray-300 p-2.5 text-sm font-semibold text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      value={editData.ten_du_an || ""}
                      onChange={(e) => setEditData({ ...editData, ten_du_an: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase text-gray-700">
                      Mã Dự án <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-gray-300 p-2 font-mono text-sm font-bold text-blue-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      value={editData.ma_du_an || ""}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          ma_du_an: e.target.value.replace(/\s/g, "").toUpperCase(),
                        })
                      }
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase text-gray-700">
                      Giai đoạn
                    </label>
                    <select
                      className="w-full cursor-pointer rounded-lg border border-gray-300 bg-white p-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      value={editData.giai_doan || ""}
                      onChange={(e) => setEditData({ ...editData, giai_doan: e.target.value })}
                    >
                      {GIAI_DOAN_EDIT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <BenAUserSelect
                      id="edit-ben-a"
                      users={db?.users || []}
                      value={editData.ben_a_user_ids || []}
                      required
                      disabled={isEditing}
                      onChange={(ids) => setEditData({ ...editData, ben_a_user_ids: ids })}
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="mb-1 block text-xs font-bold uppercase text-gray-700">
                      Chủ đầu tư
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      value={editData.chu_dau_tu || ""}
                      onChange={(e) => setEditData({ ...editData, chu_dau_tu: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase text-gray-700">
                      Số QĐ Giao A
                    </label>
                    <input
                      type="text"
                      placeholder="Vd: 406/QĐ-EVNNPC ngày 24/7/2026"
                      className="w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      value={editData.qd_giao_a || ""}
                      onChange={(e) => setEditData({ ...editData, qd_giao_a: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase text-gray-700">
                      Năm Giao A
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      value={editData.nam_giao_a || ""}
                      onChange={(e) => setEditData({ ...editData, nam_giao_a: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase text-gray-700">
                      Địa điểm Khảo sát
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      value={editData.dia_diem_ks || ""}
                      onChange={(e) => setEditData({ ...editData, dia_diem_ks: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase text-gray-700">
                      Hợp đồng (viết tắt)
                    </label>
                    <input
                      type="text"
                      placeholder="Vd: 308/2020/HĐTV-... ngày 07/12/2020"
                      className="w-full rounded-lg border border-gray-300 p-2 text-sm font-semibold text-green-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      value={editData.hop_dong || ""}
                      onChange={(e) => setEditData({ ...editData, hop_dong: e.target.value })}
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="mb-1 block text-xs font-bold uppercase text-gray-700">
                      Hợp đồng (đầy đủ)
                    </label>
                    <textarea
                      rows={2}
                      placeholder='Hợp đồng số … ngày … gói thầu: … dự án “…” giữa … và …'
                      className="w-full rounded-lg border border-gray-300 p-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      value={editData.hop_dong_day_du || ""}
                      onChange={(e) =>
                        setEditData({ ...editData, hop_dong_day_du: e.target.value })
                      }
                    />
                    <p className="mt-1 text-[11px] text-gray-500">
                      PDF hợp đồng: cập nhật trong trang công trình (Workspace).
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 flex-col-reverse gap-2 rounded-b-xl border-t border-gray-200 bg-gray-50 p-4 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  className="w-full rounded-lg border border-gray-300 px-5 py-2 font-bold text-gray-600 transition hover:bg-gray-100 sm:w-auto"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={isEditing || !editData.ten_du_an?.trim() || !editData.ma_du_an?.trim()}
                  className={`flex w-full items-center justify-center gap-2 rounded-lg px-6 py-2 font-bold text-white shadow-md transition sm:w-auto ${
                    isEditing || !editData.ten_du_an?.trim() || !editData.ma_du_an?.trim()
                      ? "cursor-not-allowed bg-blue-400"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {isEditing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {isEditing ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function KpiCard({ label, value, hint, active, tone, onClick }) {
  const tones = {
    blue: "from-blue-50 to-blue-100/80 border-blue-200 ring-blue-400",
    sky: "from-sky-50 to-cyan-100/70 border-sky-200 ring-sky-400",
    amber: "from-amber-50 to-orange-100/70 border-amber-200 ring-amber-400",
    violet: "from-violet-50 to-purple-100/70 border-violet-200 ring-violet-400",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border bg-gradient-to-br p-4 text-left shadow-sm transition ${
        tones[tone]
      } ${active ? "ring-2" : "hover:brightness-[0.99]"}`}
    >
      <p className="text-[11px] font-black uppercase tracking-widest text-blue-800/80">{label}</p>
      <p className="mt-1 text-3xl font-black tabular-nums text-blue-950">{value}</p>
      <p className="mt-1 text-xs font-medium text-teal-800">{hint}</p>
    </button>
  );
}
