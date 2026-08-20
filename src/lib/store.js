/**
 * Data layer: Supabase khi có env, ngược lại localStorage (dev offline).
 */
import { hasSupabase, supabase } from "./supabase";
import {
  DEMO_USERS,
  SEED_ROLES,
  ensureLocalDemo,
  getLocalDb,
  saveLocalDb,
  seedLocalDb,
  uid,
} from "./storeLocal";

export { DEMO_USERS, SEED_ROLES, uid, hasSupabase };

function stripPassword(user) {
  if (!user) return null;
  const { mat_khau: _, ...safe } = user;
  return safe;
}

export async function fetchDb() {
  if (!hasSupabase) {
    return ensureLocalDemo(getLocalDb());
  }

  const [
    rolesRes,
    usersRes,
    duAnRes,
    mocRes,
    ksRes,
    gdRes,
    chiaRes,
    tlRes,
    lsRes,
  ] = await Promise.all([
    supabase.from("phan_quyen").select("*"),
    supabase.from("nguoi_dung").select("*"),
    supabase.from("du_an").select("*").order("ma_du_an"),
    supabase.from("moc_tien_do").select("*"),
    supabase.from("ks_module").select("*"),
    supabase.from("giao_dich").select("*").order("ngay", { ascending: false }),
    supabase.from("chia_noi_bo").select("*"),
    supabase.from("tai_lieu").select("*").order("thoi_gian", { ascending: false }),
    supabase
      .from("lich_su_hoat_dong")
      .select("*")
      .order("thoi_gian", { ascending: false })
      .limit(200),
  ]);

  const err =
    rolesRes.error ||
    usersRes.error ||
    duAnRes.error ||
    mocRes.error ||
    ksRes.error ||
    gdRes.error ||
    chiaRes.error ||
    tlRes.error ||
    lsRes.error;
  if (err) throw new Error(err.message);

  const roles = {};
  (rolesRes.data || []).forEach((r) => {
    roles[r.phan_quyen] = r;
  });

  return {
    roles: Object.keys(roles).length ? roles : SEED_ROLES,
    users: usersRes.data || [],
    duAn: duAnRes.data || [],
    moc: mocRes.data || [],
    ksModules: ksRes.data || [],
    giaoDich: (gdRes.data || []).map((g) => ({
      ...g,
      so_tien: Number(g.so_tien),
    })),
    chiaNoiBo: (chiaRes.data || []).map((c) => ({
      ...c,
      ty_le: Number(c.ty_le),
    })),
    taiLieu: tlRes.data || [],
    lichSu: lsRes.data || [],
  };
}

export async function getPermsForUser(user) {
  if (!user) return SEED_ROLES.member;
  if (!hasSupabase) {
    const db = ensureLocalDemo(getLocalDb());
    return db.roles[user.phan_quyen] || SEED_ROLES[user.phan_quyen] || SEED_ROLES.member;
  }
  const { data, error } = await supabase
    .from("phan_quyen")
    .select("*")
    .eq("phan_quyen", user.phan_quyen)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data || SEED_ROLES[user.phan_quyen] || SEED_ROLES.member;
}

export async function loginLocal(username, password) {
  const uname = String(username || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  const pwd = String(password || "").trim();

  if (!hasSupabase) {
    const db = ensureLocalDemo(getLocalDb());
    const user = db.users.find(
      (u) =>
        String(u.username || "").toLowerCase() === uname &&
        String(u.mat_khau || "") === pwd &&
        (u.trang_thai || "active") === "active"
    );
    if (!user && DEMO_USERS.some((d) => d.username === uname && d.mat_khau === pwd)) {
      seedLocalDb();
      return loginLocal(uname, pwd);
    }
    if (!user) return { ok: false, error: "User hoặc mật khẩu không đúng." };
    return {
      ok: true,
      user: stripPassword(user),
      perms: await getPermsForUser(user),
    };
  }

  const { data: user, error } = await supabase
    .from("nguoi_dung")
    .select("*")
    .eq("username", uname)
    .eq("mat_khau", pwd)
    .eq("trang_thai", "active")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!user) return { ok: false, error: "User hoặc mật khẩu không đúng." };

  return {
    ok: true,
    user: stripPassword(user),
    perms: await getPermsForUser(user),
  };
}

