/**
 * Dữ liệu + xuất Word NTKS (biểu mẫu theo registry).
 */
import { saveAs } from "file-saver";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { formatNkksNgayDisplay, sanitizeNkksExportText } from "./nkksWordExport";
import { getNtksFormDef, normalizeNtksChiTiet } from "./ntksFormRegistry";
import { resolveNtksKiemTraGsToChuc } from "./ntksInit";
import {
  buildNtksDownloadFileName,
  buildNtksExportStoragePath,
  uploadNtksExportBlob,
} from "./ntksExportStorage";

function formatDateField(value) {
  return formatNkksNgayDisplay(value);
}

/**
 * Dòng thời gian BB nghiệm thu:
 * 「09h00 ngày 15 tháng 07 năm 2026」 — thiếu ngày thì chấm ……
 * Giờ mặc định: bắt đầu 09h00, kết thúc 11h00 (không nhập trên form).
 */
export function formatNtksThoiGianDong(dateIso, timeHm = "09:00") {
  const blank = "……";
  let gio = blank;
  let phut = blank;
  let ngay = blank;
  let thang = blank;
  let nam = blank;

  const t = String(timeHm || "").trim();
  const tm = t.match(/^(\d{1,2}):(\d{2})$/);
  if (tm) {
    gio = String(Number(tm[1])).padStart(2, "0");
    phut = tm[2];
  }

  const raw = String(dateIso || "").trim();
  if (raw) {
    const d = raw.includes("T") ? new Date(raw) : null;
    let y;
    let m;
    let day;
    if (d && !Number.isNaN(d.getTime()) && raw.includes("T")) {
      y = d.getFullYear();
      m = d.getMonth() + 1;
      day = d.getDate();
    } else {
      const m2 = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m2) {
        y = Number(m2[1]);
        m = Number(m2[2]);
        day = Number(m2[3]);
      } else {
        const m3 = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (m3) {
          day = Number(m3[1]);
          m = Number(m3[2]);
          y = Number(m3[3]);
        }
      }
    }
    if (y && m && day) {
      ngay = String(day).padStart(2, "0");
      thang = String(m).padStart(2, "0");
      nam = String(y);
    }
  }

  return `${gio}h${phut} ngày ${ngay} tháng ${thang} năm ${nam}`;
}

function mapTableRows(rows, fields) {
  return (rows || []).map((row) => {
    const out = {};
    for (const f of fields) {
      out[f] = sanitizeNkksExportText(row?.[f] ?? "");
    }
    return out;
  });
}

