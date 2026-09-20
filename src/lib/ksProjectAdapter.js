/**
 * Map OUTSRC `du_an` → shape form KS (ksnpsc) mong đợi.
 */
export function toKsProject(duAn) {
  if (!duAn) return null;
  const ten = String(duAn.ten_du_an || duAn.ten || "").trim();
  return {
    ...duAn,
    ten_du_an: ten,
    ten,
    dia_diem_ks: String(duAn.dia_diem_ks || duAn.dia_diem || "").trim(),
    giai_doan_chuan: String(duAn.giai_doan_chuan || duAn.giai_doan || "").trim(),
  };
}

/** Trạng thái module theo hồ sơ thật (có bản ghi = đang làm / đã có). */
export function ksRecordStatus(record) {
  if (!record) return "chua_lam";
  return "dang_lam";
}
