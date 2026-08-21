/**
 * Chiết giảm TNCTTT (thu nhập chịu thuế tính trước) trên hợp đồng.
 * Số bảng CT / phụ lục thường là gross (I+II); điều khoản trước VAT = net sau % giảm.
 */

import { MONEY_TOLERANCE, toMoneyNumber } from "./hopDongBangGia";
import { numOrNull } from "./hopDongThucHien";

/** @typedef {{ ty_le: number|null, so_tien: number|null, so_tien_truoc_giam: number|null, ghi_chu: string, co_chiet_giam: boolean }} ChietGiamTncttt */

export function emptyChietGiamTncttt(partial = {}) {
  return {
    co_chiet_giam: Boolean(partial.co_chiet_giam),
    ty_le: partial.ty_le != null && partial.ty_le !== "" ? Number(partial.ty_le) : null,
    so_tien: partial.so_tien != null && partial.so_tien !== "" ? Number(partial.so_tien) : null,
    so_tien_truoc_giam:
      partial.so_tien_truoc_giam != null && partial.so_tien_truoc_giam !== ""
        ? Number(partial.so_tien_truoc_giam)
        : null,
    ghi_chu: String(partial.ghi_chu || "").trim(),
  };
}

/** Chuẩn hoá từ AI / form / DB jsonb. */
export function normalizeChietGiamTncttt(raw) {
  if (raw == null || raw === "") return emptyChietGiamTncttt();
  if (typeof raw === "string") {
    try {
      return normalizeChietGiamTncttt(JSON.parse(raw));
    } catch {
      return emptyChietGiamTncttt();
    }
  }
  const tyLe = toMoneyNumber(raw.ty_le ?? raw.tyLe ?? raw.percent);
  const soTien = toMoneyNumber(raw.so_tien ?? raw.soTien ?? raw.gia_tri);
  const truocGiam = toMoneyNumber(
    raw.so_tien_truoc_giam ?? raw.soTienTruocGiam ?? raw.gross ?? raw.tong_truoc_giam
  );
  const ghiChu = String(raw.ghi_chu || raw.ghiChu || raw.note || "").trim();
  const co =
    raw.co_chiet_giam === true ||
    raw.co_chiet_giam === "true" ||
    Boolean(tyLe && tyLe > 0) ||
    Boolean(soTien && soTien > 0);
  const next = emptyChietGiamTncttt({
    co_chiet_giam: co,
    ty_le: tyLe != null && tyLe > 0 ? tyLe : null,
    so_tien: soTien != null && soTien > 0 ? Math.round(soTien) : null,
    so_tien_truoc_giam: truocGiam != null && truocGiam > 0 ? Math.round(truocGiam) : null,
    ghi_chu: ghiChu,
  });
  if (!next.co_chiet_giam) return emptyChietGiamTncttt();
  return next;
}

/** Ghi DB: null nếu không có chiết giảm. */
export function normalizeChietGiamTnctttForDb(raw) {
  const n = normalizeChietGiamTncttt(raw);
  if (!n.co_chiet_giam) return null;
  if (n.ty_le == null && n.so_tien == null) return null;
  return {
    ty_le: n.ty_le,
    so_tien: n.so_tien,
    so_tien_truoc_giam: n.so_tien_truoc_giam,
    ghi_chu: n.ghi_chu || undefined,
  };
}

export function applyPercentDiscount(amount, tyLePct) {
  const a = typeof amount === "number" ? amount : toMoneyNumber(amount);
  const r = typeof tyLePct === "number" ? tyLePct : toMoneyNumber(tyLePct);
  if (a == null || r == null || r <= 0) return a;
  return Math.round(a * (1 - r / 100));
}

/**
 * Σ bảng CT đang là gross và gross×(1−r) ≈ trước VAT điều khoản → nên scale.
 */
