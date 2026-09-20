/** Hằng số trình ký nội bộ — Module 32 */

export const TRINH_KY_MODULE_NVKS = "nvks";
export const TRINH_KY_MODULE_PAKTKS = "paktks";

export const TRINH_KY_STATUS = {
  CHO_KY: "cho_ky",
  TU_CHOI: "tu_choi",
  HOAN_THANH: "hoan_thanh",
  HUY: "huy",
};

export const BUOC_STATUS = {
  CHO: "cho",
  DANG_CHO: "dang_cho",
  DA_XEM: "da_xem",
  DA_KY: "da_ky",
  TU_CHOI: "tu_choi",
};

export const HO_SO_KY_STATUS = {
  CHUA_TRINH: "chua_trinh",
  DANG_TRINH: "dang_trinh",
  DA_KY: "da_ky",
  TU_CHOI: "tu_choi",
};

export const VAI_TRO = {
  NGUOI_LAP: "nguoi_lap",
  CNKS: "cnks",
  NGUOI_LAP_CNKS: "nguoi_lap_cnks",
  LANH_DAO: "lanh_dao",
};

export const VAI_TRO_LABEL = {
  [VAI_TRO.NGUOI_LAP]: "Người lập",
  [VAI_TRO.CNKS]: "Chủ nhiệm KS",
  [VAI_TRO.NGUOI_LAP_CNKS]: "Người lập / Chủ nhiệm KS",
  [VAI_TRO.LANH_DAO]: "Lãnh đạo (PGĐ)",
};

/** Vai trò stamp trên PDF tương ứng mỗi bước */
export function stampRolesForBuoc(vaiTro) {
  if (vaiTro === VAI_TRO.NGUOI_LAP_CNKS) return [VAI_TRO.NGUOI_LAP, VAI_TRO.CNKS];
  return [vaiTro];
}

export const TOKEN_TTL_MS = 72 * 60 * 60 * 1000;
export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_FAIL = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

/**
 * Kênh xác nhận bước ký:
 * - `in_app` (mặc định): đăng nhập app → inbox/KPI → Ký (không OTP/SMS)
 * - `sms`: bật lại luồng token + OTP (dormant; set TRINH_KY_NOTIFY_CHANNEL=sms)
 */
export const TRINH_KY_CHANNEL_IN_APP = "in_app";
export const TRINH_KY_CHANNEL_SMS = "sms";

export function getTrinhKyNotifyChannel() {
  const v = String(process.env.TRINH_KY_NOTIFY_CHANNEL || TRINH_KY_CHANNEL_IN_APP)
    .trim()
    .toLowerCase();
  return v === TRINH_KY_CHANNEL_SMS ? TRINH_KY_CHANNEL_SMS : TRINH_KY_CHANNEL_IN_APP;
}

export function isTrinhKyInAppChannel() {
  return getTrinhKyNotifyChannel() === TRINH_KY_CHANNEL_IN_APP;
}

export const CHU_KY_BUCKET = "chu_ky_nhan_su";
export const CHU_KY_MAX_BYTES = 1024 * 1024;
export const CHU_KY_ACCEPT = "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp";
