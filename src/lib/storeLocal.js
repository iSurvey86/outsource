/**
 * LocalStorage fallback (dev không có Supabase).
 */

const DB_KEY = "outsrc_db_v5";
const LEGACY_KEYS = ["outsrc_db_v1", "outsrc_db_v2", "outsrc_db_v3", "outsrc_db_v4"];

export const SEED_ROLES = {
  admin: {
    phan_quyen: "admin",
    q_admin: 1,
    q_sua_du_an: 1,
    q_xoa_du_an: 1,
    q_lap_ks: 1,
    q_xuat_ban: 1,
    q_chia_noi_bo: 1,
    q_sua_chia_noi_bo: 1,
    q_system_log: 1,
  },
  pm: {
    phan_quyen: "pm",
    q_admin: 0,
    q_sua_du_an: 1,
    q_xoa_du_an: 0,
    q_lap_ks: 1,
    q_xuat_ban: 1,
    q_chia_noi_bo: 1,
    q_sua_chia_noi_bo: 1,
    q_system_log: 0,
  },
  member: {
    phan_quyen: "member",
    q_admin: 0,
    q_sua_du_an: 0,
    q_xoa_du_an: 0,
    q_lap_ks: 1,
    q_xuat_ban: 0,
    q_chia_noi_bo: 1,
    q_sua_chia_noi_bo: 0,
    q_system_log: 0,
  },
  ben_a_viewer: {
    phan_quyen: "ben_a_viewer",
    q_admin: 0,
    q_sua_du_an: 0,
    q_xoa_du_an: 0,
    q_lap_ks: 0,
    q_xuat_ban: 0,
    q_chia_noi_bo: 0,
    q_sua_chia_noi_bo: 0,
    q_system_log: 0,
  },
};

export const DEMO_USERS = [
  {
    id: "u-admin",
    username: "phuongdm",
    mat_khau: "admin123",
    ho_ten: "Phương DM",
    phe: "ben_b",
    phan_quyen: "admin",
    trang_thai: "active",
  },
  {
    id: "u-pm",
    username: "tinhtv",
    mat_khau: "pm123",
    ho_ten: "Tình TV",
    phe: "ben_b",
    phan_quyen: "pm",
    trang_thai: "active",
  },
  {
    id: "u-mem",
    username: "hienth",
    mat_khau: "mem123",
    ho_ten: "Hiền TH",
    phe: "ben_b",
    phan_quyen: "member",
    trang_thai: "active",
  },
  {
    id: "u-a1",
    username: "chulm",
    mat_khau: "a123",
    ho_ten: "Chu LM (Bên A)",
    phe: "ben_a",
    phan_quyen: "ben_a_viewer",
    trang_thai: "active",
  },
];

export function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function clearLegacyKeys() {
  if (typeof window === "undefined") return;
  LEGACY_KEYS.forEach((k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  });
}

export function seedLocalDb() {
  const db = {
    roles: SEED_ROLES,
    users: DEMO_USERS.map((u) => ({ ...u })),
    duAn: [
      {
        id: "da-1",
        ma_du_an: "DA-2026-001",
        ten: "Đường dây 110kV Demo",
        ben_a_user_id: "u-a1",
        phu_trach_id: "u-pm",
        chu_dau_tu: "Công ty Điện lực Demo",
        quy_mo: "ĐZ 110kV — 12 km",
        dia_diem: "Tỉnh Demo",
        giai_doan: "BCNCKT",
        trang_thai: "dang_lam",
        nguon_gia_tri: "padt_tam_tinh",
        gia_tri_tu_van: 1_000_000_000,
        ty_le_ben_b: 0.25,
        ty_le_tam_ung: 0.3,
        mo_ta: "DA demo — tạm tính PAĐT",
        ngay_bat_dau: "2026-08-01",
        ngay_ket_thuc_dk: "2026-12-31",
      },
    ],
    moc: [
      {
        id: "m-1",
        du_an_id: "da-1",
        ma: "trien_khai",
        ten: "Triển khai",
        thu_tu: 1,
        trang_thai: "hoan_thanh",
        han: "2026-08-15",
      },
      {
        id: "m-2",
        du_an_id: "da-1",
        ma: "giao_tuyen",
        ten: "Giao tuyến",
        thu_tu: 2,
        trang_thai: "dang_lam",
        han: "2026-10-30",
      },
    ],
    ksModules: [
      { id: "ks-1", du_an_id: "da-1", loai: "nvks", trang_thai: "dang_lam" },
      { id: "ks-2", du_an_id: "da-1", loai: "paktks", trang_thai: "chua_lam" },
      { id: "ks-3", du_an_id: "da-1", loai: "bcks", trang_thai: "chua_lam" },
      { id: "ks-4", du_an_id: "da-1", loai: "nghiem_thu", trang_thai: "chua_lam" },
      { id: "ks-5", du_an_id: "da-1", loai: "nhat_ky", trang_thai: "chua_lam" },
    ],
    giaoDich: [
      {
        id: "gd-1",
        du_an_id: "da-1",
        loai: "tam_ung",
        so_tien: 75_000_000,
        ngay: "2026-08-10",
        noi_dung: "Tạm ứng 30% phần B — triển khai",
        nguoi_tao_id: "u-admin",
      },
    ],
    chiaNoiBo: [
      { id: "cn-1", du_an_id: "da-1", nguoi_dung_id: "u-pm", ty_le: 0.4, ghi_chu: "Lead" },
      { id: "cn-2", du_an_id: "da-1", nguoi_dung_id: "u-mem", ty_le: 0.35, ghi_chu: "" },
      { id: "cn-3", du_an_id: "da-1", nguoi_dung_id: "u-admin", ty_le: 0.25, ghi_chu: "Hỗ trợ" },
    ],
    taiLieu: [
      {
        id: "tl-1",
        du_an_id: "da-1",
        loai_kho: "thiet_ke",
        nguon: "upload",
        ten_file: "MB-tong-the.pdf",
        ghi_chu: "Upload mẫu",
        nguoi_up_id: "u-pm",
        thoi_gian: "2026-08-12T08:00:00",
      },
    ],
    lichSu: [
      {
        id: "ls-1",
        username: "phuongdm",
        ho_ten: "Phương DM",
        phan_he: "auth",
        hanh_dong: "SEED",
        chi_tiet: "Khởi tạo dữ liệu demo",
        thoi_gian: new Date().toISOString(),
      },
    ],
  };
  saveLocalDb(db);
  return db;
}

export function ensureLocalDemo(db) {
  if (!db) return seedLocalDb();
  if (!db.roles) db.roles = SEED_ROLES;
  if (!Array.isArray(db.users)) db.users = [];
  for (const demo of DEMO_USERS) {
    const idx = db.users.findIndex(
      (u) => u.id === demo.id || String(u.username || "").toLowerCase() === demo.username
    );
    if (idx >= 0) {
      db.users[idx] = { ...db.users[idx], ...demo, trang_thai: "active" };
    } else {
      db.users.push({ ...demo });
    }
  }
  saveLocalDb(db);
  return db;
}

export function getLocalDb() {
  if (typeof window === "undefined") return seedLocalDb();
  clearLegacyKeys();
  const raw = localStorage.getItem(DB_KEY);
  if (!raw) return seedLocalDb();
  try {
    return JSON.parse(raw);
  } catch {
    return seedLocalDb();
  }
}

export function saveLocalDb(db) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    /* ignore */
  }
}
