/**
 * ScanKQ — schema prompt + merge kết quả lab vào Form BCKS Địa chất.
 */

import {
  BCKS_DIA_CHAT_FORMS,
  CO_LY_DAT_2_HAT_COLS,
  emptyDoDtsPhanTichRow,
  computeDoDtsRow,
  computeDoDtsPhanTichRows,
  emptyCoLyDat2SampleRow,
  emptyTnDaRow,
  TN_NUOC_DEFAULT_CHI_TIEU,
} from "./bcksFormRegistry";

export const BCKS_KQ_FORM_KEYS = ["co_ly_dat_2", "tn_nuoc", "tn_da", "do_dts"];

export function isBcksKqFormKey(key) {
  return BCKS_KQ_FORM_KEYS.includes(key);
}

function str(v) {
  if (v == null) return "";
  return String(v).trim();
}

/** Chuẩn hóa số lab: bỏ khoảng trắng nghìn, dấu phẩy thập phân → chấm khi cần giữ chuỗi form */
export function normalizeLabNumberString(raw) {
  let s = str(raw);
  if (!s) return "";
  s = s.replace(/\s/g, "");
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
    s = s.replace(/,/g, "");
  } else if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",") && !s.includes(".")) {
    s = s.replace(",", ".");
  }
  return s;
}

function pickFilled(scanned, existing) {
  const s = str(scanned);
  return s ? s : str(existing);
}

export function buildBcksKqPrompt(formKey) {
  const label = BCKS_DIA_CHAT_FORMS[formKey]?.label || formKey;
  const common = `
Bạn đọc phiếu/bảng KẾT QUẢ THÍ NGHIỆM / ĐO ĐẠC phòng lab (PDF, ảnh, hoặc bảng Excel đã chuyển thành text).
Biểu mẫu đích: «${label}» (form_key=${formKey}).

TRẢ VỀ DUY NHẤT JSON (không markdown, không giải thích).
Số thập phân: dùng dấu chấm trong JSON. Không bịa giá trị không có trên phiếu.
Thêm "confidence" (0-100) và "warning" (chuỗi, có thể rỗng).
`;

  if (formKey === "do_dts") {
    return `${common}
Schema:
{
  "ma_thiet_bi": "",
  "so_series": "",
  "diem_do": "",
  "rows": [
    { "ab2": "", "mn": "", "u_mv": "", "i_ma": "" }
  ],
  "phan_tich": [
    { "rho": "", "h": "" }
  ],
  "nguoi_do": "",
  "nguoi_kiem_tra": "",
  "confidence": 80,
  "warning": ""
}
- rows: bảng đo AB/2, MN, U (mV), I (mA). Đủ mọi dòng có số liệu. Không cần k/ρₖ/độ sâu (hệ thống tự tính).
- phan_tich: bảng phân lớp ρ, h nếu có trên phiếu giải tích; không có thì [].
`;
  }

  if (formKey === "tn_nuoc") {
    return `${common}
Schema:
{
  "lab_ten": "",
  "lab_phong": "",
  "lab_dia_chi": "",
  "don_vi_yeu_cau": "",
  "cong_trinh": "",
  "nguon_goc_mau": "",
  "ngay_gui_mau": "YYYY-MM-DD hoặc để trống",
  "ngay_thi_nghiem": "YYYY-MM-DD hoặc để trống",
  "chi_tieu": [
    { "chi_tieu": "tên chỉ tiêu", "yeu_cau": "", "ket_qua": "", "phuong_phap": "" }
  ],
  "ghi_chu": "",
  "nguoi_thi_nghiem": "",
  "phong_thi_nghiem": "",
  "pho_giam_doc": "",
  "confidence": 80,
  "warning": ""
}
- Ưu tiên khớp tên chỉ tiêu với: Độ pH, Cl⁻, SO₄²⁻, muối hòa tan, cặn không tan, chất hữu cơ, dầu mỡ.
- Chỉ điền ket_qua khi đọc được; giữ yeu_cau/phuong_phap nếu có trên phiếu.
`;
  }

  if (formKey === "tn_da") {
    return `${common}
Schema:
{
  "lab_ten": "",
  "lab_phong": "",
  "so_phieu": "",
  "lab_dia_chi": "",
  "pp_tn": "",
  "don_vi_yeu_cau": "",
  "du_an": "",
  "ngay_nhan_mau": "",
  "ngay_thi_nghiem": "",
  "rows": [
    {
      "so_hieu_tn": "", "lop": "", "vi_tri": "", "do_sau": "", "mo_ta_da": "",
      "w0": "", "ws": "", "r": "", "g0": "", "gs": "", "gc": "", "n": "",
      "g0_bh": "", "gs_bh": "", "dc": "", "dch": "", "k": ""
    }
  ],
  "nguoi_thi_nghiem": "",
  "truong_phong_tn": "",
  "pho_giam_doc": "",
  "confidence": 80,
  "warning": ""
}
- rows: mỗi mẫu đá một dòng; chỉ điền ô đọc được.
`;
  }

  // co_ly_dat_2
  const hatKeys = CO_LY_DAT_2_HAT_COLS.map((c) => c.key).join(", ");
  return `${common}
Schema:
{
  "du_an": "",
  "giai_doan": "",
  "rows": [
    {
      "type": "mau",
      "ho_khoan": "", "so_hieu_mau": "", "lop": "", "do_sau_tu": "", "do_sau_den": "",
      "w": "", "gamma_w": "", "gamma_bh": "", "gamma_k": "", "delta": "", "e0": "", "n": "", "g": "",
      "wch": "", "wd": "", "ip": "", "b": "", "phi_do": "", "phi_phut": "", "c": "", "a12": "", "phan_loai": "",
      ${CO_LY_DAT_2_HAT_COLS.map((c) => `"${c.key}": ""`).join(", ")}
    }
  ],
  "nguoi_lap": "",
  "nguoi_kiem_tra": "",
  "ngay": "",
  "confidence": 80,
  "warning": ""
}
- type "mau" cho dòng mẫu; "trung_binh" nếu là dòng TB lớp.
- Cột hạt (nếu có): ${hatKeys}.
- Chỉ điền ô đọc được; không bịa.
`;
}

