/**
 * Đối chiếu số học bảng giá hợp đồng sau khi quét AI.
 *
 * Bối cảnh: một dòng của "BẢNG GIÁ HỢP ĐỒNG" thường bằng tổng của nhiều bảng chi tiết
 * (ví dụ Khảo sát giai đoạn BCNCKT = BẢNG 3.1 khảo sát + BẢNG 4 thỏa thuận, thu thập số liệu).
 * Khi AI chỉ đọc được một bảng chi tiết, tổng các khoản sẽ thiếu so với tổng giai đoạn.
 * Các hàm dưới đây tìm đúng bảng chi tiết còn thiếu để bù vào, thay vì chia số tuỳ tiện.
 */

/** Chênh lệch dưới ngưỡng này coi như làm tròn, không xử lý. */
export const MONEY_TOLERANCE = 1;

export const KHOAN_MUC_LABEL = {
  gia_tri_ks: "Khảo sát",
  gia_tri_ks_dia_hinh: "Khảo sát địa hình",
  gia_tri_ks_dia_chat: "Khảo sát địa chất",
  gia_tri_ks_khac: "Khảo sát khác/thỏa thuận",
  gia_tri_lap_hs: "Lập Hồ sơ Thiết kế",
  gia_tri_ctdt: "Chủ trương Đầu tư",
};