export function shouldApplyTnctttScale(rowsSum, truocVat, tyLePct) {
  const sum = typeof rowsSum === "number" ? rowsSum : toMoneyNumber(rowsSum);
  const legal = typeof truocVat === "number" ? truocVat : toMoneyNumber(truocVat);
  const r = typeof tyLePct === "number" ? tyLePct : toMoneyNumber(tyLePct);
  if (sum == null || legal == null || r == null || r <= 0 || sum <= 0) return false;
  if (Math.abs(sum - legal) <= MONEY_TOLERANCE) return false;
  const net = applyPercentDiscount(sum, r);
  return net != null && Math.abs(net - legal) <= MONEY_TOLERANCE;
}

const SCALE_FIELDS_HD_ONLY = ["gia_tri_hd"];

/** Scale chỉ cột Giá trị HĐ (net). KS / Lập HS / CTĐT giữ gross theo bảng dự toán. */
export function scaleKhoiLuongRowByTncttt(row, tyLePct) {
  const r = typeof tyLePct === "number" ? tyLePct : toMoneyNumber(tyLePct);
  if (r == null || r <= 0 || !row) return row;
  const next = { ...row };
  for (const f of SCALE_FIELDS_HD_ONLY) {
    const n = numOrNull(next[f]);
    if (n != null && n > 0) next[f] = String(applyPercentDiscount(n, r));
  }
  return next;
}

export function scaleKhoiLuongRowsByTncttt(rows, tyLePct) {
  return (rows || []).map((row) => scaleKhoiLuongRowByTncttt(row, tyLePct));
}

/** Scale số tiền trong phụ lục TBA / giai đoạn (object money strings). */
export function scaleMoneyFieldsInObject(obj, fields, tyLePct) {
  if (!obj) return obj;
  const r = typeof tyLePct === "number" ? tyLePct : toMoneyNumber(tyLePct);
  if (r == null || r <= 0) return obj;
  const next = { ...obj };
  for (const f of fields) {
    const n = toMoneyNumber(next[f]);
    if (n != null && n > 0) next[f] = String(applyPercentDiscount(n, r));
  }
  return next;
}

/** Phụ lục: chỉ đưa gia_tri_tong → net; KS / lập giữ gross. */
const PHU_LUC_NET_FIELDS = ["gia_tri_tong"];

/** Giai đoạn / root: chỉ gia_tri_hd → net. */
const PHASE_NET_FIELDS = ["gia_tri_hd"];

/**
 * Lệch phân rã − HĐ có khớp % TNCTTT không? (KS+Lập gross, HĐ net).
 */
export function isTnctttExplainedPhanRaGap(chenh, tongPhanRa, tyLePct) {
  const gap = typeof chenh === "number" ? chenh : toMoneyNumber(chenh);
  const gross = typeof tongPhanRa === "number" ? tongPhanRa : toMoneyNumber(tongPhanRa);
  const r = typeof tyLePct === "number" ? tyLePct : toMoneyNumber(tyLePct);
  if (gap == null || gross == null || r == null || r <= 0 || gross <= 0) return false;
  if (gap <= 0) return false;
  const expected = Math.round(gross * (r / 100));
  return Math.abs(gap - expected) <= MONEY_TOLERANCE;
}

/**
 * Số chiết giảm TNCTTT trên bảng sổ **theo giai đoạn / CT đang xem**.
 * Không dùng `so_tien` cấp cả HĐ (thường là tổng nhiều CT — vd. 208Tr) —
 * ưu tiên: gross phân rã − GTHĐ net, hoặc gross × %.
 *
 * @returns {number|null}
 */
export function resolveChietGiamTnctttPhaseAmount({
  tongPhanRa,
  giaTriHd,
  chietGiam = null,
  defaultTyLe = 6,
} = {}) {
  const chiet = normalizeChietGiamTncttt(chietGiam);
  const gross = toMoneyNumber(tongPhanRa);
  const net = toMoneyNumber(giaTriHd);
  const tyLe =
    chiet.ty_le != null && chiet.ty_le > 0
      ? chiet.ty_le
      : chiet.co_chiet_giam
        ? defaultTyLe
        : null;

  if (gross != null && net != null && gross > net) {
    return Math.round(gross - net);
  }
  if (tyLe != null && gross != null && gross > 0) {
    return Math.round((gross * tyLe) / 100);
  }
  return null;
}

