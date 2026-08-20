import { createClient } from "@supabase/supabase-js";

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

export const hasSupabase = Boolean(
  url &&
    key &&
    !url.includes("YOUR_") &&
    !key.includes("YOUR_") &&
    url.startsWith("http")
);

export const supabase = hasSupabase
  ? createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;
