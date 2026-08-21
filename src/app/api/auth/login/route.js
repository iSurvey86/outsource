import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DEMO_USERS, SEED_ROLES } from "../../../../lib/storeLocal";
import { loginUserFacingError } from "../../../../lib/publicErrors";

function normalizeAnonKey(raw) {
  const k = String(raw || "").trim();
  const i = k.indexOf("eyJ");
  return i >= 0 ? k.slice(i) : k;
}

function stripPassword(user) {
  if (!user) return null;
  const { mat_khau: _, ...safe } = user;
  return safe;
}

function serverSupabase() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = normalizeAnonKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!url || !key || !key.startsWith("eyJ") || !url.startsWith("http")) {
    return null;
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const uname = String(body.username || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
    const pwd = String(body.password || "").trim();

    if (!uname || !pwd) {
      return NextResponse.json(
        { ok: false, error: "Vui lòng nhập tài khoản và mật khẩu." },
        { status: 400 }
      );
    }

    const sb = serverSupabase();
    if (!sb) {
      const demo = DEMO_USERS.find(
        (u) => u.username === uname && u.mat_khau === pwd && u.trang_thai === "active"
      );
      if (!demo) {
        return NextResponse.json(
          { ok: false, error: "Tài khoản hoặc mật khẩu không đúng." },
          { status: 401 }
        );
      }
      const perms = SEED_ROLES[demo.phan_quyen] || SEED_ROLES.member;
      return NextResponse.json({ ok: true, user: stripPassword(demo), perms });
    }

    const { data: user, error } = await sb
      .from("nguoi_dung")
      .select("*")
      .eq("username", uname)
      .eq("mat_khau", pwd)
      .eq("trang_thai", "active")
      .maybeSingle();

    if (error) {
      // eslint-disable-next-line no-console
      console.error("[login]", error.message);
      return NextResponse.json(
        { ok: false, error: loginUserFacingError(error.message) },
        { status: 503 }
      );
    }
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Tài khoản hoặc mật khẩu không đúng." },
        { status: 401 }
      );
    }

    const { data: permsRow, error: permsErr } = await sb
      .from("phan_quyen")
      .select("*")
      .eq("phan_quyen", user.phan_quyen)
      .maybeSingle();

    if (permsErr) {
      // eslint-disable-next-line no-console
      console.error("[login/perms]", permsErr.message);
    }

    const perms =
      permsRow || SEED_ROLES[user.phan_quyen] || SEED_ROLES.member;

    return NextResponse.json({
      ok: true,
      user: stripPassword(user),
      perms,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[login]", err);
    return NextResponse.json(
      { ok: false, error: loginUserFacingError(err) },
      { status: 500 }
    );
  }
}
