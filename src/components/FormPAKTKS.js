"use client";

import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from "react";
import { Eye } from "lucide-react";
import { supabase } from "../lib/supabase";
import { logHoatDong } from "../lib/logger";
import { useAppDialog } from "./AppDialog";
import { normalizeChuDauTu } from "../lib/chuDauTuAlias";
import { supplementDmCongViec, syncMauNuocQuantities } from "../lib/nvksLoaiHinh";
import {
  buildInitialFormFromSources,
  mergeSavedPakIntoForm,
  snapshotBangTinhFromNvks,
} from "../lib/paktksInit";
import { buildFilteredWorkItems } from "../lib/nvksFilteredWorkItems";
import { buildDsKhoiLuong, countPositiveKlRows } from "../lib/nvksKhoiLuongExport";
import { appendThoiGianThucHienDisplayRows } from "../lib/nvksDcKl";
import { getAuthUser } from "../lib/authSession";
import {
  DEFAULT_CNKS_OPTIONS,
  DEFAULT_LANH_DAO_OPTIONS,
  mergePersonnelOptions,
  resolveMaNvByHoTen,
} from "../lib/hoSoPersonnelDefaults";
import { exportPaktkWord, generatePaktkWordBlob } from "../lib/paktksWordExport";
import { convertDocxBlobToPdfDownload } from "../lib/exportPdfClient";
import {
  buildPaktkDownloadFileName,
  buildPaktkExportStoragePath,
  uploadPaktkExportBlob,
  uploadPaktkSignedPdf,
} from "../lib/paktksExportStorage";
import { parseNvksExportLink } from "../lib/nvksExportStorage";
import {
  EXPORT_REPLACE_CONFIRM_MSG,
  hasExistingExportFile,
  syncTaiLieuHoSoByTagSafe,
  syncXuatBanTaiLieuSafe,
} from "../lib/hoSoTaiLieu";
import { exportDisplayNameFromUrl } from "../lib/hoSoTaiLieuBackfill";
import HoSoPersonnelSidebar from "./HoSoPersonnelSidebar";
import ExportFileNameDisplay from "./ExportFileNameDisplay";
import NvksTrinhKyPanel from "./NvksTrinhKyPanel";
import { resetTrinhKyAfterPdfExport } from "../lib/trinhKy/resetAfterPdfExport";
import { useResizableTableColumns } from "../hooks/useResizableTableColumns";
import ResizableTh from "./table/ResizableTh";
import {
  fetchPaktkVersions,
  formatPaktkPhienBanLabel,
  isNvksSnapshotStale,
  isPhienBanGocPak,
  isPhienBanDcPak,
  setActivePaktkVersion,
  hasPaktkGocRecord,
  canCreatePaktkDieuChinh,
  createPaktkDieuChinhVersion,
  createPaktkDieuChinhFromNvks,
  fetchPaktkByNvksId,
} from "../lib/paktksPhienBan";
import { fetchNvksVersions } from "../lib/nvksPhienBan";
import {
  DEFAULT_CAP_DH,
  initDoVeTramTyLeQuantities,
  isDoVeTramTyLeItem,
} from "../lib/nvksDoVeTramTyLe";

function autoResizeTextarea(el) {
  if (!el) return;
  el.style.height = "0";
  const next = el.scrollHeight + 4;
  el.style.height = `${next}px`;
  if (el.scrollHeight > next) {
    el.style.height = `${el.scrollHeight + 2}px`;
  }
}

function readSessionUser() {
  return getAuthUser();
}