/** Chuẩn hóa payload AI → object data sạch (không kèm confidence/warning) */
export function normalizeBcksKqPayload(formKey, raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const confidence = Number(src.confidence) || 0;
  const warning = str(src.warning);

  if (formKey === "do_dts") {
    const cleanRows = Array.isArray(src.rows)
      ? src.rows
          .map((r) =>
            computeDoDtsRow({
              ab2: normalizeLabNumberString(r?.ab2),
              mn: normalizeLabNumberString(r?.mn),
              u_mv: normalizeLabNumberString(r?.u_mv),
              i_ma: normalizeLabNumberString(r?.i_ma),
            })
          )
          .filter((r) => r.ab2 || r.mn || r.u_mv || r.i_ma)
      : [];
    const phan = Array.isArray(src.phan_tich)
      ? src.phan_tich
          .map((r) => ({
            ...emptyDoDtsPhanTichRow(),
            rho: normalizeLabNumberString(r?.rho),
            h: normalizeLabNumberString(r?.h),
          }))
          .filter((r) => r.rho || r.h)
      : [];
    return {
      data: {
        ma_thiet_bi: str(src.ma_thiet_bi),
        so_series: str(src.so_series),
        diem_do: str(src.diem_do),
        rows: cleanRows,
        phan_tich: phan.length ? computeDoDtsPhanTichRows(phan) : [],
        nguoi_do: str(src.nguoi_do),
        nguoi_kiem_tra: str(src.nguoi_kiem_tra),
      },
      confidence,
      warning,
      stats: { rows: cleanRows.length, phan_tich: phan.length },
    };
  }

  if (formKey === "tn_nuoc") {
    const chi = Array.isArray(src.chi_tieu)
      ? src.chi_tieu.map((r) => ({
          chi_tieu: str(r?.chi_tieu),
          yeu_cau: str(r?.yeu_cau),
          ket_qua: str(r?.ket_qua),
          phuong_phap: str(r?.phuong_phap),
        }))
      : [];
    return {
      data: {
        lab_ten: str(src.lab_ten),
        lab_phong: str(src.lab_phong),
        lab_dia_chi: str(src.lab_dia_chi),
        don_vi_yeu_cau: str(src.don_vi_yeu_cau),
        cong_trinh: str(src.cong_trinh),
        nguon_goc_mau: str(src.nguon_goc_mau),
        ngay_gui_mau: str(src.ngay_gui_mau),
        ngay_thi_nghiem: str(src.ngay_thi_nghiem),
        chi_tieu: chi,
        ghi_chu: str(src.ghi_chu),
        nguoi_thi_nghiem: str(src.nguoi_thi_nghiem),
        phong_thi_nghiem: str(src.phong_thi_nghiem),
        pho_giam_doc: str(src.pho_giam_doc),
      },
      confidence,
      warning,
      stats: { chi_tieu: chi.filter((c) => c.ket_qua).length },
    };
  }

  if (formKey === "tn_da") {
    const base = emptyTnDaRow();
    const rows = Array.isArray(src.rows)
      ? src.rows
          .map((r) => {
            const row = { ...base };
            for (const k of Object.keys(base)) {
              if (r?.[k] != null && str(r[k])) {
                row[k] = ["w0", "ws", "r", "g0", "gs", "gc", "n", "g0_bh", "gs_bh", "dc", "dch", "k", "do_sau"].includes(k)
                  ? normalizeLabNumberString(r[k])
                  : str(r[k]);
              }
            }
            return row;
          })
          .filter((r) => Object.values(r).some((v) => str(v)))
      : [];
    return {
      data: {
        lab_ten: str(src.lab_ten),
        lab_phong: str(src.lab_phong),
        so_phieu: str(src.so_phieu),
        lab_dia_chi: str(src.lab_dia_chi),
        pp_tn: str(src.pp_tn),
        don_vi_yeu_cau: str(src.don_vi_yeu_cau),
        du_an: str(src.du_an),
        ngay_nhan_mau: str(src.ngay_nhan_mau),
        ngay_thi_nghiem: str(src.ngay_thi_nghiem),
        rows,
        nguoi_thi_nghiem: str(src.nguoi_thi_nghiem),
        truong_phong_tn: str(src.truong_phong_tn),
        pho_giam_doc: str(src.pho_giam_doc),
      },
      confidence,
      warning,
      stats: { rows: rows.length },
    };
  }

  // co_ly_dat_2
  const rows = Array.isArray(src.rows)
    ? src.rows
        .map((r) => {
          const type = r?.type === "trung_binh" ? "trung_binh" : "mau";
          const row = emptyCoLyDat2SampleRow();
          row.type = type;
          for (const k of Object.keys(row)) {
            if (k === "type") continue;
            if (r?.[k] != null && str(r[k])) {
              row[k] = normalizeLabNumberString(r[k]) || str(r[k]);
              // text fields shouldn't be force-normalized wrongly
              if (["ho_khoan", "so_hieu_mau", "lop", "phan_loai"].includes(k)) {
                row[k] = str(r[k]);
              }
            }
          }
          return row;
        })
        .filter((r) =>
          Object.entries(r).some(([k, v]) => k !== "type" && str(v))
        )
    : [];
  return {
    data: {
      du_an: str(src.du_an),
      giai_doan: str(src.giai_doan),
      rows,
      nguoi_lap: str(src.nguoi_lap),
      nguoi_kiem_tra: str(src.nguoi_kiem_tra),
      ngay: str(src.ngay),
    },
    confidence,
    warning,
    stats: { rows: rows.length },
  };
}

