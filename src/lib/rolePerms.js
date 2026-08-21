/**
 * Quyền theo ma trận — nguồn sự thật: SEED_ROLES (docs/Phan_quyen_OUTSRC.md).
 * Member = PM trừ tài chính nội bộ (q_chia_noi_bo / q_sua_chia_noi_bo = 0).
 */

import { SEED_ROLES } from "./storeLocal";

/** Lấy bản quyền chuẩn theo mã vai trò (admin|pm|member|ben_a_viewer). */
export function resolveRolePerms(phanQuyen, fallbackRow = null) {
  const role = String(phanQuyen || "").trim();
  if (role && SEED_ROLES[role]) {
    return { ...SEED_ROLES[role] };
  }
  if (fallbackRow && typeof fallbackRow === "object") {
    return { ...fallbackRow };
  }
  return { ...SEED_ROLES.member };
}
