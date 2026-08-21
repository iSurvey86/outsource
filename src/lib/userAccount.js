/**
 * Tài khoản cá nhân — đổi mật khẩu (OUTSRC).
 */

import { clearAuthSessionIncludingViewAs } from "./viewAsPermission";

export function validatePasswordChange({
  currentPassword,
  newPassword,
  confirmPassword,
  requireCurrent = true,
}) {
  const cur = String(currentPassword || "");
  const next = String(newPassword || "");
  const confirm = String(confirmPassword || "");

  if (requireCurrent && !cur) {
    return { ok: false, message: "Vui lòng nhập mật khẩu hiện tại." };
  }
  if (!next || !confirm) {
    return { ok: false, message: "Vui lòng nhập đầy đủ mật khẩu mới và xác nhận." };
  }
  if (next.length < 6) {
    return { ok: false, message: "Mật khẩu mới tối thiểu 6 ký tự." };
  }
  if (requireCurrent && next === cur) {
    return { ok: false, message: "Mật khẩu mới phải khác mật khẩu hiện tại." };
  }
  if (next !== confirm) {
    return { ok: false, message: "Xác nhận mật khẩu mới không khớp." };
  }
  return { ok: true };
}

export function forceReLoginAfterPasswordChange(message) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    "outsrc_login_notice",
    message || "Đổi mật khẩu thành công. Vui lòng đăng nhập lại bằng mật khẩu mới."
  );
  clearAuthSessionIncludingViewAs();
  window.location.replace("/login");
}
