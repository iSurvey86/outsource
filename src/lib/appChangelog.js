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
    version: "0.4.2",
    date: "2026-08-22",
    title: "Upload hồ sơ + quyền Member / xóa file",
    sections: {
      added: [
        "Tải file thật vào hồ sơ KS|TK (kéo-thả, nhiều file); bucket ho_so; mở/xóa file trên workspace",
      ],
      improved: [
        "Member Bên B không xem menu Tài chính A↔B; seed user đồng bộ (hienth = Bên A)",
        "Xóa file upload: Admin mọi file; PM/Member chỉ file do mình tải lên",
      ],
    },
  },
  {
    version: "0.4.1",
    date: "2026-08-21",
    title: "Ma trận Member + slogan",
    sections: {
      improved: [
        "Quyền login/xem quyền lấy từ ma trận code (Member = PM − nội bộ); đồng bộ phan_quyen trên Supabase",
        "Slogan: Hệ thống quản lý công việc, tiến độ dự án",
      ],
      fixed: [
        "Member mới (vd. binhnv) nhận đúng quyền — không còn phụ thuộc bản phan_quyen cũ trên DB",
      ],
    },
  },
  {
    version: "0.4.0",
    date: "2026-08-21",
    title: "Tài chính gọn + nội bộ 2 tầng + gán nhóm Bên A",
    sections: {
      added: [
        "Gán nhiều tài khoản Bên A trên một DA (nhóm); SQL 021 ben_a_user_ids",
        "Tài chính nội bộ: list DA → trang chi tiết; chia 1 lần trên tổng đã nhận từ A (tỷ lệ hoặc số cứng)",
        "Đổi mật khẩu / bắt đổi lần đầu; ma trận phân quyền enforce trên UI",
      ],
      improved: [
        "Nhận tạm ứng A↔B: ngoài nhập số → trong chỉ ngày + bill; số tiền gắn link bill",
        "Ngày hiển thị dd/mm/yyyy; danh mục DA ẩn cột Bên A với viewer A; đồng bộ khi «Xem quyền»",
      ],
      fixed: [
        "Xem quyền Bên A không còn giữ filter Admin (không lộ DA chưa gán)",
      ],
    },
  },
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
