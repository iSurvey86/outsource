/**
 * Forward VES Schlumberger 1D — từ mô hình lớp (ρ, h) → ρₐ(AB/2).
 * Dùng resistivity transform T(λ) (Koefoed) + lọc ngắn quanh λ≈1/(AB/2)
 * (đủ gần để minh họa như IPI2Win; không thay phần mềm chuyên dụng).
 */

function toNum(raw) {
  const s = String(raw ?? "")
    .trim()
    .replace(/\s/g, "");
  if (!s) return NaN;
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
    return Number(s.replace(/,/g, ""));
  }
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    return Number(s.replace(/\./g, "").replace(",", "."));
  }
  if (s.includes(",") && !s.includes(".")) {
    return Number(s.replace(",", "."));
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Parse bảng phân tích → lớp VES.
 * Lớp cuối: có ρ nhưng không có h → bán vô hạn (basement).
 * Nếu mọi lớp đều có h → lớp cuối vẫn coi bán vô hạn (chuẩn 1D).
 */
export function parseDoDtsVesLayers(phanTich) {
  const raw = [];
  for (const row of phanTich || []) {
    const rho = toNum(row?.rho);
    if (!(rho > 0)) continue;
    const h = toNum(row?.h);
    raw.push({ rho, h: h > 0 ? h : null });
  }
  if (!raw.length) return [];

  const layers = [];
  let cum = 0;
  for (let i = 0; i < raw.length; i++) {
    const isLast = i === raw.length - 1;
    const h = raw[i].h;
    if (isLast) {
      layers.push({ rho: raw[i].rho, h: Infinity, d: cum > 0 ? cum : 0, basement: true });
      break;
    }
    if (!(h > 0)) {
      layers.push({ rho: raw[i].rho, h: Infinity, d: cum > 0 ? cum : 0, basement: true });
      break;
    }
    cum += h;
    layers.push({ rho: raw[i].rho, h, d: cum, basement: false });
  }
  return layers;
}

/** T(λ) — resistivity transform, từ lớp đáy lên */
export function resistivityTransform(lambda, layers) {
  if (!layers?.length || !(lambda > 0)) return NaN;
  let t = layers[layers.length - 1].rho;
  for (let i = layers.length - 2; i >= 0; i--) {
    const r = layers[i].rho;
    const h = layers[i].h;
    if (!(Number.isFinite(h) && h > 0)) continue;
    const th = Math.tanh(lambda * h);
    t = (r * (t + r * th)) / (r + t * th);
  }
  return t;
}

/**
 * ρₐ tại một AB/2 — lọc ngắn quanh λ=1/s (mượt hơn T thuần).
 */
export function forwardRhoAAt(ab2, layers) {
  if (!(ab2 > 0) || !layers?.length) return NaN;
  const factors = [0.55, 0.75, 1, 1.35, 1.8];
  const weights = [0.08, 0.18, 0.48, 0.18, 0.08];
  let sum = 0;
  for (let i = 0; i < factors.length; i++) {
    sum += weights[i] * resistivityTransform(factors[i] / ab2, layers);
  }
  return sum;
}

/** Log-spaced AB/2 từ xMin → xMax */
export function logSpace(xMin, xMax, count = 48) {
  const a = Math.log(xMin);
  const b = Math.log(xMax);
  const n = Math.max(8, count);
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(Math.exp(a + ((b - a) * i) / (n - 1)));
  }
  return out;
}

/** Chuỗi đường lý thuyết (đỏ) */
export function buildDoDtsTheorySeries(phanTich, ab2List) {
  const layers = parseDoDtsVesLayers(phanTich);
  if (layers.length < 1 || !ab2List?.length) return [];
  return ab2List
    .map((ab2) => {
      const rho = forwardRhoAAt(ab2, layers);
      if (!(rho > 0)) return null;
      return { ab2, rho };
    })
    .filter(Boolean);
}

/**
 * Đường mô hình bậc (xanh): ρ thật theo độ sâu d trên trục AB/2.
 * Kéo dài lớp cuối (basement) tới xMax.
 */
export function buildDoDtsModelStepSeries(phanTich, xMin, xMax) {
  const layers = parseDoDtsVesLayers(phanTich);
  if (!layers.length) return [];

  const finite = layers.filter((l) => !l.basement && l.d > 0);
  const basement = layers.find((l) => l.basement) || layers[layers.length - 1];
  const startX = Math.min(xMin, finite[0]?.d ? finite[0].d * 0.15 : xMin);

  const pts = [];

  if (finite.length) {
    pts.push({ ab2: startX, rho: finite[0].rho });
    for (let i = 0; i < finite.length; i++) {
      const layer = finite[i];
      pts.push({ ab2: layer.d, rho: layer.rho });
      const nextRho = i + 1 < finite.length ? finite[i + 1].rho : basement.rho;
      if (nextRho !== layer.rho) {
        pts.push({ ab2: layer.d, rho: nextRho });
      }
    }
  } else {
    pts.push({ ab2: startX, rho: basement.rho });
  }

  const lastX = pts[pts.length - 1]?.ab2 ?? startX;
  const endX = Math.max(xMax, lastX * 1.01);
  pts.push({ ab2: endX, rho: basement.rho });
  return pts;
}

/** Domain thập kỷ log kiểu Excel (1–100, 100–1000…) */
export function decadeDomain(values, padLo = 1, padHi = 1) {
  const pos = (values || []).filter((v) => v > 0);
  if (!pos.length) return [padLo, padHi];
  const lo = Math.min(...pos);
  const hi = Math.max(...pos);
  let xMin = 10 ** Math.floor(Math.log10(lo));
  let xMax = 10 ** Math.ceil(Math.log10(hi));
  if (xMin === xMax) {
    xMin = 10 ** (Math.floor(Math.log10(lo)) - 1);
    xMax = 10 ** (Math.ceil(Math.log10(hi)) + 1);
  }
  // Ít nhất 1 thập kỷ (kiểu Excel 100–1000)
  if (Math.log10(xMax) - Math.log10(xMin) < 1) {
    xMax = xMin * 100;
  }
  return [xMin, xMax];
}
