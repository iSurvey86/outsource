import { normalizeChuDauTu } from "./chuDauTuAlias";
import { addWorkingDays } from "./workingDays";
import { syncMauNuocQuantities } from "./nvksLoaiHinh";
import { DEFAULT_CNKS_NAME, DEFAULT_LANH_DAO_NAME } from "./hoSoPersonnelDefaults";

export function mapGiaiDoan(project) {
  let g = project?.giai_doan_chuan || project?.giai_doan || "";
  if (g === "FS") g = "BCNCKT";
  if (g === "TKKT-TKBVTC") g = "TKBVTC";
  return g;
}

export function inferCapDienAp(project) {
  const pName = (project?.ten_du_an || "").toLowerCase();
  const pCode = (project?.ma_du_an || "").toLowerCase();
  if (
    pName.includes("110kv") ||
    pName.includes("220kv") ||
    pName.includes("500kv") ||
    pCode.includes("110") ||
    pCode.includes("220") ||
    pCode.includes("500")
  ) {
    return "Cao áp (110-220kV)";
  }
  return "Trung hạ áp (0.4-35kV)";
}

export function formatDiaDiemKs(raw) {
  let s = (raw || "").trim();
  if (s && !/(tỉnh|thành phố|tp\.)/i.test(s)) s = `Tỉnh ${s}`;
  return s;
}

export function buildQuyetDinhGiaoA(project) {
  return (
    project?.qd_giao_a_day_du_dieu_chinh ||
    project?.qd_giao_a_dieu_chinh ||
    project?.qd_giao_a_day_du ||
    project?.qd_giao_a ||
    ""
  ).trim();
}

export function buildQuyMo(project) {
  return (project?.quy_mo_dieu_chinh || project?.quy_mo || "").trim();
}

/** Snapshot du_lieu_bang_tinh từ NVKS (giữ nguyên cấu trúc, đánh dấu nguồn) */
export function snapshotBangTinhFromNvks(nvks) {
  const src = nvks?.du_lieu_bang_tinh || {};
  return {
    quantities: syncMauNuocQuantities({ ...(src.quantities || {}) }),
    capDhValues: { ...(src.capDhValues || {}) },
    notes: { ...(src.notes || {}) },
    hiddenItems: [...(src.hiddenItems || [])],
    donViOverrides: { ...(src.donViOverrides || {}) },
    cap_dien_ap: src.cap_dien_ap || "",
    source_nvks_id: nvks?.id || null,
    filtered_kl_only: true,
  };
}

export function buildInitialFormFromSources(project, nvks, sessionUser) {
  const giaiDoan = mapGiaiDoan(project);
  const capDienAp =
    nvks?.du_lieu_bang_tinh?.cap_dien_ap || inferCapDienAp(project);

  let thoiDiemLap = "";
  if (nvks?.thoi_diem_lap) {
    thoiDiemLap = addWorkingDays(String(nvks.thoi_diem_lap).slice(0, 10), 5);
  }

  const defaultNguoiLap = sessionUser?.ho_ten || nvks?.nguoi_lap || "";
  const defaultEmail = sessionUser?.email || nvks?.email_nguoi_lap || "";

  return {
    ma_du_an: project?.ma_du_an || "",
    ten_du_an: project?.ten_du_an || "",
    giai_doan: giaiDoan,
    loai_hinh: nvks?.loai_hinh || "",
    chu_dau_tu: normalizeChuDauTu(project?.chu_dau_tu || nvks?.chu_dau_tu || ""),
    dia_diem: nvks?.dia_diem || formatDiaDiemKs(project?.dia_diem_ks),
    quyet_dinh_giao_a: buildQuyetDinhGiaoA(project),
    quy_mo: buildQuyMo(project),
    cap_dien_ap: capDienAp,
    nguoi_lap: nvks?.nguoi_lap || defaultNguoiLap,
    email_nguoi_lap: nvks?.email_nguoi_lap || defaultEmail,
    chu_nhiem_ks: nvks?.chu_nhiem_ks || DEFAULT_CNKS_NAME,
    lanh_dao_duyet: nvks?.lanh_dao_duyet || DEFAULT_LANH_DAO_NAME,
    thoi_diem_lap: thoiDiemLap,
    thoi_gian_ks_lap_pa: "",
    thoi_gian_ks_lap_bcks: nvks?.thoi_gian_ks_lap_bcks || "",
    thoi_gian_hoan_thien_ho_so: "",
    thoi_gian_thuc_hien_tong: "",
    trang_thai_paktks: "dang_lap",
    phien_ban: "GOC",
    so_lan_dc: 0,
    quyet_dinh_phe_duyet_paktks: "",
    quyet_dinh_phe_duyet_paktks_day_du: "",
    link_pdf_phe_duyet_paktks: "",
    ngay_qd_phe_duyet: "",
  };
}

export function mergeSavedPakIntoForm(saved, project, nvks) {
  const base = buildInitialFormFromSources(project, nvks, null);
  return {
    ...base,
    ...saved,
    ma_du_an: saved.ma_du_an || base.ma_du_an,
    thoi_diem_lap: saved.thoi_diem_lap || base.thoi_diem_lap,
    thoi_gian_ks_lap_pa: "",
    thoi_gian_ks_lap_bcks: saved.thoi_gian_ks_lap_bcks ?? base.thoi_gian_ks_lap_bcks,
    thoi_gian_hoan_thien_ho_so: "",
    thoi_gian_thuc_hien_tong: "",
  };
}
