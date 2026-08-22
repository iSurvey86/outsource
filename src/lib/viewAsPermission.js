/**
 * Admin «Xem với quyền» — persona theo nhóm quyền OUTSRC (PM / Member / Bên A).
 * Actor (Admin thật) giữ trong sessionStorage; session hiện tại = persona.
 */

import {
  clearAuthSession,
  loadAuthSession,
  setAuthSession,
} from "./authSession";
import { resolveRolePerms } from "./rolePerms";
import { SEED_ROLES } from "./storeLocal";
import { hasSupabase, supabase } from "./supabase";

const KEYS = {
  actorUser: "outsrc_actor_user",
  actorPerms: "outsrc_actor_perms",
  meta: "outsrc_view_as_meta",
};

/**
 * Persona cố định — không mượn mật khẩu user thật.
 * Test_BenA dùng id u-a1 để khớp seed DA (ben_a_user_id).
 */
export const VIEW_AS_ROLE_PRESETS = [
  {
    id: "pm",
    user_id: "view-as-pm",
    username: "test_pm",
    ho_ten: "Test_PM",
    phe: "ben_b",
    phan_quyen: "pm",
    mo_ta: "Quản lý dự án — lập KS, upload HS, xem A↔B, có nội bộ",
  },
  {
    id: "member",
    user_id: "view-as-member",
    username: "test_member",
    ho_ten: "Test_Member",
    phe: "ben_b",
    phan_quyen: "member",
    mo_ta: "Giống PM; không sổ A↔B, không tài chính nội bộ",
  },
  {
    id: "ben_a",
    user_id: "u-a1",
    username: "test_ben_a",
    ho_ten: "Test_BenA",
    phe: "ben_a",
    phan_quyen: "ben_a_viewer",
    mo_ta: "Bên A — chỉ DA gắn mình (seed: u-a1)",
  },
];

const ROLE_LABELS = {
  admin: "Quản trị",
  pm: "Quản lý dự án",
  member: "Thành viên",
  ben_a_viewer: "Bên A (xem)",
};

function readJson(key) {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(key, JSON.stringify(value));
}

function removeKey(key) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(key);
}

export function getAuthUser() {
  return loadAuthSession().user;
}

export function getAuthPerms() {
  return loadAuthSession().perms;
}

export function isViewAsActive() {
  return Boolean(readJson(KEYS.actorUser));
}

export function getAuthActor() {
  const actor = readJson(KEYS.actorUser);
  if (actor) return actor;
  return getAuthUser();
}

export function getAuthActorPerms() {
  const actorPerms = readJson(KEYS.actorPerms);
  if (actorPerms) return actorPerms;
  return getAuthPerms();
}

export function getViewAsMeta() {
  return readJson(KEYS.meta);
}

export function canUseViewAsPermission() {
  const actor = getAuthActor();
  const actorPerms = getAuthActorPerms();
  return Boolean(actor && (actorPerms?.q_admin || actor.phan_quyen === "admin"));
}

export function clearViewAsStorage() {
  removeKey(KEYS.actorUser);
  removeKey(KEYS.actorPerms);
  removeKey(KEYS.meta);
}

export function notifyAuthSessionChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("outsrc-auth-session-changed", {
      detail: {
        user: getAuthUser(),
        perms: getAuthPerms(),
        viewAs: isViewAsActive(),
        actor: getAuthActor(),
        meta: getViewAsMeta(),
      },
    })
  );
}

export function buildViewAsUserFromPreset(preset) {
  if (!preset?.phan_quyen) return null;
  return {
    id: preset.user_id || `view-as-${preset.id}`,
    username: preset.username,
    ho_ten: preset.ho_ten,
    phe: preset.phe,
    phan_quyen: preset.phan_quyen,
    trang_thai: "active",
    bat_doi_mk: 0,
    is_view_as_persona: true,
  };
}

export function startViewAsPermission(targetUser, targetPerms) {
  if (typeof window === "undefined") return { ok: false, error: "Khong co cua so trinh duyet." };
  if (!canUseViewAsPermission()) {
    return { ok: false, error: "Chi Admin he thong moi dung duoc che do xem voi quyen." };
  }
  if (!targetUser?.id || !targetPerms) {
    return { ok: false, error: "Thieu persona hoac nhom quyen dich." };
  }

  const currentUser = getAuthUser();
  const currentPerms = getAuthPerms();
  if (!currentUser || !currentPerms) {
    return { ok: false, error: "Chua co phien dang nhap." };
  }

  if (!isViewAsActive()) {
    writeJson(KEYS.actorUser, currentUser);
    writeJson(KEYS.actorPerms, currentPerms);
  }

  const actor = readJson(KEYS.actorUser) || currentUser;
  if (String(targetUser.id) === String(actor.id)) {
    return { ok: false, error: "Khong the xem voi quyen chinh tai khoan Admin dang dang nhap." };
  }

  writeJson(KEYS.meta, {
    started_at: new Date().toISOString(),
    target_id: targetUser.id,
    target_username: targetUser.username || "",
    target_ho_ten: targetUser.ho_ten || "",
    target_phan_quyen: targetUser.phan_quyen || "",
    target_phe: targetUser.phe || "",
    actor_id: actor.id,
    actor_ho_ten: actor.ho_ten || "",
    persona: true,
  });

  const safeTarget = { ...targetUser, is_view_as_persona: true };
  delete safeTarget.mat_khau;

  setAuthSession(safeTarget, targetPerms);
  notifyAuthSessionChanged();
  return { ok: true };
}

export function stopViewAsPermission() {
  if (typeof window === "undefined") return { ok: false, error: "Khong co cua so trinh duyet." };
  const actor = readJson(KEYS.actorUser);
  const actorPerms = readJson(KEYS.actorPerms);
  if (!actor || !actorPerms) {
    clearViewAsStorage();
    return { ok: false, error: "Khong dang o che do xem voi quyen." };
  }
  clearViewAsStorage();
  setAuthSession(actor, actorPerms);
  notifyAuthSessionChanged();
  return { ok: true };
}

export function clearAuthSessionIncludingViewAs() {
  clearViewAsStorage();
  clearAuthSession();
}

export function roleLabel(phanQuyen) {
  return ROLE_LABELS[phanQuyen] || phanQuyen || "-";
}

export async function fetchPermsForRole(phanQuyen) {
  const role = String(phanQuyen || "").trim();
  if (!role) throw new Error("Thieu ma nhom quyen.");

  // Ma trận trong code là nguồn sự thật (Member = PM − nội bộ).
  if (SEED_ROLES[role]) return resolveRolePerms(role);

  if (hasSupabase && supabase) {
    const { data, error } = await supabase
      .from("phan_quyen")
      .select("*")
      .eq("phan_quyen", role)
      .maybeSingle();
    if (!error && data) return resolveRolePerms(role, data);
  }

  throw new Error(`Nhom quyen «${role}» chua co trong phan_quyen.`);
}
