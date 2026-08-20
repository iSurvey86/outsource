/** Ngày cập nhật HDSD — đặt = ngày phiên khi sửa docs/hdsd/ */
export const HDSD_VERSION = "2026-08-20";

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
    description: "Đăng nhập, menu, quyền A/B",
    file: "00-tong-quan.md",
    order: 0,
    status: "published",
  },
  {
    slug: "du-an",
    title: "Dự án & workspace",
    shortTitle: "Dự án",
    description: "Danh mục, thông tin chung, KS, hồ sơ",
    file: "01-du-an.md",
    order: 1,
    status: "published",
  },
  {
    slug: "tai-chinh",
    title: "Tài chính",
    shortTitle: "Tài chính",
    description: "Sổ A↔B và tài chính nội bộ B",
    file: "02-tai-chinh.md",
    order: 2,
    status: "published",
  },
  {
    slug: "quan-ly-he-thong",
    title: "Quản lý hệ thống",
    shortTitle: "QLHT",
    description: "Tài khoản và nhật ký",
    file: "03-quan-ly-he-thong.md",
    order: 3,
    status: "published",
  },
];
