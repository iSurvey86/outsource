import { isBenA, isBenB } from "./authSession";
import { duAnVisibleToBenA } from "./benAUsers";

/** Tài chính nội bộ — chỉ Admin + PM (Member B không vào). */
export function canSeeChiaNoiBo(user, perms) {
  if (!isBenB(user)) return false;
  const role = String(user?.phan_quyen || "");
  if (role !== "admin" && role !== "pm") return false;
  return !!perms?.q_chia_noi_bo;
}

/** Sửa góp vốn / bảng chia nội bộ — chỉ Admin. PM chỉ xem. */
export function canSuaChiaNoiBo(user, perms) {
  if (!isBenB(user)) return false;
  if (String(user?.phan_quyen || "") !== "admin") return false;
  return !!perms?.q_sua_chia_noi_bo;
}

const NOI_BO_UI_ROLES = new Set(["admin", "pm"]);

/** Bên B đang hoạt động (mọi role) — tra cứu tên lịch sử góp vốn. */
export function filterBenBActive(users) {
  return (users || []).filter(
    (u) => u.phe === "ben_b" && String(u.trang_thai || "active") === "active"
  );
}

/**
 * Thành viên hiện trên UI chia / chọn góp-vốn (ẩn Member; PM đại diện nhóm).
 * Không xóa user — sau này có thể mở thêm Member góp quỹ qua cờ riêng.
 */
export function filterBenBNoiBoUi(users) {
  return filterBenBActive(users).filter((u) =>
    NOI_BO_UI_ROLES.has(String(u.phan_quyen || ""))
  );
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
