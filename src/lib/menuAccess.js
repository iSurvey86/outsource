import { isBenB } from "./authSession";

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

export function canSuaDuAn(perms) {
  return !!perms?.q_sua_du_an;
}

export function canXoaDuAn(perms) {
  return !!perms?.q_xoa_du_an;
}

/** Path guard — trả về route redirect nếu không được vào */
export function checkPathAccess(pathname, user, perms) {
  if (!user) return "/login";
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
