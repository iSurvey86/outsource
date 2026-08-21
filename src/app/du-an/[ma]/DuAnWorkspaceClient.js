"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { loadAuthSession, isBenB } from "../../../lib/authSession";
import { canLapKs, canSuaDuAn } from "../../../lib/menuAccess";
import {
  HOP_DONG_ACTION,
  SURVEY_WORKFLOW,
  getKsStatusMap,
  getWorkflowAccent,
  isModuleUnlocked,
  workflowButtonLabel,
} from "../../../lib/duAnWorkspace";
import { fetchDb, insertRow, logActivity, uid, updateRow } from "../../../lib/store";
import { hasSupabase, supabase } from "../../../lib/supabase";
import { KsStatusChip } from "../../../components/StatusChip";
import { useAppDialog } from "../../../components/AppDialog";
import DuAnWorkspaceHeader from "../../../components/duAn/DuAnWorkspaceHeader";
import HoSoKhoPanel from "../../../components/duAn/HoSoKhoPanel";
import UpdateHopDongModal, { HopDongSoPanel } from "../../../components/duAn/UpdateHopDongModal";
import {
  parseHosoFolders,
  slugCustomFolderKey,
  validateCustomFolderLabel,
  itemsInFolder,
} from "../../../lib/hoSoFolders";

function asHopDongProject(p) {
  if (!p) return p;
  return { ...p, ten_du_an: p.ten_du_an || p.ten || "" };
}

