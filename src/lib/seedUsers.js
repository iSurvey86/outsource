/**
 * Tài khoản demo / seed — nguồn sự thật (đồng bộ Supabase thật + localStorage dev).
 * Cập nhật kèm: scripts/sql/001_schema.sql, scripts/sql/023_sync_seed_users.sql,
 * README.md, workflows/01_auth.md, workflows/04_quan_ly_he_thong.md
 */

export const SEED_USERS = [
  {
    id: "u-admin",
    username: "phuongdm",
    mat_khau: "admin123",
    ho_ten: "Phương DM",
    phe: "ben_b",
    phan_quyen: "admin",
    trang_thai: "active",
    bat_doi_mk: 1,
  },
  {
    id: "u-pm",
    username: "tinhtv",
    mat_khau: "pm123",
    ho_ten: "Tình TV",
    phe: "ben_b",
    phan_quyen: "pm",
    trang_thai: "active",
    bat_doi_mk: 1,
  },
  {
    id: "u-mem",
    username: "hienth",
    mat_khau: "a123",
    ho_ten: "Hiền TH",
    phe: "ben_a",
    phan_quyen: "ben_a_viewer",
    trang_thai: "active",
    bat_doi_mk: 1,
  },
  {
    id: "u-a1",
    username: "chulm",
    mat_khau: "a123",
    ho_ten: "Chu LM (Bên A)",
    phe: "ben_a",
    phan_quyen: "ben_a_viewer",
    trang_thai: "active",
    bat_doi_mk: 1,
  },
];

/** Alias dùng trong code cũ */
export const DEMO_USERS = SEED_USERS;
