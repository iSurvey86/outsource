/**
 * Shim nhóm công trình (từ ksnpsc giaoViecInbox) — chỉ phần Hợp đồng cần.
 * OUTSRC: tên dự án ở cột `ten` (alias ten_du_an khi có).
 */

export function normalizeTenDuAn(ten) {
  return String(ten || "").trim().toLowerCase();
}

export function projectTenDuAn(project) {
  return String(project?.ten_du_an || project?.ten || "").trim();
}

/** Khóa nhóm công trình — theo tên dự án (gộp các giai đoạn cùng công trình). */
export function bgdGroupKeyForProject(project) {
  return normalizeTenDuAn(projectTenDuAn(project)) || project?.ma_du_an || "";
}
