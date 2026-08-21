/**
 * Adapter log hoạt động — API kiểu ksnpsc `logHoatDong` → OUTSRC `logActivity`.
 */
import { loadAuthSession } from "./authSession";
import { logActivity } from "./store";
import { getAuthActor, getViewAsMeta, isViewAsActive } from "./viewAsPermission";

export async function logHoatDong({
  phanHe,
  hanhDong,
  chiTietNgan,
  doiTuongId = null,
  duLieuDong = {},
  user = null,
  trangThai = "Thành công",
}) {
  try {
    const { user: sessionUser } = loadAuthSession();
    const viewAs = typeof isViewAsActive === "function" ? isViewAsActive() : false;
    const actor = typeof getAuthActor === "function" ? getAuthActor() : null;
    const effective = user || sessionUser;

    let username = "";
    let email = "";
    let ho_ten = "";

    if (viewAs && actor) {
      username = actor.username || actor.email || "";
      email = actor.email || actor.username || "";
      ho_ten = actor.ho_ten || "";
    } else if (effective) {
      username = effective.username || effective.email || "";
      email = effective.email || effective.username || "";
      ho_ten = effective.ho_ten || "";
    }

    const payloadDong = {
      ...(duLieuDong && typeof duLieuDong === "object" ? duLieuDong : {}),
    };
    if (doiTuongId) payloadDong.doi_tuong_id = doiTuongId;
    if (viewAs && typeof getViewAsMeta === "function") {
      const meta = getViewAsMeta();
      if (meta) {
        payloadDong.impersonate = true;
        payloadDong.view_as = meta;
      }
    }

    await logActivity({
      username,
      email,
      ho_ten,
      phan_he: phanHe || "hop_dong",
      hanh_dong: hanhDong || "CAP_NHAT",
      chi_tiet: chiTietNgan || "",
      trang_thai: trangThai || "Thành công",
      du_lieu_dong: Object.keys(payloadDong).length ? payloadDong : null,
    });
  } catch (err) {
    console.error("logHoatDong", err?.message || err);
  }
}