export default function DuAnWorkspaceClient() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const ma = decodeURIComponent(params.ma || "");
  const { showAlert, showConfirm } = useAppDialog();
  const [tick, setTick] = useState(0);
  const [bundle, setBundle] = useState(undefined);
  const [user, setUser] = useState(null);
  const [perms, setPerms] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [addingFolder, setAddingFolder] = useState(false);
  const [showHopDongPanel, setShowHopDongPanel] = useState(false);
  const [showHopDongModal, setShowHopDongModal] = useState(false);
  const [hopDongEditId, setHopDongEditId] = useState(null);
  const [hopDongModalMode, setHopDongModalMode] = useState("chinh");
  const [hopDongGocId, setHopDongGocId] = useState(null);
  const [hopDongRefreshKey, setHopDongRefreshKey] = useState(0);
  const actionHandledRef = useRef(false);

  useEffect(() => {
    const sync = () => {
      const { user: u, perms: p } = loadAuthSession();
      setUser(u);
      setPerms(p);
    };
    sync();
    window.addEventListener("outsrc-auth-session-changed", sync);
    return () => window.removeEventListener("outsrc-auth-session-changed", sync);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchDb()
      .then((db) => {
        if (cancelled) return;
        const duAn = db.duAn.find((d) => d.ma_du_an === ma);
        if (!duAn) {
          setBundle(null);
          return;
        }
        setBundle({
          db,
          duAn,
          benAUser: db.users.find((u) => u.id === duAn.ben_a_user_id),
          ks: db.ksModules.filter((k) => k.du_an_id === duAn.id),
          tl: db.taiLieu.filter((t) => t.du_an_id === duAn.id),
        });
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [ma, tick]);

  function refresh() {
    setTick((t) => t + 1);
  }

  const clearActionParam = useCallback(() => {
    if (!searchParams.get("action")) return;
    router.replace(`/du-an/${encodeURIComponent(ma)}`);
  }, [router, ma, searchParams]);

  const openHopDongSo = useCallback(() => {
    if (!hasSupabase) {
      showAlert(
        "Sổ hợp đồng cần Supabase.\nChạy scripts/sql/008_create_hop_dong.sql … 017_du_an_link_pdf_hop_dong.sql rồi cấu hình .env.local."
      );
      return;
    }
    setShowHopDongPanel(true);
  }, [showAlert]);

  const openUpdateHopDongModal = useCallback(
    (editId = null, opts = {}) => {
      if (!canSuaDuAn(perms)) {
        showAlert(
          "Tài khoản không được phép cập nhật hợp đồng.\nChỉ Admin / người có quyền sửa dự án."
        );
        return;
      }
      if (!hasSupabase) {
        showAlert("Cần Supabase để lưu sổ hợp đồng.");
        return;
      }
      setHopDongEditId(editId);
      setHopDongModalMode(
        opts.mode === "phu_luc_dc"
          ? "phu_luc_dc"
          : opts.mode === "thau_phu"
            ? "thau_phu"
            : opts.mode === "ky_lai"
              ? "ky_lai"
              : "chinh"
      );
      setHopDongGocId(opts.gocId || null);
      setShowHopDongModal(true);
    },
    [perms, showAlert]
  );

  useEffect(() => {
    if (!bundle || actionHandledRef.current) return;
    const action = searchParams.get("action");
    if (!action) return;
    actionHandledRef.current = true;
    if (action === HOP_DONG_ACTION || action === "hop_dong") {
      if (!hasSupabase) {
        showAlert(
          "Sổ hợp đồng cần Supabase.\nChạy scripts/sql/008_create_hop_dong.sql … 017_du_an_link_pdf_hop_dong.sql rồi cấu hình .env.local."
        );
      } else {
        queueMicrotask(() => setShowHopDongPanel(true));
      }
      clearActionParam();
    }
  }, [bundle, searchParams, clearActionParam, showAlert]);

  if (!user || bundle === undefined) {
    return <p className="text-sm font-bold text-teal-800">Đang tải…</p>;
  }
  if (!bundle) {
    return (
      <div>
        <p className="font-bold text-rose-700">Không tìm thấy dự án {ma}</p>
        <Link href="/du-an" className="mt-2 inline-block text-sm font-bold text-blue-700">
          ← Danh mục
        </Link>
      </div>
    );
  }

  const { duAn, benAUser, ks, tl, db } = bundle;
  const hopDongProject = asHopDongProject(duAn);
  const allProjects = (db.duAn || []).map(asHopDongProject);
  const benBUser = isBenB(user);
  const canWorkKs = canLapKs(user, perms);
  const canEditHopDong = canSuaDuAn(perms);
  const canImportHopDongExcel = Boolean(perms?.q_admin);
  const canUploadHoSo = benBUser;
  const statusMap = getKsStatusMap(ks);
  const tlKs = tl.filter((t) => t.loai_kho === "khao_sat");
  const tlTk = tl.filter((t) => t.loai_kho === "thiet_ke");
  const hosoFolders = parseHosoFolders(duAn);

  async function setKsStatus(loai, trang_thai) {
    if (!canWorkKs) return;
    const row = statusMap[loai];
    if (!row) return;
    try {
      await updateRow("ks_module", row.id, { trang_thai });
      if (trang_thai === "da_xuat_ban") {
        await insertRow("tai_lieu", {
          id: uid("tl"),
          du_an_id: duAn.id,
          loai_kho: "khao_sat",
          nguon: "xuat_ban",
          ten_file: `${loai.toUpperCase()}-${duAn.ma_du_an}.pdf`,
          ghi_chu: `Xuất bản từ module ${loai}`,
          nguoi_up_id: user.id,
          thoi_gian: new Date().toISOString(),
          module_loai: loai,
          storage_path: null,
        });
      }
      await logActivity({
        username: user.username,
        ho_ten: user.ho_ten,
        phan_he: "khao_sat",
        hanh_dong: trang_thai === "da_xuat_ban" ? "XUAT_BAN" : "CAP_NHAT",
        chi_tiet: `${duAn.ma_du_an} / ${loai} → ${trang_thai}`,
      });
      refresh();
    } catch (err) {
      showAlert(err.message || "Lỗi cập nhật KS");
    }
  }

  async function handleModuleClick(mod) {
    const unlocked = isModuleUnlocked(mod, statusMap);
    if (!unlocked) {
      showAlert(workflowButtonLabel(mod, statusMap[mod.key], false, canWorkKs));
      return;
    }
    if (!canWorkKs) {
      showAlert("Bạn chỉ xem trạng thái — Bên B mới lập KS.");
      return;
    }
    const row = statusMap[mod.key];
    if (!row || row.trang_thai === "chua_lam") {
      await setKsStatus(mod.key, "dang_lam");
      showAlert(`Đã mở bước ${mod.shortLabel}. Form chi tiết sẽ bổ sung ở bước sau.`);
      return;
    }
    if (row.trang_thai === "dang_lam") {
      await setKsStatus(mod.key, "da_xuat_ban");
      return;
    }
    showAlert(`${mod.shortLabel} đã xuất bản. Form / tra cứu hồ sơ sẽ bổ sung sau.`);
  }

  async function handleFolderUpload({ loaiKho, moduleLoai, tenFile }) {
    if (!canUploadHoSo || !tenFile?.trim()) return;
    setUploading(true);
    try {
      await insertRow("tai_lieu", {
        id: uid("tl"),
        du_an_id: duAn.id,
        loai_kho: loaiKho,
        nguon: "upload",
        ten_file: tenFile.trim(),
        ghi_chu: "Upload thủ công (metadata)",
        nguoi_up_id: user.id,
        thoi_gian: new Date().toISOString(),
        module_loai: moduleLoai,
        storage_path: null,
      });
      await logActivity({
        username: user.username,
        ho_ten: user.ho_ten,
        phan_he: "ho_so",
        hanh_dong: "UPLOAD",
        chi_tiet: `${loaiKho}/${moduleLoai || "khac"}: ${tenFile}`,
      });
      refresh();
      showAlert("Đã ghi nhận tài liệu.");
    } catch (err) {
      showAlert(err.message || "Lỗi upload");
    } finally {
      setUploading(false);
    }
  }

  async function handleAddFolder({ loaiKho, label }) {
    if (!canUploadHoSo || !label?.trim()) return;
    const name = label.trim();
    const current = parseHosoFolders(duAn);
    const list = [...(current[loaiKho] || [])];
    const err = validateCustomFolderLabel(name, loaiKho, list);
    if (err) {
      showAlert(err);
      return;
    }
    const key = slugCustomFolderKey(name);
    list.push({ key, label: name });
    const next = { ...current, [loaiKho]: list };
    setAddingFolder(true);
    try {
      await updateRow("du_an", duAn.id, { hoso_folders: next });
      await logActivity({
        username: user.username,
        ho_ten: user.ho_ten,
        phan_he: "ho_so",
        hanh_dong: "TAO_FOLDER",
        chi_tiet: `${duAn.ma_du_an}/${loaiKho}: ${name}`,
      });
      refresh();
    } catch (e) {
      showAlert(e.message || "Không tạo được thư mục");
    } finally {
      setAddingFolder(false);
    }
  }

  async function handleRenameFolder({ loaiKho, key, label }) {
    if (!canUploadHoSo || !key || !label?.trim()) return;
    const name = label.trim();
    const current = parseHosoFolders(duAn);
    const list = [...(current[loaiKho] || [])];
    const err = validateCustomFolderLabel(name, loaiKho, list, key);
    if (err) {
      showAlert(err);
      return;
    }
    const idx = list.findIndex((f) => f.key === key);
    if (idx >= 0) list[idx] = { ...list[idx], label: name };
    else list.push({ key, label: name });
    const next = { ...current, [loaiKho]: list };
    setAddingFolder(true);
    try {
      await updateRow("du_an", duAn.id, { hoso_folders: next });
      await logActivity({
        username: user.username,
        ho_ten: user.ho_ten,
        phan_he: "ho_so",
        hanh_dong: "DOI_TEN_FOLDER",
        chi_tiet: `${duAn.ma_du_an}/${loaiKho}: ${key} → ${name}`,
      });
      refresh();
    } catch (e) {
      showAlert(e.message || "Không đổi tên được");
    } finally {
      setAddingFolder(false);
    }
  }

  async function handleDeleteFolder({ loaiKho, key, label }) {
    if (!canUploadHoSo || !key) return false;
    const files = itemsInFolder(
      tl.filter((t) => t.loai_kho === loaiKho),
      key,
      loaiKho,
      [key]
    );
    const msg =
      files.length > 0
        ? `Xóa thư mục「${label || key}」? ${files.length} file sẽ chuyển sang「Chưa phân loại」.`
        : `Xóa thư mục「${label || key}」?`;
    const ok = await showConfirm(msg, {
      title: "Xóa thư mục tùy chọn",
      confirmLabel: "Xóa",
      variant: "warning",
    });
    if (!ok) return false;

    const current = parseHosoFolders(duAn);
    const list = (current[loaiKho] || []).filter((f) => f.key !== key);
    const next = { ...current, [loaiKho]: list };
    setAddingFolder(true);
    try {
      for (const t of files) {
        await updateRow("tai_lieu", t.id, { module_loai: null });
      }
      await updateRow("du_an", duAn.id, { hoso_folders: next });
      await logActivity({
        username: user.username,
        ho_ten: user.ho_ten,
        phan_he: "ho_so",
        hanh_dong: "XOA_FOLDER",
        chi_tiet: `${duAn.ma_du_an}/${loaiKho}: ${label || key} (${files.length} file)`,
      });
      refresh();
      return true;
    } catch (e) {
      showAlert(e.message || "Không xóa được thư mục");
      return false;
    } finally {
      setAddingFolder(false);
    }
  }

  const hopDongModal = (
    <UpdateHopDongModal
      open={showHopDongModal}
      project={hopDongProject}
      allProjects={allProjects}
      canEdit={canEditHopDong}
      hopDongId={hopDongEditId}
      mode={hopDongModalMode}
      hopDongGocId={hopDongGocId}
      onClose={() => {
        setShowHopDongModal(false);
        setHopDongEditId(null);
        setHopDongModalMode("chinh");
        setHopDongGocId(null);
      }}
      onSaved={() => {
        setHopDongRefreshKey((k) => k + 1);
        refresh();
      }}
      showAlert={showAlert}
      showConfirm={showConfirm}
      supabase={supabase}
    />
  );

  if (showHopDongPanel) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-teal-50/70 via-slate-50 to-slate-100/60 p-6 lg:p-8">
          <HopDongSoPanel
            project={hopDongProject}
            allProjects={allProjects}
            canEdit={canEditHopDong}
            canImportExcel={canImportHopDongExcel}
            supabase={supabase}
            refreshKey={hopDongRefreshKey}
            onBack={() => {
              setShowHopDongPanel(false);
              refresh();
            }}
            onOpenEditor={(id, opts) => openUpdateHopDongModal(id, opts)}
          />
        </div>
        {hopDongModal}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DuAnWorkspaceHeader
        project={duAn}
        benAUser={benAUser}
        canAttachPdf={canSuaDuAn(perms)}
        onUpdateHopDong={openHopDongSo}
        onAlert={(msg) => showAlert(msg)}
        onPdfAttached={async (url, fileName) => {
          try {
            await updateRow("du_an", duAn.id, { link_pdf_giao_a_goc: url });
            await insertRow("tai_lieu", {
              id: uid("tl"),
              du_an_id: duAn.id,
              loai_kho: "khao_sat",
              nguon: "upload",
              ten_file: fileName || "GiaoA.pdf",
              ghi_chu: "PDF Giao A gốc",
              nguoi_up_id: user.id,
              thoi_gian: new Date().toISOString(),
              module_loai: null,
              storage_path: url,
            });
            await logActivity({
              username: user.username,
              ho_ten: user.ho_ten,
              phan_he: "du_an",
              hanh_dong: "UPLOAD",
              chi_tiet: `PDF Giao A: ${fileName || url}`,
            });
            refresh();
            showAlert("Đã gắn PDF Giao A.");
          } catch (err) {
            showAlert(err.message || "Lỗi gắn PDF");
          }
        }}
      />

      {benBUser ? (
        <section className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/80 via-white to-orange-50/40 p-5">
          <div className="mb-4 flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-amber-700" />
            <h2 className="text-sm font-black uppercase tracking-wide text-amber-950">
              Khảo sát & nghiệm thu
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {SURVEY_WORKFLOW.map((mod) => {
              const accent = getWorkflowAccent(mod.color);
              const row = statusMap[mod.key];
              const unlocked = isModuleUnlocked(mod, statusMap);
              const disabled = !unlocked;
              const label = workflowButtonLabel(mod, row, unlocked, canWorkKs);
              return (
                <div key={mod.key}>
                  <article
                    className={`flex h-full flex-col overflow-hidden rounded-xl border bg-white shadow-sm ${accent.card}`}
                  >
                    <div className={`h-1.5 w-full bg-gradient-to-r ${accent.top} to-transparent`} />
                    <div className="flex flex-1 flex-col p-4">
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black text-white shadow ${accent.step}`}
                        >
                          {mod.step}
                        </span>
                        <KsStatusChip status={row?.trang_thai || "chua_lam"} />
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                        {mod.shortLabel}
                      </p>
                      <h3 className="mt-1 text-sm font-bold leading-snug text-blue-950">{mod.label}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">{mod.description}</p>
                      <div className="mt-auto pt-3">
                        <button
                          type="button"
                          disabled={disabled && canWorkKs}
                          onClick={() => handleModuleClick(mod)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-bold text-white shadow-sm transition ${
                            disabled || !canWorkKs
                              ? "cursor-not-allowed bg-slate-300 text-slate-600"
                              : accent.btn
                          }`}
                        >
                          {label}
                        </button>
                      </div>
                    </div>
                  </article>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs font-medium text-amber-900/80">
            Form NVKS / PAKTKS / NKKS / BCKS / NT chi tiết sẽ làm ở các bước tiếp theo. Hiện cập nhật
            trạng thái stub (Lập → Đang làm → Xuất bản).
          </p>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <HoSoKhoPanel
          loaiKho="khao_sat"
          title="Hồ sơ khảo sát"
          items={tlKs}
          users={db.users}
          customFolders={hosoFolders.khao_sat}
          canUpload={canUploadHoSo}
          uploading={uploading}
          addingFolder={addingFolder}
          onUpload={handleFolderUpload}
          onAddFolder={handleAddFolder}
          onRenameFolder={handleRenameFolder}
          onDeleteFolder={handleDeleteFolder}
        />
        <HoSoKhoPanel
          loaiKho="thiet_ke"
          title="Hồ sơ thiết kế"
          items={tlTk}
          users={db.users}
          customFolders={hosoFolders.thiet_ke}
          canUpload={canUploadHoSo}
          uploading={uploading}
          addingFolder={addingFolder}
          onUpload={handleFolderUpload}
          onAddFolder={handleAddFolder}
          onRenameFolder={handleRenameFolder}
          onDeleteFolder={handleDeleteFolder}
        />
      </div>

      {hopDongModal}
    </div>
  );
}
