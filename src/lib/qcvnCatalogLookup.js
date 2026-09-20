/**
 * Tra cứu catalog QCVN 02:2022/BXD (JSON trong src/data) — phục vụ mục 2.3 BCKS.
 */
import bang41 from "../data/bang41MatDoSetCatalog.json";
import bang51 from "../data/bang51PhanVungGioCatalog.json";
import bang61 from "../data/bang61DongDatAgRCatalog.json";
import bangA1 from "../data/bangA1ToaDoTramCatalog.json";
import bangA2 from "../data/bangA2NhietDoTbCatalog.json";
import bangA25 from "../data/bangA25LuongMuaTbCatalog.json";

function stripDiacritics(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

/** Chuẩn hóa tên tỉnh để so khớp giữa các bảng */
export function normalizeTinhKey(name) {
  let s = String(name || "").trim();
  s = s.replace(/^\d+\.\s*/, "");
  s = s.replace(/^(thanh pho|tp\.?|tinh)\s+/i, "");
  s = s.replace(/^thành phố\s+/i, "");
  s = s.replace(/^tp\.\s*/i, "");
  s = s.replace(/\s+/g, " ").trim().toLowerCase();
  return stripDiacritics(s);
}

export function displayTinhName(name) {
  return String(name || "")
    .replace(/^\d+\.\s*/, "")
    .replace(/^Thành phố\s+/i, "")
    .replace(/^TP\.\s*/i, "")
    .trim();
}

function tinhMatch(a, b) {
  const ka = normalizeTinhKey(a);
  const kb = normalizeTinhKey(b);
  if (!ka || !kb) return false;
  return ka === kb || ka.includes(kb) || kb.includes(ka);
}

function normPlace(s) {
  return stripDiacritics(String(s || "").toLowerCase())
    .replace(/^(huyen|thi xa|tx\.?|quan|tp\.?|thanh pho|thi tran|xa)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function placeScore(haystack, needle) {
  const h = normPlace(haystack);
  const n = normPlace(needle);
  if (!h || !n) return 0;
  if (h === n) return 100;
  if (h.includes(n) || n.includes(h)) return 70;
  return 0;
}

/** Danh sách tỉnh (nhãn hiển thị), gộp từ các bảng chính */
export function listQcvnTinhOptions() {
  const map = new Map();
  const add = (tinh) => {
    const key = normalizeTinhKey(tinh);
    if (!key) return;
    const label = displayTinhName(tinh);
    if (!map.has(key) || label.length < map.get(key).label.length) {
      map.set(key, { key, label, raw: tinh });
    }
  };
  for (const r of bang51.rows || []) add(r.tinh);
  for (const r of bang41.rows || []) add(r.tinh);
  for (const r of bang61.rows || []) add(r.tinh);
  for (const r of bangA1.rows || []) add(r.tinh);
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "vi"));
}

/** Địa danh gió (bảng 5.1) theo tỉnh */
export function listGioDiaDanhForTinh(tinh) {
  return (bang51.rows || [])
    .filter((r) => tinhMatch(r.tinh, tinh))
    .map((r) => ({
      dia_danh: r.dia_danh,
      vung: r.vung,
      w0_dan_m2: r.w0_dan_m2,
      v3s_50_ms: r.v3s_50_ms,
      v10m_50_ms: r.v10m_50_ms,
    }));
}

/** Quận/huyện động đất (bảng 6.1) theo tỉnh */
export function listDongDatDiaDanhForTinh(tinh) {
  return (bang61.rows || [])
    .filter((r) => tinhMatch(r.tinh, tinh))
    .map((r) => ({
      dia_danh: r.dia_danh,
      agR_x_g: r.agR_x_g,
      agR_label: r.agR_label,
    }));
}

/** Nhóm huyện mật độ sét (bảng 4.1) theo tỉnh */
export function listSetGroupsForTinh(tinh) {
  return (bang41.rows || [])
    .filter((r) => tinhMatch(r.tinh, tinh))
    .map((r) => ({
      dia_danh: r.dia_danh,
      mat_do_set: r.mat_do_set,
    }));
}

/** Trạm khí tượng (A.1) theo tỉnh */
export function listTramForTinh(tinh) {
  return (bangA1.rows || [])
    .filter((r) => tinhMatch(r.tinh, tinh))
    .map((r) => ({
      tram: r.tram,
      huyen: r.huyen,
      kinh_do: r.kinh_do,
      vi_do: r.vi_do,
      cao_do_m: r.cao_do_m,
      khu_vuc: r.khu_vuc,
    }));
}

export function lookupGio({ tinh, diaDanh }) {
  const rows = listGioDiaDanhForTinh(tinh);
  if (!rows.length) return null;
  if (!diaDanh) return rows[0];
  let best = null;
  let score = 0;
  for (const r of rows) {
    const sc = placeScore(r.dia_danh, diaDanh);
    if (sc > score) {
      score = sc;
      best = r;
    }
  }
  return best || rows[0];
}

export function lookupDongDat({ tinh, diaDanh }) {
  const rows = listDongDatDiaDanhForTinh(tinh);
  if (!rows.length) return null;
  if (!diaDanh) return rows[0];
  let best = null;
  let score = 0;
  for (const r of rows) {
    const sc = placeScore(r.dia_danh, diaDanh);
    if (sc > score) {
      score = sc;
      best = r;
    }
  }
  return best || rows[0];
}

export function lookupMatDoSet({ tinh, diaDanh }) {
  const groups = listSetGroupsForTinh(tinh);
  if (!groups.length) return null;
  if (!diaDanh) {
    return { ...groups[0], dia_danh_label: (groups[0].dia_danh || []).join(", ") };
  }
  let best = null;
  let score = 0;
  for (const g of groups) {
    for (const d of g.dia_danh || []) {
      const sc = placeScore(d, diaDanh);
      if (sc > score) {
        score = sc;
        best = g;
      }
    }
  }
  const pick = best || groups[0];
  return { ...pick, dia_danh_label: (pick.dia_danh || []).join(", ") };
}

function climateByTram(tramName) {
  const name = String(tramName || "").trim();
  if (!name) return null;
  const temp = (bangA2.rows || []).find((r) => normPlace(r.tram) === normPlace(name));
  const rain = (bangA25.rows || []).find((r) => normPlace(r.tram) === normPlace(name));
  if (!temp && !rain) return null;
  return {
    tram: name,
    nhiet_do_nam: temp?.nam ?? null,
    mua_nam: rain?.nam ?? null,
  };
}

export function lookupTram({ tinh, tram }) {
  const list = listTramForTinh(tinh);
  if (!list.length) return null;
  if (!tram) return { ...list[0], climate: climateByTram(list[0].tram) };
  const hit =
    list.find((r) => normPlace(r.tram) === normPlace(tram)) ||
    list.find((r) => placeScore(r.tram, tram) >= 70) ||
    list[0];
  return { ...hit, climate: climateByTram(hit.tram) };
}

/**
 * Ghép đoạn mục 2.3 từ kết quả tra cứu.
 * Giữ nguyên phần «Thủy văn - Địa hình» nếu đã có trong text cũ.
 */
export function buildMuc23TuNhienText({ tinh, diaDanhGio, diaDanhDongDat, diaDanhSet, tram, existingText } = {}) {
  const tinhLabel = displayTinhName(tinh) || "…";
  const gio = lookupGio({ tinh, diaDanh: diaDanhGio || diaDanhDongDat });
  const dd = lookupDongDat({ tinh, diaDanh: diaDanhDongDat || diaDanhGio });
  const set = lookupMatDoSet({ tinh, diaDanh: diaDanhSet || diaDanhDongDat || diaDanhGio });
  const st = lookupTram({ tinh, tram });

  const lines = [`- Khí tượng (theo QCVN 02:2022/BXD), địa bàn ${tinhLabel}:`];

  if (st) {
    const elev = st.cao_do_m != null ? `${st.cao_do_m} m` : "…";
    lines.push(
      `+ Trạm khí tượng tham chiếu: ${st.tram}${st.huyen ? ` (${st.huyen})` : ""} — kinh độ ${st.kinh_do}, vĩ độ ${st.vi_do}, cao độ ${elev}.`
    );
    if (st.climate?.nhiet_do_nam != null || st.climate?.mua_nam != null) {
      const bits = [];
      if (st.climate.nhiet_do_nam != null) bits.push(`nhiệt độ trung bình năm ${st.climate.nhiet_do_nam} °C`);
      if (st.climate.mua_nam != null) bits.push(`lượng mưa trung bình năm ${st.climate.mua_nam} mm`);
      lines.push(`+ ${bits.join("; ")}.`);
    }
  } else {
    lines.push("+ Trạm khí tượng tham chiếu: …");
  }

  if (gio) {
    lines.push(
      `+ Áp lực / vận tốc gió (Bảng 5.1): vùng ${gio.vung}; W₀ = ${gio.w0_dan_m2} daN/m² (3 s, 20 năm); V3s,50 = ${gio.v3s_50_ms} m/s; V10m,50 = ${gio.v10m_50_ms} m/s — địa danh: ${gio.dia_danh}.`
    );
  } else {
    lines.push("+ Áp lực / vận tốc gió: …");
  }

  if (set) {
    lines.push(
      `+ Mật độ sét đánh (Bảng 4.1): ${set.mat_do_set} lần/km²/năm — áp dụng nhóm địa danh: ${set.dia_danh_label}.`
    );
  } else {
    lines.push("+ Mật độ sét đánh: …");
  }

  if (dd) {
    lines.push(
      `+ Động đất (Bảng 6.1): đỉnh gia tốc nền tham chiếu agR = ${dd.agR_label || `${dd.agR_x_g}×g`} (chu kỳ lặp 500 năm, nền loại A) — địa danh: ${dd.dia_danh}.`
    );
  } else {
    lines.push("+ Động đất: …");
  }

  const existing = String(existingText || "");
  const hydroIdx = existing.search(/^- Thủy văn/im);
  if (hydroIdx >= 0) {
    lines.push(existing.slice(hydroIdx).trimEnd());
  } else {
    lines.push("- Thủy văn - Địa hình: …");
  }

  return lines.join("\n");
}

/** Gợi ý tỉnh từ chuỗi vị trí địa lý mục 2.2 */
export function guessTinhFromViTriText(text) {
  const s = String(text || "");
  if (!s.trim()) return null;
  const opts = listQcvnTinhOptions();
  let best = null;
  let score = 0;
  for (const o of opts) {
    const label = o.label;
    const re = new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    if (re.test(s)) {
      const sc = label.length;
      if (sc > score) {
        score = sc;
        best = o;
      }
    }
  }
  return best;
}
