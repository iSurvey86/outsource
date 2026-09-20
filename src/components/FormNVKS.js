"use client";

import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from "react";
import { Eye } from "lucide-react";
import { supabase } from "../lib/supabase"; 
import { logHoatDong } from '../lib/logger';
import { useAppDialog } from './AppDialog';
import { getAuthUser } from '../lib/authSession';
import AppStyledSelect from './AppStyledSelect';
import { getCanonicalChuDauTuList, normalizeChuDauTu } from '../lib/chuDauTuAlias';
import {
  LOAI_HINH_NVKS_OPTIONS,
  normalizeLoaiHinhLabel,
  isWorkItemApplicable,
  pruneOrphanSectionTitles,
  isRemovedDmRow,
  getLoaiHinhConfigByLabel,
  supplementDmCongViec,
  seedDefaultCapDhValues,
  MAU_NUOC_PARENT_ID,
  isMauNuocParentId,
  isMauNuocChiTieuId,
  isMauNuocParentItem,
  isMauNuocChiTieuItem,
  mauNuocChildKlFromParent,
  resolveMauNuocParentTong,
  syncMauNuocQuantities,
  zeroCongViecKlInQuantities,
} from '../lib/nvksLoaiHinh';
import {
  DVT_PRESET_OPTIONS,
  allocateNextCvId,
  buildTableRenderPlan,
  buildUserCongViecRow,
  getEffectiveDonVi,
  insertDmCongViecRow,
  isDieuTraCongFixedItem,
  isOptionalCapDhItem,
  mergeUserRowsIntoSubsections,
  resolveTramPhanLoaiForUserAdd,
  shouldShowCapDhCell,
  shouldShowDuongDayAddButton,
  shouldShowThoaThuanAddButton,
  shouldShowTramAddButton,
} from '../lib/nvksCustomCongViec';
import {
  TY_LE_PRESET_OPTIONS,
  DONG_MUC_PRESET_OPTIONS,
  DEFAULT_CAP_DH,
  buildDoVeTramTyLeDongChinh,
  getDoVeTramDongMucValue,
  getDoVeTramPhamViText,
  getDoVeTramTyLeValue,
  initDoVeTramTyLeQuantities,
  isDoVeTramTyLeItem,
} from '../lib/nvksDoVeTramTyLe';
import { exportNvksWord, generateNvksWordBlob, prepareNvksDocxBlobForPdf } from '../lib/nvksWordExport';
import { convertDocxBlobToPdfDownload } from '../lib/exportPdfClient';
import {
  buildNvksExportFileNames,
  buildNvksExportStoragePath,
  cleanForFileName,
  parseNvksExportLink,
  uploadNvksExportBlob,
  uploadNvksPhatHanhPdf,
  uploadNvksSignedPdf,
} from '../lib/nvksExportStorage';
import { syncXuatBanTaiLieu, syncTaiLieuHoSoByTag, hasExistingExportFile, EXPORT_REPLACE_CONFIRM_MSG } from '../lib/hoSoTaiLieu';
import {
  DEFAULT_CNKS_NAME,
  DEFAULT_LANH_DAO_NAME,
  DEFAULT_CNKS_OPTIONS,
  DEFAULT_LANH_DAO_OPTIONS,
  mergePersonnelOptions,
  resolveMaNvByHoTen,
} from '../lib/hoSoPersonnelDefaults';
import ExportFileNameDisplay from './ExportFileNameDisplay';
import { saveAs } from 'file-saver';
import {
  canCreateDieuChinh,
  createDieuChinhVersion,
  fetchNvksVersions,
  formatNvksPhienBanLabel,
  hasNvksGocRecord,
  isPhienBanDieuChinh,
  isPhienBanGoc,
  pickNvksGocRecord,
  setActiveNvksVersion,
} from '../lib/nvksPhienBan';
import { createPaktkDieuChinhFromNvks } from '../lib/paktksPhienBan';
import HoSoPersonnelSidebar from './HoSoPersonnelSidebar';
import NvksTrinhKyPanel from './NvksTrinhKyPanel';
import { resetTrinhKyAfterPdfExport } from '../lib/trinhKy/resetAfterPdfExport';
import KlComparisonTable from './KlComparisonTable';
import {
  buildGocKlApprovedById,
  computeKlDcChenh,
  computeKlDcChenhDiff,
  formatKlCellDisplay,
  getKlDc02InputClass,
  getKlDcChenhDisplayClass,
  getKlDcManual,
  isKlDcValueChanged,
  NVKS_THOI_GIAN_FIELDS,
  isNvksThoiGianField,
  isNvksTextKlRow,
  isNvksVBaoCaoWorkItem,
  injectNvksVBaoCaoDetailWorkItem,
  NVKS_V_BAO_CAO_DVT,
  NVKS_V_BAO_CAO_KL_DEFAULT,
  NVKS_V_BAO_CAO_NOI_DUNG,
} from '../lib/nvksDcKl';
import { KL_SECTION_TITLE_CELL_CLASS, getKlNvksDescCellClass, formatKlNumber, parseKlNumber, preventKlNumberInput } from '../lib/klTableUtils';
import { useResizableTableColumns } from '../hooks/useResizableTableColumns';
import ResizableTh from './table/ResizableTh';

const DUONG_CHUYEN_CAP_1_ID = 'CV_008';
const DUONG_CHUYEN_CAP_2_ID = 'CV_009';
const DO_VE_BD_TUYEN_ID = 'CV_016a';

/** Gốc mặc định theo kéo tay user (localStorage nvks-goc-kl). Tổng 1031px. */
const GOC_KL_TABLE_WIDTHS = [52, 547, 96, 81, 207, 48];
const GOC_KL_TABLE_ID = 'nvks-goc-kl-v2';
/** DC mặc định theo kéo tay user (localStorage v3): Nội dung rộng, (01)/(02)/(03) vừa. Tổng 1394px. */
const DC_KL_TABLE_WIDTHS = [48, 601, 72, 64, 200, 200, 161, 48];
const DC_KL_TABLE_ID = 'nvks-dc-kl-unified-v3';

/** Cột Xóa sticky mép phải — không trôi khi cuộn ngang / kéo cột. */
const KL_XOA_STICKY_TH_DC =
  'p-2 border border-rose-100 text-center font-bold sticky right-0 z-[30] bg-amber-50 shadow-[-3px_0_6px_rgba(0,0,0,0.08)]';
const KL_XOA_STICKY_TH_GOC =
  'p-2 border border-blue-100 text-center font-bold sticky right-0 z-[30] bg-blue-50 shadow-[-3px_0_6px_rgba(0,0,0,0.08)]';
const KL_XOA_STICKY_TD =
  'p-1 border border-gray-200 text-center sticky right-0 z-10 bg-white shadow-[-3px_0_5px_rgba(0,0,0,0.06)] group-hover:bg-blue-50';
const KL_XOA_STICKY_TD_MUTED =
  'p-1 border border-gray-200 text-center sticky right-0 z-10 bg-white shadow-[-3px_0_5px_rgba(0,0,0,0.06)]';
const KL_XOA_STICKY_TD_TITLE =
  'p-1 border border-gray-200 text-center sticky right-0 z-10 bg-gray-100 shadow-[-3px_0_5px_rgba(0,0,0,0.06)]';
const KL_XOA_STICKY_TD_ADD =
  'p-1 border border-gray-200 sticky right-0 z-10 bg-emerald-50/40 shadow-[-3px_0_5px_rgba(0,0,0,0.06)]';
const KL_XOA_STICKY_TD_SECTION =
  'p-1 border border-gray-200 sticky right-0 z-10 bg-slate-100 shadow-[-3px_0_5px_rgba(0,0,0,0.06)]';
const DC_KL_COL_TOOLTIPS = {
  kl01: 'Khối lượng đã phê duyệt (01) — lấy từ NVKS Gốc',
  kl02: 'Khối lượng điều chỉnh (02) — ô vàng cam = đã khác (01); mặc định xanh lá',
  kl03: 'Chênh lệch (03) = (02) − (01); dương (+) tăng, âm (−) giảm so với phê duyệt',
};

function isDuongChuyenCapItem(id) {
  return id === DUONG_CHUYEN_CAP_1_ID || id === DUONG_CHUYEN_CAP_2_ID;
}

function getRouteLengthKey(quantities) {
  return `${quantities['CV_005a_tong'] ?? ''}|${quantities['CV_005b_tong'] ?? ''}`;
}

function getRouteLengthKm(quantities) {
  const overhead = parseFloat(quantities['CV_005a_tong']) || 0;
  const underground = parseFloat(quantities['CV_005b_tong']) || 0;
  const sum = overhead + underground;
  if (sum > 0) return sum;
  return parseFloat(quantities['CV_005_tong']) || 0;
}

function computeDuongChuyenCap1(routeKm) {
  if (routeKm <= 1) return 3;
  return Math.floor(routeKm / 0.8);
}

function computeDuongChuyenCap2(routeKm, cap1) {
  if (routeKm <= 1) return 2;
  return Math.floor(routeKm / 0.3) - cap1;
}

function getRouteLengthMeters(quantities) {
  const routeKm = getRouteLengthKm(quantities);
  return routeKm > 0 ? routeKm * 1000 : 0;
}

function calcDoVeBdWidth(quantities, itemId, defaultWidth = 60) {
  const br = parseFloat(quantities[`${itemId}_br`]);
  return Number.isNaN(br) ? defaultWidth : br;
}

function calcDoVeBdLength(quantities, itemId, defaultLength = 80) {
  const cdRaw = quantities[`${itemId}_cd`];
  if (cdRaw !== undefined && cdRaw !== "") {
    return parseFloat(cdRaw) || 0;
  }
  return defaultLength;
}

function calcDoVeBdTotal(quantities, itemId) {
  const sl = parseFloat(quantities[`${itemId}_sl`]) || 0;
  const width = calcDoVeBdWidth(quantities, itemId, 60);
  const cdM = calcDoVeBdLength(quantities, itemId, 80);
  return parseFloat(((sl * width * cdM) / 10000).toFixed(4));
}

function calcDoVeBdTuyenTotal(quantities, itemId = DO_VE_BD_TUYEN_ID) {
  const sl = parseFloat(quantities[`${itemId}_sl`]) || 0;
  const width = calcDoVeBdWidth(quantities, itemId, 60);
  const cdRaw = quantities[`${itemId}_cd`];
  const cdM =
    cdRaw !== undefined && cdRaw !== ''
      ? parseFloat(cdRaw) || 0
      : getRouteLengthMeters(quantities);
  return parseFloat(((sl * width * cdM) / 10000).toFixed(4));
}

function autoResizeTextarea(el) {
  if (!el) return;
  // Đo lại từ 0 để scrollHeight chính xác; cộng thêm vài px tránh cắt chân dòng cuối (line-height / justify)
  el.style.height = "0";
  const next = el.scrollHeight + 4;
  el.style.height = `${next}px`;
  if (el.scrollHeight > next) {
    el.style.height = `${el.scrollHeight + 2}px`;
  }
}

const NVKS_TOOLBAR_BTN =
  "inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-45 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0";

