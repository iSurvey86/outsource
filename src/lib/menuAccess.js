import { isBenA, isBenB } from "./authSession";
import { duAnVisibleToBenA } from "./benAUsers";

export function canSeeChiaNoiBo(user, perms) {
  return isBenB(user) && !!perms?.q_chia_noi_bo;
}

export function canSuaChiaNoiBo(user, perms) {
  return isBenB(user) && !!perms?.q_sua_chia_noi_bo;
}

export function canLapKs(user, perms) {
  return isBenB(user) && !!perms?.q_lap_ks;
}

export function canSeeQlht(user, perms) {
  return !!perms?.q_admin || !!perms?.q_system_log;
}

/** Tạo / sửa metadata DA / gắn Bên A / PDF Giao A / sổ HĐ — chỉ Admin (ma trận). */
export function canSuaDuAn(perms) {
  return !!perms?.q_sua_du_an;
}

export function canXoaDuAn(perms) {
  return !!perms?.q_xoa_du_an;
}

/** Sổ A↔B: xem — Admin/PM/Bên A; Member Bên B không xem. */
export function canSeeTaiChinhAb(user, perms) {
  if (isBenA(user)) return true;
  if (isBenB(user) && user?.phan_quyen === "member") return false;
  if (perms && "q_xem_tai_chinh_ab" in perms) {
    return !!perms.q_xem_tai_chinh_ab;
  }
  return isBenB(user);
}

/** Sổ A↔B: sửa số liệu / nhận tạm ứng — chỉ Admin. */
export function canSuaTaiChinhAb(perms) {
  return !!perms?.q_admin;
}

/** Upload hồ sơ KS|TK + folder tùy chọn — Bên B (Admin/PM/Member). */
export function canUploadHoSo(user) {
  return isBenB(user);
}

/**
 * Xóa file hồ sơ upload: Admin mọi file; PM/Member chỉ file do mình tải lên.
 * Không xóa file xuất bản; Bên A không xóa.
 */
export function canXoaHoSoFile(user, perms, item) {
  if (!user || !item || item.nguon !== "upload") return false;
  if (!isBenB(user)) return false;
  if (perms?.q_admin) return true;
  const ownerId = String(item.nguoi_up_id || "");
  const uid = String(user.id || "");
  return Boolean(ownerId && uid && ownerId === uid);
}

/**
 * Bên A chỉ thấy DA có mình trong `ben_a_user_ids` (hoặc legacy ben_a_user_id).
 * Bên B (mọi role MVP): mọi DA.
 */
export function filterDuAnForUser(duAnList, user) {
  const list = Array.isArray(duAnList) ? duAnList : [];
  if (!user) return [];
  if (isBenA(user)) {
    const uid = String(user.id || "");
    return list.filter((d) => duAnVisibleToBenA(d, uid));
  }
  return list;
}

export function canAccessDuAn(duAn, user) {
  if (!user || !duAn) return false;
  if (isBenA(user)) {
    return duAnVisibleToBenA(duAn, user.id);
  }
  return true;
}

/** Path guard — trả về route redirect nếu không được vào */
export function checkPathAccess(pathname, user, perms) {
  if (!user) return "/login";
  if (
    pathname.startsWith("/tai-chinh") &&
    !pathname.startsWith("/tai-chinh-noi-bo") &&
    !canSeeTaiChinhAb(user, perms)
  ) {
    return "/";
  }
  if (pathname.startsWith("/chia-noi-bo") || pathname.startsWith("/tai-chinh-noi-bo")) {
    if (!canSeeChiaNoiBo(user, perms)) return "/";
  }
  if (pathname.startsWith("/quan-ly-he-thong") && !canSeeQlht(user, perms)) {
    return "/";
  }
  if (pathname.startsWith("/nhap-du-an") && !canSuaDuAn(perms)) {
    return "/du-an";
  }
  return null;
}
