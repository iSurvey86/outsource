import { SESSION_PERMS_KEY, SESSION_USER_KEY } from "./brand";

export function loadAuthSession() {
  if (typeof window === "undefined") return { user: null, perms: null };
  try {
    const user = JSON.parse(sessionStorage.getItem(SESSION_USER_KEY) || "null");
    const perms = JSON.parse(sessionStorage.getItem(SESSION_PERMS_KEY) || "null");
    return { user, perms };
  } catch {
    return { user: null, perms: null };
  }
}

export function setAuthSession(user, perms) {
  sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
  sessionStorage.setItem(SESSION_PERMS_KEY, JSON.stringify(perms));
}

export function clearAuthSession() {
  sessionStorage.removeItem(SESSION_USER_KEY);
  sessionStorage.removeItem(SESSION_PERMS_KEY);
}

export function isBenB(user) {
  return user?.phe === "ben_b";
}

export function isBenA(user) {
  return user?.phe === "ben_a";
}

/** Lần đầu / admin đặt lại MK — bắt buộc đổi trước khi dùng app. */
export function userMustChangePassword(user) {
  if (!user || user.is_view_as_persona) return false;
  return Number(user.bat_doi_mk) === 1;
}