function formatDateInput(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function buildPaktkFormSnapshot(formData, quantities, capDhValues, hiddenItems, donViOverrides) {
  return JSON.stringify({
    quantities,
    capDhValues,
    hiddenItems: [...hiddenItems].sort(),
    donViOverrides,
    ma_du_an: formData.ma_du_an || "",
    ten_du_an: formData.ten_du_an || "",
    loai_hinh: formData.loai_hinh || "",
    chu_nhiem_ks: formData.chu_nhiem_ks || "",
    lanh_dao_duyet: formData.lanh_dao_duyet || "",
    thoi_diem_lap: formData.thoi_diem_lap || "",
    thoi_gian_ks_lap_bcks: formData.thoi_gian_ks_lap_bcks || "",
    quy_mo: formData.quy_mo || "",
    chu_dau_tu: formData.chu_dau_tu || "",
    dia_diem: formData.dia_diem || "",
    quyet_dinh_giao_a: formData.quyet_dinh_giao_a || "",
  });
}

const PAKTKS_TOOLBAR_BTN =
  "inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-45 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0";

function PaktksToolbarSpinner({ className = "w-3.5 h-3.5" }) {
  return (
    <svg className={`animate-spin shrink-0 ${className}`} fill="none" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function PaktksToolbarDivider() {
  return <div className="w-px h-6 bg-purple-300/60 mx-0.5 shrink-0 hidden sm:block" aria-hidden />;
}

export default function FormPAKTKS({ project, nvksRecord, paktksRecord: initialPaktk, onClose, onSaved }) {
  const { showAlert, showConfirm } = useAppDialog();

  const [formData, setFormData] = useState({});
  const [paktksRecordId, setPaktksRecordId] = useState(initialPaktk?.id || null);
  const [templateData, setTemplateData] = useState([]);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(true);
  const [quantities, setQuantities] = useState({});
  const [capDhValues, setCapDhValues] = useState({});
  const [hiddenItems, setHiddenItems] = useState(new Set());
  const [donViOverrides, setDonViOverrides] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isPrintingPdf, setIsPrintingPdf] = useState(false);
  const [trinhKyActions, setTrinhKyActions] = useState(null);
  const [isCreatingDc, setIsCreatingDc] = useState(false);
  const [isScanningPheDuyet, setIsScanningPheDuyet] = useState(false);
  const [pheDuyetScanPercent, setPheDuyetScanPercent] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const [nvksSnapshotAt, setNvksSnapshotAt] = useState(initialPaktk?.nvks_snapshot_at || null);
  const [versionList, setVersionList] = useState([]);
  const [nvksFresh, setNvksFresh] = useState(nvksRecord);
  const [needsSync, setNeedsSync] = useState(false);

  const [listCNKS, setListCNKS] = useState(() => [...DEFAULT_CNKS_OPTIONS]);
  const [listLanhDao, setListLanhDao] = useState(() => [...DEFAULT_LANH_DAO_OPTIONS]);
  const [nhanSuCatalog, setNhanSuCatalog] = useState([]);

  const loadVersionList = useCallback(async (maDuAn) => {
    if (!maDuAn) {
      setVersionList([]);
      return [];
    }
    try {
      const list = await fetchPaktkVersions(supabase, maDuAn);
      setVersionList(list);
      return list;
    } catch (err) {
      console.warn("Không tải phiên bản PAKTKS:", err.message);
      return [];
    }
  }, []);

  const refreshNvksLink = useCallback(async () => {
    if (!nvksRecord?.id) return null;
    const { data, error } = await supabase.from("HO_SO_NVKS").select("*").eq("id", nvksRecord.id).single();
    if (error) {
      console.warn("Không tải NVKS cho PAK:", error.message);
      return nvksRecord;
    }
    setNvksFresh(data);
    return data;
  }, [nvksRecord]);

  useEffect(() => {
    refreshNvksLink();
    loadVersionList(project?.ma_du_an || nvksRecord?.ma_du_an);
  }, [refreshNvksLink, loadVersionList, project?.ma_du_an, nvksRecord?.ma_du_an]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const trySelect = async (cols) => {
        const { data, error } = await supabase
          .from("NHAN_SU")
          .select(cols)
          .eq("trang_thai", 1)
          .order("ho_ten");
        if (error) throw error;
        return data || [];
      };
      try {
        let data;
        try {
          data = await trySelect("ma_nv, ho_ten, sdt, chu_ky_path, chu_ky_nhay_path, chuc_vu, phan_quyen, trang_thai");
        } catch {
          try {
            data = await trySelect("ma_nv, ho_ten, sdt, chu_ky_path, chuc_vu, phan_quyen, trang_thai");
          } catch {
            data = await trySelect("ma_nv, ho_ten, chuc_vu, phan_quyen, trang_thai");
          }
        }
        if (cancelled) return;
        setNhanSuCatalog(data);
      } catch (err) {
        console.warn("Không tải danh mục nhân sự cho trình ký PAKTKS:", err?.message || err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!nhanSuCatalog.length) return;
    setFormData((prev) => {
      const cnMa = prev.chu_nhiem_ks_ma_nv || resolveMaNvByHoTen(nhanSuCatalog, prev.chu_nhiem_ks);
      const ldMa = prev.lanh_dao_duyet_ma_nv || resolveMaNvByHoTen(nhanSuCatalog, prev.lanh_dao_duyet);
      if (cnMa === prev.chu_nhiem_ks_ma_nv && ldMa === prev.lanh_dao_duyet_ma_nv) return prev;
      return {
        ...prev,
        ...(cnMa ? { chu_nhiem_ks_ma_nv: cnMa } : {}),
        ...(ldMa ? { lanh_dao_duyet_ma_nv: ldMa } : {}),
      };
    });
  }, [nhanSuCatalog]);

  useEffect(() => {
    if (!paktksRecordId || !nvksFresh) {
      setNeedsSync(false);
      return;
    }
    const stale = isNvksSnapshotStale(
      { du_lieu_bang_tinh: { quantities, capDhValues, hiddenItems: Array.from(hiddenItems), donViOverrides } },
      nvksFresh
    );
    setNeedsSync(stale && isPhienBanGocPak(formData.phien_ban));
  }, [paktksRecordId, nvksFresh, quantities, capDhValues, hiddenItems, donViOverrides, formData.phien_ban]);

  const qdGiaoARef = useRef(null);
  const quyMoRef = useRef(null);
  const suppressDirtyRef = useRef(true);
  const hydrationEndRef = useRef(null);
  const savedSnapshotRef = useRef(null);
  const hydrationCommitRef = useRef(false);
  const [formDirty, setFormDirty] = useState(!initialPaktk?.id);

  const commitSavedSnapshot = useCallback(() => {
    savedSnapshotRef.current = buildPaktkFormSnapshot(
      formData,
      quantities,
      capDhValues,
      hiddenItems,
      donViOverrides
    );
    setFormDirty(false);
  }, [formData, quantities, capDhValues, hiddenItems, donViOverrides]);

  const finishHydration = useCallback((markDirty = false) => {
    suppressDirtyRef.current = true;
    hydrationCommitRef.current = !markDirty;
    if (markDirty) {
      savedSnapshotRef.current = null;
      setFormDirty(true);
    }
    if (hydrationEndRef.current) {
      cancelAnimationFrame(hydrationEndRef.current);
      hydrationEndRef.current = null;
    }
    hydrationEndRef.current = requestAnimationFrame(() => {
      hydrationEndRef.current = requestAnimationFrame(() => {
        suppressDirtyRef.current = false;
        hydrationEndRef.current = null;
      });
    });
  }, []);

  const applyBangTinhSnapshot = useCallback((snap) => {
    if (!snap) return;
    const q = syncMauNuocQuantities({ ...(snap.quantities || {}) });
    initDoVeTramTyLeQuantities({ id_cong_viec: "CV_026", cong_thuc: "12" }, q);
    setQuantities(q);
    const cap = { ...(snap.capDhValues || {}) };
    if (!cap.CV_026) cap.CV_026 = DEFAULT_CAP_DH;
    setCapDhValues(cap);
    setHiddenItems(new Set(snap.hiddenItems || []));
    setDonViOverrides(snap.donViOverrides || {});
  }, []);

  const initFromRecords = useCallback(() => {
    const sessionUser = readSessionUser();
    suppressDirtyRef.current = true;

    if (initialPaktk) {
      setPaktksRecordId(initialPaktk.id);
      setNvksSnapshotAt(initialPaktk.nvks_snapshot_at || null);
      const merged = mergeSavedPakIntoForm(
        {
          ...initialPaktk,
          thoi_diem_lap: formatDateInput(initialPaktk.thoi_diem_lap),
          phien_ban: initialPaktk.phien_ban || "GOC",
          so_lan_dc: Number(initialPaktk.so_lan_dc) || 0,
          link_docx_xuat: initialPaktk.link_docx_xuat || "",
          link_pdf_xuat: initialPaktk.link_pdf_xuat || "",
          link_pdf_da_ky: initialPaktk.link_pdf_da_ky || "",
          link_pdf_ky_dau: initialPaktk.link_pdf_ky_dau || "",
          exported_at: initialPaktk.exported_at || "",
          trang_thai_ky_noi_bo: initialPaktk.trang_thai_ky_noi_bo || "chua_trinh",
          trinh_ky_id: initialPaktk.trinh_ky_id || "",
          nguoi_lap_ma_nv: initialPaktk.nguoi_lap_ma_nv || "",
          chu_nhiem_ks_ma_nv: initialPaktk.chu_nhiem_ks_ma_nv || "",
          lanh_dao_duyet_ma_nv: initialPaktk.lanh_dao_duyet_ma_nv || "",
        },
        project,
        nvksRecord
      );
      setFormData(merged);
      setListCNKS(mergePersonnelOptions(DEFAULT_CNKS_OPTIONS, merged.chu_nhiem_ks));
      setListLanhDao(mergePersonnelOptions(DEFAULT_LANH_DAO_OPTIONS, merged.lanh_dao_duyet));
      applyBangTinhSnapshot(initialPaktk.du_lieu_bang_tinh);
      finishHydration(false);
    } else {
      const base = buildInitialFormFromSources(project, nvksRecord, sessionUser);
      setFormData({
        ...base,
        trang_thai_ky_noi_bo: "chua_trinh",
        trinh_ky_id: "",
        nguoi_lap_ma_nv: sessionUser?.ma_nv || "",
        chu_nhiem_ks_ma_nv: "",
        lanh_dao_duyet_ma_nv: "",
      });
      setListCNKS(mergePersonnelOptions(DEFAULT_CNKS_OPTIONS, base.chu_nhiem_ks));
      setListLanhDao(mergePersonnelOptions(DEFAULT_LANH_DAO_OPTIONS, base.lanh_dao_duyet));
      applyBangTinhSnapshot(snapshotBangTinhFromNvks(nvksRecord));
      setNvksSnapshotAt(new Date().toISOString());
      finishHydration(true);
    }
    setInitialized(true);
  }, [initialPaktk, project, nvksRecord, applyBangTinhSnapshot, finishHydration]);

  useEffect(() => {
    if (!hydrationCommitRef.current) return;
    if (!initialized || isLoadingTemplate || !templateData.length) return;
    hydrationCommitRef.current = false;
    commitSavedSnapshot();
  }, [initialized, isLoadingTemplate, templateData.length, commitSavedSnapshot]);

  useEffect(() => {
    if (suppressDirtyRef.current) return;
    if (!savedSnapshotRef.current) {
      setFormDirty(true);
      return;
    }
    const current = buildPaktkFormSnapshot(formData, quantities, capDhValues, hiddenItems, donViOverrides);
    setFormDirty(current !== savedSnapshotRef.current);
  }, [quantities, capDhValues, hiddenItems, donViOverrides, formData]);

  const fetchTemplateData = useCallback(async () => {
    try {
      setIsLoadingTemplate(true);
      const { data, error } = await supabase.from("DM_CONG_VIEC").select("*").order("id_cong_viec", { ascending: true });
      if (error) throw error;
      setTemplateData(supplementDmCongViec(data || []));
    } catch (err) {
      console.error("Lỗi tải DM công việc PAKTKS:", err.message);
    } finally {
      setIsLoadingTemplate(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplateData();
  }, [fetchTemplateData]);

  useEffect(() => {
    initFromRecords();
  }, [initialPaktk?.id, initFromRecords]);

  useLayoutEffect(() => {
    autoResizeTextarea(qdGiaoARef.current);
    autoResizeTextarea(quyMoRef.current);
  }, [formData.quyet_dinh_giao_a, formData.quy_mo, initialized]);

  const filteredWorkItems = useMemo(() => {
    return buildFilteredWorkItems(
      templateData,
      { giaiDoan: formData.giai_doan, loaiHinh: formData.loai_hinh },
      hiddenItems
    );
  }, [templateData, formData.giai_doan, formData.loai_hinh, hiddenItems]);

  const dsKhoiLuongDisplay = useMemo(() => {
    if (!initialized || !formData.loai_hinh) return [];
    const base = buildDsKhoiLuong({ filteredWorkItems, quantities, capDhValues, donViOverrides });
    return appendThoiGianThucHienDisplayRows(base, formData, {
      fields: ["thoi_gian_ks_lap_bcks"],
    });
  }, [
    initialized,
    formData.loai_hinh,
    formData.thoi_gian_ks_lap_bcks,
    filteredWorkItems,
    quantities,
    capDhValues,
    donViOverrides,
  ]);

  const positiveKlCount = useMemo(() => countPositiveKlRows(dsKhoiLuongDisplay), [dsKhoiLuongDisplay]);

  const isQdPdLocked = Boolean(formData.quyet_dinh_phe_duyet_paktks?.trim());
  /** Khóa cứng: đã chốt. Khóa mềm: đang trình ký. Không khóa vì đã ký nội bộ. */
  const isKlLocked =
    formData.trang_thai_paktks === "da_chot" ||
    formData.trang_thai_ky_noi_bo === "dang_trinh";

  const handleSelectNhanSu = (field, maNv, hoTen) => {
    if (isKlLocked) return;
    if (field === "chu_nhiem_ks") {
      setFormData((prev) => ({
        ...prev,
        chu_nhiem_ks_ma_nv: maNv,
        chu_nhiem_ks: hoTen || prev.chu_nhiem_ks,
      }));
    } else if (field === "lanh_dao_duyet") {
      setFormData((prev) => ({
        ...prev,
        lanh_dao_duyet_ma_nv: maNv,
        lanh_dao_duyet: hoTen || prev.lanh_dao_duyet,
      }));
    }
  };

  const handleInputChange = (e) => {
    if (isKlLocked) return;
    const { name, value } = e.target;
    if (value === "ADD_NEW") {
      if (name === "chu_nhiem_ks") {
        const val = prompt("Nhập tên Chủ nhiệm khảo sát mới:");
        if (val?.trim()) {
          const trimmed = val.trim();
          setListCNKS((prev) => mergePersonnelOptions(DEFAULT_CNKS_OPTIONS, prev, trimmed));
          setFormData((prev) => ({ ...prev, chu_nhiem_ks: trimmed }));
        }
      } else if (name === "lanh_dao_duyet") {
        const val = prompt("Nhập tên Lãnh đạo phê duyệt mới:");
        if (val?.trim()) {
          const trimmed = val.trim();
          setListLanhDao((prev) => mergePersonnelOptions(DEFAULT_LANH_DAO_OPTIONS, prev, trimmed));
          setFormData((prev) => ({ ...prev, lanh_dao_duyet: trimmed }));
        }
      }
      return;
    }
    if (name === "chu_nhiem_ks") {
      setFormData((prev) => ({
        ...prev,
        chu_nhiem_ks: value,
        chu_nhiem_ks_ma_nv: resolveMaNvByHoTen(nhanSuCatalog, value),
      }));
    } else if (name === "lanh_dao_duyet") {
      setFormData((prev) => ({
        ...prev,
        lanh_dao_duyet: value,
        lanh_dao_duyet_ma_nv: resolveMaNvByHoTen(nhanSuCatalog, value),
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const preventInvalidNumberInput = (e) => {
    if (
      [46, 8, 9, 27, 13, 110, 190].includes(e.keyCode) ||
      (e.keyCode === 65 && e.ctrlKey) ||
      (e.keyCode === 67 && e.ctrlKey) ||
      (e.keyCode === 86 && e.ctrlKey) ||
      (e.keyCode === 88 && e.ctrlKey) ||
      (e.keyCode >= 35 && e.keyCode <= 39)
    ) {
      return;
    }
    if ((e.shiftKey || e.keyCode < 48 || e.keyCode > 57) && (e.keyCode < 96 || e.keyCode > 105)) {
      e.preventDefault();
    }
  };

  const handleSyncFromNvks = async () => {
    if (isKlLocked) return;
    const fresh = (await refreshNvksLink()) || nvksRecord;
    if (!fresh) return;
    const ok = await showConfirm(
      "Đồng bộ lại sẽ ghi đè snapshot khối lượng từ NVKS hiện tại.\n\nTiếp tục?",
      { confirmLabel: "Đồng bộ", cancelLabel: "Hủy" }
    );
    if (!ok) return;
    applyBangTinhSnapshot(snapshotBangTinhFromNvks(fresh));
    setNvksSnapshotAt(new Date().toISOString());
    setNeedsSync(false);
    savedSnapshotRef.current = null;
    setFormDirty(true);
    await showAlert("Đã đồng bộ khối lượng từ NVKS. Nhớ bấm Lưu để ghi vào hồ sơ PAKTKS.");
  };

  const applyPakRecordById = async (recordId, { markDirtyAfterLoad = false } = {}) => {
    suppressDirtyRef.current = true;
    const maDuAn = formData.ma_du_an || project?.ma_du_an;
    await setActivePaktkVersion(supabase, maDuAn, recordId);
    const { data, error } = await supabase.from("HO_SO_PAKTKS").select("*").eq("id", recordId).single();
    if (error) throw error;
    if (data.nvks_id) {
      const { data: linkedNvks, error: nvksErr } = await supabase
        .from("HO_SO_NVKS")
        .select("*")
        .eq("id", data.nvks_id)
        .single();
      if (!nvksErr && linkedNvks) setNvksFresh(linkedNvks);
    }
    setPaktksRecordId(data.id);
    setNvksSnapshotAt(data.nvks_snapshot_at || null);
    const merged = mergeSavedPakIntoForm(
      {
        ...data,
        thoi_diem_lap: formatDateInput(data.thoi_diem_lap),
        phien_ban: data.phien_ban || "GOC",
        so_lan_dc: Number(data.so_lan_dc) || 0,
        link_docx_xuat: data.link_docx_xuat || "",
        link_pdf_xuat: data.link_pdf_xuat || "",
        link_pdf_da_ky: data.link_pdf_da_ky || "",
        link_pdf_ky_dau: data.link_pdf_ky_dau || "",
        exported_at: data.exported_at || "",
        trang_thai_ky_noi_bo: data.trang_thai_ky_noi_bo || "chua_trinh",
        trinh_ky_id: data.trinh_ky_id || "",
        nguoi_lap_ma_nv: data.nguoi_lap_ma_nv || "",
        chu_nhiem_ks_ma_nv: data.chu_nhiem_ks_ma_nv || "",
        lanh_dao_duyet_ma_nv: data.lanh_dao_duyet_ma_nv || "",
      },
      project,
      nvksRecord
    );
    setFormData(merged);
    applyBangTinhSnapshot(data.du_lieu_bang_tinh);
    hydrationCommitRef.current = true;
    finishHydration(markDirtyAfterLoad);
    await loadVersionList(maDuAn);
  };

  const handleSwitchPakVersion = async (recordId) => {
    if (!recordId || recordId === paktksRecordId) return;
    try {
      await applyPakRecordById(recordId, { markDirtyAfterLoad: false });
    } catch (err) {
      await showAlert(`Không chuyển được phiên bản PAKTKS: ${err.message}`);
    }
  };

  const handleDieuChinh = async () => {
    if (!paktksRecordId) {
      await showAlert("Cần lưu bản GỐC PAKTKS trước khi tạo ĐIỀU CHỈNH.");
      return;
    }
    const maDuAn = formData.ma_du_an || project?.ma_du_an;
    const versions = versionList.length ? versionList : await loadVersionList(maDuAn);
    const gate = canCreatePaktkDieuChinh(versions);
    if (!gate.ok) {
      await showAlert(gate.reason);
      return;
    }
    const ok = await showConfirm(
      "Tạo bản ĐIỀU CHỈNH PAKTKS mới?\n\nBản hiện tại được giữ nguyên trong lịch sử. Bản mới copy KL từ NVKS tương ứng để chỉnh theo thực địa."
    );
    if (!ok) return;

    try {
      setIsCreatingDc(true);
      const maxDc = versions.reduce((m, v) => Math.max(m, Number(v.so_lan_dc) || 0), 0);
      const nextDc = maxDc + 1;
      const nvksVersions = await fetchNvksVersions(
        supabase,
        maDuAn,
        "id, so_lan_dc, phien_ban, is_active, parent_nvks_id"
      );
      const nvksDc = nvksVersions.find((v) => Number(v.so_lan_dc) === nextDc);

      let newId;
      if (nvksDc) {
        const existing = await fetchPaktkByNvksId(supabase, nvksDc.id, "id");
        if (existing) {
          newId = existing.id;
        } else {
          const { data: fullNvks, error: nvksLoadErr } = await supabase
            .from("HO_SO_NVKS")
            .select("*")
            .eq("id", nvksDc.id)
            .single();
          if (nvksLoadErr) throw nvksLoadErr;
          const created = await createPaktkDieuChinhFromNvks(supabase, fullNvks, project);
          newId = created.id;
        }
      } else {
        const { data: source, error: srcErr } = await supabase
          .from("HO_SO_PAKTKS")
          .select("*")
          .eq("id", paktksRecordId)
          .single();
        if (srcErr) throw srcErr;
        const freshNvks = nvksFresh || (await refreshNvksLink()) || nvksRecord;
        const created = await createPaktkDieuChinhVersion(supabase, source, versions, freshNvks);
        newId = created.id;
      }

      await applyPakRecordById(newId, { markDirtyAfterLoad: true });
      await showAlert(
        `Đã tạo bản ĐIỀU CHỈNH lần ${nextDc}. Chỉnh thông tin và bấm Lưu trên bản mới.`
      );
      logHoatDong({
        phanHe: "PAKTKS",
        hanhDong: "CREATE_DC",
        chiTietNgan: `Tạo PAKTKS ĐIỀU CHỈNH lần ${nextDc}`,
        doiTuongId: newId,
        duLieuDong: { ma_du_an: maDuAn, parent: paktksRecordId, so_lan_dc: nextDc, giai_doan: formData.giai_doan },
      });
      onSaved?.({ id: newId, ma_du_an: maDuAn });
    } catch (err) {
      await showAlert(`Không tạo được bản ĐIỀU CHỈNH:\n${err.message}`);
    } finally {
      setIsCreatingDc(false);
    }
  };

  const handleChotKl = async () => {
    if (!paktksRecordId || isKlLocked) return;
    const phienBanLabel = formatPaktkPhienBanLabel({
      phien_ban: formData.phien_ban,
      so_lan_dc: formData.so_lan_dc,
    });
    const ok = await showConfirm(
      isPhienBanDcPak(formData.phien_ban)
        ? `Chốt khối lượng bản ${phienBanLabel}?\n\nSau khi chốt không thể SỬA trên bản này.`
        : "Chốt khối lượng bản GỐC PAKTKS?\n\nSau khi chốt không SỬA được (cần ĐIỀU CHỈNH nếu thay đổi so với NVKS)."
    );
    if (!ok) return;
    try {
      const { error } = await supabase
        .from("HO_SO_PAKTKS")
        .update({ trang_thai_paktks: "da_chot" })
        .eq("id", paktksRecordId);
      if (error) throw error;
      setFormData((prev) => ({ ...prev, trang_thai_paktks: "da_chot" }));
      await loadVersionList(formData.ma_du_an || project?.ma_du_an);
      logHoatDong({
        phanHe: "PAKTKS",
        hanhDong: "CHOT_KL",
        chiTietNgan: `Chốt KL PAKTKS ${phienBanLabel}: ${formData.ten_du_an}`,
        doiTuongId: paktksRecordId,
        duLieuDong: { phien_ban: formData.phien_ban, so_lan_dc: formData.so_lan_dc, giai_doan: formData.giai_doan },
      });
      await showAlert(`Đã chốt khối lượng bản ${phienBanLabel}.`);
    } catch (err) {
      await showAlert(`Không chốt được KL: ${err.message}`);
    }
  };

  const cleanForFileName = (str) => {
    if (!str) return "DuAn";
    let cleaned = str
      .replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a")
      .replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e")
      .replace(/ì|í|ị|ỉ|ĩ/g, "i")
      .replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o")
      .replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u")
      .replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y")
      .replace(/đ/g, "d")
      .replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A")
      .replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E")
      .replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I")
      .replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O")
      .replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U")
      .replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y")
      .replace(/Đ/g, "D")
      .replace(/[^a-zA-Z0-9]/g, "_")
      .replace(/_+/g, "_");
    return cleaned.replace(/^_|_$/g, "");
  };

  const handleUploadPheDuyet = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (isQdPdLocked || isKlLocked) return;
    if (!paktksRecordId) {
      await showAlert("Vui lòng Lưu hồ sơ PAKTKS trước khi đính kèm Quyết định phê duyệt.");
      e.target.value = "";
      return;
    }

    setIsScanningPheDuyet(true);
    setPheDuyetScanPercent(4);
    let uploadTick = null;
    const storageBucket = "pdfs_phe_duyet_paktks";

    try {
      uploadTick = setInterval(() => {
        setPheDuyetScanPercent((p) => (p < 28 ? p + 2 : p));
      }, 180);

      const fileExt = file.name.split(".").pop() || "pdf";
      const safeName = cleanForFileName(formData.ma_du_an || formData.ten_du_an);
      const suffix = formData.phien_ban === "GOC" ? "GOC" : "DC";
      const fileName = `${safeName}_PD_PAKTKS_${suffix}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(storageBucket)
        .upload(fileName, file, { cacheControl: "3600", upsert: true });

      if (uploadTick) clearInterval(uploadTick);
      uploadTick = null;

      if (uploadError) throw new Error("Lỗi khi tải file lên Storage: " + uploadError.message);

      setPheDuyetScanPercent(32);

      const { data: publicUrlData } = supabase.storage.from(storageBucket).getPublicUrl(fileName);
      const fileUrl = publicUrlData.publicUrl;

      const fileData = new FormData();
      fileData.append("file", file);
      fileData.append("ten_du_an", formData.ten_du_an || project?.ten_du_an || "");
      fileData.append("loai_ho_so", "paktks");

      const data = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/parse-phe-duyet");
        xhr.onload = () => {
          try {
            const parsed = JSON.parse(xhr.responseText || "{}");
            if (xhr.status >= 200 && xhr.status < 300) {
              setPheDuyetScanPercent(98);
              resolve(parsed);
            } else {
              reject(new Error(parsed.error || "Lỗi khi hệ thống quét file"));
            }
          } catch {
            reject(new Error("Lỗi khi hệ thống quét file"));
          }
        };
        xhr.onerror = () => reject(new Error("Không thể kết nối máy chủ."));
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable && ev.total > 0) {
            const pct = 32 + Math.round((ev.loaded / ev.total) * 62);
            setPheDuyetScanPercent(Math.min(96, pct));
          }
        };
        xhr.send(fileData);
      });

      setPheDuyetScanPercent(100);

      const soQdNgan = data.so_quyet_dinh?.value || "";
      const quyetDinhDayDu = data.quyet_dinh_day_du || "";
      const ngayQd = data.ngay_qd || "";
      const warning = data.so_quyet_dinh?.warning || "";
      const tenTrongQd = data.ten_cong_trinh_trong_qd || "";
      const doKhop = data.do_khop ?? 0;
      const khopDuAn = Boolean(data.khop_du_an);

      if (!soQdNgan) {
        await supabase.storage.from(storageBucket).remove([fileName]);
        await showAlert(
          "Hệ thống nhận dạng không đọc được số QĐ phê duyệt PAKTKS trong file này.\n\nFile đã bị hủy — vui lòng kiểm tra và chọn đúng QĐ phê duyệt.",
          { variant: "warning" }
        );
        return;
      }

      if (!khopDuAn) {
        const tenHeThong = formData.ten_du_an || project?.ten_du_an || "";
        let detailMsg = data.canh_bao_khop || "";
        detailMsg = detailMsg.replace(/^AI không tìm thấy/i, "Hệ thống nhận dạng không tìm thấy");

        const confirmed = await showConfirm("", {
          title: "Cảnh báo — đối chiếu tên công trình",
          confirmLabel: "Vẫn dùng file này",
          cancelLabel: "Hủy — chọn file khác",
          variant: "warning",
          compare: {
            intro:
              "QĐ phê duyệt có thể không thuộc công trình đang mở trên form. Anh/chị đối chiếu hai tên bên dưới trước khi tiếp tục.",
            leftLabel: "Tên công trình được đối chiếu",
            leftValue: tenHeThong,
            rightLabel: "Tên trong QĐPD (file upload)",
            rightValue: tenTrongQd || "(Không trích được tên riêng trong QĐ)",
            doKhop,
            detail: detailMsg,
          },
        });
        if (!confirmed) {
          await supabase.storage.from(storageBucket).remove([fileName]);
          return;
        }
      } else if (warning) {
        await showAlert(`${warning}\n\nVui lòng kiểm tra lại nội dung QĐ trước khi tiếp tục.`, { variant: "warning" });
      }

      const qdPatch = {
        quyet_dinh_phe_duyet_paktks: soQdNgan,
        quyet_dinh_phe_duyet_paktks_day_du: quyetDinhDayDu,
        ngay_qd_phe_duyet: ngayQd || null,
        link_pdf_phe_duyet_paktks: fileUrl,
        trang_thai_paktks: "da_chot",
      };
      const { error: qdSaveErr } = await supabase
        .from("HO_SO_PAKTKS")
        .update(qdPatch)
        .eq("id", paktksRecordId);
      if (qdSaveErr) throw new Error("Không lưu QĐ / chốt KL: " + qdSaveErr.message);

      setFormData((prev) => ({
        ...prev,
        quyet_dinh_phe_duyet_paktks: soQdNgan,
        quyet_dinh_phe_duyet_paktks_day_du: quyetDinhDayDu,
        ngay_qd_phe_duyet: ngayQd,
        link_pdf_phe_duyet_paktks: fileUrl,
        trang_thai_paktks: "da_chot",
      }));
      await loadVersionList(formData.ma_du_an || project?.ma_du_an);

      const user = getAuthUser();
      await syncTaiLieuHoSoByTagSafe(supabase, {
        maDuAn: formData.ma_du_an,
        moduleLoai: "paktks",
        loaiKho: "khao_sat",
        nguon: "upload",
        tag: "qd_pd",
        storagePath: fileUrl,
        displayName: exportDisplayNameFromUrl(fileUrl) || fileName,
        thoiGian: ngayQd || new Date().toISOString(),
        nguoiUpMaNv: user?.ma_nv,
      });

      const successMsg = khopDuAn
        ? "🎉 Đã quét QĐ phê duyệt PAKTKS — tên công trình khớp.\n\nĐã chốt khối lượng (khóa sửa form). Muốn đổi KL → tạo bản ĐIỀU CHỈNH."
        : "⚠️ Đã áp dụng QĐ (anh/chị đã xác nhận thủ công).\n\nĐã chốt khối lượng (khóa sửa form). Muốn đổi KL → tạo bản ĐIỀU CHỈNH.";
      await showAlert(successMsg);

      logHoatDong({
        phanHe: "PAKTKS",
        hanhDong: "SCAN_QD_PHE_DUYET",
        chiTietNgan: `Quét QĐ PD PAKTKS + chốt KL: ${soQdNgan}`,
        doiTuongId: paktksRecordId,
        duLieuDong: {
          so_quyet_dinh_ngan: soQdNgan,
          quyet_dinh_day_du: quyetDinhDayDu,
          file_url: fileUrl,
          confidence: data.so_quyet_dinh?.confidence,
          warning,
          do_khop: doKhop,
          khop_du_an: khopDuAn,
          ten_cong_trinh_trong_qd: tenTrongQd,
          auto_chot_kl: true,
        },
      });
    } catch (err) {
      console.error("Lỗi quét QĐ PAKTKS:", err);
      await showAlert(`Đã xảy ra lỗi: ${err.message}`);
      logHoatDong({
        phanHe: "PAKTKS",
        hanhDong: "UPLOAD_FILE_FAIL",
        chiTietNgan: "Lỗi đính kèm QĐ Phê duyệt PAKTKS",
        trangThai: "Thất bại",
        doiTuongId: paktksRecordId,
        duLieuDong: { error: err.message },
      });
    } finally {
      if (uploadTick) clearInterval(uploadTick);
      setIsScanningPheDuyet(false);
      setPheDuyetScanPercent(0);
      e.target.value = "";
    }
  };

  const buildSavePayload = () => {
    const maDuAn = (formData.ma_du_an || project?.ma_du_an || "").trim();
    const hiddenItemsArray = Array.from(hiddenItems);
    const now = new Date().toISOString();

    return {
      ma_du_an: maDuAn,
      nvks_id: nvksFresh?.id || nvksRecord?.id,
      ten_du_an: formData.ten_du_an,
      giai_doan: formData.giai_doan,
      loai_hinh: formData.loai_hinh,
      chu_dau_tu: normalizeChuDauTu(formData.chu_dau_tu),
      dia_diem: formData.dia_diem,
      quyet_dinh_giao_a: formData.quyet_dinh_giao_a,
      quy_mo: formData.quy_mo,
      cap_dien_ap: formData.cap_dien_ap,
      nguoi_lap: formData.nguoi_lap,
      email_nguoi_lap: formData.email_nguoi_lap,
      nguoi_lap_ma_nv: formData.nguoi_lap_ma_nv || null,
      chu_nhiem_ks: formData.chu_nhiem_ks,
      chu_nhiem_ks_ma_nv: formData.chu_nhiem_ks_ma_nv || null,
      lanh_dao_duyet: formData.lanh_dao_duyet,
      lanh_dao_duyet_ma_nv: formData.lanh_dao_duyet_ma_nv || null,
      thoi_diem_lap: formData.thoi_diem_lap || null,
      thoi_gian_ks_lap_pa: "",
      thoi_gian_ks_lap_bcks: formData.thoi_gian_ks_lap_bcks,
      thoi_gian_hoan_thien_ho_so: "",
      thoi_gian_thuc_hien_tong: "",
      nvks_snapshot_at: nvksSnapshotAt || new Date().toISOString(),
      du_lieu_bang_tinh: {
        quantities,
        capDhValues,
        notes: {},
        hiddenItems: hiddenItemsArray,
        donViOverrides,
        cap_dien_ap: formData.cap_dien_ap,
        source_nvks_id: nvksFresh?.id || nvksRecord?.id || null,
        filtered_kl_only: true,
      },
      trang_thai_paktks:
        formData.trang_thai_paktks === "da_chot"
          ? "da_chot"
          : (formData.quyet_dinh_phe_duyet_paktks || "").trim()
            ? "co_qd_pd"
            : "dang_lap",
      quyet_dinh_phe_duyet_paktks: formData.quyet_dinh_phe_duyet_paktks || "",
      quyet_dinh_phe_duyet_paktks_day_du: formData.quyet_dinh_phe_duyet_paktks_day_du || "",
      link_pdf_phe_duyet_paktks: formData.link_pdf_phe_duyet_paktks || "",
      ngay_qd_phe_duyet: formData.ngay_qd_phe_duyet || null,
      phien_ban: formData.phien_ban || "GOC",
      so_lan_dc: Number(formData.so_lan_dc) || 0,
      is_active: true,
      updated_at: now,
    };
  };

  const handleSaveToDB = async ({ closeAfterSave = false } = {}) => {
    if (isSaving || isKlLocked) return;
    const maDuAn = (formData.ma_du_an || project?.ma_du_an || "").trim();
    if (!maDuAn) {
      await showAlert("Thiếu mã dự án — không thể lưu hồ sơ PAKTKS.");
      return;
    }
    if (!nvksRecord?.id) {
      await showAlert("Thiếu hồ sơ NVKS — không thể lưu PAKTKS.");
      return;
    }

    try {
      setIsSaving(true);
      const payload = buildSavePayload();
      const isUpdate = Boolean(paktksRecordId);
      let savedId = paktksRecordId;

      const stripKyMaNv = (p) => {
        const next = { ...p };
        delete next.nguoi_lap_ma_nv;
        delete next.chu_nhiem_ks_ma_nv;
        delete next.lanh_dao_duyet_ma_nv;
        return next;
      };

      const runSave = async (body) => {
        if (isUpdate) {
          return supabase.from("HO_SO_PAKTKS").update(body).eq("id", paktksRecordId);
        }
        savedId = crypto.randomUUID();
        const { error: offErr } = await supabase
          .from("HO_SO_PAKTKS")
          .update({ is_active: false })
          .eq("ma_du_an", maDuAn);
        if (offErr) throw offErr;
        const insertPayload = {
          ...body,
          id: savedId,
          phien_ban: "GOC",
          so_lan_dc: 0,
          parent_paktks_id: null,
          root_paktks_id: savedId,
          is_active: true,
        };
        return supabase.from("HO_SO_PAKTKS").insert([insertPayload]);
      };

      let { error } = await runSave(payload);
      if (error && /nguoi_lap_ma_nv|chu_nhiem_ks_ma_nv|lanh_dao_duyet_ma_nv|column/i.test(error.message || "")) {
        ({ error } = await runSave(stripKyMaNv(payload)));
      }
      if (error) throw error;

      if (!isUpdate) {
        setPaktksRecordId(savedId);
      }

      await loadVersionList(maDuAn);

      await showAlert("🎉 Đã lưu hồ sơ PAKTKS thành công!");
      hydrationCommitRef.current = true;
      finishHydration(false);

      logHoatDong({
        phanHe: "PAKTKS",
        hanhDong: isUpdate ? "UPDATE" : "CREATE",
        chiTietNgan: `${isUpdate ? "Cập nhật" : "Tạo mới"} hồ sơ PAKTKS`,
        doiTuongId: savedId,
        duLieuDong: {
          ma_du_an: maDuAn,
          ten_du_an: payload.ten_du_an,
          giai_doan: payload.giai_doan,
          loai_hinh: payload.loai_hinh,
        },
      });

      onSaved?.({ id: savedId, ma_du_an: maDuAn });
      if (closeAfterSave) onClose();
    } catch (err) {
      console.error("Lỗi lưu PAKTKS:", err);
      await showAlert(`Đã xảy ra lỗi: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportWord = async () => {
    if (!paktksRecordId) {
      await showAlert("Bạn phải nhấn lưu trước khi xuất file.");
      return;
    }
    if (formDirty) {
      await showAlert("Bạn phải nhấn Lưu hoặc Lưu & đóng trước khi xuất file.");
      return;
    }
    const formOk =
      (formData.ma_du_an || "").trim() !== "" &&
      (formData.ten_du_an || "").trim() !== "" &&
      (formData.loai_hinh || "").trim() !== "" &&
      (formData.chu_nhiem_ks || "").trim() !== "" &&
      (formData.lanh_dao_duyet || "").trim() !== "" &&
      (formData.thoi_diem_lap || "").trim() !== "" &&
      positiveKlCount > 0;
    if (!formOk) {
      await showAlert("Điền đủ thông tin và có ít nhất 1 dòng KL > 0 để xuất file.");
      return;
    }
    const hadDocx = await hasExistingExportFile(supabase, {
      maDuAn: formData.ma_du_an,
      moduleLoai: "paktks",
      kind: "docx",
      formLink: formData.link_docx_xuat,
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
    try {
      setIsExporting(true);
      const { templateFileName, storageUrl, downloadFileName } = await exportPaktkWord({
        formData,
        filteredWorkItems,
        quantities,
        capDhValues,
        donViOverrides,
        supabase,
        saveToStorage: true,
        download: false,
      });

      if (!storageUrl) {
        throw new Error("Đã xuất Word nhưng không lấy được URL file trên kho lưu trữ.");
      }

      const exportedAt = new Date().toISOString();
      const { data: updatedRow, error: linkErr } = await supabase
        .from("HO_SO_PAKTKS")
        .update({
          link_docx_xuat: storageUrl,
          exported_at: exportedAt,
        })
        .eq("id", paktksRecordId)
        .select("link_docx_xuat, link_pdf_xuat, exported_at")
        .single();
      if (linkErr) throw new Error(`Không cập nhật được link file Word: ${linkErr.message}`);

      const user = getAuthUser();
      await syncXuatBanTaiLieuSafe(supabase, {
        maDuAn: formData.ma_du_an,
        moduleLoai: "paktks",
        kind: "docx",
        storagePath: storageUrl,
        displayName: exportDisplayNameFromUrl(storageUrl) || downloadFileName,
        thoiGian: exportedAt,
        nguoiUpMaNv: user?.ma_nv,
      });

      setFormData((prev) => ({
        ...prev,
        link_docx_xuat: updatedRow?.link_docx_xuat || storageUrl,
        link_pdf_xuat: updatedRow?.link_pdf_xuat || prev.link_pdf_xuat || "",
      }));

      logHoatDong({
        phanHe: "PAKTKS",
        hanhDong: "EXPORT_WORD",
        chiTietNgan: `Xuất file Word PAKTKS: ${formData.ten_du_an}`,
        doiTuongId: paktksRecordId,
        duLieuDong: { template: templateFileName, giai_doan: formData.giai_doan, link_docx_xuat: storageUrl || null },
      });

      await showAlert("Đã xuất Word. Xem hoặc tải tại mục File xuất trên form.", {
        title: "Xuất thành công",
        variant: "success",
      });
    } catch (err) {
      console.error("Lỗi xuất PAKTKS:", err);
      await showAlert(`Đã xảy ra lỗi khi tạo tệp tin Word:\n${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrintPdf = async () => {
    if (!paktksRecordId) {
      await showAlert("Bạn phải nhấn lưu trước khi In/PDF.");
      return;
    }
    if (formDirty) {
      await showAlert("Bạn phải nhấn Lưu hoặc Lưu & đóng trước khi In/PDF.");
      return;
    }
    const formOk =
      (formData.ma_du_an || "").trim() !== "" &&
      (formData.ten_du_an || "").trim() !== "" &&
      (formData.loai_hinh || "").trim() !== "" &&
      (formData.chu_nhiem_ks || "").trim() !== "" &&
      (formData.lanh_dao_duyet || "").trim() !== "" &&
      (formData.thoi_diem_lap || "").trim() !== "" &&
      positiveKlCount > 0;
    if (!formOk) {
      await showAlert("Điền đủ thông tin và có ít nhất 1 dòng KL > 0 để in.");
      return;
    }
    if (formData.trang_thai_ky_noi_bo === "dang_trinh") {
      await showAlert("Đang trình ký — hủy phiên trước khi xuất PDF mới.");
      return;
    }
    const hadPdf = await hasExistingExportFile(supabase, {
      maDuAn: formData.ma_du_an,
      moduleLoai: "paktks",
      kind: "pdf",
      formLink: formData.link_pdf_xuat,
    });
    if (hadPdf) {
      const ok = await showConfirm(EXPORT_REPLACE_CONFIRM_MSG, {
        title: "Đã có PDF xuất",
        confirmLabel: "Xuất lại",
        cancelLabel: "Hủy",
        variant: "warning",
      });
      if (!ok) return;
    }
    try {
      setIsPrintingPdf(true);
      const { outBlob, templateFileName, downloadFileName } = await generatePaktkWordBlob({
        formData,
        filteredWorkItems,
        quantities,
        capDhValues,
        donViOverrides,
        supabase,
      });
      const pdfName = String(downloadFileName || "PAKTKS.docx").replace(/\.docx$/i, ".pdf");
      const pdfBlob = await convertDocxBlobToPdfDownload(outBlob, {
        fileName: pdfName,
        download: false,
      });

      const ts = Date.now();
      const storageFileName = buildPaktkDownloadFileName(formData, { timestamp: ts, ext: "pdf" });
      const pdfPath = buildPaktkExportStoragePath(formData, storageFileName);
      const pdfUrl = await uploadPaktkExportBlob(supabase, pdfBlob, pdfPath, "application/pdf");
      const exportedAt = new Date(ts).toISOString();
      const { data: updatedRow, error: linkErr } = await supabase
        .from("HO_SO_PAKTKS")
        .update({ link_pdf_xuat: pdfUrl, exported_at: exportedAt })
        .eq("id", paktksRecordId)
        .select("link_pdf_xuat, exported_at")
        .single();
      if (linkErr) throw new Error(linkErr.message || "Không cập nhật link PDF trên hồ sơ.");

      const user = getAuthUser();
      await syncXuatBanTaiLieuSafe(supabase, {
        maDuAn: formData.ma_du_an,
        moduleLoai: "paktks",
        kind: "pdf",
        storagePath: pdfUrl,
        displayName: exportDisplayNameFromUrl(pdfUrl) || storageFileName,
        thoiGian: exportedAt,
        nguoiUpMaNv: user?.ma_nv,
      });

      setFormData((prev) => ({
        ...prev,
        link_pdf_xuat: updatedRow?.link_pdf_xuat || pdfUrl,
        exported_at: exportedAt,
      }));

      let kyReset = false;
      try {
        kyReset = await resetTrinhKyAfterPdfExport(supabase, {
          module: "paktks",
          hoSoId: paktksRecordId,
          trangThaiKy: formData.trang_thai_ky_noi_bo,
        });
        if (kyReset) {
          setFormData((prev) => ({
            ...prev,
            trang_thai_ky_noi_bo: "chua_trinh",
            trinh_ky_id: null,
          }));
        }
      } catch (resetErr) {
        console.warn("Không reset trình ký sau xuất PDF:", resetErr?.message || resetErr);
      }

      logHoatDong({
        phanHe: "PAKTKS",
        hanhDong: "PRINT_PDF",
        chiTietNgan: `Xuất PDF PAKTKS: ${formData.ten_du_an}`,
        doiTuongId: paktksRecordId,
        duLieuDong: {
          template: templateFileName,
          giai_doan: formData.giai_doan,
          link_pdf_xuat: pdfUrl,
          via: "libreoffice",
          reset_trinh_ky: kyReset,
        },
      });

      await showAlert(
        kyReset
          ? "Đã xuất PDF mới và reset chuỗi trình ký. Bản đã ký trước vẫn giữ trong mục PDF đã ký / Hộp chờ ký — bấm Trình ký để mở vòng ký mới."
          : "Đã xuất PDF. Xem hoặc tải tại mục File xuất trên form.",
        {
          title: "Xuất thành công",
          variant: "success",
        }
      );
    } catch (err) {
      console.error("Lỗi In/PDF PAKTKS:", err);
      await showAlert(`Không xuất được PDF:\n${err.message}`);
    } finally {
      setIsPrintingPdf(false);
    }
  };

  const handleUploadPdfDaKy = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!paktksRecordId) {
      await showAlert("Lưu hồ sơ PAKTKS trước khi upload PDF đã ký.");
      e.target.value = "";
      return;
    }
    if (formData.link_pdf_da_ky) {
      const ok = await showConfirm(
        "Đã có PDF đã ký lưu trước đó.\n\nTải lên mới sẽ thay bản cũ trong kho hồ sơ.\n\nTiếp tục?",
        { title: "Thay PDF đã ký", confirmLabel: "Tải lên", cancelLabel: "Hủy", variant: "warning" }
      );
      if (!ok) {
        e.target.value = "";
        return;
      }
    }
    try {
      const { storageUrl, fileName: signedFileName } = await uploadPaktkSignedPdf(supabase, file, formData);
      const { error } = await supabase
        .from("HO_SO_PAKTKS")
        .update({ link_pdf_da_ky: storageUrl })
        .eq("id", paktksRecordId);
      if (error) throw error;
      const user = getAuthUser();
      await syncTaiLieuHoSoByTagSafe(supabase, {
        maDuAn: formData.ma_du_an,
        moduleLoai: "paktks",
        nguon: "upload",
        tag: "pdf_da_ky",
        storagePath: storageUrl,
        displayName: signedFileName || file.name,
        nguoiUpMaNv: user?.ma_nv,
      });
      setFormData((prev) => ({ ...prev, link_pdf_da_ky: storageUrl }));
      await showAlert("Đã lưu PDF đã ký lên kho hồ sơ.");
    } catch (err) {
      await showAlert(`Lỗi upload PDF: ${err.message}`);
    } finally {
      e.target.value = "";
    }
  };

  if (!project || !nvksRecord) return null;

  const isFormComplete =
    (formData.ma_du_an || "").trim() !== "" &&
    (formData.ten_du_an || "").trim() !== "" &&
    (formData.loai_hinh || "").trim() !== "" &&
    (formData.chu_nhiem_ks || "").trim() !== "" &&
    (formData.lanh_dao_duyet || "").trim() !== "" &&
    (formData.thoi_diem_lap || "").trim() !== "" &&
    positiveKlCount > 0;
  const templatesReady = !isLoadingTemplate && templateData.length > 0;
  const isSavedToDb = Boolean(paktksRecordId);
  const isExportReady =
    isSavedToDb && isFormComplete && !formDirty && !isExporting && !isPrintingPdf && templatesReady;
  const isExportButtonDisabled = !isExportReady || isExporting || isPrintingPdf || isKlLocked;
  const hasGocSaved =
    hasPaktkGocRecord(versionList) || (isSavedToDb && isPhienBanGocPak(formData.phien_ban));
  const dieuChinhGate = canCreatePaktkDieuChinh(versionList);
  const pakLabel = formatPaktkPhienBanLabel({
    phien_ban: formData.phien_ban,
    so_lan_dc: formData.so_lan_dc,
  });
  const isSuaMode = isPhienBanGocPak(formData.phien_ban) && !isKlLocked;
  const isDcMode = isPhienBanDcPak(formData.phien_ban);

  const {
    widths: pakKlColWidths,
    startResize: startPakKlColResize,
    totalWidth: pakKlTableWidth,
    containerRef: pakKlTableContainerRef,
    fitContainer: pakKlFit,
  } = useResizableTableColumns("paktks-kl-v2", [40, 240, 76, 64, 80], {
    fitContainer: true,
  });

  const docxExportMeta = parseNvksExportLink(formData.link_docx_xuat, formData.exported_at);
  const pdfExportMeta = parseNvksExportLink(formData.link_pdf_xuat, formData.exported_at);
  const pdfDaKyMeta = parseNvksExportLink(formData.link_pdf_da_ky, formData.exported_at);
  const pdfKyDauMeta = parseNvksExportLink(formData.link_pdf_ky_dau, formData.exported_at);

  const pakPdfDaKySection = (
    <>
      {formData.link_pdf_da_ky ? (
        <div className="space-y-0.5">
          <ExportFileNameDisplay
            href={formData.link_pdf_da_ky}
            displayName={pdfDaKyMeta.displayName || "PDF đã ký"}
            nameSuffix="+ ký tươi (phục vụ xuất bản)"
            displayTime={pdfDaKyMeta.displayTime}
            title="Hồ sơ phục vụ xuất bản"
            nameClassName="font-bold text-teal-900"
            suffixClassName="text-[11px] font-bold text-blue-600"
          />
        </div>
      ) : null}
      {formData.link_pdf_ky_dau ? (
        <div className="space-y-0.5">
          <ExportFileNameDisplay
            href={formData.link_pdf_ky_dau}
            displayName={pdfKyDauMeta.displayName || "PDF ký dấu"}
            nameSuffix="+ ký đóng dấu (gửi CĐT)"
            displayTime={pdfKyDauMeta.displayTime}
            title="Hồ sơ phục vụ gửi nhanh cho CĐT"
            nameClassName="font-bold text-teal-900"
            suffixClassName="text-[11px] font-bold text-red-600"
          />
        </div>
      ) : null}
      <div>
        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Upload PDF đã ký</label>
        <input
          type="file"
          accept="application/pdf"
          onChange={handleUploadPdfDaKy}
          disabled={!paktksRecordId || isKlLocked || formData.trang_thai_ky_noi_bo === "dang_trinh"}
          className="w-full text-xs file:mr-2 file:py-1.5 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-bold file:bg-emerald-100 file:text-emerald-800"
        />
      </div>
    </>
  );

  const pakExportLinks = (
    <>
      {formData.link_docx_xuat || formData.link_pdf_xuat ? (
        <div className="min-w-0 space-y-1.5">
          {formData.link_docx_xuat ? (
            <ExportFileNameDisplay
              href={formData.link_docx_xuat}
              displayName={docxExportMeta.displayName || "Word.docx"}
              displayTime={docxExportMeta.displayTime}
            />
          ) : null}
          {formData.link_pdf_xuat ? (
            <div className="space-y-1.5">
              <ExportFileNameDisplay
                href={formData.link_pdf_xuat}
                displayName={pdfExportMeta.displayName || "PDF.pdf"}
                displayTime={pdfExportMeta.displayTime}
                nameClassName="font-bold text-red-800"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={!trinhKyActions?.canTrinh || trinhKyActions?.busy}
                  onClick={() => trinhKyActions?.trinhKy?.()}
                  title={trinhKyActions?.hint || "Trình ký nội bộ"}
                  className="px-3 py-1.5 text-[11px] font-bold rounded bg-teal-600 text-white disabled:opacity-40 hover:bg-teal-700"
                >
                {trinhKyActions?.busy
                  ? "Đang xử lý…"
                  : trinhKyActions?.buttonLabel || "Trình ký"}
              </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-[11px] text-gray-500">
          Chưa có file — xuất Word hoặc In/PDF (PDF trình ký ghi kho tự động).
        </p>
      )}
      <div className="pt-2 border-t border-indigo-100">
        <NvksTrinhKyPanel
          module="paktks"
          hoSoRecordId={paktksRecordId}
          formData={formData}
          isKlLocked={isKlLocked}
          compact
          showTrinhButton={false}
          onActionsChange={setTrinhKyActions}
          onStatusChange={(st) => {
            if (!st) return;
            setFormData((prev) => {
              const nextTrangThai = st.trangThai || prev.trang_thai_ky_noi_bo;
              const nextLinkPdfDaKy = st.linkPdfDaKy || "";
              const nextLinkPdfKyDau = st.linkPdfKyDau || "";
              const nextTrinhKyId =
                st.phien?.id ?? (nextTrangThai === "chua_trinh" ? null : prev.trinh_ky_id);
              if (
                nextTrangThai === prev.trang_thai_ky_noi_bo &&
                nextLinkPdfDaKy === prev.link_pdf_da_ky &&
                nextLinkPdfKyDau === prev.link_pdf_ky_dau &&
                nextTrinhKyId === prev.trinh_ky_id
              ) {
                return prev;
              }
              return {
                ...prev,
                trang_thai_ky_noi_bo: nextTrangThai,
                link_pdf_da_ky: nextLinkPdfDaKy,
                link_pdf_ky_dau: nextLinkPdfKyDau,
                trinh_ky_id: nextTrinhKyId,
              };
            });
          }}
        />
      </div>
    </>
  );

  const pakQdSection = (
    <div
      className={`p-4 rounded-xl border ${
        isQdPdLocked ? "bg-emerald-50/40 border-emerald-200" : "bg-amber-50/50 border-amber-200"
      } flex flex-col gap-3 shadow-sm`}
    >
      {!isQdPdLocked && !isKlLocked ? (
        <div className="w-full flex flex-col gap-2">
          <input
            type="file"
            accept="application/pdf"
            onChange={handleUploadPheDuyet}
            disabled={isScanningPheDuyet || !paktksRecordId}
            className={`w-full text-xs file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-amber-100 file:text-amber-700 hover:file:bg-amber-200 cursor-pointer ${
              isScanningPheDuyet || !paktksRecordId ? "opacity-50 cursor-not-allowed" : ""
            }`}
          />
          {!paktksRecordId ? (
            <p className="text-[10px] text-amber-700 font-medium">
              Lưu hồ sơ PAKTKS lần đầu trước khi quét QĐ phê duyệt.
            </p>
          ) : null}
          {isScanningPheDuyet ? (
            <div className="relative h-9 rounded-lg overflow-hidden bg-sky-100 border border-sky-200 shadow-inner">
              <div
                className="absolute inset-y-0 left-0 bg-sky-600 transition-all duration-300 ease-out overflow-hidden"
                style={{ width: `${Math.max(pheDuyetScanPercent, 12)}%` }}
              >
                <span className="absolute inset-y-0 left-0 flex items-center px-3 text-[11px] font-bold text-white whitespace-nowrap">
                  Hệ thống đang quét...
                </span>
              </div>
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-sky-800 tabular-nums">
                {pheDuyetScanPercent}%
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {isQdPdLocked || formData.quyet_dinh_phe_duyet_paktks ? (
        <div className="bg-white/80 border border-emerald-100 rounded-lg p-3 space-y-2">
          <div>
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1">
              Số Quyết định:
            </p>
            {formData.link_pdf_phe_duyet_paktks ? (
              <a
                href={formData.link_pdf_phe_duyet_paktks}
                target="_blank"
                rel="noreferrer"
                title="Nhấn để xem PDF"
                className="inline-flex items-center gap-1.5 font-bold italic text-[#1d4ed8] hover:text-[#1e3a8a] hover:underline text-sm leading-snug transition-colors cursor-pointer group"
              >
                <span>{formData.quyet_dinh_phe_duyet_paktks}</span>
                <Eye className="w-4 h-4 shrink-0 text-[#c2410c] group-hover:text-[#9a3412] transition-colors" aria-hidden />
                <span className="sr-only">Xem PDF quyết định phê duyệt</span>
              </a>
            ) : (
              <p className="inline-flex items-center gap-1.5 font-bold italic text-[#1d4ed8] text-sm leading-snug">
                <span>{formData.quyet_dinh_phe_duyet_paktks}</span>
              </p>
            )}
          </div>
          <div>
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1">
              Chi tiết:
            </p>
            <div className="text-xs text-[#15803d] italic leading-relaxed whitespace-pre-line text-justify">
              {(formData.quyet_dinh_phe_duyet_paktks_day_du || "").trim() || "—"}
            </div>
            {!formData.link_pdf_phe_duyet_paktks ? (
              <p className="mt-1.5 text-xs text-gray-400 italic">Chưa có file PDF quyết định phê duyệt</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white text-gray-800">
      <div className="bg-white px-6 py-4 border-b border-purple-100 flex justify-between items-center shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-1.5 hover:bg-purple-50 rounded text-gray-500 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
        <div>
            <h3 className="font-black text-purple-900 text-base tracking-tight uppercase">
              Lập phương án kỹ thuật khảo sát
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-purple-600 font-medium">{project.ten_du_an}</span>
              <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded border border-purple-200">
                {pakLabel}
              </span>
              {formData.trang_thai_paktks === "da_chot" && (
                <span className="bg-red-50 text-red-700 text-[11px] font-bold px-2 py-0.5 rounded border border-red-100 flex items-center gap-1">
                  🔒 ĐÃ CHỐT KL
                </span>
              )}
              {formData.trang_thai_ky_noi_bo === "dang_trinh" && (
                <span className="bg-amber-50 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                  ⏳ ĐANG TRÌNH KÝ
                </span>
              )}
              {formData.trang_thai_paktks !== "da_chot" && isQdPdLocked && (
                <span className="bg-amber-50 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                  📋 ĐÃ CÓ QĐ PD
                </span>
              )}
            </div>
           </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <div
            className="inline-flex flex-wrap items-center gap-1 p-1.5 rounded-2xl bg-gradient-to-b from-purple-50 to-purple-100/90 border border-purple-200/90 shadow-sm"
            role="toolbar"
            aria-label="Thao tác PAKTKS"
          >
            <button
              type="button"
              onClick={handleExportWord}
              disabled={isExportButtonDisabled}
              className={`${PAKTKS_TOOLBAR_BTN} ${
                !isExportReady || isKlLocked
                  ? "bg-slate-200 text-slate-400 border border-slate-200"
                  : "bg-gradient-to-br from-blue-500 to-blue-600 text-white border border-blue-600/20 shadow-md shadow-blue-500/25 hover:from-blue-600 hover:to-blue-700 hover:shadow-lg hover:shadow-blue-500/30 hover:-translate-y-px active:translate-y-0 focus-visible:ring-blue-400"
              }`}
              title={
                !isSavedToDb
                  ? "Bạn phải nhấn lưu trước khi xuất file"
                  : formDirty
                    ? "Bạn phải nhấn Lưu hoặc Lưu & đóng trước khi xuất file"
                    : !isFormComplete
                      ? "Điền đủ thông tin và có ít nhất 1 dòng KL > 0 để xuất file"
                      : "Xuất file Word"
              }
            >
              {isExporting ? (
                <PaktksToolbarSpinner />
              ) : (
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              )}
              <span>{isExporting ? "Xuất Word…" : "Xuất Word"}</span>
            </button>

            <button
              type="button"
              onClick={handlePrintPdf}
              disabled={isExportButtonDisabled}
              className={`${PAKTKS_TOOLBAR_BTN} ${
                !isExportReady || isKlLocked
                  ? "bg-slate-200 text-slate-400 border border-slate-200"
                  : "bg-gradient-to-br from-rose-500 to-red-600 text-white border border-red-600/20 shadow-md shadow-red-500/25 hover:from-rose-600 hover:to-red-700 hover:shadow-lg hover:shadow-red-500/30 hover:-translate-y-px active:translate-y-0 focus-visible:ring-red-400"
              }`}
              title={
                !isSavedToDb
                  ? "Bạn phải nhấn lưu trước khi Xuất PDF"
                  : formDirty
                    ? "Bạn phải nhấn Lưu hoặc Lưu & đóng trước khi Xuất PDF"
                    : !isFormComplete
                      ? "Điền đủ thông tin và có ít nhất 1 dòng KL > 0 để xuất PDF"
                      : "Xuất file PDF"
              }
            >
              {isPrintingPdf ? (
                <PaktksToolbarSpinner />
              ) : (
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                  />
                </svg>
              )}
              <span>{isPrintingPdf ? "Xuất PDF…" : "Xuất PDF"}</span>
            </button>

            {hasGocSaved && (
              <>
                <PaktksToolbarDivider />
                <button
                  type="button"
                  onClick={handleDieuChinh}
                  disabled={isCreatingDc || !dieuChinhGate.ok}
                  title={dieuChinhGate.ok ? "Tạo bản ĐIỀU CHỈNH PAKTKS mới" : dieuChinhGate.reason}
                  className={`${PAKTKS_TOOLBAR_BTN} ${
                    isCreatingDc || !dieuChinhGate.ok
                      ? "bg-slate-100 text-slate-400 border border-slate-200"
                      : "bg-gradient-to-br from-amber-50 to-orange-100 text-amber-900 border border-amber-300/80 shadow-sm hover:from-amber-100 hover:to-orange-200 hover:border-amber-400 hover:-translate-y-px focus-visible:ring-amber-400"
                  }`}
                >
                  {isCreatingDc ? (
                    <PaktksToolbarSpinner />
                  ) : (
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                  )}
                  <span>{isCreatingDc ? "Đang tạo…" : "Điều chỉnh"}</span>
                </button>
              </>
            )}

            {!isKlLocked && isSavedToDb && (
              <button
                type="button"
                onClick={handleChotKl}
                title="Khóa SỬA trên bản PAKTKS hiện tại"
                className={`${PAKTKS_TOOLBAR_BTN} bg-white text-red-700 border border-red-200 shadow-sm hover:bg-red-50 hover:border-red-300 hover:-translate-y-px focus-visible:ring-red-300`}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                <span>Chốt KL</span>
              </button>
            )}

            <PaktksToolbarDivider />

            <button
              type="button"
              onClick={() => handleSaveToDB({ closeAfterSave: false })}
              disabled={isSaving || !isFormComplete || isKlLocked}
              className={`${PAKTKS_TOOLBAR_BTN} min-w-[7.5rem] ${
                isKlLocked
                  ? "bg-slate-200 text-slate-500 border border-slate-200"
                  : isSaving || !isFormComplete
                    ? "bg-purple-300/80 text-white border border-purple-300"
                    : "bg-gradient-to-br from-purple-500 to-purple-700 text-white border border-purple-600/20 shadow-md shadow-purple-500/25 hover:from-purple-600 hover:to-purple-800 hover:shadow-lg hover:shadow-purple-500/30 hover:-translate-y-px focus-visible:ring-purple-400"
              }`}
            >
              {isSaving ? (
                <PaktksToolbarSpinner />
              ) : isKlLocked ? (
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              ) : (
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                  />
                </svg>
              )}
              <span>{isKlLocked ? "Đã khóa" : isSaving ? "Đang lưu…" : "Lưu"}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSaveToDB({ closeAfterSave: true })}
              disabled={isSaving || !isFormComplete || isKlLocked}
              className={`${PAKTKS_TOOLBAR_BTN} ${
                isKlLocked
                  ? "bg-slate-100 text-slate-400 border border-slate-200"
                  : isSaving || !isFormComplete
                    ? "bg-white text-purple-300 border border-purple-200"
                    : "bg-white text-purple-700 border border-purple-400 shadow-sm hover:bg-purple-50 hover:border-purple-500 hover:-translate-y-px focus-visible:ring-purple-400"
              }`}
            >
              {isSaving ? (
                <PaktksToolbarSpinner className="w-3.5 h-3.5 text-purple-600" />
              ) : (
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              )}
              <span className="normal-case tracking-normal font-bold text-[11px]">
                {isKlLocked ? "Không sửa" : isSaving ? "Đang lưu…" : "Lưu & đóng"}
              </span>
        </button>
          </div>
        </div>
      </div>

      {versionList.length > 0 && (
        <div className="px-6 py-2.5 bg-purple-50/60 border-b border-purple-100 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black text-purple-700 uppercase tracking-wide">Lịch sử phiên bản</span>
          {versionList.map((v) => {
            const label = formatPaktkPhienBanLabel(v);
            const active = v.id === paktksRecordId;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => handleSwitchPakVersion(v.id)}
                className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition ${
                  active
                    ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                    : "bg-white text-purple-800 border-purple-200 hover:border-purple-400 hover:text-purple-900"
                }`}
              >
                {label}
                {v.trang_thai_paktks === "da_chot" ? " 🔒" : ""}
              </button>
            );
          })}
        </div>
      )}

      {(isSuaMode || isDcMode) && (
        <div
          className={`px-6 py-2 text-xs font-medium border-b ${
            isDcMode
              ? "bg-orange-50 text-orange-900 border-orange-100"
              : "bg-sky-50 text-sky-900 border-sky-100"
          }`}
        >
          {isDcMode ? (
            <>
              <span className="font-black">ĐIỀU CHỈNH</span> — chỉnh PAKTKS theo KL NVKS ĐC (bản mới, QĐ PD riêng).
            </>
          ) : (
            <>
              <span className="font-black">SỬA (GỐC)</span> — đồng bộ KL từ NVKS GỐC khi NVKS thay đổi; chưa chốt thì vẫn sửa được.
            </>
          )}
        </div>
      )}

      {needsSync && !isKlLocked && (
        <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-200 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-amber-900">
            <span className="font-black">NVKS GỐC đã thay đổi KL</span> — cần đồng bộ sang PAKTKS GỐC trước khi trình phê duyệt.
          </p>
          <button
            type="button"
            onClick={handleSyncFromNvks}
            className="text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-3 py-1 rounded-lg"
          >
            ↻ Đồng bộ KL từ NVKS
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto p-6 bg-purple-50/30 flex flex-col gap-6">
        <div className="flex flex-col lg:flex-row gap-6 items-stretch">
        <div className="w-full lg:w-2/3 flex flex-col min-h-0">
          <div className="bg-white p-5 rounded border border-purple-200 shadow-sm flex-1 flex flex-col min-h-0">
            <h4 className="font-bold text-purple-800 border-b border-purple-100 pb-2 mb-4">I. THÔNG TIN CƠ BẢN</h4>
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12">
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Tên công trình</label>
                <input
                  type="text"
                  value={formData.ten_du_an || ""}
                  readOnly
                  className="w-full border border-gray-200 bg-gray-100 rounded p-2 text-sm font-bold text-gray-800 cursor-not-allowed"
                />
              </div>
              <div className="col-span-12 md:col-span-3">
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Mã dự án</label>
                <input
                  type="text"
                  value={formData.ma_du_an || ""}
                  readOnly
                  className="w-full border border-gray-200 bg-gray-100 rounded p-2 text-sm font-bold cursor-not-allowed"
                />
              </div>
              <div className="col-span-12 md:col-span-3">
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Cấp điện áp</label>
                <input
                  type="text"
                  value={formData.cap_dien_ap || ""}
                  readOnly
                  className="w-full border border-gray-200 bg-gray-100 rounded p-2 text-sm font-bold text-purple-800 cursor-not-allowed"
                />
              </div>
              <div className="col-span-12 md:col-span-3">
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Địa điểm khảo sát</label>
                <input
                  type="text"
                  value={formData.dia_diem || ""}
                  readOnly
                  className="w-full border border-gray-200 bg-gray-100 rounded p-2 text-sm cursor-not-allowed"
                />
              </div>
              <div className="col-span-12 md:col-span-3">
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Chủ đầu tư</label>
                <input
                  type="text"
                  value={formData.chu_dau_tu || ""}
                  readOnly
                  className="w-full border border-gray-200 bg-gray-100 rounded p-2 text-sm cursor-not-allowed"
                />
              </div>
              <div className="col-span-12 md:col-span-6">
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Giai đoạn</label>
                <input
                  type="text"
                  value={formData.giai_doan || ""}
                  readOnly
                  className="w-full border border-gray-200 bg-gray-100 rounded p-2 text-sm font-bold text-purple-800 cursor-not-allowed"
                />
              </div>
              <div className="col-span-12 md:col-span-6">
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Loại hình khảo sát</label>
                <input
                  type="text"
                  value={formData.loai_hinh || ""}
                  readOnly
                  className="w-full border border-gray-200 bg-gray-100 rounded p-2 text-sm font-medium text-gray-800 cursor-not-allowed"
                />
              </div>
              <div className="col-span-12 md:col-span-6">
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Quyết định giao A</label>
                <textarea
                  ref={qdGiaoARef}
                  value={formData.quyet_dinh_giao_a || ""}
                  readOnly
                  rows={1}
                  className="w-full min-h-[3.5rem] box-border border border-gray-200 bg-gray-100 rounded px-2 pt-2 pb-2.5 text-sm overflow-y-hidden resize-none text-justify leading-relaxed cursor-not-allowed"
                />
              </div>
              <div className="col-span-12 md:col-span-6">
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Quy mô xây dựng chính</label>
                <textarea
                  ref={quyMoRef}
                  value={formData.quy_mo || ""}
                  readOnly
                  rows={1}
                  className="w-full min-h-[3.5rem] box-border border border-gray-200 bg-gray-100 rounded px-2 pt-2 pb-2.5 text-sm overflow-y-hidden resize-none text-justify leading-relaxed cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-1/3 flex flex-col min-h-0">
          <HoSoPersonnelSidebar
            theme="purple"
            className="flex-1"
            formData={formData}
            listCNKS={listCNKS}
            listLanhDao={listLanhDao}
            nhanSuCatalog={nhanSuCatalog}
            onSelectNhanSu={handleSelectNhanSu}
            usePersonnelCatalog={nhanSuCatalog.length > 0}
            isKlLocked={isKlLocked}
            onInputChange={handleInputChange}
            exportLinks={pakExportLinks}
            exportSectionTitle="XUẤT FILE & TRÌNH KÝ"
            pdfDaKySection={pakPdfDaKySection}
            quyetDinhSection={{ title: "QUYẾT ĐỊNH PHÊ DUYỆT PAKTKS", content: pakQdSection }}
          />
        </div>
        </div>

        <div className="w-full lg:w-2/3 mx-auto min-w-0 max-w-full">
          <div className="rounded-lg border border-purple-200 overflow-hidden shadow-sm w-full">
            <div className="bg-white px-4 py-2.5 border-b border-purple-100">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-bold text-purple-800">III. KHỐI LƯỢNG KHẢO SÁT</h4>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide bg-purple-50 text-purple-700 px-2 py-1 rounded border border-purple-200">
                    Kế thừa NVKS — chỉ KL &gt; 0
                  </span>
                  <button
                    type="button"
                    onClick={handleSyncFromNvks}
                    disabled={isKlLocked}
                    className={`text-xs font-semibold hover:underline disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline ${
                      needsSync ? "text-amber-800 font-bold" : "text-indigo-700 hover:text-indigo-900"
                    }`}
                  >
                    ↻ Đồng bộ KL từ NVKS
                  </button>
                </div>
              </div>
            </div>
            <div ref={pakKlTableContainerRef} className="overflow-x-hidden w-full min-w-0">
              <table
                className="text-left border-collapse text-xs table-fixed w-full"
                style={
                  pakKlFit
                    ? { width: "100%", minWidth: 0 }
                    : { width: pakKlTableWidth, minWidth: pakKlTableWidth }
                }
              >
                <colgroup>
                  {pakKlColWidths.map((w, i) => (
                    <col key={i} style={{ width: w }} />
                  ))}
                </colgroup>
                <thead>
                  <tr className="bg-purple-50 text-xs text-purple-800 uppercase">
                    <ResizableTh columnIndex={0} onResizeStart={startPakKlColResize} className="px-1 py-1.5 border border-purple-100 text-center font-bold">STT</ResizableTh>
                    <ResizableTh columnIndex={1} onResizeStart={startPakKlColResize} className="px-1.5 py-1.5 border border-purple-100 text-center font-bold leading-tight">Nội dung công việc</ResizableTh>
                    <ResizableTh columnIndex={2} onResizeStart={startPakKlColResize} className="px-1 py-1.5 border border-purple-100 text-center font-bold leading-tight">Cấp địa hình</ResizableTh>
                    <ResizableTh columnIndex={3} onResizeStart={startPakKlColResize} className="px-1 py-1.5 border border-purple-100 text-center font-bold leading-tight">Đơn vị tính</ResizableTh>
                    <ResizableTh columnIndex={4} onResizeStart={startPakKlColResize} className="px-1 py-1.5 border border-purple-100 text-center font-bold">Khối lượng</ResizableTh>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingTemplate ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-gray-500 italic">
                        Đang tải bảng khối lượng...
                      </td>
                    </tr>
                  ) : dsKhoiLuongDisplay.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-amber-700 italic">
                        Chưa có dòng khối lượng &gt; 0 — kiểm tra NVKS hoặc đồng bộ lại.
                      </td>
                    </tr>
                  ) : (
                    dsKhoiLuongDisplay.map((row, idx) => (
                      <tr
                        key={`${row.stt}-${row.id_cong_viec || row.field || idx}`}
                        className={row.is_header ? "bg-gray-100/80 font-bold" : "hover:bg-purple-50/40"}
                      >
                        <td className="px-1 py-1.5 border border-gray-200 text-center">{row.stt}</td>
                        <td className={`px-1.5 py-1.5 border border-gray-200 ${row.is_header ? "uppercase bg-slate-100/50" : ""}`}>
                          <div className="leading-snug">{row.noi_dung}</div>
                          {row.ghi_chu ? (
                            <div className="text-[10px] text-gray-500 italic mt-0.5 whitespace-pre-wrap leading-snug">{row.ghi_chu}</div>
                          ) : null}
                        </td>
                        <td className="px-1 py-1.5 border border-gray-200 text-center">{row.cap_dh}</td>
                        <td className="px-1 py-1.5 border border-gray-200 text-center">{row.don_vi}</td>
                        <td className="px-1 py-1.5 border border-gray-200 text-center font-bold text-purple-900">
                          {row.is_thoi_gian ? (
                            <input
                              type="text"
                              name={row.field}
                              value={formData[row.field] || ""}
                              onChange={handleInputChange}
                              onKeyDown={preventInvalidNumberInput}
                              readOnly={isKlLocked}
                              autoComplete="off"
                              className={`w-full max-w-[4.5rem] mx-auto text-center border rounded px-1 py-1 font-bold outline-none text-xs ${
                                isKlLocked
                                  ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                                  : "bg-amber-50 text-amber-900 border-amber-300 focus:bg-white focus:border-purple-500"
                              }`}
                            />
                          ) : (
                            row.khoi_luong
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
