/**
 * Upload / mở file hồ sơ KS|TK.
 * Supabase bucket `ho_so`; không có Supabase → IndexedDB (local://).
 */

import { hasSupabase, supabase } from "./supabase";
import { openStoredFile, resolvePdfOpenUrl } from "./pdfGiaoAStorage";

const IDB_NAME = "outsrc_pdfs_v1";
const IDB_STORE = "blobs";
const LOCAL_PREFIX = "local://";
const BUCKET = "ho_so";

const ALLOWED_EXT = new Set([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "dwg",
  "dxf",
  "zip",
  "rar",
  "7z",
  "jpg",
  "jpeg",
  "png",
]);

function cleanSegment(str, max = 60) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, max);
}

function fileExt(name) {
  const parts = String(name || "").split(".");
  return (parts.length > 1 ? parts.pop() : "bin").toLowerCase();
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
    tx.onerror = () => reject(tx.error || new Error("Lưu file local thất bại"));
  });
}

async function idbDelete(key) {
  const db = await openIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Xóa file local thất bại"));
  });
}

/** Trích object path trong bucket ho_so từ URL public hoặc local:// */
export function hoSoStorageObjectPath(storagePath) {
  const raw = String(storagePath || "").trim();
  if (!raw) return null;
  if (raw.startsWith(LOCAL_PREFIX)) {
    const sub = raw.slice(LOCAL_PREFIX.length);
    return sub.startsWith("ho-so/") ? sub.slice("ho-so/".length) : sub;
  }
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = raw.indexOf(marker);
  if (idx >= 0) return decodeURIComponent(raw.slice(idx + marker.length));
  if (raw.includes(`${BUCKET}/`)) {
    return raw.split(`${BUCKET}/`).pop() || null;
  }
  return null;
}

export function validateHoSoFile(file) {
  if (!file) return "Chọn file cần tải lên.";
  const ext = fileExt(file.name);
  if (!ALLOWED_EXT.has(ext)) {
    return `Định dạng .${ext} chưa hỗ trợ. Dùng: ${[...ALLOWED_EXT].join(", ")}.`;
  }
  const maxMb = 80;
  if (file.size > maxMb * 1024 * 1024) {
    return `File quá lớn (tối đa ${maxMb} MB).`;
  }
  return null;
}

/**
 * @returns {Promise<string|null>} URL public hoặc local://key
 */
export async function uploadHoSoFile(file, { maDuAn, loaiKho, moduleLoai }) {
  const err = validateHoSoFile(file);
  if (err) throw new Error(err);

  const safeMa = cleanSegment(maDuAn) || "DA";
  const folder = cleanSegment(moduleLoai || "chua_phan_loai", 40);
  const stamp = Date.now().toString(36);
  const safeName = cleanSegment(file.name, 120) || `file.${fileExt(file.name)}`;
  const objectPath = `${safeMa}/${loaiKho}/${folder}/${stamp}_${safeName}`;

  if (hasSupabase && supabase) {
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath, file, { cacheControl: "3600", upsert: false });
    if (uploadError) {
      throw new Error(
        "Lỗi tải hồ sơ lên Storage: " +
          uploadError.message +
          "\n(Chạy scripts/sql/024_storage_ho_so.sql trên Supabase.)"
      );
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
    return data?.publicUrl || objectPath;
  }

  const key = `${LOCAL_PREFIX}ho-so/${objectPath}`;
  await idbPut(key, file);
  return key;
}

export async function openHoSoFile(storagePath) {
  return openStoredFile(storagePath);
}

export async function canOpenHoSoFile(storagePath) {
  const url = await resolvePdfOpenUrl(storagePath);
  return Boolean(url);
}

/** Xóa binary (Storage / IndexedDB). Bỏ qua nếu không có path. */
export async function deleteHoSoFile(storagePath) {
  const raw = String(storagePath || "").trim();
  if (!raw) return;

  if (raw.startsWith(LOCAL_PREFIX)) {
    await idbDelete(raw);
    return;
  }

  const objectPath = hoSoStorageObjectPath(raw);
  if (hasSupabase && supabase && objectPath) {
    const { error } = await supabase.storage.from(BUCKET).remove([objectPath]);
    if (error) {
      throw new Error("Không xóa được file trên Storage: " + error.message);
    }
  }
}
