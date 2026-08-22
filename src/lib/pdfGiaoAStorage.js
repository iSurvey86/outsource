/**
 * Lưu / mở PDF Giao A gốc.
 * Prefer Supabase Storage bucket `pdfs_giao_a`; fallback IndexedDB (local mode).
 */

import { hasSupabase, supabase } from "./supabase";

const IDB_NAME = "outsrc_pdfs_v1";
const IDB_STORE = "blobs";
const LOCAL_PREFIX = "local://";

function cleanForFileName(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80);
}

function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB lỗi"));
  });
}

async function idbPut(key, blob) {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Lưu PDF local thất bại"));
  });
}

async function idbGet(key) {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error || new Error("Đọc PDF local thất bại"));
  });
}

export function isLocalPdfLink(link) {
  return String(link || "").startsWith(LOCAL_PREFIX);
}

/** Upload file → public URL hoặc local://key */
export async function uploadPdfGiaoAGoc(file, soQd = "") {
  if (!file) return null;
  const safeSoQD = cleanForFileName(soQd) || "GiaoA";
  const fileExt = (file.name.split(".").pop() || "pdf").toLowerCase();
  const fileName = `${safeSoQD}_GiaoA_Goc.${fileExt}`;

  if (hasSupabase && supabase) {
    const { error: uploadError } = await supabase.storage
      .from("pdfs_giao_a")
      .upload(fileName, file, { cacheControl: "3600", upsert: true });
    if (uploadError) {
      throw new Error(
        "Lỗi tải PDF Giao A lên Storage: " +
          uploadError.message +
          "\n(Kiểm tra bucket `pdfs_giao_a` và policy upload.)"
      );
    }
    const { data } = supabase.storage.from("pdfs_giao_a").getPublicUrl(fileName);
    return data?.publicUrl || null;
  }

  const key = `${LOCAL_PREFIX}${fileName}`;
  await idbPut(key, file);
  return key;
}

/** Trả URL mở được trong tab (http hoặc blob:) */
export async function resolvePdfOpenUrl(link) {
  const raw = String(link || "").trim();
  if (!raw) return null;
  if (isLocalPdfLink(raw)) {
    const blob = await idbGet(raw);
    if (!blob) return null;
    return URL.createObjectURL(blob instanceof Blob ? blob : new Blob([blob]));
  }
  return raw;
}

export async function openPdfGiaoA(link) {
  const url = await resolvePdfOpenUrl(link);
  if (!url) throw new Error("Không tìm thấy file PDF Giao A.");
  window.open(url, "_blank", "noopener,noreferrer");
}

/** Bill tạm ứng / thanh toán — cùng cơ chế Storage hoặc IndexedDB */
export async function uploadTamUngBill(file, maDuAn = "", dot = "lan1") {
  if (!file) return null;
  const safeMa = cleanForFileName(maDuAn) || "DA";
  const safeDot = cleanForFileName(dot) || "lan1";
  const fileExt = (file.name.split(".").pop() || "pdf").toLowerCase();
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const fileName = `${safeMa}_${safeDot}_${stamp}.${fileExt}`;

  if (hasSupabase && supabase) {
    const { error: uploadError } = await supabase.storage
      .from("pdfs_giao_a")
      .upload(`tam-ung/${fileName}`, file, { cacheControl: "3600", upsert: true });
    if (uploadError) {
      throw new Error("Lỗi tải bill: " + uploadError.message);
    }
    const { data } = supabase.storage.from("pdfs_giao_a").getPublicUrl(`tam-ung/${fileName}`);
    return data?.publicUrl || null;
  }

  const key = `${LOCAL_PREFIX}tam-ung/${fileName}`;
  await idbPut(key, file);
  return key;
}

/** Bill chuyển khoản góp vốn nội bộ B↔B */
export async function uploadGopVonBill(file, maDuAn = "", tag = "gop") {
  if (!file) return null;
  const safeMa = cleanForFileName(maDuAn) || "DA";
  const safeTag = cleanForFileName(tag) || "gop";
  const fileExt = (file.name.split(".").pop() || "pdf").toLowerCase();
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const fileName = `${safeMa}_${safeTag}_${stamp}.${fileExt}`;

  if (hasSupabase && supabase) {
    const { error: uploadError } = await supabase.storage
      .from("pdfs_giao_a")
      .upload(`noi-bo/${fileName}`, file, { cacheControl: "3600", upsert: true });
    if (uploadError) {
      throw new Error("Lỗi tải bill nội bộ: " + uploadError.message);
    }
    const { data } = supabase.storage.from("pdfs_giao_a").getPublicUrl(`noi-bo/${fileName}`);
    return data?.publicUrl || null;
  }

  const key = `${LOCAL_PREFIX}noi-bo/${fileName}`;
  await idbPut(key, file);
  return key;
}

export async function openStoredFile(link) {
  const url = await resolvePdfOpenUrl(link);
  if (!url) throw new Error("Không tìm thấy file đính kèm.");
  window.open(url, "_blank", "noopener,noreferrer");
}
