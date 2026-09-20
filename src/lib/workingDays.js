/** Cộng N ngày làm việc (bỏ T7, CN) — dùng cho thoi_diem_lap PAKTKS (+5 từ NVKS) */
export function addWorkingDays(startDateStr, daysToAdd) {
  if (!startDateStr || daysToAdd <= 0) return startDateStr || "";
  const parts = String(startDateStr).slice(0, 10).split("-");
  if (parts.length !== 3) return startDateStr;
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (Number.isNaN(date.getTime())) return startDateStr;

  let added = 0;
  while (added < daysToAdd) {
    date.setDate(date.getDate() + 1);
    if (date.getDay() !== 0 && date.getDay() !== 6) added++;
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
