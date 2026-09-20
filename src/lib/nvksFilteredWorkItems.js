/**
 * Lọc hàng công việc NVKS/PAKTKS theo giai đoạn + loại hình (giống FormNVKS).
 */
import {
  isWorkItemApplicable,
  pruneOrphanSectionTitles,
  isRemovedDmRow,
} from "./nvksLoaiHinh";
import { mergeUserRowsIntoSubsections } from "./nvksCustomCongViec";

export function buildFilteredWorkItems(templateData, { giaiDoan, loaiHinh }, hiddenItems = new Set()) {
  if (!giaiDoan || !templateData?.length || !loaiHinh) return [];

  let romanCounter = 0;
  let subRomanCounter = 0;
  let mainCounter = 0;
  let subCounter = 0;

  const toRoman = (num) => {
    const roman = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
    return roman[num] || num;
  };

  const filtered = mergeUserRowsIntoSubsections(
    templateData.filter((item) => {
      if (isRemovedDmRow(item)) return false;
      if (hiddenItems.has(item.id_cong_viec)) return false;
      return isWorkItemApplicable(item, giaiDoan, loaiHinh);
    })
  );

  const mapped = filtered.map((item) => {
    let dynamicTT = item.tt;
    const loaiDong = (item.loai_dong || "").trim().toLowerCase();

    if (loaiDong === "tieu_de") {
      const isSubTitle = (item.tt || "").trim().includes(".");
      if (!isSubTitle) {
        romanCounter++;
        subRomanCounter = 0;
        dynamicTT = toRoman(romanCounter);
      } else {
        subRomanCounter++;
        dynamicTT = `${toRoman(romanCounter)}.${subRomanCounter}`;
      }
      mainCounter = 0;
      subCounter = 0;
    } else if (loaiDong === "cong_viec_con") {
      subCounter++;
      dynamicTT = `${mainCounter}.${subCounter}`;
    } else {
      mainCounter++;
      subCounter = 0;
      dynamicTT = mainCounter.toString();
    }

    return { ...item, dynamicTT };
  });

  return pruneOrphanSectionTitles(mapped);
}