/**
 * Hậu xử lý sau AI: nếu tổng phụ lục/giai đoạn là gross khớp công thức TNCTTT với điều khoản,
 * scale số về net và bổ sung metadata chiết giảm.
 */
export function postProcessTnctttAfterParse({
  chietGiamRaw,
  truocVat,
  phuLucCongTrinh = [],
  giaiDoanValues = [],
  rootMoney = {},
}) {
  let chiet = normalizeChietGiamTncttt(chietGiamRaw);
  const legal = toMoneyNumber(truocVat);

  const sumPhuLuc = (phuLucCongTrinh || []).reduce((s, r) => {
    const tong =
      toMoneyNumber(r.gia_tri_tong) ??
      (toMoneyNumber(r.gia_tri_ks) || 0) +
        (toMoneyNumber(r.gia_tri_lap_bcnckt) || 0) +
        (toMoneyNumber(r.gia_tri_lap_tkbvtc) || 0);
    return s + (tong || 0);
  }, 0);

  const sumPhase = (giaiDoanValues || []).reduce(
    (s, g) => s + (toMoneyNumber(g.gia_tri_hd) || 0),
    0
  );

  const grossCandidate =
    sumPhuLuc > 0 ? sumPhuLuc : sumPhase > 0 ? sumPhase : toMoneyNumber(rootMoney.gia_tri_hd);

  // Suy % nếu AI chỉ ghi chú điều khoản «không gồm TNCTTT 6%»
  if ((!chiet.ty_le || chiet.ty_le <= 0) && grossCandidate != null && legal != null && grossCandidate > legal) {
    const implied = ((grossCandidate - legal) / grossCandidate) * 100;
    if (Math.abs(implied - 6) < 0.15) {
      chiet = normalizeChietGiamTncttt({
        ...chiet,
        co_chiet_giam: true,
        ty_le: 6,
        so_tien_truoc_giam: grossCandidate,
        so_tien: Math.round(grossCandidate - legal),
        ghi_chu: chiet.ghi_chu || "Suy từ lệch tổng bảng vs điều khoản (TNCTTT ~6%)",
      });
    }
  }

  if (!chiet.co_chiet_giam || !chiet.ty_le) {
    return {
      chiet_giam_tncttt: chiet.co_chiet_giam ? chiet : emptyChietGiamTncttt(),
      phu_luc_cong_trinh: phuLucCongTrinh,
      giai_doan_values: giaiDoanValues,
      rootMoney,
      scaled: false,
    };
  }

  const tyLe = chiet.ty_le;
  const needScale = shouldApplyTnctttScale(grossCandidate, legal, tyLe);

  let nextPhuLuc = phuLucCongTrinh;
  let nextPhases = giaiDoanValues;
  let nextRoot = { ...rootMoney };
  let scaled = false;

  if (needScale) {
    scaled = true;
    // Chỉ net hóa tổng/HĐ — giữ KS & lập gross để đối chiếu bảng dự toán.
    nextPhuLuc = (phuLucCongTrinh || []).map((row) => {
      const scaledRow = scaleMoneyFieldsInObject(row, PHU_LUC_NET_FIELDS, tyLe);
      // Nếu thiếu gia_tri_tong: suy net từ KS+lập gross
      if (!toMoneyNumber(scaledRow.gia_tri_tong)) {
        const grossRow =
          (toMoneyNumber(row.gia_tri_ks) || 0) +
          (toMoneyNumber(row.gia_tri_lap_bcnckt) || 0) +
          (toMoneyNumber(row.gia_tri_lap_tkbvtc) || 0);
        if (grossRow > 0) {
          scaledRow.gia_tri_tong = String(applyPercentDiscount(grossRow, tyLe));
        }
      }
      return scaledRow;
    });
    nextPhases = (giaiDoanValues || []).map((g) =>
      scaleMoneyFieldsInObject(g, PHASE_NET_FIELDS, tyLe)
    );
    for (const f of PHASE_NET_FIELDS) {
      if (nextRoot[f]) {
        const n = toMoneyNumber(nextRoot[f]);
        if (n != null && n > 0) nextRoot[f] = String(applyPercentDiscount(n, tyLe));
      }
    }
    const gross = Math.round(grossCandidate);
    const soTien =
      chiet.so_tien != null
        ? chiet.so_tien
        : legal != null
          ? Math.round(gross - legal)
          : Math.round(gross - applyPercentDiscount(gross, tyLe));
    chiet = normalizeChietGiamTncttt({
      ...chiet,
      co_chiet_giam: true,
      so_tien_truoc_giam: chiet.so_tien_truoc_giam || gross,
      so_tien: soTien,
      ghi_chu:
        chiet.ghi_chu ||
        `Giá trị HĐ = net sau ${tyLe}% TNCTTT; cột KS/Lập giữ số gross bảng dự toán`,
    });
  } else if (chiet.so_tien_truoc_giam == null && grossCandidate != null) {
    // Đã net sẵn trên tổng — vẫn lưu metadata nếu AI có %
    chiet = normalizeChietGiamTncttt({
      ...chiet,
      so_tien_truoc_giam:
        legal != null && chiet.ty_le
          ? Math.round(legal / (1 - chiet.ty_le / 100))
          : grossCandidate,
      so_tien:
        chiet.so_tien ||
        (legal != null && chiet.so_tien_truoc_giam
          ? Math.round(chiet.so_tien_truoc_giam - legal)
          : null),
      ghi_chu:
        chiet.ghi_chu ||
        `HĐ có TNCTTT ${tyLe}% — cột HĐ net; KS/Lập gross nếu đọc được từ bảng chi tiết`,
    });
  }

  return {
    chiet_giam_tncttt: chiet,
    phu_luc_cong_trinh: nextPhuLuc,
    giai_doan_values: nextPhases,
    rootMoney: nextRoot,
    scaled,
  };
}

