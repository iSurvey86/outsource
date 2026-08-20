/**
 * Nhật ký phiên bản (nguồn UI «Có gì mới» khi có).
 * Khi bump package.json: prepend entry khớp version.
 */

/** @typedef {{ added?: string[], improved?: string[], fixed?: string[] }} ChangelogSections */

/**
 * @typedef {Object} ChangelogRelease
 * @property {string} version
 * @property {string} date
 * @property {string} [title]
 * @property {ChangelogSections} sections
 */

/** @type {ChangelogRelease[]} — mới nhất ở đầu */
export const APP_CHANGELOG = [
  {
    version: "0.2.0",
    date: "2026-08-20",
    title: "MVP OUTSRC — A↔B, Supabase, Vercel",
    sections: {
      added: [
        "Đăng nhập theo phe Bên A / Bên B; dashboard, danh mục và workspace dự án",
        "Hồ sơ khảo sát / thiết kế dùng chung; sổ tài chính A↔B (25% / 30% / giao tuyến)",
        "Tài chính nội bộ chỉ Bên B; quản lý hệ thống (tài khoản + nhật ký)",
        "Kết nối Supabase khi có cấu hình; không có thì dùng dữ liệu local (dev)",
      ],
      improved: [
        "Thương hiệu HỆ THỐNG / OUTSRC; giao diện teal–blue–emerald; khối tài khoản trên sidebar",
      ],
      fixed: [
        "Chuẩn hóa khóa API khi copy nhầm; thông báo rõ khi khóa Supabase không hợp lệ",
      ],
    },
  },
];