/** Chuỗi tiền → số thuần (1.234.567 / 1,234,567 → 1234567). */
export function toMoneyNumber(raw) {
  const s0 =
    raw && typeof raw === "object" && "value" in raw
      ? String(raw.value ?? "").trim()
      : String(raw ?? "").trim();
  if (!s0) return null;
  const s = s0.replace(/[^\d.,-]/g, "");
  if (!s) return null;
  const normalized = s.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function formatVnMoney(n) {
  return Math.round(n).toLocaleString("vi-VN");
}

export function normalizeGiaiDoanKey(raw) {
  const s = String(raw || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  if (!s) return "";
  if (s.includes("TKBVTC") || s.includes("TKKT")) return "TKBVTC";
  if (s.includes("BCKTKT")) return "BCKTKT";
  if (s.includes("FS") || s.includes("BCNCKT")) return "FS";
  return s;
}

export function normalizeKhoanMuc(raw) {
  const s = String(raw || "").toLowerCase();
  if (!s) return "";
  if (/thỏa\s*thuận|thoa\s*thuan|thu\s*thập|thu\s*thap|scada|f87l|f79|khac/.test(s)) return "gia_tri_ks_khac";
  if (/địa\s*hình|dia\s*hinh/.test(s)) return "gia_tri_ks_dia_hinh";
  if (/địa\s*chất|dia\s*chat|khoan|thí\s*nghiệm\s*mẫu/.test(s)) return "gia_tri_ks_dia_chat";
  if (/(^|[^a-z])ks([^a-z]|$)|khảo\s*sát|khao\s*sat/.test(s)) return "gia_tri_ks";
  if (/ctdt|chủ\s*trương|chu\s*truong|chấp\s*thuận|chap\s*thuan/.test(s)) return "gia_tri_ctdt";
  if (/lap_hs|lập|thiết\s*kế|thiet\s*ke|bcnckt|tkbvtc|tkkt/.test(s)) return "gia_tri_lap_hs";
  return "";
}

/** Chuẩn hoá danh mục bảng chi tiết do AI trả về. */
export function normalizeBangChiTiet(list) {
  return (Array.isArray(list) ? list : [])
    .map((t) => ({
      ten_bang: String(t?.ten_bang || "").trim(),
      tieu_de: String(t?.tieu_de || "").trim(),
      tong: toMoneyNumber(t?.tong),
      giai_doan: String(t?.giai_doan || "").trim(),
      khoan_muc: String(t?.khoan_muc || "").trim(),
      trang: toMoneyNumber(t?.trang) != null ? Math.round(toMoneyNumber(t.trang)) : null,
    }))
    .filter((t) => t.tong != null && t.tong > 0);
}

const KHAO_SAT_NHOM_FIELD = {
  dia_hinh: "gia_tri_ks_dia_hinh",
  dia_chat: "gia_tri_ks_dia_chat",
  khac: "gia_tri_ks_khac",
};

/** Phân nhóm một dòng khảo sát dựa vào nhãn nhóm, đề mục rồi mới đến nội dung. */
export function classifyKhaoSatNhom(row) {
  const truc_tiep = String(row?.nhom || "").toLowerCase().replace(/[^a-z_]/g, "");
  if (KHAO_SAT_NHOM_FIELD[truc_tiep]) return KHAO_SAT_NHOM_FIELD[truc_tiep];
  const suyDoan = normalizeKhoanMuc(`${row?.de_muc || ""} ${row?.noi_dung || ""}`);
  return KHAO_SAT_NHOM_FIELD.dia_hinh === suyDoan ||
    KHAO_SAT_NHOM_FIELD.dia_chat === suyDoan ||
    KHAO_SAT_NHOM_FIELD.khac === suyDoan
    ? suyDoan
    : "";
}

/**
 * Cộng từng dòng khảo sát thành ba nhóm, theo giai đoạn.
 * LLM đếm/cộng nhiều dòng rất dễ sai nên phần cộng đặt ở đây.
 */
export function aggregateKhaoSatChiTiet(rows) {
  const byPhase = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const tien = toMoneyNumber(row?.thanh_tien);
    if (tien == null || tien <= 0) continue;
    const field = classifyKhaoSatNhom(row);
    if (!field) continue;
    const key = normalizeGiaiDoanKey(row?.giai_doan);
    if (!byPhase.has(key)) {
      byPhase.set(key, {
        gia_tri_ks_dia_hinh: 0,
        gia_tri_ks_dia_chat: 0,
        gia_tri_ks_khac: 0,
        soDong: 0,
      });
    }
    const acc = byPhase.get(key);
    acc[field] += tien;
    acc.soDong += 1;
  }
  return byPhase;
}

/** Chuẩn hoá danh mục dòng khảo sát chi tiết do AI trả về. */
export function normalizeKhaoSatChiTiet(list) {
  return (Array.isArray(list) ? list : [])
    .map((r) => ({
      giai_doan: String(r?.giai_doan || "").trim(),
      nhom: String(r?.nhom || "").trim(),
      de_muc: String(r?.de_muc || "").trim(),
      noi_dung: String(r?.noi_dung || "").trim().slice(0, 120),
      thanh_tien: toMoneyNumber(r?.thanh_tien),
      trang: toMoneyNumber(r?.trang) != null ? Math.round(toMoneyNumber(r.trang)) : null,
    }))
    .filter((r) => r.thanh_tien != null && r.thanh_tien > 0);
}

/** Tìm tổ hợp tối đa `maxSize` bảng chi tiết có tổng đúng bằng phần còn thiếu. */
export function findSubsetSum(items, target, maxSize = 3) {
  const sorted = [...items].sort((a, b) => b.tong - a.tong);
  const picked = [];
  let found = null;

  const dfs = (start, remaining) => {
    if (found) return;
    if (picked.length && Math.abs(remaining) <= MONEY_TOLERANCE) {
      found = picked.slice();
      return;
    }
    if (picked.length >= maxSize || remaining <= MONEY_TOLERANCE) return;
    for (let i = start; i < sorted.length; i += 1) {
      if (sorted[i].tong > remaining + MONEY_TOLERANCE) continue;
      picked.push(sorted[i]);
      dfs(i + 1, remaining - sorted[i].tong);
      picked.pop();
      if (found) return;
    }
  };

  dfs(0, target);
  return found;
}

/**
 * Bù phần thiếu của một giai đoạn bằng bảng chi tiết chưa được dùng.
 * Trả về bản sao của `phase`, kèm `nguon_ghi_chu` khi bù được hoặc `canh_bao` khi không.
 */
export function reconcilePhaseValues(phase, tables = [], khaoSatTong = null) {
  const next = { ...phase };
  const ksDetailKeys = ["gia_tri_ks_dia_hinh", "gia_tri_ks_dia_chat", "gia_tri_ks_khac"];

  // Ưu tiên số do server cộng từ từng dòng khảo sát; chỉ dùng khi AI chưa tự tách.
  if (khaoSatTong) {
    for (const key of ksDetailKeys) {
      if (toMoneyNumber(next[key]) == null && khaoSatTong[key] > 0) {
        next[key] = String(khaoSatTong[key]);
      }
    }
  }

  const ksDetails = Object.fromEntries(ksDetailKeys.map((key) => [key, toMoneyNumber(next[key])]));
  const hasKsDetail = Object.values(ksDetails).some((n) => n != null);
  const ksDetailSum = Object.values(ksDetails).reduce((sum, n) => sum + (n || 0), 0);
  const ksTongDocDuoc = toMoneyNumber(next.gia_tri_ks);

  if (hasKsDetail && ksTongDocDuoc == null) {
    next.gia_tri_ks = String(ksDetailSum);
  } else if (hasKsDetail && ksTongDocDuoc - ksDetailSum > MONEY_TOLERANCE) {
    const ksKhac = ksTongDocDuoc - ksDetailSum;
    const phaseKey = normalizeGiaiDoanKey(next.giai_doan);
    const bangKhac = tables.filter((t) => {
      const tKey = normalizeGiaiDoanKey(t.giai_doan);
      return (
        (!tKey || !phaseKey || tKey === phaseKey) &&
        normalizeKhoanMuc(t.khoan_muc || t.tieu_de || t.ten_bang) === "gia_tri_ks_khac"
      );
    });
    const subsetKhac = findSubsetSum(bangKhac, ksKhac);
    if (subsetKhac) {
      const tenBang = subsetKhac.map((t) => t.ten_bang || t.tieu_de).filter(Boolean).join(" + ");
      next.gia_tri_ks_khac = String((ksDetails.gia_tri_ks_khac || 0) + ksKhac);
      next.nguon_ghi_chu = `Khảo sát khác/thỏa thuận: ${tenBang || "bảng chi tiết"} = ${formatVnMoney(ksKhac)} đ.`;
    } else {
      next.canh_bao = `Chi tiết ba nhóm khảo sát thiếu ${formatVnMoney(ksKhac)} đ so với tổng Khảo sát — chưa xác định được bảng nguồn.`;
    }
  } else if (hasKsDetail && ksDetailSum - ksTongDocDuoc > MONEY_TOLERANCE) {
    next.canh_bao = `Tổng ba nhóm khảo sát vượt tổng Khảo sát ${formatVnMoney(ksDetailSum - ksTongDocDuoc)} đ.`;
  }

  const tong = toMoneyNumber(phase.gia_tri_hd);
  const parts = {
    gia_tri_ks: toMoneyNumber(next.gia_tri_ks),
    gia_tri_lap_hs: toMoneyNumber(next.gia_tri_lap_hs),
    gia_tri_ctdt: toMoneyNumber(next.gia_tri_ctdt),
  };
  const known = Object.values(parts).filter((n) => n != null);
  if (tong == null || !known.length) return next;

  const thieu = tong - known.reduce((a, b) => a + b, 0);
  if (Math.abs(thieu) <= MONEY_TOLERANCE) return next;

  if (thieu < 0) {
    return {
      ...next,
      canh_bao: `Tổng các khoản vượt giá trị giai đoạn ${formatVnMoney(-thieu)} đ — kiểm tra lại bảng giá.`,
    };
  }

  const phaseKey = normalizeGiaiDoanKey(phase.giai_doan);
  const chuaDung = tables.filter((t) => {
    if (!(t.tong > 0)) return false;
    const tKey = normalizeGiaiDoanKey(t.giai_doan);
    if (tKey && phaseKey && tKey !== phaseKey) return false;
    if (Math.abs(t.tong - tong) <= MONEY_TOLERANCE) return false;
    return !known.some((n) => Math.abs(t.tong - n) <= MONEY_TOLERANCE);
  });

  const subset = findSubsetSum(chuaDung, thieu);
  if (!subset) {
    return {
      ...next,
      canh_bao: `Tổng các khoản thiếu ${formatVnMoney(thieu)} đ so với giá trị giai đoạn — chưa tìm được bảng chi tiết tương ứng, kiểm tra lại bảng giá.`,
    };
  }

  const target =
    subset.map((t) => normalizeKhoanMuc(t.khoan_muc || t.tieu_de || t.ten_bang)).find(Boolean) ||
    "gia_tri_ks_khac";
  const tenBang = subset.map((t) => t.ten_bang || t.tieu_de).filter(Boolean).join(" + ");
  const isKsDetail = ksDetailKeys.includes(target);

  return {
    ...next,
    [target]: String((toMoneyNumber(next[target]) || 0) + thieu),
    ...(isKsDetail ? { gia_tri_ks: String((parts.gia_tri_ks || 0) + thieu) } : {}),
    nguon_ghi_chu: `${KHOAN_MUC_LABEL[target]}: đã cộng thêm ${tenBang || "bảng chi tiết"} = ${formatVnMoney(thieu)} đ cho khớp tổng giai đoạn.`,
  };
}