export async function logActivity({ username, email, ho_ten, phan_he, hanh_dong, chi_tiet }) {
  const row = {
    id: uid("ls"),
    username: username || email || "",
    ho_ten: ho_ten || "",
    phan_he,
    hanh_dong,
    chi_tiet: chi_tiet || "",
    thoi_gian: new Date().toISOString(),
  };

  if (!hasSupabase) {
    const db = getLocalDb();
    if (!Array.isArray(db.lichSu)) db.lichSu = [];
    db.lichSu.unshift(row);
    saveLocalDb(db);
    return;
  }

  const { error } = await supabase.from("lich_su_hoat_dong").insert(row);
  if (error) console.error("logActivity", error.message);
}

export async function insertRow(table, row) {
  if (!hasSupabase) {
    const db = getLocalDb();
    const map = tableMap(db);
    map[table].push(row);
    saveLocalDb(db);
    return row;
  }
  const { data, error } = await supabase.from(table).insert(row).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateRow(table, id, patch) {
  if (!hasSupabase) {
    const db = getLocalDb();
    const list = tableMap(db)[table];
    const i = list.findIndex((r) => r.id === id);
    if (i >= 0) list[i] = { ...list[i], ...patch };
    saveLocalDb(db);
    return list[i];
  }
  const { data, error } = await supabase
    .from(table)
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteWhere(table, column, value) {
  if (!hasSupabase) {
    const db = getLocalDb();
    const map = tableMap(db);
    map[table] = map[table].filter((r) => r[column] !== value);
    // sync back
    Object.assign(db, invertTableMap(map));
    saveLocalDb(db);
    return;
  }
  const { error } = await supabase.from(table).delete().eq(column, value);
  if (error) throw new Error(error.message);
}

export async function replaceChiaNoiBo(duAnId, rows) {
  if (!hasSupabase) {
    const db = getLocalDb();
    db.chiaNoiBo = db.chiaNoiBo.filter((c) => c.du_an_id !== duAnId);
    db.chiaNoiBo.push(...rows);
    saveLocalDb(db);
    return;
  }
  const { error: delErr } = await supabase
    .from("chia_noi_bo")
    .delete()
    .eq("du_an_id", duAnId);
  if (delErr) throw new Error(delErr.message);
  if (rows.length) {
    const { error } = await supabase.from("chia_noi_bo").insert(rows);
    if (error) throw new Error(error.message);
  }
}

function tableMap(db) {
  return {
    nguoi_dung: db.users,
    du_an: db.duAn,
    moc_tien_do: db.moc,
    ks_module: db.ksModules,
    giao_dich: db.giaoDich,
    chia_noi_bo: db.chiaNoiBo,
    tai_lieu: db.taiLieu,
    lich_su_hoat_dong: db.lichSu,
  };
}

function invertTableMap(map) {
  return {
    users: map.nguoi_dung,
    duAn: map.du_an,
    moc: map.moc_tien_do,
    ksModules: map.ks_module,
    giaoDich: map.giao_dich,
    chiaNoiBo: map.chia_noi_bo,
    taiLieu: map.tai_lieu,
    lichSu: map.lich_su_hoat_dong,
  };
}

/** Tạo DA + mốc + KS modules (local hoặc remote) */
export async function createDuAnBundle({ duAn, mocList, ksList }) {
  if (!hasSupabase) {
    const db = getLocalDb();
    db.duAn.push(duAn);
    db.moc.push(...mocList);
    db.ksModules.push(...ksList);
    saveLocalDb(db);
    return;
  }
  const { error: e1 } = await supabase.from("du_an").insert(duAn);
  if (e1) throw new Error(e1.message);
  if (mocList.length) {
    const { error } = await supabase.from("moc_tien_do").insert(mocList);
    if (error) throw new Error(error.message);
  }
  if (ksList.length) {
    const { error } = await supabase.from("ks_module").insert(ksList);
    if (error) throw new Error(error.message);
  }
}

export async function resetDb() {
  if (hasSupabase) {
    throw new Error("Reset demo chỉ dùng khi chưa gắn Supabase.");
  }
  return seedLocalDb();
}

// backward-compat aliases used by older imports
export const getDb = fetchDb;
export const saveDb = saveLocalDb;