/**
 * Merge scanned data vào formData. Giữ chữ ký nếu scan trống và form đã có.
 */
export function applyBcksKqScan(formData, formKey, scannedData) {
  if (!isBcksKqFormKey(formKey) || !scannedData || typeof scannedData !== "object") {
    return formData;
  }
  const next = structuredClone(formData);
  if (!next.chi_tiet_bcks) next.chi_tiet_bcks = { dia_chat: {} };
  if (!next.chi_tiet_bcks.dia_chat) next.chi_tiet_bcks.dia_chat = {};
  const cur = next.chi_tiet_bcks.dia_chat[formKey] || {};
  const s = scannedData;

  if (formKey === "do_dts") {
    const signKeys = ["nguoi_do", "nguoi_kiem_tra"];
    const merged = { ...cur };
    for (const k of ["ma_thiet_bi", "so_series", "diem_do"]) {
      if (str(s[k])) merged[k] = str(s[k]);
    }
    for (const k of signKeys) {
      merged[k] = pickFilled(s[k], cur[k]);
    }
    if (Array.isArray(s.rows) && s.rows.length) {
      merged.rows = s.rows.map((r) => computeDoDtsRow(r || {}));
    }
    if (Array.isArray(s.phan_tich) && s.phan_tich.length) {
      merged.phan_tich = computeDoDtsPhanTichRows(s.phan_tich);
    }
    next.chi_tiet_bcks.dia_chat.do_dts = merged;
    return next;
  }

  if (formKey === "tn_nuoc") {
    const merged = { ...cur };
    for (const k of [
      "lab_ten",
      "lab_phong",
      "lab_dia_chi",
      "don_vi_yeu_cau",
      "cong_trinh",
      "nguon_goc_mau",
      "ngay_gui_mau",
      "ngay_thi_nghiem",
      "ghi_chu",
    ]) {
      if (str(s[k])) merged[k] = str(s[k]);
    }
    for (const k of ["nguoi_thi_nghiem", "phong_thi_nghiem", "pho_giam_doc"]) {
      merged[k] = pickFilled(s[k], cur[k]);
    }
    if (Array.isArray(s.chi_tieu) && s.chi_tieu.length) {
      const base = (cur.chi_tieu?.length ? cur.chi_tieu : TN_NUOC_DEFAULT_CHI_TIEU).map((r) => ({
        ...r,
      }));
      const byName = new Map(
        s.chi_tieu.map((r) => [str(r.chi_tieu).toLowerCase(), r])
      );
      for (const row of base) {
        const hit = byName.get(str(row.chi_tieu).toLowerCase());
        if (hit) {
          if (str(hit.ket_qua)) row.ket_qua = str(hit.ket_qua);
          if (str(hit.yeu_cau)) row.yeu_cau = str(hit.yeu_cau);
          if (str(hit.phuong_phap)) row.phuong_phap = str(hit.phuong_phap);
        }
      }
      // thêm chỉ tiêu mới không có trong mặc định
      for (const r of s.chi_tieu) {
        const name = str(r.chi_tieu);
        if (!name) continue;
        if (!base.some((b) => str(b.chi_tieu).toLowerCase() === name.toLowerCase())) {
          base.push({
            chi_tieu: name,
            yeu_cau: str(r.yeu_cau),
            ket_qua: str(r.ket_qua),
            phuong_phap: str(r.phuong_phap),
          });
        }
      }
      merged.chi_tieu = base;
    }
    next.chi_tiet_bcks.dia_chat.tn_nuoc = merged;
    return next;
  }

  if (formKey === "tn_da") {
    const merged = { ...cur };
    for (const k of [
      "lab_ten",
      "lab_phong",
      "so_phieu",
      "lab_dia_chi",
      "pp_tn",
      "don_vi_yeu_cau",
      "du_an",
      "ngay_nhan_mau",
      "ngay_thi_nghiem",
    ]) {
      if (str(s[k])) merged[k] = str(s[k]);
    }
    for (const k of ["nguoi_thi_nghiem", "truong_phong_tn", "pho_giam_doc"]) {
      merged[k] = pickFilled(s[k], cur[k]);
    }
    if (Array.isArray(s.rows) && s.rows.length) merged.rows = s.rows;
    next.chi_tiet_bcks.dia_chat.tn_da = merged;
    return next;
  }

  // co_ly_dat_2
  const merged = { ...cur };
  if (str(s.du_an)) merged.du_an = str(s.du_an);
  if (str(s.giai_doan)) merged.giai_doan = str(s.giai_doan);
  if (str(s.ngay)) merged.ngay = str(s.ngay);
  merged.nguoi_lap = pickFilled(s.nguoi_lap, cur.nguoi_lap);
  merged.nguoi_kiem_tra = pickFilled(s.nguoi_kiem_tra, cur.nguoi_kiem_tra);
  if (Array.isArray(s.rows) && s.rows.length) merged.rows = s.rows;
  next.chi_tiet_bcks.dia_chat.co_ly_dat_2 = merged;
  return next;
}

/** Excel AOA → text cho Gemini */
export function excelAoaToPromptText(aoa, maxRows = 80, maxCols = 24) {
  const lines = [];
  const rows = (aoa || []).slice(0, maxRows);
  for (let i = 0; i < rows.length; i++) {
    const row = (rows[i] || []).slice(0, maxCols);
    const cells = row.map((c) => (c == null || c === "" ? "" : String(c).trim()));
    if (cells.every((c) => !c)) continue;
    lines.push(cells.join("\t"));
  }
  return lines.join("\n");
}
