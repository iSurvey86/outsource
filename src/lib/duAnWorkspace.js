/** Luồng khảo sát trên workspace dự án (kiểu ksnpsc). */

export const HOP_DONG_ACTION = "hop_dong";

export function buildDuAnWorkspaceUrl(maDuAn, action = null) {
  const base = `/du-an/${encodeURIComponent(maDuAn || "")}`;
  if (!action) return base;
  return `${base}?action=${encodeURIComponent(action)}`;
}

export const SURVEY_WORKFLOW = [
  {
    key: "nvks",
    step: 1,
    shortLabel: "NVKS",
    label: "Nhiệm vụ Khảo sát",
    description: "Lập / xem / xuất hồ sơ NVKS",
    color: "emerald",
    requires: [],
  },
  {
    key: "paktks",
    step: 2,
    shortLabel: "PAK",
    label: "Phương án kỹ thuật KS",
    description: "Phương án kỹ thuật khảo sát (PAKTKS)",
    color: "indigo",
    requires: ["nvks"],
  },
  {
    key: "nkks",
    step: 3,
    shortLabel: "NKKS",
    label: "Nhật ký khảo sát",
    description: "Nhật ký hiện trường",
    color: "sky",
    requires: ["nvks"],
  },
  {
    key: "bcks",
    step: 4,
    shortLabel: "BCKS",
    label: "Báo cáo khảo sát",
    description: "Báo cáo khảo sát thực địa",
    color: "amber",
    requires: ["nvks"],
  },
  {
    key: "nghiem_thu",
    step: 5,
    shortLabel: "NT",
    label: "Nghiệm thu KS",
    description: "Biên bản nghiệm thu hồ sơ",
    color: "green",
    requires: ["nkks"],
  },
];

const ACCENT = {
  emerald: {
    card: "border-emerald-200",
    top: "from-emerald-500",
    step: "bg-emerald-600",
    icon: "bg-emerald-50 text-emerald-700",
    btn: "bg-emerald-600 hover:bg-emerald-700",
  },
  indigo: {
    card: "border-indigo-200",
    top: "from-indigo-500",
    step: "bg-indigo-600",
    icon: "bg-indigo-50 text-indigo-700",
    btn: "bg-indigo-600 hover:bg-indigo-700",
  },
  sky: {
    card: "border-sky-200",
    top: "from-sky-500",
    step: "bg-sky-600",
    icon: "bg-sky-50 text-sky-700",
    btn: "bg-sky-600 hover:bg-sky-700",
  },
  amber: {
    card: "border-amber-200",
    top: "from-amber-500",
    step: "bg-amber-600",
    icon: "bg-amber-50 text-amber-800",
    btn: "bg-amber-600 hover:bg-amber-700",
  },
  green: {
    card: "border-green-200",
    top: "from-green-600",
    step: "bg-green-700",
    icon: "bg-green-50 text-green-800",
    btn: "bg-green-700 hover:bg-green-800",
  },
};

export function getWorkflowAccent(color) {
  return ACCENT[color] || ACCENT.sky;
}

export function getKsStatusMap(ksRows = []) {
  const map = {};
  for (const row of ksRows) {
    const loai = row.loai === "nhat_ky" ? "nkks" : row.loai;
    map[loai] = row;
  }
  return map;
}

export function isModuleUnlocked(mod, statusMap) {
  return (mod.requires || []).every((req) => {
    const row = statusMap[req];
    return row && (row.trang_thai === "dang_lam" || row.trang_thai === "da_xuat_ban");
  });
}

export function workflowButtonLabel(mod, row, unlocked, canWork) {
  if (!unlocked) {
    const need = (mod.requires || [])[0];
    if (need === "nvks") return "Cần NVKS";
    if (need === "nkks") return "Cần NKKS";
    return "Chưa mở";
  }
  if (!canWork) {
    if (row?.trang_thai === "da_xuat_ban") return "Đã XB";
    if (row?.trang_thai === "dang_lam") return "Đang làm";
    return "Chưa làm";
  }
  if (!row || row.trang_thai === "chua_lam") return "+ Lập";
  if (row.trang_thai === "dang_lam") return "Tiếp tục";
  return "Xem / XB";
}