/** Docxtemplater payload cho một biểu mẫu */
export function buildNtksDocData(formData = {}, formKey) {
  const chi = normalizeNtksChiTiet(formData.chi_tiet_ntks);
  const detail = chi[formKey] || {};

  const shared = {
    ten_du_an: sanitizeNkksExportText(formData.ten_du_an || ""),
    dia_diem: sanitizeNkksExportText(formData.dia_diem || ""),
    giai_doan: sanitizeNkksExportText(formData.giai_doan || ""),
    chu_dau_tu: sanitizeNkksExportText(formData.chu_dau_tu || ""),
    nha_thau_ks: sanitizeNkksExportText(formData.nha_thau_ks || ""),
    nha_thau_tvgs: sanitizeNkksExportText(formData.nha_thau_tvgs || ""),
    dia_diem_lap: sanitizeNkksExportText(detail.dia_diem_lap || formData.dia_diem || ""),
    ngay_bat_dau: formatDateField(detail.ngay_bat_dau),
    ngay_ket_thuc: formatDateField(detail.ngay_ket_thuc),
  };

  if (formKey === "hien_truong") {
    const pick = (key, fallback = "") =>
      sanitizeNkksExportText(detail[key] || fallback);
    const withStt = (rows, fields) =>
      mapTableRows(rows, fields).map((row, i) => ({
        ...row,
        stt: String(i + 1),
      }));
    const layMau = withStt(detail.lay_mau, [
      "ten_mau",
      "vi_tri",
      "so_luong",
      "ngay_bb",
      "danh_gia",
      "quy_cach",
      "yeu_cau",
    ]).map((row) => ({
      ...row,
      // Template 02 dùng yeu_cau; form cũ dùng danh_gia
      yeu_cau: row.yeu_cau || row.danh_gia,
      danh_gia: row.danh_gia || row.yeu_cau,
    }));

    return {
      ...shared,
      ngay_bat_dau: formatNtksThoiGianDong(detail.ngay_bat_dau, "09:00"),
      ngay_ket_thuc: formatNtksThoiGianDong(detail.ngay_ket_thuc, "11:00"),
      can_cu_hop_dong: pick("can_cu_hop_dong"),
      can_cu_qd_giam_sat: pick("can_cu_qd_giam_sat"),
      can_cu_nv_paktks: pick("can_cu_nv_paktks"),
      gs_to_chuc: pick("gs_to_chuc", formData.nha_thau_tvgs),
      ten_gs_1: pick("ten_gs_1", detail.gs_ho_ten),
      cv_gs_1: pick("cv_gs_1", detail.gs_chuc_vu),
      ten_gs_2: pick("ten_gs_2"),
      cv_gs_2: pick("cv_gs_2"),
      ten_gs_3: pick("ten_gs_3"),
      cv_gs_3: pick("cv_gs_3"),
      gs_ho_ten: pick("ten_gs_1", detail.gs_ho_ten),
      gs_chuc_vu: pick("cv_gs_1", detail.gs_chuc_vu),
      nt_to_chuc: pick("nt_to_chuc", formData.nha_thau_ks),
      ten_nt_1: pick("ten_nt_1", detail.nt_ho_ten),
      cv_nt_1: pick("cv_nt_1", detail.nt_chuc_vu),
      ten_nt_2: pick("ten_nt_2"),
      cv_nt_2: pick("cv_nt_2"),
      ten_nt_3: pick("ten_nt_3"),
      cv_nt_3: pick("cv_nt_3"),
      nt_ho_ten: pick("ten_nt_1", detail.nt_ho_ten),
      nt_chuc_vu: pick("cv_nt_1", detail.nt_chuc_vu),
      kien_nghi: pick("kien_nghi"),
      so_ban: pick("so_ban", "02"),
      so_ban_moi_ben: pick("so_ban_moi_ben", "01"),
      khoan_dia_chat: withStt(detail.khoan_dia_chat, [
        "vi_tri",
        "chieu_sau",
        "duong_kinh",
        "danh_gia",
      ]),
      lay_mau: layMau,
      do_dien_tro_suat: withStt(detail.do_dien_tro_suat, ["noi_dung", "ngay_do", "ghi_chu"]),
      khao_sat_dia_hinh: withStt(detail.khao_sat_dia_hinh, [
        "noi_dung",
        "don_vi",
        "khoi_luong",
        "ghi_chu",
      ]),
    };
  }

  if (formKey === "lay_mau") {
    const pick = (key, fallback = "") =>
      sanitizeNkksExportText(detail[key] || fallback);
    const layMau = mapTableRows(detail.lay_mau, [
      "ten_mau",
      "vi_tri",
      "so_luong",
      "quy_cach",
      "yeu_cau",
      "ngay_bb",
      "danh_gia",
    ]).map((row, i) => ({
      ...row,
      stt: String(i + 1),
      yeu_cau: row.yeu_cau || row.danh_gia,
    }));

    return {
      ...shared,
      gs_to_chuc: pick(
        "gs_to_chuc",
        resolveNtksKiemTraGsToChuc({
          tvgs: formData.nha_thau_tvgs,
          chuDauTu: formData.chu_dau_tu,
        })
      ),
      ten_gs_1: pick("ten_gs_1"),
      cv_gs_1: pick("cv_gs_1"),
      ten_gs_2: pick("ten_gs_2"),
      cv_gs_2: pick("cv_gs_2"),
      ten_gs_3: pick("ten_gs_3"),
      cv_gs_3: pick("cv_gs_3"),
      nt_to_chuc: pick("nt_to_chuc", formData.nha_thau_ks),
      ten_nt_1: pick("ten_nt_1"),
      cv_nt_1: pick("cv_nt_1"),
      ten_nt_2: pick("ten_nt_2"),
      cv_nt_2: pick("cv_nt_2"),
      ten_nt_3: pick("ten_nt_3"),
      cv_nt_3: pick("cv_nt_3"),
      kien_nghi: pick(
        "kien_nghi",
        "Công tác lấy mẫu thí nghiệm đảm bảo đúng quy cách và yêu cầu kỹ thuật."
      ),
      so_ban: pick("so_ban", "02"),
      so_ban_moi_ben: pick("so_ban_moi_ben", "01"),
      lay_mau: layMau,
    };
  }

  if (formKey === "kiem_tra_nl_tb") {
    // Form NL/TB luôn có khối GS: TVGS hoặc tên Chủ đầu tư (tự giám sát)
    const pick = (key, fallback = "") =>
      sanitizeNkksExportText(detail[key] || fallback);
    const gsToChuc = pick(
      "gs_to_chuc",
      resolveNtksKiemTraGsToChuc({
        tvgs: formData.nha_thau_tvgs,
        chuDauTu: formData.chu_dau_tu,
      })
    );
    const mayMoc = mapTableRows(detail.may_moc, [
      "ten_may",
      "cong_suat_ma",
      "so_luong",
      "tinh_trang",
    ]).map((row, i) => ({
      ...row,
      stt: String(i + 1).padStart(2, "0"),
    }));

    return {
      ...shared,
      cong_trinh: sanitizeNkksExportText(detail.cong_trinh || formData.ten_du_an),
      muc: sanitizeNkksExportText(detail.muc),
      giai_doan: sanitizeNkksExportText(formData.giai_doan || ""),
      noi_dung_kiem_tra: sanitizeNkksExportText(detail.noi_dung_kiem_tra),
      dia_diem_kiem_tra: sanitizeNkksExportText(
        detail.dia_diem_kiem_tra || "Hiện trường công trình"
      ),
      ngay_bat_dau: formatNtksThoiGianDong(detail.ngay_bat_dau, "09:00"),
      ngay_ket_thuc: formatNtksThoiGianDong(detail.ngay_ket_thuc, "11:00"),
      label_gs: "a",
      label_nt: "b",
      gs_to_chuc: gsToChuc,
      ten_gs_1: pick("ten_gs_1", detail.gs_ho_ten),
      cv_gs_1: pick("cv_gs_1", detail.gs_chuc_vu),
      ten_gs_2: pick("ten_gs_2"),
      cv_gs_2: pick("cv_gs_2"),
      ten_gs_3: pick("ten_gs_3"),
      cv_gs_3: pick("cv_gs_3"),
      gs_ho_ten: pick("ten_gs_1", detail.gs_ho_ten),
      gs_chuc_vu: pick("cv_gs_1", detail.gs_chuc_vu),
      nt_to_chuc: pick("nt_to_chuc", formData.nha_thau_ks),
      ten_nt_1: pick("ten_nt_1", detail.nt_ho_ten),
      cv_nt_1: pick("cv_nt_1", detail.nt_chuc_vu),
      ten_nt_2: pick("ten_nt_2"),
      cv_nt_2: pick("cv_nt_2"),
      ten_nt_3: pick("ten_nt_3"),
      cv_nt_3: pick("cv_nt_3"),
      nt_ho_ten: pick("ten_nt_1", detail.nt_ho_ten),
      nt_chuc_vu: pick("cv_nt_1", detail.nt_chuc_vu),
      nl_chu_nhiem: pick("nl_chu_nhiem"),
      nl_ks_dia_hinh: pick("nl_ks_dia_hinh"),
      nl_ks_dia_chat: pick("nl_ks_dia_chat"),
      nl_cong_nhan: pick("nl_cong_nhan"),
      nhan_luc_chi_huy: sanitizeNkksExportText(detail.nhan_luc_chi_huy),
      nhan_luc_ky_thuat: sanitizeNkksExportText(detail.nhan_luc_ky_thuat),
      nhan_luc_cong_nhan: sanitizeNkksExportText(detail.nhan_luc_cong_nhan),
      may_moc: mayMoc,
      ket_luan: sanitizeNkksExportText(detail.ket_luan),
      so_ban: sanitizeNkksExportText(detail.so_ban),
      so_ban_moi_ben: sanitizeNkksExportText(detail.so_ban_moi_ben),
    };
  }

  if (formKey === "nghiem_thu_kq") {
    const giaiDoan = sanitizeNkksExportText(formData.giai_doan || "");
    const pick = (key, fallback = "") =>
      sanitizeNkksExportText(detail[key] || fallback);
    const hasGiamSat = Boolean(
      String(formData.nha_thau_tvgs || detail.giam_sat_ks || "").trim()
    );
    const labelTvtk = hasGiamSat ? "c" : "b";

    return {
      ...shared,
      giai_doan: giaiDoan,
      giai_doan_in_hoa: giaiDoan.toUpperCase(),
      so_bien_ban: pick("so_bien_ban"),
      ngay_bat_dau: formatNtksThoiGianDong(detail.ngay_bat_dau, "09:00"),
      ngay_ket_thuc: formatNtksThoiGianDong(detail.ngay_ket_thuc, "11:00"),
      has_giam_sat: hasGiamSat,
      label_tvtk: labelTvtk,
      can_cu_hop_dong: pick("can_cu_hop_dong"),
      can_cu_qd_giam_sat: hasGiamSat ? pick("can_cu_qd_giam_sat") : "",
      can_cu_qdpd_nvks: pick("can_cu_qdpd_nvks"),
      can_cu_qdpd_paktks: pick("can_cu_qdpd_paktks"),
      cdt_to_chuc: pick("cdt_to_chuc", formData.chu_dau_tu),
      ten_pgd_cdt: pick("ten_pgd_cdt"),
      cv_pgd_cdt: pick("cv_pgd_cdt"),
      ten_tr_phong_cdt: pick("ten_tr_phong_cdt"),
      cv_tr_phong_cdt: pick("cv_tr_phong_cdt"),
      ten_chuyen_vien_cdt: pick("ten_chuyen_vien_cdt"),
      cv_chuyen_vien_cdt: pick("cv_chuyen_vien_cdt"),
      giam_sat_ks: hasGiamSat ? pick("giam_sat_ks", formData.nha_thau_tvgs) : "",
      ten_lanh_dao_gsks: hasGiamSat ? pick("ten_lanh_dao_gsks") : "",
      cv_lanh_dao_gsks: hasGiamSat ? pick("cv_lanh_dao_gsks") : "",
      ten_cnks_gsks: hasGiamSat ? pick("ten_cnks_gsks") : "",
      cv_cnks_gsks: hasGiamSat ? pick("cv_cnks_gsks") : "",
      ten_cvien_gsks: hasGiamSat ? pick("ten_cvien_gsks") : "",
      cv_cvien_gsks: hasGiamSat ? pick("cv_cvien_gsks") : "",
      tu_van_thiet_ke: pick("tu_van_thiet_ke", formData.nha_thau_ks),
      ten_lanh_dao_tvtk: pick("ten_lanh_dao_tvtk"),
      cv_lanh_dao_tvtk: pick("cv_lanh_dao_tvtk"),
      ten_gdxntv_tvtk: pick("ten_gdxntv_tvtk"),
      cv_gdxntv_tvtk: pick("cv_gdxntv_tvtk"),
      ten_kdoanh_cty: pick("ten_kdoanh_cty"),
      cv_kdoanh_cty: pick("cv_kdoanh_cty"),
      ten_cnks_tvtk: pick("ten_cnks_tvtk"),
      cv_cnks_tvtk: pick("cv_cnks_tvtk"),
      danh_gia_chat_luong: pick("danh_gia_chat_luong"),
      danh_gia_quy_mo: pick("danh_gia_quy_mo"),
      danh_gia_khoi_luong: pick("danh_gia_khoi_luong"),
      danh_gia_bao_cao: pick("danh_gia_bao_cao"),
      danh_gia_khac: pick("danh_gia_khac"),
      ket_luan: pick("ket_luan"),
      yeu_cau_bo_sung: pick("yeu_cau_bo_sung"),
      so_ban: pick("so_ban"),
      so_ban_ben_a: pick("so_ban_ben_a"),
      so_ban_ben_b: pick("so_ban_ben_b"),
    };
  }

  return shared;
}

async function loadTemplateArrayBuffer(formKey) {
  const def = getNtksFormDef(formKey);
  if (!def?.templatePath) throw new Error("Không tìm thấy template NTKS");
  const res = await fetch(def.templatePath);
  if (!res.ok) throw new Error(`Không tải được template: ${def.templatePath}`);
  return res.arrayBuffer();
}

export async function generateNtksWordBlob(formData, formKey) {
  const buf = await loadTemplateArrayBuffer(formKey);
  const zip = new PizZip(buf);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });
  doc.render(buildNtksDocData(formData, formKey));
  return doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

export async function exportNtksWord(formData, formKey, { download = true } = {}) {
  const blob = await generateNtksWordBlob(formData, formKey);
  const fileName = buildNtksDownloadFileName(formData, formKey);
  if (download) saveAs(blob, fileName);
  return { blob, fileName };
}

export async function exportAndUploadNtksWord(supabase, formData, formKey, recordId) {
  const { blob, fileName } = await exportNtksWord(formData, formKey, { download: false });
  const storagePath = buildNtksExportStoragePath(formData, fileName);
  const publicUrl = await uploadNtksExportBlob(
    supabase,
    blob,
    storagePath,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
  return { publicUrl, fileName, exported_at: new Date().toISOString() };
}
