import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getLocalDb, saveLocalDb, ensureLocalDemo } from "../../../../lib/storeLocal";
import { validatePasswordChange } from "../../../../lib/userAccount";
import { loginUserFacingError } from "../../../../lib/publicErrors";

function normalizeAnonKey(raw) {
  const k = String(raw || "").trim();
  const i = k.indexOf("eyJ");
  return i >= 0 ? k.slice(i) : k;
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
    const userId = String(body.userId || "").trim();
    const username = String(body.username || "")
      .trim()
      .toLowerCase();
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");
    const confirmPassword = String(body.confirmPassword || "");

    const check = validatePasswordChange({
      currentPassword,
      newPassword,
      confirmPassword,
      requireCurrent: true,
    });
    if (!check.ok) {
      return NextResponse.json({ ok: false, error: check.message }, { status: 400 });
    }

    const sb = serverSupabase();
    if (!sb) {
      const db = ensureLocalDemo(getLocalDb());
      const user = db.users.find(
        (u) =>
          (userId && u.id === userId) ||
          String(u.username || "").toLowerCase() === username
      );
      if (!user || String(user.mat_khau || "") !== currentPassword) {
        return NextResponse.json(
          { ok: false, error: "Mật khẩu hiện tại không đúng." },
          { status: 401 }
        );
      }
      if ((user.trang_thai || "active") !== "active") {
        return NextResponse.json({ ok: false, error: "Tài khoản đã bị khóa." }, { status: 403 });
      }
      user.mat_khau = newPassword;
      user.bat_doi_mk = 0;
      saveLocalDb(db);
      return NextResponse.json({ ok: true });
    }

    let query = sb.from("nguoi_dung").select("*");
    if (userId) query = query.eq("id", userId);
    else query = query.eq("username", username);

    const { data: user, error } = await query.maybeSingle();
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[change-password]", error.message);
      return NextResponse.json(
        { ok: false, error: loginUserFacingError(error.message) },
        { status: 503 }
      );
    }
    if (!user || String(user.mat_khau || "") !== currentPassword) {
      return NextResponse.json(
        { ok: false, error: "Mật khẩu hiện tại không đúng." },
        { status: 401 }
      );
    }
    if (user.trang_thai !== "active") {
      return NextResponse.json({ ok: false, error: "Tài khoản đã bị khóa." }, { status: 403 });
    }

    const { error: updErr } = await sb
      .from("nguoi_dung")
      .update({ mat_khau: newPassword, bat_doi_mk: 0 })
      .eq("id", user.id);

    if (updErr) {
      // eslint-disable-next-line no-console
      console.error("[change-password]", updErr.message);
      const missing = /bat_doi_mk|column/i.test(updErr.message || "");
      if (missing) {
        const { error: fb } = await sb
          .from("nguoi_dung")
          .update({ mat_khau: newPassword })
          .eq("id", user.id);
        if (fb) {
          return NextResponse.json(
            { ok: false, error: loginUserFacingError(fb.message) },
            { status: 503 }
          );
        }
        return NextResponse.json({ ok: true, warning: "missing_bat_doi_mk" });
      }
      return NextResponse.json(
        { ok: false, error: loginUserFacingError(updErr.message) },
        { status: 503 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[change-password]", err);
    return NextResponse.json(
      { ok: false, error: loginUserFacingError(err) },
      { status: 500 }
    );
  }
}
