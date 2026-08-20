import { createClient } from "@supabase/supabase-js";

/** Chuẩn hóa anon key — bỏ prefix copy nhầm (sb_secret_… trước eyJ). */
function normalizeAnonKey(raw) {
  const k = String(raw || "").trim();
  const i = k.indexOf("eyJ");
  return i >= 0 ? k.slice(i) : k;
}

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const key = normalizeAnonKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export const hasSupabase = Boolean(
  url &&
    key &&
    key.startsWith("eyJ") &&
    !url.includes("YOUR_") &&
    !key.includes("YOUR_") &&
    url.startsWith("http")
);

export const supabase = hasSupabase
  ? createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;