/**
 * Đối chiếu sau khi đã biết chiết giảm:
 * combined (CT + chung) vs trước VAT; nếu lệch nhưng gross − chiết giảm khớp → coi như OK.
 */
export function evaluateTnctttReconcile({ rowsSum, chiPhiChungSum = 0, truocVat, chietGiam }) {
  const rows = toMoneyNumber(rowsSum);
  const chung = toMoneyNumber(chiPhiChungSum) || 0;
  const legal = toMoneyNumber(truocVat);
  const combined = rows != null ? rows + chung : chung > 0 ? chung : null;
  const chiet = normalizeChietGiamTncttt(chietGiam);

  const mismatch =
    combined != null && legal != null && Math.abs(combined - legal) > MONEY_TOLERANCE;

  if (!mismatch) {
    return { mismatch: false, combined, legal, chiet, explained: false };
  }

  // combined đang gross?
  if (chiet.ty_le && shouldApplyTnctttScale(combined, legal, chiet.ty_le)) {
    const net = applyPercentDiscount(combined, chiet.ty_le);
    return {
      mismatch: true,
      explained: true,
      combined,
      legal,
      netAfterTncttt: net,
      chiet,
      message: `Tổng bảng trước giảm ${combined} − TNCTTT ${chiet.ty_le}% ≈ ${net} (điều khoản ${legal}) — nên trừ chiết giảm / quét lại để điền net.`,
    };
  }

  // combined đã net nhưng còn lệch
  return {
    mismatch: true,
    explained: Boolean(chiet.co_chiet_giam),
    combined,
    legal,
    chiet,
    message: null,
  };
}
