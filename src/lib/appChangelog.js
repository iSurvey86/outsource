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
    version: "0.3.0",
    date: "2026-08-21",
    title: "Hồ sơ folder tùy chọn + Sổ hợp đồng",
    sections: {
      added: [
        "Sổ hợp đồng trên workspace (HĐ chính, phụ lục, thầu phụ, ký lại; quét AI; số liệu)",
        "Thư mục hồ sơ tùy chọn trên khảo sát / thiết kế (thêm, đổi tên, xóa)",
        "Hướng dẫn Sổ hợp đồng trong tài liệu người dùng",
      ],
      improved: [
        "Workspace gọn hơn: bỏ khối tài chính trên trang DA (dùng menu Tài chính)",
        "Hiển thị Giá trị tư vấn rõ hơn trên header; màu hồ sơ KS / TK phân biệt",
      ],
      fixed: [
        "Script SQL sổ hợp đồng dùng bảng du_an (không còn DANH_MUC_DA của hệ thống cũ)",
      ],
    },
  },
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
