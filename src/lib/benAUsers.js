/** Tài khoản Bên A — gắn DA qua `ben_a_user_ids` (mảng id); legacy `ben_a_user_id`. */

export function listBenAUsers(users = []) {
  return (users || [])
    .filter((u) => u?.phe === "ben_a" && String(u.trang_thai || "active") === "active")
    .slice()
    .sort((a, b) =>
      String(a.ho_ten || a.username || "").localeCompare(String(b.ho_ten || b.username || ""), "vi")
    );
}

export function labelBenAUser(u) {
  if (!u) return "—";
  const name = String(u.ho_ten || "").trim() || "Bên A";
  const un = String(u.username || "").trim();
  return un ? `${name} (${un})` : name;
}

/** Tên hiển thị gọn trên workspace / danh mục — không kèm username hay hậu tố phe. */
export function displayBenAName(u) {
  if (!u) return "";
  let name = String(u.ho_ten || "").trim();
  name = name.replace(/\s*\(Bên A\)\s*$/i, "").trim();
  if (!name) name = String(u.username || "").trim();
  return name;
}

/** Chuẩn hoá danh sách id Bên A từ record DA (hỗ trợ cột cũ). */
export function getBenAUserIds(duAn) {
  if (!duAn) return [];
  const raw = duAn.ben_a_user_ids;
  let ids = [];
  if (Array.isArray(raw)) {
    ids = raw.map((x) => String(x || "").trim()).filter(Boolean);
  } else if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        ids = parsed.map((x) => String(x || "").trim()).filter(Boolean);
      }
    } catch {
      /* ignore */
    }
  }
  if (!ids.length && duAn.ben_a_user_id) {
    ids = [String(duAn.ben_a_user_id).trim()].filter(Boolean);
  }
  return [...new Set(ids)];
}

export function findBenAUsers(users, duAnOrIds) {
  const ids = Array.isArray(duAnOrIds)
    ? duAnOrIds.map(String)
    : getBenAUserIds(duAnOrIds);
  if (!ids.length) return [];
  const set = new Set(ids);
  return listBenAUsers(users).filter((u) => set.has(String(u.id)));
}

/** @deprecated dùng findBenAUsers — giữ cho chỗ gọi 1 người */
export function findBenAUser(users, idOrDuAn) {
  if (!idOrDuAn) return null;
  if (typeof idOrDuAn === "object") {
    return findBenAUsers(users, idOrDuAn)[0] || null;
  }
  return (users || []).find((u) => String(u.id) === String(idOrDuAn)) || null;
}

export function labelBenAGroup(users, duAnOrIds) {
  const list = findBenAUsers(users, duAnOrIds);
  if (!list.length) return "";
  return list.map(displayBenAName).filter(Boolean).join("; ");
}

/** Patch đồng bộ mảng + cột legacy (phần tử đầu). */
export function benAAssignPatch(ids) {
  const clean = [...new Set((ids || []).map((x) => String(x || "").trim()).filter(Boolean))];
  return {
    ben_a_user_ids: clean,
    ben_a_user_id: clean[0] || null,
  };
}

export function duAnVisibleToBenA(duAn, userId) {
  const uid = String(userId || "");
  if (!uid) return false;
  return getBenAUserIds(duAn).includes(uid);
}