function NvksToolbarSpinner({ className = "w-3.5 h-3.5" }) {
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

function NvksToolbarDivider() {
  return <div className="w-px h-6 bg-slate-300/60 mx-0.5 shrink-0 hidden sm:block" aria-hidden />;
}

export default function FormNVKS({ project, existingId, onClose, onSaved }) {
  const { showAlert, showConfirm } = useAppDialog();
  const [formData, setFormData] = useState({
    ma_du_an: "",
    ten_du_an: "",
    giai_doan: "",
    cap_dien_ap: "Trung hạ áp (0.4-35kV)", 
    loai_hinh: "",
    chu_dau_tu: "",
    dia_diem: "",
    quyet_dinh_giao_a: "",
    quyet_dinh_phe_duyet_nvks: "",
    quyet_dinh_phe_duyet_nvks_day_du: "",
    link_pdf_phe_duyet_nvks: "",
    ngay_qd_phe_duyet: "",
    trang_thai_nvks: "dang_lap",
    phien_ban: "GỐC",
    so_lan_dc: 0,
    link_docx_xuat: "",
    link_pdf_xuat: "",
    link_pdf_da_ky: "",
    link_pdf_ky_dau: "",
    exported_at: "",
    quy_mo: "",
    thoi_gian_ks_lap_pa: "",
    thoi_gian_ks_lap_bcks: "",
    thoi_gian_hoan_thien_ho_so: "",
    thoi_gian_thuc_hien_tong: "",
    thoi_diem_lap: "",
    nguoi_lap: "", // Sẽ được tự động điền theo tài khoản đăng nhập
    email_nguoi_lap: "",
    nguoi_lap_ma_nv: "",
    chu_nhiem_ks: DEFAULT_CNKS_NAME,
    chu_nhiem_ks_ma_nv: "",
    lanh_dao_duyet: DEFAULT_LANH_DAO_NAME,
    lanh_dao_duyet_ma_nv: "",
    trang_thai_ky_noi_bo: "chua_trinh",
    trinh_ky_id: "",
  });

  const [nhanSuCatalog, setNhanSuCatalog] = useState([]);
  const [listCNKS, setListCNKS] = useState(() => [...DEFAULT_CNKS_OPTIONS]);
  const [listLanhDao, setListLanhDao] = useState(() => [...DEFAULT_LANH_DAO_OPTIONS]);
  
  const [listChuDauTu, setListChuDauTu] = useState(getCanonicalChuDauTuList);

  const [pdfFile, setPdfFile] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isScanningPheDuyet, setIsScanningPheDuyet] = useState(false);
  const [pheDuyetScanPercent, setPheDuyetScanPercent] = useState(0);
  const [isSaving, setIsSaving] = useState(false); 
  const [isExporting, setIsExporting] = useState(false);
  const [isPrintingPdf, setIsPrintingPdf] = useState(false);
  const [trinhKyActions, setTrinhKyActions] = useState(null);
  const [isCreatingDc, setIsCreatingDc] = useState(false);
  const [versionList, setVersionList] = useState([]);
  const [klDcManual, setKlDcManual] = useState({});
  const [gocNvksRecord, setGocNvksRecord] = useState(null);

  const [templateData, setTemplateData] = useState([]);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);
  const [quantities, setQuantities] = useState({});
  const [capDhValues, setCapDhValues] = useState({});
  const [notes, setNotes] = useState({}); 
  const [hiddenItems, setHiddenItems] = useState(new Set());
  const [donViOverrides, setDonViOverrides] = useState({});
  const [addRowModal, setAddRowModal] = useState({ open: false, section: null, ten: '', donVi: 'Công' });
  const [isAddingRow, setIsAddingRow] = useState(false);

  const qdGiaoARef = useRef(null);
  const quyMoRef = useRef(null);
  const routeLengthKeyRef = useRef(null);
  /** Word/PDF chỉ sáng sau Lưu / Lưu & đóng thành công; sửa tay → tắt (không phụ thuộc đồng bộ công thức). */
  const [exportUnlocked, setExportUnlocked] = useState(false);
  const lockExport = useCallback(() => setExportUnlocked(false), []);
  const unlockExport = useCallback(() => setExportUnlocked(true), []);
  const [nvksRecordId, setNvksRecordId] = useState(existingId);

  useEffect(() => {
    setNvksRecordId(existingId);
  }, [existingId]);

  /** Khóa cứng: đã chốt KL (thường sau upload QĐ PD). Khóa mềm: đang trình ký. Không khóa vì đã ký nội bộ. */
  const isKlLocked =
    formData.trang_thai_nvks === "da_chot_kl" ||
    formData.trang_thai_ky_noi_bo === "dang_trinh";
  const isQdPdLocked = Boolean(formData.quyet_dinh_phe_duyet_nvks?.trim());

  useEffect(() => {
    routeLengthKeyRef.current = null;
  }, [existingId, nvksRecordId]);

  useEffect(() => {
    if (isKlLocked) return;

    const routeKey = getRouteLengthKey(quantities);

    if (routeLengthKeyRef.current === null) {
      routeLengthKeyRef.current = routeKey;
      return;
    }

    if (routeLengthKeyRef.current === routeKey) return;

    routeLengthKeyRef.current = routeKey;

    const routeKm = getRouteLengthKm(quantities);
    const cap1 = computeDuongChuyenCap1(routeKm);
    const cap2 = computeDuongChuyenCap2(routeKm, cap1);
    const sl016a = parseFloat(quantities[`${DO_VE_BD_TUYEN_ID}_sl`]) || 0;

    setQuantities((prev) => ({
      ...prev,
      [`${DUONG_CHUYEN_CAP_1_ID}_tong`]: String(cap1),
      [`${DUONG_CHUYEN_CAP_2_ID}_tong`]: String(cap2),
      ...(sl016a <= 1
        ? {
            [`${DO_VE_BD_TUYEN_ID}_cd`]:
              routeKm > 0 ? String(routeKm * 1000) : '',
          }
        : {}),
    }));
  }, [quantities['CV_005a_tong'], quantities['CV_005b_tong'], isKlLocked]);

  // Tự co giãn chiều cao textarea QĐ Giao A / Quy mô (sau khi DOM layout xong)
  useLayoutEffect(() => {
    const resize = () => {
      autoResizeTextarea(qdGiaoARef.current);
      autoResizeTextarea(quyMoRef.current);
    };
    resize();
    const frame = requestAnimationFrame(resize);
    const afterPaint = setTimeout(resize, 0);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(afterPaint);
    };
  }, [formData.quyet_dinh_giao_a, formData.quy_mo]);

  const loaiHinhOptions = useMemo(
    () => LOAI_HINH_NVKS_OPTIONS.map(({ slug, label }) => ({ slug, label })),
    []
  );

  useEffect(() => {
    // 1. Tự động lấy thông tin người dùng đang đăng nhập từ Session
    let defaultNguoiLap = "Đỗ Minh Phương";
    let defaultEmail = "minhphuong.npsc@gmail.com";
    let defaultMaNv = "";
    try {
      const parsedUser = getAuthUser();
      if (parsedUser) {
        if (parsedUser.ho_ten) defaultNguoiLap = parsedUser.ho_ten;
        if (parsedUser.email) defaultEmail = parsedUser.email;
        if (parsedUser.ma_nv) defaultMaNv = parsedUser.ma_nv;
      }
    } catch (e) {}

    // 2. Khởi tạo các thông tin cơ bản của dự án
    if (project) {
      const pName = (project.ten_du_an || "").toLowerCase();
      const pCode = (project.ma_du_an || "").toLowerCase();
      let autoCapDienAp = "Trung hạ áp (0.4-35kV)";
      if (
        pName.includes("110kv") || pName.includes("220kv") || pName.includes("500kv") ||
        pCode.includes("110") || pCode.includes("220") || pCode.includes("500")
      ) {
        autoCapDienAp = "Cao áp (110-220kV)";
      }

      let mappedGiaiDoan = project.giai_doan_chuan || project.giai_doan || "";
      if (mappedGiaiDoan === "FS") mappedGiaiDoan = "BCNCKT";
      if (mappedGiaiDoan === "TKKT-TKBVTC") mappedGiaiDoan = "TKBVTC";

      let diaDiemStr = project.dia_diem_ks || "";
      if (diaDiemStr && !/(tỉnh|thành phố|tp\.)/i.test(diaDiemStr)) {
        diaDiemStr = "Tỉnh " + diaDiemStr;
      }

      let autoThoiDiemLap = "";
      if (!existingId && project.qd_giao_a) {
        const match = project.qd_giao_a.match(/(?:ngày\s+)?(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/i);
        if (match) {
          const day = parseInt(match[1], 10);
          const month = parseInt(match[2], 10) - 1;
          const year = parseInt(match[3], 10);
          let date = new Date(year, month, day);
          if (!isNaN(date.getTime())) {
            let added = 0;
            while (added < 3) {
              date.setDate(date.getDate() + 1);
              if (date.getDay() !== 0 && date.getDay() !== 6) {
                added++;
              }
            }
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            autoThoiDiemLap = `${y}-${m}-${d}`;
          }
        }
      }

      const normalizedCdt = normalizeChuDauTu(project.chu_dau_tu || '');
      if (normalizedCdt && !listChuDauTu.includes(normalizedCdt)) {
        setListChuDauTu(prev => {
          if (!prev.includes(normalizedCdt)) return [...prev, normalizedCdt];
          return prev;
        });
      }

      if (!existingId) {
        setFormData((prev) => ({
          ...prev,
          ma_du_an: project.ma_du_an || "",
          ten_du_an: project.ten_du_an || "",
          giai_doan: mappedGiaiDoan,
          dia_diem: diaDiemStr,
          cap_dien_ap: autoCapDienAp,
          quy_mo: project.quy_mo_dieu_chinh || project.quy_mo || "",
          quyet_dinh_giao_a: project.qd_giao_a_day_du || project.qd_giao_a || "",
          chu_dau_tu: normalizedCdt,
          ...(autoThoiDiemLap ? { thoi_diem_lap: autoThoiDiemLap } : {})
        }));
      }
    }
    
    // 3. Phân luồng: Mở Hồ sơ cũ VS Tạo Hồ sơ mới
    if (existingId) {
      fetchSavedRecord(); 
    } else {
      // Chỉ gán thông tin đăng nhập cho HỒ SƠ MỚI
      setFormData(prev => ({
        ...prev,
        nguoi_lap: defaultNguoiLap,
        email_nguoi_lap: defaultEmail,
        nguoi_lap_ma_nv: defaultMaNv,
        chu_nhiem_ks: prev.chu_nhiem_ks || DEFAULT_CNKS_NAME,
        lanh_dao_duyet: prev.lanh_dao_duyet || DEFAULT_LANH_DAO_NAME,
      }));
      fetchTemplateData();
    }
  }, [project, existingId]);

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
        console.warn("Không tải danh mục nhân sự cho trình ký:", err?.message || err);
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

  const loadVersionList = async (maDuAn) => {
    if (!maDuAn) {
      setVersionList([]);
      return [];
    }
    try {
      const list = await fetchNvksVersions(supabase, maDuAn);
      setVersionList(list);
      return list;
    } catch (err) {
      console.warn("Không tải được danh sách phiên bản:", err.message);
      return [];
    }
  };

  const GOC_NVKS_COLUMNS =
    "id, ma_du_an, giai_doan, loai_hinh, du_lieu_bang_tinh, thoi_gian_ks_lap_pa, thoi_gian_ks_lap_bcks, thoi_gian_hoan_thien_ho_so, thoi_gian_thuc_hien_tong";

  const loadGocNvksRecord = useCallback(async (maDuAn) => {
    if (!maDuAn) {
      setGocNvksRecord(null);
      return;
    }
    try {
      const versions = await fetchNvksVersions(supabase, maDuAn, GOC_NVKS_COLUMNS);
      setGocNvksRecord(pickNvksGocRecord(versions));
    } catch (err) {
      console.warn("Không tải NVKS Gốc:", err.message);
      setGocNvksRecord(null);
    }
  }, []);

  useEffect(() => {
    const maDuAn = formData.ma_du_an || project?.ma_du_an;
    if (!isPhienBanDieuChinh(formData.phien_ban) || !maDuAn) {
      setGocNvksRecord(null);
      return;
    }
    loadGocNvksRecord(maDuAn);
  }, [formData.phien_ban, formData.ma_du_an, project?.ma_du_an, loadGocNvksRecord]);

  const applyRecordToForm = (data) => {
    if (!data) return;
    // Hồ sơ đã có trên DB = đã lưu phiên trước → xuất Word/PDF sáng ngay; chỉ tắt khi user sửa tay
    setExportUnlocked(true);
    let dbGiaiDoan = data.giai_doan || "";
    if (dbGiaiDoan === "FS") dbGiaiDoan = "BCNCKT";
    if (dbGiaiDoan === "TKKT-TKBVTC") dbGiaiDoan = "TKBVTC";
    const dbLoaiHinh = normalizeLoaiHinhLabel(data.loai_hinh || "");

    setFormData({
      ma_du_an: data.ma_du_an || project?.ma_du_an || "",
      ten_du_an: data.ten_du_an || "",
      giai_doan: dbGiaiDoan,
      cap_dien_ap:
        data.du_lieu_bang_tinh?.cap_dien_ap ||
        ((data.ten_du_an || "").toLowerCase().includes("110kv") ||
        (data.ten_du_an || "").toLowerCase().includes("220kv")
          ? "Cao áp (110-220kV)"
          : "Trung hạ áp (0.4-35kV)"),
      loai_hinh: dbLoaiHinh,
      chu_dau_tu: data.chu_dau_tu || "",
      dia_diem: data.dia_diem || "",
      quyet_dinh_giao_a: data.quyet_dinh_giao_a || "",
      quyet_dinh_phe_duyet_nvks: data.quyet_dinh_phe_duyet_nvks || "",
      quyet_dinh_phe_duyet_nvks_day_du: data.quyet_dinh_phe_duyet_nvks_day_du || "",
      link_pdf_phe_duyet_nvks: data.link_pdf_phe_duyet_nvks || "",
      ngay_qd_phe_duyet: data.ngay_qd_phe_duyet || "",
      trang_thai_nvks:
        data.trang_thai_nvks ||
        ((data.quyet_dinh_phe_duyet_nvks || "").trim() ? "co_qd_pd" : "dang_lap"),
      phien_ban: data.phien_ban || "GỐC",
      so_lan_dc: Number(data.so_lan_dc) || 0,
      link_docx_xuat: data.link_docx_xuat || "",
      link_pdf_xuat: data.link_pdf_xuat || "",
      link_pdf_da_ky: data.link_pdf_da_ky || "",
      link_pdf_ky_dau: data.link_pdf_ky_dau || "",
      exported_at: data.exported_at || "",
      quy_mo: data.quy_mo || "",
      thoi_gian_ks_lap_pa: data.thoi_gian_ks_lap_pa || "",
      thoi_gian_ks_lap_bcks: data.thoi_gian_ks_lap_bcks || "",
      thoi_gian_hoan_thien_ho_so: data.thoi_gian_hoan_thien_ho_so || "",
      thoi_gian_thuc_hien_tong: data.thoi_gian_thuc_hien_tong || "",
      thoi_diem_lap: data.thoi_diem_lap || "",
      nguoi_lap: data.nguoi_lap || "Đỗ Minh Phương",
      email_nguoi_lap: data.email_nguoi_lap || data.email || "minhphuong.npsc@gmail.com",
      nguoi_lap_ma_nv: data.nguoi_lap_ma_nv || "",
      chu_nhiem_ks: data.chu_nhiem_ks || DEFAULT_CNKS_NAME,
      chu_nhiem_ks_ma_nv: data.chu_nhiem_ks_ma_nv || "",
      lanh_dao_duyet: data.lanh_dao_duyet || DEFAULT_LANH_DAO_NAME,
      lanh_dao_duyet_ma_nv: data.lanh_dao_duyet_ma_nv || "",
      trang_thai_ky_noi_bo: data.trang_thai_ky_noi_bo || "chua_trinh",
      trinh_ky_id: data.trinh_ky_id || "",
    });

    setListCNKS(mergePersonnelOptions(DEFAULT_CNKS_OPTIONS, data.chu_nhiem_ks));
    setListLanhDao(mergePersonnelOptions(DEFAULT_LANH_DAO_OPTIONS, data.lanh_dao_duyet));

    if (data.du_lieu_bang_tinh) {
      const q = { ...(data.du_lieu_bang_tinh.quantities || {}) };
      initDoVeTramTyLeQuantities({ id_cong_viec: "CV_026", cong_thuc: "12" }, q);
      // Hồ sơ cũ: chỉ tiêu mẫu nước còn cứng 3 → roll về theo số mẫu cha
      setQuantities(syncMauNuocQuantities(q));
      routeLengthKeyRef.current = getRouteLengthKey(q);
      const cap = { ...(data.du_lieu_bang_tinh.capDhValues || {}) };
      if (!cap.CV_026) cap.CV_026 = DEFAULT_CAP_DH;
      // Điền III (hoặc cấp mặc định trên DM) cho các dòng chưa có giá trị — tránh select rỗng hiện "I"
      setCapDhValues(seedDefaultCapDhValues(cap, templateData));
      setNotes(data.du_lieu_bang_tinh.notes || {});
      setHiddenItems(new Set(data.du_lieu_bang_tinh.hiddenItems || []));
      setDonViOverrides(data.du_lieu_bang_tinh.donViOverrides || {});
      setKlDcManual(getKlDcManual(data.du_lieu_bang_tinh));
    } else {
      setKlDcManual({});
    }
  };

  const fetchSavedRecord = async (recordIdOverride) => {
    const recordId = recordIdOverride || nvksRecordId || existingId;
    if (!recordId) return;
    try {
      const { data, error } = await supabase.from("HO_SO_NVKS").select("*").eq("id", recordId).single();
      if (error) throw error;
      if (data) {
        applyRecordToForm(data);
        setNvksRecordId(data.id);
        await loadVersionList(data.ma_du_an || project?.ma_du_an);
      }
    } catch (err) {
      console.error("Lỗi phục hồi dữ liệu:", err.message);
    } finally {
      fetchTemplateData();
    }
  };

  const fetchTemplateData = async () => {
    try {
      setIsLoadingTemplate(true);
      const { data, error } = await supabase.from('DM_CONG_VIEC').select('*').order('id_cong_viec', { ascending: true }); 
      if (error) throw error;
      const merged = supplementDmCongViec(data || []);
      setTemplateData(merged);
      if (merged.length && !existingId && !nvksRecordId) {
        const initQuantities = {};
        const initCapDh = {};
        merged.forEach(item => {
            const capRaw = item.cap_dh?.toString().trim();
            if (
              capRaw &&
              !capRaw.startsWith("'=") &&
              !capRaw.startsWith('=') &&
              capRaw !== '__optional__'
            ) {
                initCapDh[item.id_cong_viec] = capRaw;
            }
            if (isDoVeTramTyLeItem(item)) {
              initDoVeTramTyLeQuantities(item, initQuantities);
              initCapDh[item.id_cong_viec] = DEFAULT_CAP_DH;
            } else if (
              item.loai_nhap_lieu === 'mac_dinh' &&
              item.cong_thuc &&
              !isMauNuocChiTieuId(item.id_cong_viec)
            ) {
                initQuantities[`${item.id_cong_viec}_tong`] = item.cong_thuc.replace(/^'?=?/, '').trim();
            }
            if (item.loai_nhap_lieu === 'do_ve_bd_tuyen' || item.loai_nhap_lieu === 'do_ve_bd') {
                initQuantities[`${item.id_cong_viec}_br`] = '60';
            }
            if (item.loai_nhap_lieu === 'do_ve_bd') {
                initQuantities[`${item.id_cong_viec}_cd`] = '80';
            }
        });
        setQuantities(syncMauNuocQuantities(initQuantities));
        setCapDhValues(seedDefaultCapDhValues(initCapDh, merged));
      }
    } catch (error) { console.error("Lỗi tải Danh mục công việc:", error.message); } 
    finally {
      setIsLoadingTemplate(false);
    }
  };

  // Tải lại DM khi quay lại tab (tránh giữ bản cũ trong RAM)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchTemplateData();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [existingId, nvksRecordId]);

  // Sau khi có DM: điền cấp ĐH mặc định III cho dòng còn trống (hồ sơ cũ / select không được để rỗng → hiện nhầm "I")
  // Chỉ setState khi thật sự thêm giá trị — và giữ quiet nếu form đang sạch (đã lưu)
  useEffect(() => {
    if (!templateData?.length) return;
    setCapDhValues((prev) => {
      const next = seedDefaultCapDhValues(prev, templateData);
      const prevKeys = Object.keys(prev || {});
      const nextKeys = Object.keys(next);
      if (prevKeys.length === nextKeys.length && nextKeys.every((k) => prev[k] === next[k])) {
        return prev;
      }
      return next;
    });
  }, [templateData]);

  const filteredWorkItems = useMemo(() => {
    if (!formData.giai_doan || templateData.length === 0) return [];
    
    let romanCounter = 0;
    let subRomanCounter = 0;
    let mainCounter = 0; 
    let subCounter = 0;

    const toRoman = (num) => {
        const roman = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
        return roman[num] || num;
    };

    const filtered = mergeUserRowsIntoSubsections(
      templateData.filter(item => {
        if (isRemovedDmRow(item)) return false;
        if (hiddenItems.has(item.id_cong_viec)) return false;
        if (!formData.loai_hinh) return false;
        return isWorkItemApplicable(item, formData.giai_doan, formData.loai_hinh);
      })
    );

    const mapped = filtered.map(item => {
      let dynamicTT = item.tt;
      const loaiDong = (item.loai_dong || "").trim().toLowerCase();
      
      if (loaiDong === "tieu_de") {
          const isSubTitle = (item.tt || "").trim().includes('.');
          if (!isSubTitle) {
              romanCounter++;
              subRomanCounter = 0;
              dynamicTT = toRoman(romanCounter);
          } else {
              subRomanCounter++;
              dynamicTT = toRoman(romanCounter) + "." + subRomanCounter;
          }
          mainCounter = 0; 
          subCounter = 0; 
      } 
      else if (loaiDong === "cong_viec_con") { 
          subCounter++; 
          dynamicTT = `${mainCounter}.${subCounter}`; 
      } 
      else { 
          mainCounter++; 
          subCounter = 0; 
          dynamicTT = mainCounter.toString(); 
      }
      
      return { ...item, dynamicTT };
    });

    return pruneOrphanSectionTitles(mapped);
  }, [formData.giai_doan, formData.loai_hinh, templateData, hiddenItems]);

  const filteredWorkItemsWithV = useMemo(
    () => injectNvksVBaoCaoDetailWorkItem(filteredWorkItems),
    [filteredWorkItems]
  );

  // Đồng bộ chỉ tiêu mẫu nước theo số mẫu (hồ sơ cũ còn mac_dinh=3 / kẹt 3)
  useLayoutEffect(() => {
    if (isKlLocked) return;
    setQuantities((prev) => {
      const synced = syncMauNuocQuantities(prev, filteredWorkItemsWithV);
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(synced);
      if (
        prevKeys.length === nextKeys.length &&
        nextKeys.every((k) => String(prev[k] ?? '') === String(synced[k] ?? ''))
      ) {
        return prev;
      }
      return synced;
    });
  }, [quantities[`${MAU_NUOC_PARENT_ID}_tong`], isKlLocked, filteredWorkItemsWithV]);

  const tableRenderPlan = useMemo(() => {
    return buildTableRenderPlan(filteredWorkItemsWithV, {
      showDzAdd: !isKlLocked && shouldShowDuongDayAddButton(formData.loai_hinh),
      showTramAdd: !isKlLocked && shouldShowTramAddButton(formData.loai_hinh),
      showThoaAdd: !isKlLocked && shouldShowThoaThuanAddButton(filteredWorkItemsWithV),
    });
  }, [filteredWorkItemsWithV, formData.loai_hinh, isKlLocked]);

  const evaluateFormula = (formulaStr) => {
      if (!formulaStr) return "";
      try {
          let parsedStr = formulaStr.toString().replace(/^'?=?/i, "").trim();

          // =CV_xxx: cha trống / không hợp lệ → 0 (chỉ tiêu mẫu nước bám số mẫu)
          const simpleRef = parsedStr.match(/^(CV_\d+[a-zA-Z]*)$/i);
          if (simpleRef) {
              const stateKey = `${simpleRef[1]}_tong`;
              const raw = quantities[stateKey];
              if (raw === undefined || raw === null || String(raw).trim() === "") return 0;
              const val = parseFloat(raw);
              if (Number.isNaN(val)) return 0;
              return Number.isInteger(val) ? val : val.toFixed(2);
          }

          parsedStr = parsedStr.replace(/INT\(([^)]+)\)/gi, 'Math.floor($1)');
          
          parsedStr = parsedStr.replace(/CV_\d+[a-zA-Z]*(_[a-z]+)?/g, (match) => {
              let stateKey = match;
              if (!match.includes('_tong') && !match.includes('_sau') && !match.includes('_ho') && !match.includes('_sl') && !match.includes('_br') && !match.includes('_ds') && !match.includes('_cd') && !match.includes('_tram') && !match.includes('_duong')) {
                  stateKey = `${match}_tong`;
              }
              const val = parseFloat(quantities[stateKey]);
              return isNaN(val) ? 0 : val;
          });
          const result = new Function('return ' + parsedStr)();
          return isNaN(result) ? 0 : Number.isInteger(result) ? result : result.toFixed(2);
      } catch (error) { return "-"; }
  };

  const evaluateCapDh = (capDhStr) => {
      if (!capDhStr) return "";
      const str = capDhStr.toString().trim();
      if (str.startsWith("'=") || str.startsWith("=")) {
          const refId = str.replace(/^'?=?/i, "").trim();
          return capDhValues[refId] || "";
      }
      return str; 
  };

  const preventInvalidNumberInput = (e) => {
    if ([46, 8, 9, 27, 13, 110, 190].includes(e.keyCode) ||
        (e.keyCode === 65 && e.ctrlKey === true) ||
        (e.keyCode === 67 && e.ctrlKey === true) ||
        (e.keyCode === 86 && e.ctrlKey === true) ||
        (e.keyCode === 88 && e.ctrlKey === true) ||
        (e.keyCode >= 35 && e.keyCode <= 39)) {
         return;
    }
    if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
        e.preventDefault();
    }
  };

  const handleQuantityChange = (id, field, value) => {
    if (field === 'tyLe') {
      setQuantities((prev) => ({ ...prev, [`${id}_${field}`]: value }));
      lockExport();
      return;
    }
    if (field === 'dongMuc') {
      setQuantities((prev) => ({ ...prev, [`${id}_${field}`]: value }));
      lockExport();
      return;
    }
    let cleanValue = value.toString().replace(/,/g, ''); 
    cleanValue = cleanValue.replace(/[^0-9.]/g, ''); 
    
    const parts = cleanValue.split('.');
    if (parts.length > 2) {
      cleanValue = parts[0] + '.' + parts.slice(1).join('');
    }

    // Số mẫu nước → chỉ tiêu con theo ngay (xóa cha → cả cha và con = 0)
    const touchedItem = filteredWorkItemsWithV.find((it) => it.id_cong_viec === id);
    const isMauParent =
      isMauNuocParentId(id) || (touchedItem ? isMauNuocParentItem(touchedItem) : false);
    const isMauChild =
      isMauNuocChiTieuId(id) || (touchedItem ? isMauNuocChiTieuItem(touchedItem) : false);

    if (isMauParent && field === 'tong') {
      const parentVal = cleanValue.trim() === '' ? '0' : cleanValue;
      const parentKey = `${MAU_NUOC_PARENT_ID}_tong`;
      // Luôn ghi cả key chuẩn CV_043 lẫn id thực tế (phòng id lệch)
      setQuantities((prev) =>
        syncMauNuocQuantities(
          {
            ...prev,
            [parentKey]: parentVal,
            [`${id}_tong`]: parentVal,
          },
          filteredWorkItemsWithV
        )
      );
      lockExport();
      return;
    }

    // Không cho sửa tay chỉ tiêu mẫu nước — luôn bám cha
    if (isMauChild && field === 'tong') {
      setQuantities((prev) => syncMauNuocQuantities(prev, filteredWorkItemsWithV));
      return;
    }
    
    setQuantities(prev => ({ ...prev, [`${id}_${field}`]: cleanValue }));
    lockExport();

    if (isPhienBanDieuChinh(formData.phien_ban) && field !== 'tyLe' && field !== 'dongMuc' && field !== 'tong') {
      setKlDcManual((prev) => {
        if (!Object.prototype.hasOwnProperty.call(prev, id)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  /** Đồng bộ KL công thức — không khóa xuất (chỉ khóa khi user sửa tay) */
  const syncAutoQuantityTong = useCallback(
    (id, nextVal) => {
      // Chỉ tiêu mẫu nước: luôn bám CV_043 — không nhận giá trị lệch từ công thức cũ (mac_dinh=3)
      if (isMauNuocChiTieuId(id)) {
        setQuantities((prev) => syncMauNuocQuantities(prev));
        return;
      }
      const normalized =
        nextVal === undefined || nextVal === null ? "" : nextVal.toString();
      setQuantities((prev) => {
        if ((prev[`${id}_tong`] ?? "").toString() === normalized) return prev;
        return { ...prev, [`${id}_tong`]: normalized };
      });
    },
    []
  );

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (value === "ADD_NEW") {
      if (name === "chu_dau_tu") {
        handleAddChuDauTu();
      } else if (name === "chu_nhiem_ks") {
        handleAddCNKS();
      } else if (name === "lanh_dao_duyet") {
        handleAddLanhDao();
      }
      return;
    }
    if (name === "chu_nhiem_ks") {
      setFormData({
        ...formData,
        chu_nhiem_ks: value,
        chu_nhiem_ks_ma_nv: resolveMaNvByHoTen(nhanSuCatalog, value),
      });
    } else if (name === "lanh_dao_duyet") {
      setFormData({
        ...formData,
        lanh_dao_duyet: value,
        lanh_dao_duyet_ma_nv: resolveMaNvByHoTen(nhanSuCatalog, value),
      });
    } else {
      setFormData({ ...formData, [name]: value });
    }
    lockExport();

    // Cập nhật chiều cao textarea ngay khi đang gõ
    if (name === "quyet_dinh_giao_a") autoResizeTextarea(qdGiaoARef.current);
    if (name === "quy_mo") autoResizeTextarea(quyMoRef.current);
  };

  const handleCapDhChange = (id, value) => {
    setCapDhValues((prev) => ({ ...prev, [id]: value }));
    lockExport();
  };
  const handleDonViChange = (id, value) => {
    setDonViOverrides((prev) => ({ ...prev, [id]: value }));
    lockExport();
  };

  const openAddRowModal = (section) => {
    if (isKlLocked || !formData.loai_hinh) return;
    setAddRowModal({ open: true, section, ten: '', donVi: 'Công' });
  };

  const handleSubmitAddRow = async () => {
    const ten = addRowModal.ten?.trim();
    if (!ten) {
      await showAlert('Vui lòng nhập tên hạng mục công việc.');
      return;
    }
    const loaiConfig = getLoaiHinhConfigByLabel(formData.loai_hinh);
    if (!loaiConfig) return;

    const phanLoai =
      addRowModal.section === 'DUONG_DAY'
        ? 'DUONG_DAY'
        : addRowModal.section === 'THOA_THUAN'
          ? 'THOA_THUAN'
          : resolveTramPhanLoaiForUserAdd(loaiConfig.cheDoTram);

    let userEmail = '';
    try {
      const parsed = getAuthUser();
      if (parsed) userEmail = parsed.email || '';
    } catch { /* ignore */ }

    setIsAddingRow(true);
    try {
      const newId = allocateNextCvId(templateData);
      const row = buildUserCongViecRow({
        id: newId,
        tenCongViec: ten,
        phanLoaiHangMuc: phanLoai,
        donVi: addRowModal.donVi || 'Công',
        taoBoiEmail: userEmail,
      });

      const { error } = await insertDmCongViecRow(supabase, row);
      if (error) throw error;

      await fetchTemplateData();
      setAddRowModal({ open: false, section: null, ten: '', donVi: 'Công' });
      lockExport();
      await showAlert(`Đã thêm hạng mục "${ten}" (${newId}) vào danh mục công việc.`);

      logHoatDong({
        phanHe: 'NVKS',
        hanhDong: 'CREATE',
        chiTietNgan: `Thêm hạng mục công việc NVKS: ${ten}`,
        doiTuongId: newId,
        duLieuDong: { phan_loai: phanLoai, don_vi: row.don_vi },
      });
    } catch (err) {
      await showAlert(`Không thể thêm hạng mục: ${err.message}`);
    } finally {
      setIsAddingRow(false);
    }
  };

  /** Thùng rác = đặt KL = 0 (không ẩn hàng). Mẫu nước: con bám theo số mẫu. */
  const handleRemoveRow = (id) => {
    if (isKlLocked) return;
    const row = filteredWorkItemsWithV.find((it) => it.id_cong_viec === id);
    setQuantities((prev) => {
      let next = zeroCongViecKlInQuantities(prev, id);
      if (row && isMauNuocParentItem(row)) {
        next = syncMauNuocQuantities(
          {
            ...next,
            [`${MAU_NUOC_PARENT_ID}_tong`]: '0',
            [`${id}_tong`]: '0',
          },
          filteredWorkItemsWithV
        );
      } else {
        next = syncMauNuocQuantities(next, filteredWorkItemsWithV);
      }
      return next;
    });
    if (!isMauNuocChiTieuId(id)) lockExport();
  };

  const handleExportWord = async () => {
    if (!nvksRecordId) {
      await showAlert("Bạn phải nhấn lưu trước khi xuất file.");
      return;
    }
    if (!exportUnlocked) {
      await showAlert("Bạn phải nhấn Lưu hoặc Lưu & đóng trước khi xuất file.");
      return;
    }
    if (!isFormComplete) {
      await showAlert(
        "Vui lòng điền đủ Chủ đầu tư, Địa điểm và Chọn đúng Loại hình khảo sát mẫu để kết xuất!"
      );
      return;
    }
    const hadDocx = await hasExistingExportFile(supabase, {
      maDuAn: formData.ma_du_an,
      moduleLoai: "nvks",
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

      const { templateFileName, storageUrl, displayName, displayTime, timestamp } = await exportNvksWord({
        formData,
        filteredWorkItems,
        quantities,
        capDhValues,
        donViOverrides,
        supabase,
        saveToStorage: true,
        download: false,
        klDcManual: isPhienBanDieuChinh(formData.phien_ban) ? klDcManual : undefined,
        gocKlById: isPhienBanDieuChinh(formData.phien_ban) ? gocKlByIdForExport : undefined,
      });

      if (storageUrl) {
        const exportedAt = new Date(timestamp).toISOString();
        const { error: linkErr } = await supabase
          .from("HO_SO_NVKS")
          .update({
            link_docx_xuat: storageUrl,
            exported_at: exportedAt,
          })
          .eq("id", nvksRecordId);
        if (linkErr) {
          console.warn("Không cập nhật link_docx_xuat:", linkErr.message);
        }
        const user = getAuthUser();
        try {
          await syncXuatBanTaiLieu(supabase, {
            maDuAn: formData.ma_du_an,
            kind: "docx",
            storagePath: storageUrl,
            displayName,
            thoiGian: exportedAt,
            nguoiUpMaNv: user?.ma_nv,
          });
        } catch (syncErr) {
          console.warn("Không ghi kho hồ sơ NVKS:", syncErr?.message || syncErr);
        }
        setFormData((prev) => ({ ...prev, link_docx_xuat: storageUrl, exported_at: exportedAt }));
      }

      logHoatDong({
        phanHe: 'NVKS',
        hanhDong: 'EXPORT_WORD',
        chiTietNgan: `Xuất file Word NVKS: ${formData.ten_du_an}`,
        doiTuongId: nvksRecordId || existingId,
        duLieuDong: {
          template: templateFileName,
          giai_doan: formData.giai_doan,
          link_docx_xuat: storageUrl || null,
        }
      });

      await showAlert("Đã xuất Word. Xem hoặc tải tại mục File xuất trên form.", {
        title: "Xuất thành công",
        variant: "success",
      });

    } catch (error) {
      console.error("Lỗi khi kết xuất:", error);
      await showAlert(`Đã xảy ra lỗi khi tạo tệp tin Word:\n${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrintPdf = async () => {
    if (!nvksRecordId) {
      await showAlert("Bạn phải nhấn lưu trước khi In/PDF.");
      return;
    }
    if (!exportUnlocked) {
      await showAlert("Bạn phải nhấn Lưu hoặc Lưu & đóng trước khi In/PDF.");
      return;
    }
    if (!isFormComplete) {
      await showAlert(
        "Vui lòng điền đủ Chủ đầu tư, Địa điểm và Chọn đúng Loại hình khảo sát mẫu để in!"
      );
      return;
    }
    if (formData.trang_thai_ky_noi_bo === "dang_trinh") {
      await showAlert("Đang trình ký — hủy phiên trước khi xuất PDF mới.");
      return;
    }
    const hadPdf = await hasExistingExportFile(supabase, {
      maDuAn: formData.ma_du_an,
      moduleLoai: "nvks",
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
      const { outBlob, templateFileName, localFileName } = await generateNvksWordBlob({
        formData,
        filteredWorkItems,
        quantities,
        capDhValues,
        donViOverrides,
        supabase,
        klDcManual: isPhienBanDieuChinh(formData.phien_ban) ? klDcManual : undefined,
        gocKlById: isPhienBanDieuChinh(formData.phien_ban) ? gocKlByIdForExport : undefined,
      });
      const pdfDocx = await prepareNvksDocxBlobForPdf(outBlob);
      const pdfName = String(localFileName || "NVKS.docx").replace(/\.docx$/i, ".pdf");
      const pdfBlob = await convertDocxBlobToPdfDownload(pdfDocx, {
        fileName: pdfName,
        download: false,
      });

      const pdfFile = new File([pdfBlob], pdfName, { type: "application/pdf" });
      const { storageUrl, displayName, exportedAt } = await uploadNvksPhatHanhPdf(
        supabase,
        pdfFile,
        formData
      );
      const { error: linkErr } = await supabase
        .from("HO_SO_NVKS")
        .update({
          link_pdf_xuat: storageUrl,
          exported_at: exportedAt,
        })
        .eq("id", nvksRecordId);
      if (linkErr) throw new Error(linkErr.message || "Không cập nhật link PDF trên hồ sơ.");

      const user = getAuthUser();
      try {
        await syncXuatBanTaiLieu(supabase, {
          maDuAn: formData.ma_du_an,
          kind: "pdf",
          storagePath: storageUrl,
          displayName,
          thoiGian: exportedAt,
          nguoiUpMaNv: user?.ma_nv,
        });
      } catch (syncErr) {
        console.warn("Không ghi kho hồ sơ NVKS PDF:", syncErr?.message || syncErr);
      }

      setFormData((prev) => ({
        ...prev,
        link_pdf_xuat: storageUrl,
        exported_at: exportedAt,
      }));

      let kyReset = false;
      try {
        kyReset = await resetTrinhKyAfterPdfExport(supabase, {
          module: "nvks",
          hoSoId: nvksRecordId,
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
        phanHe: "NVKS",
        hanhDong: "PRINT_PDF",
        chiTietNgan: `Xuất PDF NVKS: ${formData.ten_du_an}`,
        doiTuongId: nvksRecordId,
        duLieuDong: {
          template: templateFileName,
          giai_doan: formData.giai_doan,
          link_pdf_xuat: storageUrl,
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
    } catch (error) {
      console.error("Lỗi In/PDF:", error);
      await showAlert(`Không xuất được PDF:\n${error.message}`);
    } finally {
      setIsPrintingPdf(false);
    }
  };

  const handleUploadPdfDaKy = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!nvksRecordId) {
      await showAlert("Vui lòng Lưu hồ sơ NVKS trước khi upload PDF đã ký.");
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
      const { storageUrl, fileName: signedFileName } = await uploadNvksSignedPdf(supabase, file, formData);
      const { error } = await supabase
        .from("HO_SO_NVKS")
        .update({ link_pdf_da_ky: storageUrl })
        .eq("id", nvksRecordId);
      if (error) throw error;
      const user = getAuthUser();
      try {
        await syncTaiLieuHoSoByTag(supabase, {
          maDuAn: formData.ma_du_an,
          nguon: "upload",
          tag: "pdf_da_ky",
          storagePath: storageUrl,
          displayName: signedFileName || file.name,
          nguoiUpMaNv: user?.ma_nv,
        });
      } catch (syncErr) {
        console.warn("Không ghi kho hồ sơ PDF đã ký:", syncErr?.message || syncErr);
      }
      setFormData((prev) => ({ ...prev, link_pdf_da_ky: storageUrl }));
      await showAlert("Đã lưu PDF đã ký lên kho hồ sơ.");
    } catch (err) {
      await showAlert(`Lỗi upload PDF: ${err.message}`);
    } finally {
      e.target.value = "";
    }
  };

  const handleSwitchVersion = async (recordId) => {
    if (!recordId || recordId === nvksRecordId) return;
    try {
      const maDuAn = formData.ma_du_an || project?.ma_du_an;
      await setActiveNvksVersion(supabase, maDuAn, recordId);
      await fetchSavedRecord(recordId);
    } catch (err) {
      await showAlert(`Không chuyển được phiên bản: ${err.message}`);
    }
  };

  const handleDieuChinh = async () => {
    if (!nvksRecordId) {
      await showAlert("Cần lưu bản GỐC trước khi tạo ĐIỀU CHỈNH.");
      return;
    }
    const gate = canCreateDieuChinh(versionList);
    if (!gate.ok) {
      await showAlert(gate.reason);
      return;
    }
    const ok = await showConfirm(
      "Tạo bản ĐIỀU CHỈNH mới?\n\nBản hiện tại được giữ nguyên trong lịch sử. Bản mới copy KL để chỉnh theo thực địa."
    );
    if (!ok) return;

    try {
      setIsCreatingDc(true);
      const { data: source, error } = await supabase
        .from("HO_SO_NVKS")
        .select("*")
        .eq("id", nvksRecordId)
        .single();
      if (error) throw error;

      const versions = versionList.length
        ? versionList
        : await loadVersionList(source.ma_du_an);
      const { id: newId, so_lan_dc: nextDc } = await createDieuChinhVersion(
        supabase,
        source,
        versions
      );

      const { data: newNvks, error: nvksLoadErr } = await supabase
        .from("HO_SO_NVKS")
        .select("*")
        .eq("id", newId)
        .single();
      if (!nvksLoadErr && newNvks) {
        try {
          await createPaktkDieuChinhFromNvks(supabase, newNvks, project);
        } catch (pakErr) {
          console.warn("Tạo PAKTKS ĐIỀU CHỈNH:", pakErr.message);
        }
      }

      await fetchSavedRecord(newId);
      await showAlert(
        `Đã tạo bản ĐIỀU CHỈNH lần ${nextDc} (+ PAKTKS DC nếu chưa có). Chỉnh KL và lưu trên bản mới.`
      );
      logHoatDong({
        phanHe: "NVKS",
        hanhDong: "CREATE_DC",
        chiTietNgan: `Tạo NVKS ĐIỀU CHỈNH lần ${nextDc}`,
        doiTuongId: newId,
        duLieuDong: { ma_du_an: source.ma_du_an, parent: source.id, so_lan_dc: nextDc, giai_doan: source.giai_doan },
      });
      onSaved?.({ id: newId, ma_du_an: source.ma_du_an });
    } catch (err) {
      await showAlert(`Không tạo được bản ĐIỀU CHỈNH:\n${err.message}`);
    } finally {
      setIsCreatingDc(false);
    }
  };

  const handleChotKl = async () => {
    if (!nvksRecordId || isKlLocked) return;
    const ok = await showConfirm(
      isPhienBanDieuChinh(formData.phien_ban)
        ? `Chốt khối lượng bản ${phienBanLabel}?\n\nSau khi chốt không thể SỬA KL trên bản này.`
        : "Chốt khối lượng bản GỐC?\n\nSau khi chốt không SỬA được KL trên GỐC (cần ĐIỀU CHỈNH nếu thay đổi so với Giao A)."
    );
    if (!ok) return;
    try {
      const { error } = await supabase
        .from("HO_SO_NVKS")
        .update({ trang_thai_nvks: "da_chot_kl" })
        .eq("id", nvksRecordId);
      if (error) throw error;
      setFormData((prev) => ({ ...prev, trang_thai_nvks: "da_chot_kl" }));
      await loadVersionList(formData.ma_du_an || project?.ma_du_an);
      logHoatDong({
        phanHe: "NVKS",
        hanhDong: "CHOT_KL",
        chiTietNgan: `Chốt KL NVKS ${phienBanLabel}: ${formData.ten_du_an}`,
        doiTuongId: nvksRecordId,
        duLieuDong: { phien_ban: formData.phien_ban, so_lan_dc: formData.so_lan_dc, giai_doan: formData.giai_doan },
      });
      await showAlert(`Đã chốt khối lượng bản ${phienBanLabel}.`);
    } catch (err) {
      await showAlert(`Không chốt được KL: ${err.message}`);
    }
  };

  const handleSaveToDB = async ({ closeAfterSave = false } = {}) => {
    if (isSaving || isKlLocked) return;
    const maDuAn = (formData.ma_du_an || project?.ma_du_an || "").trim();
    if (!maDuAn) {
      await showAlert("Thiếu mã dự án — không thể lưu hồ sơ NVKS.");
      return;
    }
    try {
      setIsSaving(true);
      const hiddenItemsArray = Array.from(hiddenItems);

      const payload = {
        ma_du_an: maDuAn,
        ten_du_an: formData.ten_du_an,
        giai_doan: formData.giai_doan,
        loai_hinh: formData.loai_hinh,
        chu_dau_tu: normalizeChuDauTu(formData.chu_dau_tu),
        dia_diem: formData.dia_diem,
        quyet_dinh_giao_a: formData.quyet_dinh_giao_a,
        quyet_dinh_phe_duyet_nvks: formData.quyet_dinh_phe_duyet_nvks,
        quyet_dinh_phe_duyet_nvks_day_du: formData.quyet_dinh_phe_duyet_nvks_day_du,
        link_pdf_phe_duyet_nvks: formData.link_pdf_phe_duyet_nvks,
        ngay_qd_phe_duyet: formData.ngay_qd_phe_duyet || null,
        trang_thai_nvks:
          formData.trang_thai_nvks === 'da_chot_kl'
            ? 'da_chot_kl'
            : (formData.quyet_dinh_phe_duyet_nvks || '').trim()
              ? 'co_qd_pd'
              : 'dang_lap',
        phien_ban: formData.phien_ban,
        so_lan_dc: Number(formData.so_lan_dc) || 0,
        is_active: true,
        quy_mo: formData.quy_mo,
        thoi_gian_ks_lap_pa: formData.thoi_gian_ks_lap_pa,
        thoi_gian_ks_lap_bcks: formData.thoi_gian_ks_lap_bcks,
        thoi_gian_hoan_thien_ho_so: formData.thoi_gian_hoan_thien_ho_so,
        thoi_gian_thuc_hien_tong: formData.thoi_gian_thuc_hien_tong,
        thoi_diem_lap: formData.thoi_diem_lap,
        nguoi_lap: formData.nguoi_lap,
        email_nguoi_lap: formData.email_nguoi_lap,
        nguoi_lap_ma_nv: formData.nguoi_lap_ma_nv || null,
        chu_nhiem_ks: formData.chu_nhiem_ks,
        chu_nhiem_ks_ma_nv: formData.chu_nhiem_ks_ma_nv || null,
        lanh_dao_duyet: formData.lanh_dao_duyet,
        lanh_dao_duyet_ma_nv: formData.lanh_dao_duyet_ma_nv || null,
        du_lieu_bang_tinh: {
          quantities,
          capDhValues,
          notes,
          hiddenItems: hiddenItemsArray,
          donViOverrides,
          cap_dien_ap: formData.cap_dien_ap,
          ...(isPhienBanDieuChinh(formData.phien_ban) ? { kl_dc_manual: klDcManual } : {}),
        },
      };

      const isUpdate = Boolean(nvksRecordId);
      let savedId = nvksRecordId;
      let statusError;

      const stripKyMaNv = (p) => {
        const next = { ...p };
        delete next.nguoi_lap_ma_nv;
        delete next.chu_nhiem_ks_ma_nv;
        delete next.lanh_dao_duyet_ma_nv;
        return next;
      };

      const runSave = async (body) => {
        if (isUpdate) {
          return supabase.from("HO_SO_NVKS").update(body).eq("id", nvksRecordId);
        }
        savedId = crypto.randomUUID();
        body.id = savedId;
        body.phien_ban = "GỐC";
        body.so_lan_dc = 0;
        body.parent_nvks_id = null;
        body.is_active = true;
        return supabase.from("HO_SO_NVKS").insert([body]);
      };

      let { error } = await runSave(payload);
      statusError = error;
      if (statusError && /nguoi_lap_ma_nv|chu_nhiem_ks_ma_nv|lanh_dao_duyet_ma_nv|column/i.test(statusError.message || "")) {
        ({ error } = await runSave(stripKyMaNv(payload)));
        statusError = error;
      }
      if (!statusError && !isUpdate) {
        await supabase.from("HO_SO_NVKS").update({ root_nvks_id: savedId }).eq("id", savedId);
      }

      if (statusError) throw statusError;

      setNvksRecordId(savedId);
      const nextTrangThai =
        formData.trang_thai_nvks === 'da_chot_kl'
          ? 'da_chot_kl'
          : (formData.quyet_dinh_phe_duyet_nvks || '').trim()
            ? 'co_qd_pd'
            : 'dang_lap';
      setFormData((prev) => ({
        ...prev,
        ma_du_an: maDuAn,
        trang_thai_nvks: nextTrangThai,
        phien_ban: isUpdate ? prev.phien_ban : "GỐC",
        so_lan_dc: isUpdate ? prev.so_lan_dc : 0,
      }));

      await loadVersionList(maDuAn);

      unlockExport();
      await showAlert("🎉 Đã lưu trữ và cập nhật dữ liệu hồ sơ thành công!");

      logHoatDong({
        phanHe: 'NVKS',
        hanhDong: isUpdate ? 'UPDATE' : 'CREATE',
        chiTietNgan: `${isUpdate ? 'Cập nhật' : 'Tạo mới'} hồ sơ NVKS`,
        doiTuongId: savedId,
        duLieuDong: {
          ma_du_an: maDuAn,
          ten_du_an: payload.ten_du_an,
          giai_doan: payload.giai_doan,
          loai_hinh: payload.loai_hinh
        }
      });

      onSaved?.({ id: savedId, ma_du_an: maDuAn });

      if (closeAfterSave) {
        onClose();
      }
    } catch (error) {
      console.error("Lỗi xử lý cơ sở dữ liệu:", error.message);
      await showAlert(`Đã xảy ra lỗi: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCNKS = () => {
    if (isKlLocked) return;
    const newName = prompt("Nhập tên Chủ nhiệm:");
    if (newName && newName.trim() !== "") {
      const trimmed = newName.trim();
      setListCNKS((prev) => mergePersonnelOptions(DEFAULT_CNKS_OPTIONS, prev, trimmed));
      setFormData({
        ...formData,
        chu_nhiem_ks: trimmed,
        chu_nhiem_ks_ma_nv: resolveMaNvByHoTen(nhanSuCatalog, trimmed),
      });
      lockExport();
    }
  };
  const handleAddLanhDao = () => {
    if (isKlLocked) return;
    const newName = prompt("Nhập tên Lãnh đạo:");
    if (newName && newName.trim() !== "") {
      const trimmed = newName.trim();
      setListLanhDao((prev) => mergePersonnelOptions(DEFAULT_LANH_DAO_OPTIONS, prev, trimmed));
      setFormData({
        ...formData,
        lanh_dao_duyet: trimmed,
        lanh_dao_duyet_ma_nv: resolveMaNvByHoTen(nhanSuCatalog, trimmed),
      });
      lockExport();
    }
  };
  const handleAddChuDauTu = () => {
    if (isKlLocked) return;
    const newName = prompt("Nhập tên Chủ đầu tư mới:");
    if (newName && newName.trim() !== "") { setListChuDauTu([...listChuDauTu, newName]); setFormData({ ...formData, chu_dau_tu: newName }); lockExport(); }
  };

  const handleFileChange = (e) => setPdfFile(e.target.files && e.target.files[0]);
  
  const handleAIParsePDF = async () => {
    if (isKlLocked) return;
    if (!pdfFile || !formData.ten_du_an) {
      await showAlert("Kiểm tra lại file và tên dự án trước khi quét.");
      return;
    }
    setIsScanning(true);
    try {
      const fileData = new FormData();
      fileData.append("file", pdfFile);
      fileData.append("ten_du_an", formData.ten_du_an);
      const response = await fetch("/api/scan-pdf", { method: "POST", body: fileData });
      let data = await response.json();
      if (!response.ok) throw new Error(data.error);

      let rawQuyetDinh = data.quyet_dinh_giao_a || "";
      rawQuyetDinh = rawQuyetDinh.replace(/tổng công ty điện lực miền bắc/gi, "Tổng Công ty Điện lực miền Bắc");

      // Cập nhật thông minh danh sách Chủ đầu tư nếu xuất hiện đơn vị mới
      let detectedChuDauTu = normalizeChuDauTu(data.chu_dau_tu || "");
      if (detectedChuDauTu && !listChuDauTu.includes(detectedChuDauTu)) {
        setListChuDauTu(prev => [...prev, detectedChuDauTu]);
      }

      setFormData((prev) => ({
        ...prev,
        dia_diem: data.dia_diem || prev.dia_diem, 
        quyet_dinh_giao_a: rawQuyetDinh,
        chu_dau_tu: detectedChuDauTu || prev.chu_dau_tu, 
        quy_mo: data.quy_mo || "",
        thoi_diem_lap: data.thoi_diem_lap || prev.thoi_diem_lap, 
      }));
      lockExport();
      await showAlert("AI trích xuất thông tin thành công!");
      
      // Ghi log AI Scan
      logHoatDong({
        phanHe: 'NVKS',
        hanhDong: 'AI_SCAN',
        chiTietNgan: `AI quét thông tin file Giao A: ${pdfFile.name}`,
        doiTuongId: nvksRecordId || existingId,
        duLieuDong: { result: data }
      });
      
    } catch (error) { 
      await showAlert(`Lỗi AI: ${error.message}`);
      // Ghi log lỗi AI
      logHoatDong({
        phanHe: 'NVKS',
        hanhDong: 'AI_SCAN_FAIL',
        chiTietNgan: `AI quét lỗi file: ${pdfFile?.name}`,
        trangThai: 'Thất bại',
        doiTuongId: nvksRecordId || existingId,
        duLieuDong: { error: error.message }
      });
    } finally { setIsScanning(false); }
  };

  const handleUploadPheDuyet = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (isKlLocked || isQdPdLocked) return;
      if (!nvksRecordId) {
          await showAlert('Vui lòng Lưu hồ sơ NVKS trước khi đính kèm Quyết định phê duyệt.');
          e.target.value = '';
          return;
      }

      setIsScanningPheDuyet(true);
      setPheDuyetScanPercent(4);
      let uploadTick = null;
      try {
          uploadTick = setInterval(() => {
              setPheDuyetScanPercent((p) => (p < 28 ? p + 2 : p));
          }, 180);

          const fileExt = file.name.split('.').pop() || 'pdf';
          const safeName = cleanForFileName(formData.ma_du_an || formData.ten_du_an);
          const suffix =
            Number(formData.so_lan_dc) > 0
              ? `DC${formData.so_lan_dc}`
              : formData.phien_ban === "GỐC"
                ? "GOC"
                : "DC";
          const fileName = `${safeName}_PD_NVKS_${suffix}_${Date.now()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
              .from('pdfs_phe_duyet_nvks')
              .upload(fileName, file, { cacheControl: '3600', upsert: true });

          if (uploadTick) clearInterval(uploadTick);
          uploadTick = null;

          if (uploadError) throw new Error("Lỗi khi tải file lên Storage: " + uploadError.message);

          setPheDuyetScanPercent(32);

          const { data: publicUrlData } = supabase.storage
              .from('pdfs_phe_duyet_nvks')
              .getPublicUrl(fileName);

          const fileUrl = publicUrlData.publicUrl;

          const fileData = new FormData();
          fileData.append("file", file);
          fileData.append("ten_du_an", formData.ten_du_an || project?.ten_du_an || "");

          const data = await new Promise((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.open('POST', '/api/parse-phe-duyet');
              xhr.onload = () => {
                  try {
                      const parsed = JSON.parse(xhr.responseText || '{}');
                      if (xhr.status >= 200 && xhr.status < 300) {
                          setPheDuyetScanPercent(98);
                          resolve(parsed);
                      } else {
                          reject(new Error(parsed.error || 'Lỗi khi hệ thống quét file'));
                      }
                  } catch {
                      reject(new Error('Lỗi khi hệ thống quét file'));
                  }
              };
              xhr.onerror = () => reject(new Error('Không thể kết nối máy chủ.'));
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
              await supabase.storage.from('pdfs_phe_duyet_nvks').remove([fileName]);
              await showAlert(
                "Hệ thống nhận dạng không đọc được số QĐ phê duyệt NVKS trong file này.\n\nFile đã bị hủy — vui lòng kiểm tra và chọn đúng QĐ phê duyệt.",
                { variant: 'warning' }
              );
              return;
          }

          if (!khopDuAn) {
              const tenHeThong = formData.ten_du_an || project?.ten_du_an || "";
              let detailMsg = data.canh_bao_khop || '';
              detailMsg = detailMsg.replace(/^AI không tìm thấy/i, 'Hệ thống nhận dạng không tìm thấy');

              const confirmed = await showConfirm('', {
                  title: 'Cảnh báo — đối chiếu tên công trình',
                  confirmLabel: 'Vẫn dùng file này',
                  cancelLabel: 'Hủy — chọn file khác',
                  variant: 'warning',
                  compare: {
                    intro: 'QĐ phê duyệt có thể không thuộc công trình đang mở trên form. Anh/chị đối chiếu hai tên bên dưới trước khi tiếp tục.',
                    leftLabel: 'Tên công trình được đối chiếu',
                    leftValue: tenHeThong,
                    rightLabel: 'Tên trong QĐPD (file upload)',
                    rightValue: tenTrongQd || '(Không trích được tên riêng trong QĐ)',
                    doKhop,
                    detail: detailMsg,
                  },
              });
              if (!confirmed) {
                  await supabase.storage.from('pdfs_phe_duyet_nvks').remove([fileName]);
                  return;
              }
          } else if (warning) {
              await showAlert(`${warning}\n\nVui lòng kiểm tra lại nội dung QĐ trước khi tiếp tục.`, { variant: 'warning' });
          }

          const qdPatch = {
              quyet_dinh_phe_duyet_nvks: soQdNgan,
              quyet_dinh_phe_duyet_nvks_day_du: quyetDinhDayDu,
              ngay_qd_phe_duyet: ngayQd || null,
              link_pdf_phe_duyet_nvks: fileUrl,
              trang_thai_nvks: "da_chot_kl",
          };
          const { error: qdSaveErr } = await supabase
              .from("HO_SO_NVKS")
              .update(qdPatch)
              .eq("id", nvksRecordId);
          if (qdSaveErr) throw new Error("Không lưu QĐ / chốt KL: " + qdSaveErr.message);

          setFormData((prev) => ({
              ...prev,
              quyet_dinh_phe_duyet_nvks: soQdNgan,
              quyet_dinh_phe_duyet_nvks_day_du: quyetDinhDayDu,
              ngay_qd_phe_duyet: ngayQd,
              link_pdf_phe_duyet_nvks: fileUrl,
              trang_thai_nvks: "da_chot_kl",
          }));
          lockExport();
          await loadVersionList(formData.ma_du_an || project?.ma_du_an);

          const user = getAuthUser();
          try {
            await syncTaiLieuHoSoByTag(supabase, {
              maDuAn: formData.ma_du_an,
              nguon: "upload",
              tag: "qd_pd",
              storagePath: fileUrl,
              displayName: fileName,
              nguoiUpMaNv: user?.ma_nv,
            });
          } catch (syncErr) {
            console.warn("Không ghi kho hồ sơ QĐ PD:", syncErr?.message || syncErr);
          }

          const successMsg = khopDuAn
            ? "🎉 Đã quét QĐ phê duyệt — tên công trình khớp.\n\nĐã chốt khối lượng (khóa sửa form). Muốn đổi KL → tạo bản ĐIỀU CHỈNH."
            : "⚠️ Đã áp dụng QĐ (anh/chị đã xác nhận thủ công).\n\nĐã chốt khối lượng (khóa sửa form). Muốn đổi KL → tạo bản ĐIỀU CHỈNH.";
          await showAlert(successMsg);

          logHoatDong({
            phanHe: 'NVKS',
            hanhDong: 'SCAN_QD_PHE_DUYET',
            chiTietNgan: `Quét QĐ PD NVKS + chốt KL: ${soQdNgan}`,
            doiTuongId: nvksRecordId || existingId,
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
            }
          });

      } catch (err) {
          console.error("Lỗi:", err);
          await showAlert(`Đã xảy ra lỗi: ${err.message}`);

          logHoatDong({
            phanHe: 'NVKS',
            hanhDong: 'UPLOAD_FILE_FAIL',
            chiTietNgan: `Lỗi đính kèm QĐ Phê duyệt NVKS`,
            trangThai: 'Thất bại',
            doiTuongId: nvksRecordId || existingId,
            duLieuDong: { error: err.message }
          });
      } finally {
          if (uploadTick) clearInterval(uploadTick);
          setIsScanningPheDuyet(false);
          setPheDuyetScanPercent(0);
          e.target.value = '';
      }
  };

  const isValidLoaiHinh = loaiHinhOptions.some(opt => opt.label === formData.loai_hinh);
  const isFormComplete = formData.chu_dau_tu.trim() !== "" && isValidLoaiHinh && formData.dia_diem.trim() !== "";
  const isSavedToDb = Boolean(nvksRecordId);
  const isExportReady =
    isSavedToDb && isFormComplete && exportUnlocked && !isExporting && !isPrintingPdf;
  // Cho xuất cả khi đã chốt KL (bản phát hành); chỉ khóa khi chưa lưu / còn sửa chưa lưu
  const isExportButtonDisabled = !isExportReady || isExporting || isPrintingPdf;
  const hasGocSaved = hasNvksGocRecord(versionList) || (isSavedToDb && !isPhienBanDieuChinh(formData.phien_ban));
  const dieuChinhGate = canCreateDieuChinh(versionList);
  const phienBanLabel = formatNvksPhienBanLabel({
    phien_ban: formData.phien_ban,
    so_lan_dc: formData.so_lan_dc,
  });
  const isSuaMode = isPhienBanGoc(formData.phien_ban) && !isKlLocked;
  const isDcMode = isPhienBanDieuChinh(formData.phien_ban);

  const gocKlApprovedById = useMemo(() => {
    if (!isDcMode || !gocNvksRecord || !templateData.length) return {};
    return buildGocKlApprovedById(gocNvksRecord, templateData, project);
  }, [isDcMode, gocNvksRecord, templateData, project]);

  const gocKlByIdForExport = useMemo(() => {
    if (!isDcMode || !gocNvksRecord || !templateData.length) return null;
    return buildGocKlApprovedById(gocNvksRecord, templateData, project);
  }, [isDcMode, gocNvksRecord, templateData, project]);

  const klTableColCount = isDcMode ? 8 : 6;
  const {
    widths: klColWidths,
    startResize: startKlColResize,
    totalWidth: klTableWidth,
    containerRef: klTableContainerRef,
    fitContainer: klFit,
  } = useResizableTableColumns(
    isDcMode ? DC_KL_TABLE_ID : GOC_KL_TABLE_ID,
    isDcMode ? DC_KL_TABLE_WIDTHS : GOC_KL_TABLE_WIDTHS,
    { fitContainer: true }
  );

  const handleKlDc02Change = useCallback(
    (idCongViec, value) => {
      if (isKlLocked) return;
      if (isNvksThoiGianField(idCongViec)) {
        setFormData((prev) => ({ ...prev, [idCongViec]: value }));
        lockExport();
        return;
      }
      if (isNvksTextKlRow(idCongViec)) {
        setKlDcManual((prev) => ({ ...prev, [idCongViec]: value }));
        lockExport();
        return;
      }
      setKlDcManual((prev) => ({ ...prev, [idCongViec]: value }));
      if (!isNvksTextKlRow(idCongViec)) {
        setQuantities((prev) => ({ ...prev, [`${idCongViec}_tong`]: value }));
      }
      lockExport();
    },
    [isKlLocked, lockExport]
  );

  const docxExportMeta = useMemo(
    () => parseNvksExportLink(formData.link_docx_xuat, formData.exported_at),
    [formData.link_docx_xuat, formData.exported_at]
  );
  const pdfExportMeta = useMemo(
    () => parseNvksExportLink(formData.link_pdf_xuat, formData.exported_at),
    [formData.link_pdf_xuat, formData.exported_at]
  );
  const pdfDaKyMeta = useMemo(
    () => parseNvksExportLink(formData.link_pdf_da_ky, formData.exported_at),
    [formData.link_pdf_da_ky, formData.exported_at]
  );
  const pdfKyDauMeta = useMemo(
    () => parseNvksExportLink(formData.link_pdf_ky_dau, formData.exported_at),
    [formData.link_pdf_ky_dau, formData.exported_at]
  );

  const nvksPdfDaKySection = (
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
          disabled={!nvksRecordId || formData.trang_thai_ky_noi_bo === "dang_trinh"}
          className="w-full text-xs file:mr-2 file:py-1.5 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-bold file:bg-emerald-100 file:text-emerald-800"
        />
      </div>
    </>
  );

  const nvksExportLinks = (
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
      <div className="pt-2 border-t border-blue-100">
        <NvksTrinhKyPanel
          nvksRecordId={nvksRecordId}
          formData={formData}
          isKlLocked={formData.trang_thai_nvks === "da_chot_kl"}
          compact
          showTrinhButton={false}
          onActionsChange={setTrinhKyActions}
          onStatusChange={(st) => {
          if (!st) return;
          setFormData((prev) => {
            const nextTrangThai = st.trangThai || prev.trang_thai_ky_noi_bo;
            const nextLinkPdfDaKy = st.linkPdfDaKy || "";
            const nextLinkPdfKyDau = st.linkPdfKyDau || "";
            const nextTrinhKyId = st.phien?.id ?? (nextTrangThai === "chua_trinh" ? null : prev.trinh_ky_id);
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

  const nvksQdSection = (
    <div
      className={`p-4 rounded-xl border ${
        isQdPdLocked ? "bg-emerald-50/40 border-emerald-200" : "bg-amber-50/50 border-amber-200"
      } flex flex-col gap-3 shadow-sm`}
    >
      {!isQdPdLocked ? (
        <div className="w-full flex flex-col gap-2">
          <input
            type="file"
            accept="application/pdf"
            onChange={handleUploadPheDuyet}
            disabled={isScanningPheDuyet || !nvksRecordId}
            className={`w-full text-xs file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-amber-100 file:text-amber-700 hover:file:bg-amber-200 cursor-pointer ${
              isScanningPheDuyet || !nvksRecordId ? "opacity-50 cursor-not-allowed" : ""
            }`}
          />
          {isScanningPheDuyet ? (
            <div className="relative h-9 rounded-lg overflow-hidden bg-sky-100 border border-sky-200 shadow-inner">
              <div
                className="absolute inset-y-0 left-0 bg-sky-600 transition-all duration-300 ease-out overflow-hidden"
                style={{ width: `${Math.max(pheDuyetScanPercent, 12)}%` }}
              >
                <span className="absolute inset-y-0 left-0 flex items-center px-3 text-[11px] font-bold text-white whitespace-nowrap phe-duyet-scan-label">
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

      {isQdPdLocked || formData.quyet_dinh_phe_duyet_nvks ? (
        <div className="bg-white/80 border border-emerald-100 rounded-lg p-3 space-y-2">
          <div>
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1">
              Số Quyết định:
            </p>
            {formData.link_pdf_phe_duyet_nvks ? (
              <a
                href={formData.link_pdf_phe_duyet_nvks}
                target="_blank"
                rel="noreferrer"
                title="Nhấn để xem PDF"
                className="inline-flex items-center gap-1.5 font-bold italic text-[#1d4ed8] hover:text-[#1e3a8a] hover:underline text-sm leading-snug transition-colors cursor-pointer group"
              >
                <span>{formData.quyet_dinh_phe_duyet_nvks}</span>
                <Eye className="w-4 h-4 shrink-0 text-[#c2410c] group-hover:text-[#9a3412] transition-colors" aria-hidden />
                <span className="sr-only">Xem PDF quyết định phê duyệt</span>
              </a>
            ) : (
              <p className="inline-flex items-center gap-1.5 font-bold italic text-[#1d4ed8] text-sm leading-snug">
                <span>{formData.quyet_dinh_phe_duyet_nvks}</span>
              </p>
            )}
          </div>
          <div>
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1">
              Chi tiết:
            </p>
            <div className="text-xs text-[#15803d] italic leading-relaxed whitespace-pre-line text-justify">
              {formData.quyet_dinh_phe_duyet_nvks_day_du?.trim() || "—"}
            </div>
            {!formData.link_pdf_phe_duyet_nvks ? (
              <p className="mt-1.5 text-xs text-gray-400 italic">Chưa có file PDF quyết định phê duyệt</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white text-gray-800">
      <div className="bg-white px-6 py-4 border-b border-gray-100 flex justify-between items-center shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded text-gray-500 transition">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          </button>
          <div className="flex items-center gap-3 flex-wrap">
             <h3 className="font-black text-slate-800 text-base tracking-tight">LẬP NHIỆM VỤ KHẢO SÁT XÂY DỰNG</h3>
             <span className="bg-slate-100 text-slate-700 text-[11px] font-bold px-2 py-0.5 rounded border border-slate-200">{phienBanLabel}</span>
             {formData.trang_thai_nvks === "da_chot_kl" && (
               <span className="bg-red-50 text-red-700 text-[11px] font-bold px-2 py-0.5 rounded border border-red-100 flex items-center gap-1">🔒 ĐÃ CHỐT KL</span>
             )}
             {formData.trang_thai_ky_noi_bo === "dang_trinh" && (
               <span className="bg-amber-50 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">⏳ ĐANG TRÌNH KÝ</span>
             )}
             {formData.trang_thai_nvks !== "da_chot_kl" && isQdPdLocked && (
               <span className="bg-amber-50 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">📋 ĐÃ CÓ QĐ PD</span>
             )}
          </div>
        </div>
        
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div
            className="inline-flex flex-wrap items-center gap-1 p-1.5 rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100/90 border border-slate-200/90 shadow-sm"
            role="toolbar"
            aria-label="Thao tác NVKS"
          >
            <button
              type="button"
              onClick={handleExportWord}
              disabled={isExportButtonDisabled}
              title={
                !isSavedToDb
                  ? "Bạn phải nhấn lưu trước khi xuất file"
                  : !exportUnlocked
                    ? "Bạn phải nhấn Lưu hoặc Lưu & đóng trước khi xuất file"
                    : !isFormComplete
                      ? "Vui lòng điền đủ thông tin để kết xuất"
                      : "Xuất file Word"
              }
              className={`${NVKS_TOOLBAR_BTN} ${
                !isExportReady
                  ? "bg-slate-200 text-slate-400 border border-slate-200"
                  : "bg-gradient-to-br from-blue-500 to-blue-600 text-white border border-blue-600/20 shadow-md shadow-blue-500/25 hover:from-blue-600 hover:to-blue-700 hover:shadow-lg hover:shadow-blue-500/30 hover:-translate-y-px active:translate-y-0 focus-visible:ring-blue-400"
              }`}
            >
              {isExporting ? (
                <NvksToolbarSpinner />
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
              title={
                !isSavedToDb
                  ? "Bạn phải nhấn lưu trước khi Xuất PDF"
                  : !exportUnlocked
                    ? "Bạn phải nhấn Lưu hoặc Lưu & đóng trước khi Xuất PDF"
                    : !isFormComplete
                      ? "Vui lòng điền đủ thông tin để xuất PDF"
                      : "Xuất file PDF"
              }
              className={`${NVKS_TOOLBAR_BTN} ${
                !isExportReady
                  ? "bg-slate-200 text-slate-400 border border-slate-200"
                  : "bg-gradient-to-br from-rose-500 to-red-600 text-white border border-red-600/20 shadow-md shadow-red-500/25 hover:from-rose-600 hover:to-red-700 hover:shadow-lg hover:shadow-red-500/30 hover:-translate-y-px active:translate-y-0 focus-visible:ring-red-400"
              }`}
            >
              {isPrintingPdf ? (
                <NvksToolbarSpinner />
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
                <NvksToolbarDivider />
                <button
                  type="button"
                  onClick={handleDieuChinh}
                  disabled={isCreatingDc || !dieuChinhGate.ok}
                  title={dieuChinhGate.ok ? "Tạo bản ĐIỀU CHỈNH mới" : dieuChinhGate.reason}
                  className={`${NVKS_TOOLBAR_BTN} ${
                    isCreatingDc || !dieuChinhGate.ok
                      ? "bg-slate-100 text-slate-400 border border-slate-200"
                      : "bg-gradient-to-br from-amber-50 to-orange-100 text-amber-900 border border-amber-300/80 shadow-sm hover:from-amber-100 hover:to-orange-200 hover:border-amber-400 hover:-translate-y-px focus-visible:ring-amber-400"
                  }`}
                >
                  {isCreatingDc ? (
                    <NvksToolbarSpinner />
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
                title="Khóa SỬA KL trên bản hiện tại"
                className={`${NVKS_TOOLBAR_BTN} bg-white text-red-700 border border-red-200 shadow-sm hover:bg-red-50 hover:border-red-300 hover:-translate-y-px focus-visible:ring-red-300`}
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

            <NvksToolbarDivider />

            <button
              type="button"
              onClick={() => handleSaveToDB({ closeAfterSave: false })}
              disabled={isSaving || !isFormComplete || isKlLocked}
              className={`${NVKS_TOOLBAR_BTN} min-w-[7.5rem] ${
                isKlLocked
                  ? "bg-slate-200 text-slate-500 border border-slate-200"
                  : isSaving || !isFormComplete
                    ? "bg-emerald-300/80 text-white border border-emerald-300"
                    : "bg-gradient-to-br from-emerald-500 to-green-600 text-white border border-emerald-600/20 shadow-md shadow-emerald-500/25 hover:from-emerald-600 hover:to-green-700 hover:shadow-lg hover:shadow-emerald-500/30 hover:-translate-y-px focus-visible:ring-emerald-400"
              }`}
            >
              {isSaving ? (
                <NvksToolbarSpinner />
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
              className={`${NVKS_TOOLBAR_BTN} ${
                isKlLocked
                  ? "bg-slate-100 text-slate-400 border border-slate-200"
                  : isSaving || !isFormComplete
                    ? "bg-white text-emerald-300 border border-emerald-200"
                    : "bg-white text-emerald-700 border border-emerald-400 shadow-sm hover:bg-emerald-50 hover:border-emerald-500 hover:-translate-y-px focus-visible:ring-emerald-400"
              }`}
            >
              {isSaving ? (
                <NvksToolbarSpinner className="w-3.5 h-3.5 text-emerald-600" />
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
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wide">Lịch sử phiên bản</span>
          {versionList.map((v) => {
            const label = formatNvksPhienBanLabel(v);
            const active = v.id === nvksRecordId;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => handleSwitchVersion(v.id)}
                className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition ${
                  active
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-700"
                }`}
              >
                {label}
                {v.trang_thai_nvks === "da_chot_kl" ? " 🔒" : ""}
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
              <span className="font-black">ĐIỀU CHỈNH</span> — chỉnh KL thay đổi so với Giao A (bản mới, QĐ PD riêng).
            </>
          ) : (
            <>
              <span className="font-black">SỬA (GỐC)</span> — chỉnh KL khớp phạm vi Giao A; chưa chốt thì vẫn sửa được. Nhớ đồng bộ PAKTKS GỐC sau khi đổi KL.
            </>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto p-6 bg-gray-50 flex flex-col gap-6">
        <div className="flex flex-col lg:flex-row gap-6 items-stretch">
        <div className="w-full lg:w-2/3 flex flex-col min-h-0">
          
          <div className="bg-white p-5 rounded border border-gray-200 shadow-sm flex-1 flex flex-col min-h-0">
            <h4 className="font-bold text-blue-800 border-b border-blue-100 pb-2 mb-4">I. THÔNG TIN CƠ BẢN</h4>
            <div className="grid grid-cols-12 gap-4">
              {/* Dòng 1: Tên công trình */}
              <div className="col-span-12">
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Tên công trình</label>
                <input type="text" value={formData.ten_du_an} readOnly className="w-full border border-gray-200 bg-gray-100 rounded p-2 text-sm font-bold text-gray-800 cursor-not-allowed" />
              </div>

              {/* Dòng 2: Mã dự án, Cấp điện áp, Địa điểm KS, Chủ đầu tư */}
              <div className="col-span-12 md:col-span-3">
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Mã dự án</label>
                <input type="text" value={formData.ma_du_an} readOnly placeholder="Trống" className="w-full border border-gray-200 bg-gray-100 rounded p-2 text-sm font-bold text-gray-800 cursor-not-allowed" />
              </div>

              <div className="col-span-12 md:col-span-3">
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Cấp điện áp</label>
                <input 
                  type="text" 
                  value={formData.cap_dien_ap} 
                  readOnly 
                  className="w-full border border-gray-200 bg-gray-100 rounded p-2 text-sm font-bold text-purple-800 cursor-not-allowed" 
                />
              </div>

              <div className="col-span-12 md:col-span-3">
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Địa điểm khảo sát <span className="text-red-500">*</span></label>
                <input type="text" name="dia_diem" value={formData.dia_diem} onChange={handleInputChange} readOnly={isKlLocked} placeholder="Vd: Tỉnh, Thành phố..." className={`w-full border border-gray-300 rounded p-2 text-sm outline-none ${isKlLocked ? "bg-gray-100 cursor-not-allowed text-gray-500" : "focus:border-blue-500"}`} />
              </div>

              <div className="col-span-12 md:col-span-3">
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Chủ đầu tư / Đại diện CĐT <span className="text-red-500">*</span></label>
                <select 
                  name="chu_dau_tu" 
                  value={formData.chu_dau_tu} 
                  onChange={handleInputChange} 
                  disabled={isKlLocked} 
                  className={`w-full border border-gray-300 rounded p-2 text-sm outline-none ${isKlLocked ? "bg-gray-100 text-gray-500 cursor-not-allowed bg-gray-100" : "focus:border-blue-500 bg-white"}`}
                >
                  <option value="" disabled>-- Lựa chọn chủ đầu tư --</option>
                  {listChuDauTu.map((n, i) => <option key={i} value={n}>{n}</option>)}
                  {!isKlLocked && (
                    <option value="ADD_NEW" className="text-blue-600 font-bold bg-blue-50">+ Thêm chủ đầu tư mới...</option>
                  )}
                </select>
              </div>

              {/* Dòng 3: Giai đoạn & Loại hình khảo sát */}
              <div className="col-span-12 md:col-span-6">
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Giai đoạn</label>
                <input type="text" value={formData.giai_doan} readOnly className="w-full border border-gray-200 bg-gray-100 rounded p-2 text-sm font-bold text-blue-800 cursor-not-allowed" />
              </div>

              <div className="col-span-12 md:col-span-6">
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Loại hình khảo sát <span className="text-red-500">*</span></label>
                <AppStyledSelect
                  name="loai_hinh"
                  value={formData.loai_hinh}
                  onChange={handleInputChange}
                  disabled={isKlLocked}
                  invalid={formData.loai_hinh === ""}
                  placeholder="-- Chọn loại hình khảo sát --"
                  options={loaiHinhOptions.map((opt) => ({ value: opt.label, label: opt.label }))}
                />
              </div>

              {/* Dòng 4: Quyết định giao A & Quy mô — căn đều */}
              <div className="col-span-12 md:col-span-6">
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Quyết định giao A</label>
                <textarea ref={qdGiaoARef} name="quyet_dinh_giao_a" value={formData.quyet_dinh_giao_a} onChange={handleInputChange} readOnly={isKlLocked} rows={1} placeholder="Nhập Quyết định giao A..." className={`w-full min-h-[3.5rem] box-border border border-gray-300 rounded px-2 pt-2 pb-2.5 text-sm outline-none overflow-y-hidden resize-none text-justify leading-relaxed ${isKlLocked ? "bg-gray-100 cursor-not-allowed text-gray-500" : "focus:border-blue-500"}`} style={{ fieldSizing: "content" }}></textarea>
              </div>

              <div className="col-span-12 md:col-span-6">
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Quy mô xây dựng chính (Dự kiến)</label>
                <textarea ref={quyMoRef} name="quy_mo" value={formData.quy_mo} onChange={handleInputChange} readOnly={isKlLocked} rows={1} placeholder="Nhập quy mô xây dựng chính..." className={`w-full min-h-[3.5rem] box-border border border-gray-300 rounded px-2 pt-2 pb-2.5 text-sm outline-none overflow-y-hidden resize-none text-justify leading-relaxed ${isKlLocked ? "bg-gray-100 cursor-not-allowed text-gray-500" : "focus:border-blue-500"}`} style={{ fieldSizing: "content" }}></textarea>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-1/3 flex flex-col min-h-0">
          <HoSoPersonnelSidebar
            theme="blue"
            className="flex-1"
            formData={formData}
            listCNKS={listCNKS}
            listLanhDao={listLanhDao}
            showAddPersonnel
            isKlLocked={isKlLocked}
            onInputChange={handleInputChange}
            exportLinks={nvksExportLinks}
            exportSectionTitle="XUẤT FILE & TRÌNH KÝ"
            pdfDaKySection={nvksPdfDaKySection}
            quyetDinhSection={{ title: "QUYẾT ĐỊNH PHÊ DUYỆT NVKS", content: nvksQdSection }}
          />
        </div>
        </div>

        {(!isDcMode || gocNvksRecord) ? (
          <div className={`w-full ${isDcMode ? '' : 'lg:w-2/3'} mx-auto min-w-0`}>
            <div
              ref={klTableContainerRef}
              className={`rounded-lg border shadow-sm w-full overflow-x-auto ${isDcMode ? 'border-rose-200' : 'border-blue-200'}`}
            >
              <div className={`bg-white px-4 py-2.5 border-b sticky left-0 ${isDcMode ? 'border-rose-100' : 'border-blue-100'}`}>
                <h4 className="font-bold text-blue-800">
                  {isDcMode ? 'III. KHỐI LƯỢNG KHẢO SÁT — ĐIỀU CHỈNH' : 'III. KHỐI LƯỢNG KHẢO SÁT (DỰ KIẾN)'}
                </h4>
              </div>
              <table
                className="text-left border-collapse text-sm table-fixed w-full"
                style={
                  klFit
                    ? { width: "100%", minWidth: 0 }
                    : { width: klTableWidth, minWidth: klTableWidth }
                }
              >
                <colgroup>
                  {klColWidths.map((w, i) => (
                    <col key={i} style={{ width: w }} />
                  ))}
                </colgroup>
                <thead>
                  <tr className={`text-xs uppercase ${isDcMode ? 'bg-gradient-to-r from-rose-50 via-orange-50 to-amber-50 text-rose-950' : 'bg-blue-50 text-blue-800'}`}>
                    <ResizableTh columnIndex={0} onResizeStart={startKlColResize} className={`p-2 border text-center font-bold ${isDcMode ? 'border-rose-100' : 'border-blue-100'}`}>STT</ResizableTh>
                    <ResizableTh columnIndex={1} onResizeStart={startKlColResize} className={`p-2 border text-center font-bold ${isDcMode ? 'border-rose-100' : 'border-blue-100'}`}>Nội dung công việc</ResizableTh>
                    <ResizableTh columnIndex={2} onResizeStart={startKlColResize} className={`p-2 border text-center font-bold ${isDcMode ? 'border-rose-100' : 'border-blue-100'}`}>Cấp ĐH</ResizableTh>
                    <ResizableTh columnIndex={3} onResizeStart={startKlColResize} className={`p-2 border text-center font-bold ${isDcMode ? 'border-rose-100' : 'border-blue-100'}`}>ĐVT</ResizableTh>
                    {isDcMode ? (
                      <>
                        <ResizableTh columnIndex={4} onResizeStart={startKlColResize} title={DC_KL_COL_TOOLTIPS.kl01} className="p-2 border border-rose-100 text-center font-bold leading-tight text-blue-800 cursor-help">
                          <span className="block">KHỐI LƯỢNG</span>
                          <span className="block">ĐÃ PHÊ DUYỆT (01)</span>
                        </ResizableTh>
                        <ResizableTh columnIndex={5} onResizeStart={startKlColResize} title={DC_KL_COL_TOOLTIPS.kl02} className="p-2 border border-rose-100 text-center font-bold leading-tight text-emerald-800 cursor-help">
                          <span className="block">KHỐI LƯỢNG</span>
                          <span className="block">ĐIỀU CHỈNH (02)</span>
                        </ResizableTh>
                        <ResizableTh columnIndex={6} onResizeStart={startKlColResize} title={DC_KL_COL_TOOLTIPS.kl03} className="p-2 border border-rose-100 text-center font-bold leading-tight text-rose-800 cursor-help">
                          <span className="block">CHÊNH LỆCH</span>
                          <span className="block">(03 = 02 − 01)</span>
                        </ResizableTh>
                        <ResizableTh columnIndex={7} onResizeStart={startKlColResize} className={KL_XOA_STICKY_TH_DC} resizable={false}>Xóa</ResizableTh>
                      </>
                    ) : (
                      <>
                        <ResizableTh columnIndex={4} onResizeStart={startKlColResize} className="p-2 border border-blue-100 text-center font-bold">Khối lượng</ResizableTh>
                        <ResizableTh columnIndex={5} onResizeStart={startKlColResize} className={KL_XOA_STICKY_TH_GOC} resizable={false}>Xóa</ResizableTh>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {isLoadingTemplate ? (
                     <tr><td colSpan={klTableColCount} className="p-4 text-center text-gray-500 italic">Đang tải cấu hình bảng...</td></tr>
                  ) : (
                     tableRenderPlan.map((entry, planIdx) => {
                      if (entry.type === 'add_dz' || entry.type === 'add_tram' || entry.type === 'add_thoa') {
                        const label =
                          entry.type === 'add_dz'
                            ? 'phần Đường dây'
                            : entry.type === 'add_thoa'
                              ? 'phần Thỏa thuận'
                              : 'phần Trạm';
                        const sectionKey =
                          entry.type === 'add_dz'
                            ? 'DUONG_DAY'
                            : entry.type === 'add_thoa'
                              ? 'THOA_THUAN'
                              : 'TRAM';
                        return (
                          <tr key={`add-${entry.type}-${planIdx}`} className="bg-emerald-50/40">
                            <td colSpan={klTableColCount - 1} className="py-1.5 px-2 border border-gray-200 text-center">
                              <button
                                type="button"
                                onClick={() => openAddRowModal(sectionKey)}
                                disabled={isAddingRow}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900 hover:underline transition disabled:opacity-50 disabled:no-underline"
                              >
                                <span className="text-sm leading-none">+</span> Thêm dòng mới ({label})
                              </button>
                            </td>
                            <td className={KL_XOA_STICKY_TD_ADD} aria-hidden />
                          </tr>
                        );
                      }

                      const item = entry.item;
                      const loaiDongCheck = (item.loai_dong || "").trim().toLowerCase();
                      const isTitle = loaiDongCheck === "tieu_de";
                      const isCongViecCon = loaiDongCheck === "cong_viec_con";

                      let rawLoaiNhap = (item.loai_nhap_lieu || "").trim().toLowerCase();
                      if (item.id_cong_viec === "CV_012") rawLoaiNhap = "khong_nhap";
                      else if (rawLoaiNhap === "nan" || rawLoaiNhap === "") rawLoaiNhap = "nhap_tay";
                      let loaiNhap = rawLoaiNhap;
                      if (isDoVeTramTyLeItem(item)) loaiNhap = "do_ve_tram_ty_le";
                      // Ép chỉ tiêu mẫu nước luôn = số mẫu CV_043 (SQL/DM cũ còn mac_dinh=3 vẫn đúng)
                      const isMauNuocChiTieu =
                        isMauNuocChiTieuId(item.id_cong_viec) || isMauNuocChiTieuItem(item);
                      const mauNuocParentTong = resolveMauNuocParentTong(
                        quantities,
                        filteredWorkItemsWithV
                      );
                      const effectiveCongThuc = isMauNuocChiTieu ? `=${MAU_NUOC_PARENT_ID}` : item.cong_thuc;
                      if (isMauNuocChiTieu) loaiNhap = "cong_thuc";
                      const isKhongNhap = loaiNhap === "khong_nhap";
                      
                      let displayTotal = "";
                      let shouldUpdateTotal = false;

                      if (isMauNuocChiTieu) {
                          // Nguồn sự thật duy nhất: số mẫu cha (không dùng công thức/DB cứng 3)
                          displayTotal = mauNuocChildKlFromParent(mauNuocParentTong);
                          // Không setTimeout trong render — useLayoutEffect đã sync state
                          shouldUpdateTotal = false;
                      } else if (loaiNhap === "cong_thuc") {
                          if (isDuongChuyenCapItem(item.id_cong_viec)) {
                              displayTotal = quantities[`${item.id_cong_viec}_tong`] ?? "";
                          } else {
                              displayTotal = evaluateFormula(effectiveCongThuc);
                              shouldUpdateTotal = true;
                          }
                      } else if (loaiNhap === "khoan") {
                          displayTotal = parseFloat(((parseFloat(quantities[`${item.id_cong_viec}_sau`]) || 0) * (parseFloat(quantities[`${item.id_cong_viec}_ho`]) || 0)).toFixed(2));
                          shouldUpdateTotal = true;
                      } else if (loaiNhap === "mcn_trong_db") {
                          displayTotal = parseFloat(((parseFloat(quantities[`${item.id_cong_viec}_sl`]) || 0) * (parseFloat(quantities[`${item.id_cong_viec}_br`]) || 0) * (quantities[`${item.id_cong_viec}_ds`] !== undefined ? parseFloat(quantities[`${item.id_cong_viec}_ds`]) : 5)).toFixed(2));
                          shouldUpdateTotal = true;
                      } else if (loaiNhap === "mcn_ngoai_db") {
                          displayTotal = parseFloat(((parseFloat(quantities[`${item.id_cong_viec}_sl`]) || 0) * 20 * 5).toFixed(2));
                          shouldUpdateTotal = true;
                      } else if (loaiNhap === "mcn_rtk") {
                          displayTotal = parseFloat(((parseFloat(quantities[`${item.id_cong_viec}_sl`]) || 0) * (parseFloat(quantities[`${item.id_cong_viec}_br`]) || 0)).toFixed(2));
                          shouldUpdateTotal = true;
                      } else if (loaiNhap === "do_ve_bd_cap_ngam") {
                          displayTotal = parseFloat(((parseFloat(quantities[`CV_007_tong`]) || 0) * 1000 * 30 / 10000).toFixed(4));
                          shouldUpdateTotal = true;
                      } else if (loaiNhap === "do_ve_bd") {
                          displayTotal = calcDoVeBdTotal(quantities, item.id_cong_viec);
                          shouldUpdateTotal = true;
                      } else if (loaiNhap === "do_ve_bd_tuyen") {
                          displayTotal = calcDoVeBdTuyenTotal(quantities, item.id_cong_viec);
                          shouldUpdateTotal = true;
                      } else if (loaiNhap === "do_ve_tram") {
                          displayTotal = parseFloat((( (parseFloat(quantities[`${item.id_cong_viec}_tram`]) || 0) + (parseFloat(quantities[`${item.id_cong_viec}_duong`]) || 0) ) / 10000).toFixed(4));
                          shouldUpdateTotal = true;
                      } else if (item.ten_cong_viec.toLowerCase().includes("điện trở suất")) {
                          let totalHo = 0;
                          filteredWorkItems.forEach(i => {
                              if ((i.loai_nhap_lieu || "").trim().toLowerCase() === "khoan") {
                                  totalHo += parseFloat(quantities[`${i.id_cong_viec}_ho`]) || 0;
                              }
                          });
                          displayTotal = totalHo;
                          shouldUpdateTotal = true;
                      }

                      if (shouldUpdateTotal) {
                        const nextVal =
                          displayTotal === undefined || displayTotal === null ? "" : displayTotal;
                        if (
                          (quantities[`${item.id_cong_viec}_tong`] ?? "").toString() !==
                          nextVal.toString()
                        ) {
                          setTimeout(
                            () => syncAutoQuantityTong(item.id_cong_viec, nextVal),
                            0
                          );
                        }
                      }

                      const currentCapDh = evaluateCapDh(item.cap_dh);
                      const isCapDhFormula = item.cap_dh && (item.cap_dh.toString().startsWith("=") || item.cap_dh.toString().startsWith("'="));
                      const isVBaoCaoRow = isNvksVBaoCaoWorkItem(item);
                      const showCapDh = !isVBaoCaoRow && shouldShowCapDhCell(item, isTitle, isKhongNhap);
                      const isUserPlusRow = (loaiNhap === 'nhap_tay_plus');
                      const isDieuTraCongFixed = isDieuTraCongFixedItem(item);
                      const effectiveDonVi = isVBaoCaoRow
                        ? NVKS_V_BAO_CAO_DVT
                        : isDieuTraCongFixed
                          ? "Công"
                          : getEffectiveDonVi(item, donViOverrides);

                      const isAutoCalculatedFields = (!isDuongChuyenCapItem(item.id_cong_viec) && ["cong_thuc", "khoan", "mcn_trong_db", "mcn_ngoai_db", "mcn_rtk", "do_ve_bd_cap_ngam", "do_ve_bd", "do_ve_bd_tuyen", "do_ve_tram"].includes(loaiNhap)) || item.ten_cong_viec.toLowerCase().includes("điện trở suất");

                      const hasManualKl02 = Object.prototype.hasOwnProperty.call(klDcManual, item.id_cong_viec);
                      const kl01Raw = isVBaoCaoRow
                        ? (gocKlApprovedById[item.id_cong_viec] ?? NVKS_V_BAO_CAO_KL_DEFAULT)
                        : gocKlApprovedById[item.id_cong_viec];
                      const kl02Auto =
                        isMauNuocChiTieu
                          ? mauNuocChildKlFromParent(mauNuocParentTong)
                          : displayTotal !== '' && displayTotal !== undefined && displayTotal !== '-'
                          ? String(displayTotal)
                          : (quantities[`${item.id_cong_viec}_tong`] ?? '');
                      const kl02Raw = hasManualKl02
                        ? klDcManual[item.id_cong_viec]
                        : isVBaoCaoRow
                          ? (gocKlApprovedById[item.id_cong_viec] ?? NVKS_V_BAO_CAO_KL_DEFAULT)
                          : kl02Auto;
                      const kl03Diff = isDcMode && !isTitle && !isVBaoCaoRow
                        ? computeKlDcChenhDiff(kl02Raw, kl01Raw)
                        : null;
                      const kl03Display = isDcMode && !isTitle
                        ? (isVBaoCaoRow ? '—' : computeKlDcChenh(kl02Raw, kl01Raw))
                        : '';
                      const kl02Changed = isDcMode && !isTitle && isKlDcValueChanged(kl02Raw, kl01Raw);
                      const kl02InputClass = getKlDc02InputClass(kl02Changed, isKlLocked);
                      const kl03Class = getKlDcChenhDisplayClass(kl03Diff);

                      return (
                        <tr key={item.id_cong_viec} className={`group [&>td]:align-middle ${isTitle ? "bg-gray-100/80 font-bold" : "hover:bg-blue-50/40"}`}>
                          <td className={`p-2 border border-gray-200 text-center align-middle ${isTitle ? "font-bold text-black" : "text-gray-600 font-medium"}`}>{item.dynamicTT}</td>
                          <td className={getKlNvksDescCellClass({ isTitle, isCongViecCon })}>
                            
                            {loaiNhap === "khoan" && (
                              <div className="flex flex-col gap-1.5 font-normal text-justify">
                                <span className="text-justify">{item.ten_cong_viec.split('chiều sâu')[0]} chiều sâu hố khoan</span>
                                <div className="flex flex-wrap items-center gap-1.5 bg-blue-50/50 p-1.5 rounded border border-blue-100 text-xs text-gray-800">
                                  <span className="text-red-600 font-bold">Chiều sâu (m):</span><input type="text" readOnly={isKlLocked} onKeyDown={preventInvalidNumberInput} value={quantities[`${item.id_cong_viec}_sau`] !== undefined ? quantities[`${item.id_cong_viec}_sau`] : ""} onChange={(e) => handleQuantityChange(item.id_cong_viec, 'sau', e.target.value)} className={`w-14 border rounded p-1 text-center font-bold text-red-600 ${isKlLocked ? "bg-gray-100 text-gray-500" : "bg-white"}`} />
                                  <span className="text-gray-400 font-bold">X</span>
                                  <span className="text-red-600 font-bold">Số lượng (hố):</span><input type="text" readOnly={isKlLocked} onKeyDown={preventInvalidNumberInput} value={quantities[`${item.id_cong_viec}_ho`] !== undefined ? quantities[`${item.id_cong_viec}_ho`] : ""} onChange={(e) => handleQuantityChange(item.id_cong_viec, 'ho', e.target.value)} className={`w-14 border rounded p-1 text-center font-bold text-red-600 ${isKlLocked ? "bg-gray-100 text-gray-500" : "bg-white"}`} />
                                </div>
                              </div>
                            )}

                            {loaiNhap === "mcn_trong_db" && (
                              <div className="flex flex-col gap-1.5 font-normal text-justify">
                                <span className="text-justify">{item.ten_cong_viec}</span>
                                <div className="flex flex-wrap items-center gap-1.5 bg-amber-50/50 p-1.5 rounded border border-amber-100 text-xs text-gray-800">
                                  <span className="text-red-600 font-bold">Số lượng (Vị trí):</span><input type="text" readOnly={isKlLocked} onKeyDown={preventInvalidNumberInput} value={quantities[`${item.id_cong_viec}_sl`] !== undefined ? quantities[`${item.id_cong_viec}_sl`] : ""} onChange={(e) => handleQuantityChange(item.id_cong_viec, 'sl', e.target.value)} className={`w-12 border border-amber-300 rounded p-1 text-center font-bold text-red-600 ${isKlLocked ? "bg-gray-100 text-gray-500" : "bg-white"}`} />
                                  <span className="text-gray-400 font-bold">X</span>
                                  <span className="text-red-600 font-bold">Rộng (m):</span><input type="text" readOnly={isKlLocked} onKeyDown={preventInvalidNumberInput} value={quantities[`${item.id_cong_viec}_br`] !== undefined ? quantities[`${item.id_cong_viec}_br`] : ""} onChange={(e) => handleQuantityChange(item.id_cong_viec, 'br', e.target.value)} className={`w-12 border border-amber-300 rounded p-1 text-center font-bold text-red-600 ${isKlLocked ? "bg-gray-100 text-gray-500" : "bg-white"}`} />
                                  <span className="text-gray-400 font-bold">X</span>
                                  <span className="text-red-600 font-bold">Sâu (m):</span><input type="text" readOnly={isKlLocked} onKeyDown={preventInvalidNumberInput} value={quantities[`${item.id_cong_viec}_ds`] ?? 5} onChange={(e) => handleQuantityChange(item.id_cong_viec, 'ds', e.target.value)} className={`w-12 border border-amber-300 rounded p-1 text-center font-bold text-red-600 ${isKlLocked ? "bg-gray-100 text-gray-500" : "bg-white"}`} />
                                </div>
                              </div>
                            )}

                            {loaiNhap === "mcn_ngoai_db" && (
                              <div className="flex flex-col gap-1.5 font-normal">
                                <span>{item.ten_cong_viec}</span>
                                <div className="flex flex-wrap items-center gap-1.5 bg-amber-50/50 p-1.5 rounded border border-amber-100 text-xs text-gray-800">
                                  <span className="text-red-600 font-bold">Số lượng (Vị trí):</span><input type="text" readOnly={isKlLocked} onKeyDown={preventInvalidNumberInput} value={quantities[`${item.id_cong_viec}_sl`] !== undefined ? quantities[`${item.id_cong_viec}_sl`] : ""} onChange={(e) => handleQuantityChange(item.id_cong_viec, 'sl', e.target.value)} className={`w-14 border border-amber-300 rounded p-1 text-center font-bold text-red-600 ${isKlLocked ? "bg-gray-100 text-gray-500" : "bg-white"}`} />
                                  <span className="text-gray-400 font-bold">X</span>
                                  <span className="text-red-600 font-bold">Rộng (m):</span>
                                  <input type="text" readOnly value="20" className="w-14 border border-amber-300 rounded p-1 text-center font-bold text-red-600 bg-gray-50 cursor-not-allowed" />
                                  <span className="text-gray-400 font-bold">X</span>
                                  <span className="text-red-600 font-bold">Sâu (m):</span>
                                  <input type="text" readOnly value="5" className="w-14 border border-amber-300 rounded p-1 text-center font-bold text-red-600 bg-gray-50 cursor-not-allowed" />
                                </div>
                              </div>
                            )}

                            {loaiNhap === "mcn_rtk" && (
                              <div className="flex flex-col gap-1.5 font-normal">
                                <span>{item.ten_cong_viec}</span>
                                <div className="flex flex-wrap items-center gap-1.5 bg-green-50/50 p-1.5 rounded border border-green-100 text-xs text-gray-800">
                                  <span className="text-red-600 font-bold">Số lượng (vị trí):</span><input type="text" readOnly={isKlLocked} onKeyDown={preventInvalidNumberInput} value={quantities[`${item.id_cong_viec}_sl`] !== undefined ? quantities[`${item.id_cong_viec}_sl`] : ""} onChange={(e) => handleQuantityChange(item.id_cong_viec, 'sl', e.target.value)} className={`w-14 border border-green-300 rounded p-1 text-center font-bold text-red-600 ${isKlLocked ? "bg-gray-100 text-gray-500" : "bg-white"}`} />
                                  <span className="text-gray-400 font-bold">X</span>
                                  <span className="text-red-600 font-bold">Rộng (m):</span><input type="text" readOnly={isKlLocked} onKeyDown={preventInvalidNumberInput} value={quantities[`${item.id_cong_viec}_br`] !== undefined ? quantities[`${item.id_cong_viec}_br`] : ""} onChange={(e) => handleQuantityChange(item.id_cong_viec, 'br', e.target.value)} className={`w-14 border border-green-300 rounded p-1 text-center font-bold text-red-600 ${isKlLocked ? "bg-gray-100 text-gray-500" : "bg-white"}`} />
                                </div>
                              </div>
                            )}

                            {loaiNhap === "do_ve_bd_cap_ngam" && (
                              <div className="flex flex-col gap-1.5 font-normal">
                                <span>{item.ten_cong_viec}</span>
                                <div className="flex flex-wrap items-center gap-1.5 bg-purple-50/50 p-1.5 rounded border border-purple-100 text-xs text-gray-800">
                                  <span className="text-red-600 font-bold">Chiều dài cáp ngầm (km):</span>
                                  <input
                                    type="text"
                                    readOnly
                                    value={quantities['CV_007_tong'] || "0"}
                                    className="w-14 border border-purple-300 rounded p-1 text-center font-bold text-red-600 bg-gray-50 cursor-not-allowed"
                                  />
                                  <span className="text-gray-400 font-bold">X</span>
                                  <span className="text-red-600 font-bold">Rộng (m):</span>
                                  <input type="text" readOnly value="30" className="w-14 border border-purple-300 rounded p-1 text-center font-bold text-red-600 bg-gray-50 cursor-not-allowed" />
                                </div>
                              </div>
                            )}

                            {loaiNhap === "do_ve_bd" && (
                              <div className="flex flex-col gap-1.5 font-normal">
                                <span>{item.ten_cong_viec}</span>
                                <div className="flex flex-wrap items-center gap-1.5 bg-teal-50/50 p-1.5 rounded border border-teal-100 text-xs text-gray-800">
                                  <span className="text-red-600 font-bold">Số lượng (vị trí):</span><input type="text" readOnly={isKlLocked} onKeyDown={preventInvalidNumberInput} value={quantities[`${item.id_cong_viec}_sl`] !== undefined ? quantities[`${item.id_cong_viec}_sl`] : ""} onChange={(e) => handleQuantityChange(item.id_cong_viec, 'sl', e.target.value)} className={`w-14 border border-teal-300 rounded p-1 text-center font-bold text-red-600 ${isKlLocked ? "bg-gray-100 text-gray-500" : "bg-white"}`} />
                                  <span className="text-gray-400 font-bold">X</span>
                                  <span className="text-red-600 font-bold">Rộng (m):</span><input type="text" readOnly={isKlLocked} onKeyDown={preventInvalidNumberInput} placeholder="60" value={quantities[`${item.id_cong_viec}_br`] ?? 60} onChange={(e) => handleQuantityChange(item.id_cong_viec, 'br', e.target.value)} className={`w-14 border border-teal-300 rounded p-1 text-center font-bold text-red-600 ${isKlLocked ? "bg-gray-100 text-gray-500" : "bg-white"}`} />
                                  <span className="text-gray-400 font-bold">X</span>
                                  <span className="text-red-600 font-bold">Dài (m):</span><input type="text" readOnly={isKlLocked} onKeyDown={preventInvalidNumberInput} placeholder="80" value={quantities[`${item.id_cong_viec}_cd`] ?? 80} onChange={(e) => handleQuantityChange(item.id_cong_viec, 'cd', e.target.value)} className={`w-14 border border-teal-300 rounded p-1 text-center font-bold text-red-600 ${isKlLocked ? "bg-gray-100 text-gray-500" : "bg-white"}`} />
                                </div>
                              </div>
                            )}

                            {loaiNhap === "do_ve_bd_tuyen" && (
                              <div className="flex flex-col gap-1.5 font-normal">
                                <span>{item.ten_cong_viec}</span>
                                <div className="flex flex-wrap items-center gap-1.5 bg-cyan-50/50 p-1.5 rounded border border-cyan-100 text-xs text-gray-800">
                                  <span className="text-red-600 font-bold">Số lượng (vị trí):</span>
                                  <input type="text" readOnly={isKlLocked} onKeyDown={preventInvalidNumberInput} value={quantities[`${item.id_cong_viec}_sl`] !== undefined ? quantities[`${item.id_cong_viec}_sl`] : ""} onChange={(e) => handleQuantityChange(item.id_cong_viec, 'sl', e.target.value)} className={`w-14 border border-cyan-300 rounded p-1 text-center font-bold text-red-600 ${isKlLocked ? "bg-gray-100 text-gray-500" : "bg-white"}`} />
                                  <span className="text-gray-400 font-bold">X</span>
                                  <span className="text-red-600 font-bold">Rộng (m):</span>
                                  <input type="text" readOnly={isKlLocked} onKeyDown={preventInvalidNumberInput} placeholder="60" value={quantities[`${item.id_cong_viec}_br`] ?? 60} onChange={(e) => handleQuantityChange(item.id_cong_viec, 'br', e.target.value)} className={`w-14 border border-cyan-300 rounded p-1 text-center font-bold text-red-600 ${isKlLocked ? "bg-gray-100 text-gray-500" : "bg-white"}`} />
                                  <span className="text-gray-400 font-bold">X</span>
                                  <span className="text-red-600 font-bold">Dài (m):</span>
                                  <input type="text" readOnly={isKlLocked} onKeyDown={preventInvalidNumberInput} placeholder={String(getRouteLengthMeters(quantities) || '')} value={quantities[`${item.id_cong_viec}_cd`] !== undefined ? quantities[`${item.id_cong_viec}_cd`] : (getRouteLengthMeters(quantities) > 0 ? String(getRouteLengthMeters(quantities)) : '')} onChange={(e) => handleQuantityChange(item.id_cong_viec, 'cd', e.target.value)} className={`w-16 border border-cyan-300 rounded p-1 text-center font-bold text-red-600 ${isKlLocked ? "bg-gray-100 text-gray-500" : "bg-white"}`} />
                                </div>
                              </div>
                            )}

                            {loaiNhap === "do_ve_tram_ty_le" && (
                              <div className="flex flex-col gap-1.5 font-normal">
                                <div className="flex flex-wrap items-center gap-1 text-gray-800 leading-snug">
                                  <span>Đo vẽ bản đồ địa hình tỷ lệ</span>
                                  <input
                                    type="text"
                                    list={`nvks-ty-le-${item.id_cong_viec}`}
                                    readOnly={isKlLocked}
                                    value={getDoVeTramTyLeValue(quantities, item.id_cong_viec)}
                                    onChange={(e) => handleQuantityChange(item.id_cong_viec, 'tyLe', e.target.value)}
                                    className={`w-[4.5rem] border border-violet-300 rounded px-1 py-0.5 text-center text-xs font-bold text-violet-900 outline-none ${isKlLocked ? "bg-gray-100 text-gray-500 cursor-not-allowed" : "bg-violet-50 focus:bg-white focus:border-violet-500"}`}
                                    title="Chọn preset hoặc bôi đen gõ tỷ lệ khác (vd. 1/250)"
                                  />
                                  <datalist id={`nvks-ty-le-${item.id_cong_viec}`}>
                                    {TY_LE_PRESET_OPTIONS.map((opt) => (
                                      <option key={opt} value={opt} />
                                    ))}
                                  </datalist>
                                  <span>, đường đồng mức</span>
                                  <select
                                    value={getDoVeTramDongMucValue(quantities, item.id_cong_viec)}
                                    disabled={isKlLocked}
                                    onChange={(e) => handleQuantityChange(item.id_cong_viec, 'dongMuc', e.target.value)}
                                    className={`border border-violet-300 rounded px-1 py-0.5 text-xs font-bold text-violet-900 outline-none ${isKlLocked ? "bg-gray-100 text-gray-500 cursor-not-allowed" : "bg-violet-50 focus:border-violet-500"}`}
                                  >
                                    {DONG_MUC_PRESET_OPTIONS.map((opt) => (
                                      <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                  </select>
                                </div>
                                <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
                                  {getDoVeTramPhamViText(item)}
                                </p>
                              </div>
                            )}

                            {loaiNhap === "do_ve_tram" && (
                              <div className="flex flex-col gap-1.5 font-normal">
                                <span>{item.ten_cong_viec}</span>
                                <div className="flex flex-wrap items-center gap-1.5 bg-indigo-50/50 p-1.5 rounded border border-indigo-100 text-xs text-gray-800">
                                  <span className="text-red-600 font-bold">Diện tích trạm (m²):</span><input type="text" readOnly={isKlLocked} onKeyDown={preventInvalidNumberInput} value={quantities[`${item.id_cong_viec}_tram`] !== undefined ? quantities[`${item.id_cong_viec}_tram`] : ""} onChange={(e) => handleQuantityChange(item.id_cong_viec, 'tram', e.target.value)} className={`w-16 border border-indigo-300 rounded p-1 text-center font-bold text-red-600 ${isKlLocked ? "bg-gray-100 text-gray-500" : "bg-white"}`} />
                                  <span className="text-gray-400 font-bold">+</span>
                                  <span className="text-red-600 font-bold">Diện tích đường vào (m²):</span><input type="text" readOnly={isKlLocked} onKeyDown={preventInvalidNumberInput} value={quantities[`${item.id_cong_viec}_duong`] !== undefined ? quantities[`${item.id_cong_viec}_duong`] : ""} onChange={(e) => handleQuantityChange(item.id_cong_viec, 'duong', e.target.value)} className={`w-16 border border-indigo-300 rounded p-1 text-center font-bold text-red-600 ${isKlLocked ? "bg-gray-100 text-gray-500" : "bg-white"}`} />
                                </div>
                              </div>
                            )}

                            {!["khoan", "mcn_trong_db", "mcn_ngoai_db", "mcn_rtk", "do_ve_bd_cap_ngam", "do_ve_bd", "do_ve_bd_tuyen", "do_ve_tram", "do_ve_tram_ty_le"].includes(loaiNhap) &&
                              (isVBaoCaoRow ? NVKS_V_BAO_CAO_NOI_DUNG : item.ten_cong_viec)}
                          </td>
                          <td className="p-1 border border-gray-200 text-center align-middle">
                              {showCapDh && (
                                  isCapDhFormula ? <div className="text-gray-500 font-medium text-sm">{currentCapDh || "-"}</div> :
                                  <select
                                    value={
                                      isDoVeTramTyLeItem(item)
                                        ? (capDhValues[item.id_cong_viec] || DEFAULT_CAP_DH)
                                        : isOptionalCapDhItem(item)
                                          ? (capDhValues[item.id_cong_viec] || "")
                                          : (capDhValues[item.id_cong_viec] || currentCapDh || DEFAULT_CAP_DH || "III")
                                    }
                                    disabled={isKlLocked}
                                    onChange={(e) => handleCapDhChange(item.id_cong_viec, e.target.value)}
                                    className={`border rounded px-1 py-1 text-sm font-bold outline-none ${isKlLocked ? "bg-gray-100 text-gray-500 cursor-not-allowed" : "text-indigo-700"}`}
                                  >
                                      {isOptionalCapDhItem(item) && !isDoVeTramTyLeItem(item) && <option value="">—</option>}
                                      <option value="I">I</option>
                                      <option value="II">II</option>
                                      <option value="III">III</option>
                                      <option value="IV">IV</option>
                                      <option value="V">V</option>
                                  </select>
                              )}
                          </td>
                          <td className="p-2 border border-gray-200 text-center text-xs font-medium">
                            {isVBaoCaoRow || isDieuTraCongFixed ? (
                              effectiveDonVi
                            ) : !isKhongNhap && !isTitle ? (
                              isUserPlusRow && !isKlLocked ? (
                                <input
                                  type="text"
                                  list="nvks-dvt-presets"
                                  value={effectiveDonVi}
                                  onChange={(e) => handleDonViChange(item.id_cong_viec, e.target.value)}
                                  className="w-full min-w-[52px] border border-gray-300 rounded px-1 py-1 text-center text-xs font-semibold outline-none focus:border-blue-400"
                                  placeholder="ĐVT"
                                />
                              ) : (
                                effectiveDonVi
                              )
                            ) : ''}
                          </td>
                          
                          {isDcMode ? (
                            <>
                              <td className="p-1.5 border border-gray-200 text-center bg-slate-100 font-medium text-blue-800">
                                {!isTitle ? formatKlCellDisplay(kl01Raw) : ''}
                              </td>
                              <td className="p-1.5 border border-gray-200 text-center">
                                {!isTitle && (isVBaoCaoRow ? (
                                  <input
                                    type="text"
                                    readOnly={isKlLocked}
                                    value={kl02Raw ?? ''}
                                    onChange={(e) => handleKlDc02Change(item.id_cong_viec, e.target.value)}
                                    className={kl02InputClass}
                                  />
                                ) : !isKhongNhap && (
                                  <input
                                    type="text"
                                    readOnly={isKlLocked}
                                    onKeyDown={preventKlNumberInput}
                                    value={kl02Raw ?? ''}
                                    onChange={(e) => handleKlDc02Change(item.id_cong_viec, e.target.value)}
                                    className={kl02InputClass}
                                    title={isAutoCalculatedFields ? 'Mặc định tự tính từ nội dung; có thể sửa tay' : 'Khối lượng điều chỉnh (02)'}
                                  />
                                ))}
                              </td>
                              <td className={`p-1.5 border border-gray-200 text-center font-medium ${kl03Class}`}>
                                {!isTitle && !isKhongNhap && !isVBaoCaoRow ? (kl03Display || '—') : (isVBaoCaoRow && !isTitle ? '—' : '')}
                              </td>
                            </>
                          ) : (
                          <td className="p-1.5 border border-gray-200 text-center">
                            {!isTitle && (isVBaoCaoRow ? (
                              <span className="inline-block px-2 py-1.5 font-bold text-blue-900">{NVKS_V_BAO_CAO_KL_DEFAULT}</span>
                            ) : !isKhongNhap && (
                              <input 
                                type="text" 
                                readOnly={isKlLocked || isAutoCalculatedFields} 
                                onKeyDown={preventInvalidNumberInput}
                                key={
                                  isMauNuocChiTieu
                                    ? `mau-nuoc-${item.id_cong_viec}-${mauNuocParentTong ?? ""}`
                                    : undefined
                                }
                                value={
                                  isMauNuocChiTieu
                                    ? mauNuocChildKlFromParent(mauNuocParentTong)
                                    : isAutoCalculatedFields
                                    ? (displayTotal !== undefined && displayTotal !== null && displayTotal !== "-"
                                        ? String(displayTotal)
                                        : (quantities[`${item.id_cong_viec}_tong`] ?? ""))
                                    : (quantities[`${item.id_cong_viec}_tong`] !== undefined
                                        ? quantities[`${item.id_cong_viec}_tong`]
                                        : "")
                                } 
                                onChange={(e) => handleQuantityChange(item.id_cong_viec, 'tong', e.target.value)} 
                                className={`w-full text-center border rounded p-1.5 font-bold outline-none transition-colors ${
                                  isKlLocked || isAutoCalculatedFields 
                                    ? "bg-slate-100 text-blue-900 border-slate-300 font-extrabold cursor-not-allowed" 
                                    : "bg-amber-50 text-amber-900 border-amber-300 focus:bg-white focus:border-amber-500"
                                }`}
                                title={
                                  isDuongChuyenCapItem(item.id_cong_viec)
                                    ? "Tự tính theo chiều dài tuyến (≤1km: 3/2; >1km: công thức). Tự cập nhật khi đổi chiều dài tuyến."
                                    : isMauNuocChiTieu || isAutoCalculatedFields
                                      ? "Tự tính theo công thức — đổi số mẫu nước thì chỉ tiêu đổi theo"
                                      : "Bạn có thể chỉnh sửa gõ số thập phân bằng dấu chấm ."
                                }
                              />
                            ))}
                          </td>
                          )}

                          <td className={isTitle ? KL_XOA_STICKY_TD_TITLE : KL_XOA_STICKY_TD}>
                              {!isTitle && !isKlLocked && !isVBaoCaoRow && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRow(item.id_cong_viec)}
                                  title={
                                    isMauNuocChiTieuId(item.id_cong_viec)
                                      ? "Chỉ tiêu bám số mẫu nước — xóa mẫu (mục cha) thì chỉ tiêu về 0"
                                      : "Đặt khối lượng = 0 (không xuất Word/PDF)"
                                  }
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded transition"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                  {!isLoadingTemplate ? (
                    <>
                      <tr className="bg-gray-100/80 font-bold">
                        <td className="p-2 border border-gray-200 text-center font-bold text-black">VI</td>
                        <td colSpan={isDcMode ? 6 : 4} className={`p-2 border border-gray-200 uppercase text-black bg-slate-100/50 ${KL_SECTION_TITLE_CELL_CLASS}`}>
                          THỜI GIAN THỰC HIỆN
                        </td>
                        <td className={KL_XOA_STICKY_TD_SECTION} aria-hidden />
                      </tr>
                      {NVKS_THOI_GIAN_FIELDS.map((tg) => {
                        const tgKl01 = gocKlApprovedById[tg.field];
                        const tgKl02 = formData[tg.field] ?? '';
                        const tgKl03Diff = isDcMode ? computeKlDcChenhDiff(tgKl02, tgKl01) : null;
                        const tgChenh = isDcMode ? computeKlDcChenh(tgKl02, tgKl01) : '';
                        const tgKl02Changed = isDcMode && isKlDcValueChanged(tgKl02, tgKl01);
                        const tgKl02Class = getKlDc02InputClass(tgKl02Changed, isKlLocked);
                        const tgKl03Class = getKlDcChenhDisplayClass(tgKl03Diff);
                        return (
                        <tr key={tg.field} className="border-t border-gray-100 bg-white even:bg-slate-50/40">
                          <td className="p-2 border border-gray-200 text-center text-slate-600">{tg.stt}</td>
                          <td colSpan={2} className="p-2 border border-gray-200 text-slate-800">{tg.noi_dung}</td>
                          <td className="p-2 border border-gray-200 text-center text-slate-600">ngày</td>
                          {isDcMode ? (
                            <>
                              <td className="p-1.5 border border-gray-200 text-center bg-slate-100 font-medium text-blue-800">
                                {formatKlCellDisplay(tgKl01)}
                              </td>
                              <td className="p-1 border border-gray-200 text-center">
                                <input
                                  type="text"
                                  readOnly={isKlLocked}
                                  onKeyDown={preventKlNumberInput}
                                  value={tgKl02}
                                  onChange={(e) => handleKlDc02Change(tg.field, e.target.value)}
                                  autoComplete="off"
                                  className={`w-full max-w-[8rem] mx-auto text-center border rounded p-1.5 font-bold outline-none transition-colors ${
                                    isKlLocked
                                      ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                                      : `${tgKl02Class} max-w-[8rem]`
                                  }`}
                                />
                              </td>
                              <td className={`p-1.5 border border-gray-200 text-center font-medium ${tgKl03Class}`}>
                                {tgChenh || '—'}
                              </td>
                            </>
                          ) : (
                          <td className="p-1 border border-gray-200 text-center">
                            <input
                              type="text"
                              readOnly={isKlLocked}
                              onKeyDown={preventInvalidNumberInput}
                              name={tg.field}
                              value={formData[tg.field] || ""}
                              onChange={handleInputChange}
                              autoComplete="off"
                              className={`w-full max-w-[8rem] mx-auto text-center border rounded p-1.5 font-bold outline-none transition-colors ${
                                isKlLocked
                                  ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                                  : "focus:border-blue-500"
                              }`}
                            />
                          </td>
                          )}
                          <td className={KL_XOA_STICKY_TD_MUTED} aria-hidden />
                        </tr>
                        );
                      })}
                    </>
                  ) : null}
                </tbody>
              </table>
              <datalist id="nvks-dvt-presets">
                {DVT_PRESET_OPTIONS.map((dvt) => (
                  <option key={dvt} value={dvt} />
                ))}
              </datalist>
            </div>
          </div>
        ) : null}

        {isDcMode && !gocNvksRecord ? (
          <div className="w-full">
            <KlComparisonTable
              title="III. KHỐI LƯỢNG KHẢO SÁT — ĐIỀU CHỈNH"
              helpText="Chưa tải được NVKS Gốc — cần bản Gốc đã lưu để so sánh khối lượng."
              rows={[]}
              emptyMessage="Chưa tải được NVKS Gốc — cần bản Gốc đã lưu để so sánh khối lượng."
            />
          </div>
        ) : null}
      </div>


      {addRowModal.open && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-black text-slate-800">
              Thêm hạng mục công việc —{' '}
              {addRowModal.section === 'DUONG_DAY'
                ? 'phần Đường dây'
                : addRowModal.section === 'THOA_THUAN'
                  ? 'phần Thỏa thuận'
                  : 'phần Trạm'}
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Hạng mục sẽ được lưu vào danh mục chung (trạng thái chờ kiểm). Anh/chị admin có thể rà soát trên DB sau.
            </p>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Tên công việc</label>
              <textarea
                value={addRowModal.ten}
                onChange={(e) => setAddRowModal((prev) => ({ ...prev, ten: e.target.value }))}
                rows={3}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500"
                placeholder="Nhập mô tả hạng mục..."
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Đơn vị tính</label>
              <input
                type="text"
                list="nvks-dvt-presets"
                value={addRowModal.donVi}
                onChange={(e) => setAddRowModal((prev) => ({ ...prev, donVi: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setAddRowModal({ open: false, section: null, ten: '', donVi: 'Công' })}
                disabled={isAddingRow}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSubmitAddRow}
                disabled={isAddingRow}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50"
              >
                {isAddingRow ? 'Đang lưu...' : 'Thêm vào bảng'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}