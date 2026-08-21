/**
 * Thông báo lỗi hiển thị cho người dùng — không lộ hạ tầng (DB, env, vendor).
 * Chi tiết kỹ thuật chỉ ghi console (dev / hỗ trợ).
 */

const INFRA_RE =
  /invalid api key|jwt|supabase|api key|failed to fetch|networkerror|econnrefused|enotfound|\.env|vercel|postgres|permission denied for|row-level security|rls|fetch failed|load failed/i;

/**
 * @param {unknown} errOrMsg
 * @param {{ fallback?: string }} [opts]
 * @returns {string}
 */
export function toUserFacingError(errOrMsg, opts = {}) {
  const fallback =
    opts.fallback || "Không thể hoàn tất thao tác. Vui lòng thử lại hoặc liên hệ quản trị viên.";
  const raw =
    typeof errOrMsg === "string"
      ? errOrMsg
      : errOrMsg?.message || errOrMsg?.error_description || errOrMsg?.error || "";

  if (raw) {
    // eslint-disable-next-line no-console
    console.error("[OUTSRC]", raw, errOrMsg);
  }

  if (!raw) return fallback;

  if (/user hoặc mật khẩu|sai mật khẩu|không đúng|không tồn tại|đã khóa|bị khóa/i.test(raw)) {
    return "Tài khoản hoặc mật khẩu không đúng.";
  }

  if (INFRA_RE.test(raw)) {
    return "Hệ thống tạm thời không kết nối được. Vui lòng thử lại sau hoặc liên hệ quản trị viên.";
  }

  // Không đẩy chuỗi kỹ thuật / tiếng Anh vendor ra UI
  if (/^[A-Za-z0-9_:[\]"'.\s-]{0,120}$/.test(raw) && /[A-Z]{2,}|error|exception|stack/i.test(raw)) {
    return fallback;
  }

  if (raw.length > 160 || /https?:\/\/|at\s+\w+|node_modules/i.test(raw)) {
    return fallback;
  }

  return raw;
}

export function loginUserFacingError(errOrMsg) {
  return toUserFacingError(errOrMsg, {
    fallback: "Đăng nhập thất bại. Vui lòng thử lại hoặc liên hệ quản trị viên.",
  });
}
