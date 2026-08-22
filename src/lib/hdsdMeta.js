/** Ngày cập nhật HDSD — đặt = ngày phiên khi sửa docs/hdsd/ */
export const HDSD_VERSION = "2026-08-22";

export const HDSD_STATUS = {
  published: {
    key: "published",
    label: "Sẵn sàng",
    chipClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  wip: {
    key: "wip",
    label: "Đang cập nhật",
    chipClass: "bg-amber-50 text-amber-800 border-amber-200",
  },
  soon: {
    key: "soon",
    label: "Sắp có",
    chipClass: "bg-teal-50 text-teal-700 border-teal-200",
  },
};

export const HDSD_SECTIONS = [
  {
    slug: "tong-quan",
    title: "Tổng quan",
    shortTitle: "Tổng quan",
    description: "Đăng nhập, menu, ma trận Admin/PM/Member/Bên A",
    file: "00-tong-quan.md",
    order: 0,
    status: "published",
  },
  {
    slug: "du-an",
    title: "Dự án & workspace",
    shortTitle: "Dự án",
    description: "Danh mục, gán Bên A, header, KS, hồ sơ upload/xóa",
    file: "01-du-an.md",
    order: 1,
    status: "published",
  },
  {
    slug: "hop-dong",
    title: "Sổ hợp đồng",
    shortTitle: "Hợp đồng",
    description: "Nhập HĐ, quét AI, phụ lục, số liệu",
    file: "04-hop-dong.md",
    order: 2,
    status: "published",
  },
  {
    slug: "tai-chinh",
    title: "Tài chính",
    shortTitle: "Tài chính",
    description: "Sổ A↔B; nội bộ góp vốn + chia (PM xem); Member ẩn",
    file: "02-tai-chinh.md",
    order: 3,
    status: "published",
  },
  {
    slug: "quan-ly-he-thong",
    title: "Quản lý hệ thống",
    shortTitle: "QLHT",
    description: "Tài khoản và nhật ký",
    file: "03-quan-ly-he-thong.md",
    order: 4,
    status: "published",
  },
];
