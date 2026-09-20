/**
 * NKKS — resolve khối lượng từ NVKS Gốc + Điều chỉnh (cột 02 nhập tay).
 */
import {
  fetchNvksVersions,
  formatNvksPhienBanLabel,
  pickLatestNvksDcRecord,
  pickNvksGocRecord,
} from "./nvksPhienBan";
import { buildNkksSimpleKlRows, countKlWorkRows } from "./nvksDcKl";

export { pickNvksGocRecord, pickLatestNvksDcRecord };

const NVKS_KL_COLUMNS =
  "id, ma_du_an, ten_du_an, giai_doan, loai_hinh, phien_ban, so_lan_dc, du_lieu_bang_tinh, chu_dau_tu";

export function countNkksBangKlWorkRows(rows) {
  return countKlWorkRows(rows);
}

/**
 * Resolve KL tham chiếu NKKS: ưu tiên cột (02) ĐC nếu có, không thì Gốc.
 */
export async function resolveNvksKlSourceForNkks(supabase, maDuAn, { templateData, project } = {}) {
  if (!maDuAn) {
    return {
      gocRecord: null,
      klSourceRecord: null,
      klSourceLabel: "—",
      nvksGocId: null,
      rows: [],
      workRowCount: 0,
    };
  }

  const versions = await fetchNvksVersions(supabase, maDuAn, NVKS_KL_COLUMNS);
  const gocRecord = pickNvksGocRecord(versions);
  const latestDc = pickLatestNvksDcRecord(versions);
  const klSourceRecord = latestDc || gocRecord;
  const klSourceLabel = latestDc ? formatNvksPhienBanLabel(latestDc) : gocRecord ? "GỐC" : "—";

  const rows =
    templateData?.length && gocRecord
      ? buildNkksSimpleKlRows(gocRecord, latestDc, templateData, project)
      : [];

  return {
    versions,
    gocRecord,
    klSourceRecord,
    klSourceLabel,
    nvksGocId: gocRecord?.id || null,
    rows,
    workRowCount: countKlWorkRows(rows),
  };
}

/** Có bản NVKS ĐC mới hơn snapshot đã lưu trên NKKS? */
export function nkksKlSourceIsStale(savedNkks, liveResolve) {
  if (!savedNkks?.nvks_kl_source_id || !liveResolve?.klSourceRecord?.id) return false;
  return savedNkks.nvks_kl_source_id !== liveResolve.klSourceRecord.id;
}

/** @deprecated Dùng buildNkksSimpleKlRows — giữ export tạm nếu import cũ */
export function buildNkksBangKhoiLuongRows(gocRecord, klSourceRecord, templateData, project) {
  return buildNkksSimpleKlRows(gocRecord, klSourceRecord, templateData, project);
}
