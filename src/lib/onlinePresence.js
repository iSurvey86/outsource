/**
 * Theo dõi người dùng đang online (presence).
 * - Có Supabase: Realtime Presence channel `outsrc-online-users`
 * - Không Supabase: localStorage + BroadcastChannel (dev / cùng máy)
 */

import { hasSupabase, supabase } from "./supabase";

const LS_KEY = "outsrc_online_presence_v1";
const BC_NAME = "outsrc-online-presence";
const STALE_MS = 45_000;
const HEARTBEAT_MS = 12_000;

export function presenceKey(user) {
  return String(user?.id || user?.username || "")
    .trim()
    .toLowerCase();
}

function publishSet(set) {
  if (typeof window === "undefined") return;
  window.__onlineUsersSet = set;
  window.dispatchEvent(new Event("online-users-updated"));
}

function readLocalMap() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

function writeLocalMap(map) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function pruneAndPublishLocal() {
  const now = Date.now();
  const map = readLocalMap();
  let changed = false;
  for (const k of Object.keys(map)) {
    if (!map[k] || now - Number(map[k]) > STALE_MS) {
      delete map[k];
      changed = true;
    }
  }
  if (changed) writeLocalMap(map);
  publishSet(new Set(Object.keys(map)));
}

/**
 * Bắt đầu ghi nhận online cho user hiện tại. Trả về cleanup.
 */
export function startOnlinePresence(user) {
  if (typeof window === "undefined" || !user) return () => {};

  const key = presenceKey(user);
  if (!key) return () => {};

  if (hasSupabase && supabase) {
    const channel = supabase.channel("outsrc-online-users", {
      config: { presence: { key } },
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const onlineSet = new Set();
      for (const k of Object.keys(state || {})) {
        onlineSet.add(String(k).toLowerCase());
      }
      publishSet(onlineSet);
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          online_at: new Date().toISOString(),
          user_id: user.id,
          username: user.username,
          ho_ten: user.ho_ten,
        });
      }
    });

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {
        /* ignore */
      }
    };
  }

  // Local fallback
  const beat = () => {
    const map = readLocalMap();
    map[key] = Date.now();
    writeLocalMap(map);
    pruneAndPublishLocal();
    try {
      const bc = new BroadcastChannel(BC_NAME);
      bc.postMessage({ type: "beat", key });
      bc.close();
    } catch {
      /* ignore */
    }
  };

  beat();
  const timer = setInterval(beat, HEARTBEAT_MS);
  const poll = setInterval(pruneAndPublishLocal, 5000);

  let bc;
  try {
    bc = new BroadcastChannel(BC_NAME);
    bc.onmessage = () => pruneAndPublishLocal();
  } catch {
    bc = null;
  }

  const onStorage = (e) => {
    if (e.key === LS_KEY) pruneAndPublishLocal();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    clearInterval(timer);
    clearInterval(poll);
    window.removeEventListener("storage", onStorage);
    if (bc) bc.close();
    const map = readLocalMap();
    delete map[key];
    writeLocalMap(map);
    pruneAndPublishLocal();
  };
}

/** Lắng nghe cập nhật danh sách online (cho trang QLHT). */
export function subscribeOnlineUsers(onChange) {
  if (typeof window === "undefined") return () => {};

  const emit = () => {
    const set =
      window.__onlineUsersSet instanceof Set
        ? new Set(window.__onlineUsersSet)
        : new Set();
    onChange(set);
  };

  emit();
  window.addEventListener("online-users-updated", emit);
  return () => window.removeEventListener("online-users-updated", emit);
}

export function labelPhe(phe) {
  if (phe === "ben_a") return "Bên A";
  if (phe === "ben_b") return "Bên B";
  return phe || "—";
}

export function labelVaiTro(role) {
  const map = {
    admin: "Quản trị",
    pm: "Quản lý dự án",
    member: "Thành viên",
    ben_a_viewer: "Bên A (xem)",
  };
  return map[role] || role || "—";
}
