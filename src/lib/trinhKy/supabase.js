import { createClient } from "@supabase/supabase-js";

export function getTrinhKySupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Thiếu cấu hình Supabase trên server.");
  }
  return createClient(url, key);
}

export function clientMeta(request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "";
  const userAgent = request.headers.get("user-agent") || "";
  return { ip, userAgent };
}
