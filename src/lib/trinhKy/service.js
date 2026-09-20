import {
  BUOC_STATUS,
  CHU_KY_BUCKET,
  HO_SO_KY_STATUS,
  OTP_MAX_FAIL,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  TOKEN_TTL_MS,
  TRINH_KY_MODULE_NVKS,
  TRINH_KY_STATUS,
  VAI_TRO,
  VAI_TRO_LABEL,
  isTrinhKyInAppChannel,
  stampRolesForBuoc,
} from "./constants";
import { getTrinhKyModuleConfig } from "./modules";
import { generateOtp6, generateToken, hashOtp, hashPdfBytes, hashToken } from "./crypto";
import { notifyBuocKy, notifyOtpSms } from "./notify";
import { stampSignaturesOnPdf, DEFAULT_NVKS_STAMP_POSITIONS } from "./stampPdf";
import { buildTrinhKySteps, describeSignerKyRequirement, isSignerReady, labelSlot2ForVaiTro, normalizeVnPhone } from "./steps";
import { NVKS_EXPORT_BUCKET, cleanForFileName } from "../nvksExportStorage";
import { appendGiaiDoanToChiTiet, resolveLogGiaiDoan } from "../logChiTietFormat";

async function writeLog(supabase, { trinhKyId, buocId, hanhDong, maNv, ip, userAgent, chiTiet }) {
  try {
    await supabase.from("TRINH_KY_LOG").insert([
      {
        trinh_ky_id: trinhKyId,
        buoc_id: buocId || null,
        hanh_dong: hanhDong,
        ma_nv: maNv || null,
        ip: ip || null,
        user_agent: userAgent || null,
        chi_tiet: chiTiet || {},
      },
    ]);
  } catch {
    /* không chặn */
  }
}

async function fetchTenDuAn(supabase, maDuAn) {
  const ma = String(maDuAn || "").trim();
  if (!ma) return "";
  try {
    const { data } = await supabase
      .from("DANH_MUC_DA")
      .select("ten_du_an")
      .eq("ma_du_an", ma)
      .maybeSingle();
    return String(data?.ten_du_an || "").trim();
  } catch {
    return "";
  }
}

function formatDuAnChiTiet(maDuAn, tenDuAn) {
  const ma = String(maDuAn || "").trim();
  const ten = String(tenDuAn || "").trim();
  if (ten && ma) return `${ten} (${ma})`;
  return ten || ma || "—";
}

/**
 * Nhật ký QLHT (`LICHSU_HOATDONG`) — song song với TRINH_KY_LOG.
 * Server-side (không phụ thuộc session browser).
 */
async function writeLichSuKy(supabase, {
  module,
  hanhDong,
  chiTietNgan,
  doiTuongId,
  maNv,
  duLieuDong = {},
  trangThai = "Thành công",
}) {
  try {
    const cfg = getTrinhKyModuleConfig(module);
    let email = "System";
    let hoTen = "Hệ thống";
    if (maNv) {
      const ns = await fetchNhanSu(supabase, maNv);
      if (ns) {
        email = ns.email || email;
        hoTen = ns.ho_ten || hoTen;
      }
    }
    const payload = {
      module: cfg.module,
      ...(duLieuDong && typeof duLieuDong === "object" ? duLieuDong : {}),
    };
    const chiTiet = appendGiaiDoanToChiTiet(chiTietNgan, resolveLogGiaiDoan(payload));
    await supabase.from("LICHSU_HOATDONG").insert([
      {
        email,
        ho_ten: hoTen,
        phan_he: cfg.phanHe,
        hanh_dong: hanhDong,
        doi_tuong_id: doiTuongId != null ? String(doiTuongId) : null,
        chi_tiet_ngan: chiTiet,
        du_lieu_dong: payload,
        trang_thai: trangThai,
      },
    ]);
  } catch {
    /* không chặn luồng ký */
  }
}

async function fetchNhanSu(supabase, maNv) {
  const { data, error } = await supabase
    .from("NHAN_SU")
    .select("ma_nv, ho_ten, email, sdt, chu_ky_path, chu_ky_nhay_path, trang_thai, chuc_vu, phan_quyen")
    .eq("ma_nv", maNv)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function downloadUrlBytes(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Không tải được PDF (${res.status}).`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

async function downloadChuKy(supabase, path) {
  const { data, error } = await supabase.storage.from(CHU_KY_BUCKET).download(path);
  if (error || !data) throw new Error(`Không tải ảnh chữ ký: ${error?.message || "empty"}`);
  const ab = await data.arrayBuffer();
  return Buffer.from(ab);
}

async function loadStampPositions(supabase, module = TRINH_KY_MODULE_NVKS) {
  const { data } = await supabase
    .from("MAU_VI_TRI_KY")
    .select("vai_tro_stamp, trang, x, y, w, h")
    .eq("module", module)
    .eq("mau_code", "default");
  if (!data?.length && module !== TRINH_KY_MODULE_NVKS) {
    return loadStampPositions(supabase, TRINH_KY_MODULE_NVKS);
  }
  if (!data?.length) return DEFAULT_NVKS_STAMP_POSITIONS;
  const map = { ...DEFAULT_NVKS_STAMP_POSITIONS };
  for (const row of data) {
    map[row.vai_tro_stamp] = {
      pageIndex: Math.max(0, Number(row.trang) || 0),
      x: Number(row.x),
      y: Number(row.y),
      w: Number(row.w) || 120,
      h: Number(row.h) || 40,
    };
  }
  return map;
}

/**
 * Kích hoạt bước hiện tại.
 * In-app: chỉ đổi trạng thái + ghi log (token vẫn sinh sẵn để bật lại SMS sau).
 * SMS: gửi link + email như cũ.
 */
async function activateBuoc(supabase, buoc, context) {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const hetHan = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  const { error } = await supabase
    .from("TRINH_KY_BUOC")
    .update({
      trang_thai: BUOC_STATUS.DANG_CHO,
      token_hash: tokenHash,
      token_het_han: hetHan,
      otp_hash: null,
      otp_het_han: null,
      otp_fail_count: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", buoc.id);
  if (error) throw error;

  if (isTrinhKyInAppChannel()) {
    await writeLog(supabase, {
      trinhKyId: buoc.trinh_ky_id,
      buocId: buoc.id,
      hanhDong: "kich_hoat_in_app",
      maNv: buoc.ma_nv,
      ip: context.ip,
      userAgent: context.userAgent,
      chiTiet: { channel: "in_app", ma_du_an: context.maDuAn },
    });
    return { token, notify: { skipped: true, channel: "in_app" } };
  }

  const ns = await fetchNhanSu(supabase, buoc.ma_nv);
  const notify = await notifyBuocKy({
    sdt: buoc.sdt_snapshot || ns?.sdt,
    email: ns?.email,
    hoTen: buoc.ho_ten_snapshot || ns?.ho_ten,
    maDuAn: context.maDuAn,
    vaiTroLabel: VAI_TRO_LABEL[buoc.vai_tro] || buoc.vai_tro,
    token,
  });

  await writeLog(supabase, {
    trinhKyId: buoc.trinh_ky_id,
    buocId: buoc.id,
    hanhDong: "gui_sms",
    maNv: buoc.ma_nv,
    ip: context.ip,
    userAgent: context.userAgent,
    chiTiet: {
      sms: notify.sms,
      email: notify.email,
      link_host: notify.link?.split("/ky/")[0] || null,
    },
  });

  return { token, notify };
}

async function updateHoSoKyRecord(supabase, module, hoSoId, patch) {
  const cfg = getTrinhKyModuleConfig(module);
  const { error } = await supabase.from(cfg.table).update(patch).eq("id", hoSoId);
  if (error) throw error;
}

/**
 * Tạo phiên trình ký (NVKS / PAKTKS).
 */
export async function createTrinhKy(supabase, body, meta = {}) {
  const module = body.module || TRINH_KY_MODULE_NVKS;
  const cfg = getTrinhKyModuleConfig(module);
  const {
    hoSoId,
    nguoiTrinhMaNv,
    nguoiLapMaNv,
    cnksMaNv,
    lanhDaoMaNv,
  } = body;

  if (!hoSoId) throw new Error(cfg.missingHoSoIdError);
  if (!nguoiTrinhMaNv) throw new Error("Thiếu mã NV người trình.");

  const { data: hoSo, error: hoSoErr } = await supabase
    .from(cfg.table)
    .select(cfg.selectFields)
    .eq("id", hoSoId)
    .single();
  if (hoSoErr || !hoSo) throw new Error(cfg.missingHoSoError);
  if (!hoSo.link_pdf_xuat) throw new Error("Chưa có PDF xuất (In/PDF) — không thể trình ký.");

  if (hoSo.trang_thai_ky_noi_bo === HO_SO_KY_STATUS.DANG_TRINH) {
    throw new Error("Hồ sơ đang có phiên trình ký. Hãy hủy phiên cũ hoặc chờ hoàn tất.");
  }

  const pdfBytes = await downloadUrlBytes(hoSo.link_pdf_xuat);
  const pdfHash = hashPdfBytes(pdfBytes);
  const trinhLai = Boolean(body.trinhLai);

  if (hoSo.trang_thai_ky_noi_bo === HO_SO_KY_STATUS.DA_KY) {
    if (!trinhLai) {
      throw new Error(
        "Hồ sơ đã ký nội bộ. Xuất PDF mới (In/PDF) rồi chọn Trình lại — hoặc tạo phiên bản điều chỉnh."
      );
    }
    // Chỉ cho trình lại khi PDF phát hành đã khác bản đã ký (tránh mở chuỗi mới nhầm)
    if (hoSo.trinh_ky_id) {
      const { data: phienCu } = await supabase
        .from("TRINH_KY")
        .select("id, pdf_hash, pdf_phat_hanh_url, trang_thai")
        .eq("id", hoSo.trinh_ky_id)
        .maybeSingle();
      if (phienCu?.trang_thai === TRINH_KY_STATUS.HOAN_THANH) {
        const sameHash = phienCu.pdf_hash && phienCu.pdf_hash === pdfHash;
        const sameUrl = phienCu.pdf_phat_hanh_url && phienCu.pdf_phat_hanh_url === hoSo.link_pdf_xuat;
        if (sameHash || sameUrl) {
          throw new Error("PDF chưa đổi so với bản đã ký. Bấm In/PDF xuất lại trước khi trình lại.");
        }
      }
    }
  }

  const steps = buildTrinhKySteps({
    nguoiLapMaNv: nguoiLapMaNv || nguoiTrinhMaNv,
    cnksMaNv,
    lanhDaoMaNv,
  });

  const requirePhone = !isTrinhKyInAppChannel();
  const signers = [];
  for (const step of steps) {
    const ns = await fetchNhanSu(supabase, step.ma_nv);
    if (!ns || Number(ns.trang_thai) !== 1) {
      throw new Error(`Nhân sự ${step.ma_nv} không tồn tại hoặc đã khóa.`);
    }
    if (!isSignerReady(ns, { requirePhone, vaiTro: step.vai_tro })) {
      const need = describeSignerKyRequirement(step.vai_tro);
      throw new Error(
        requirePhone
          ? `${ns.ho_ten || step.ma_nv} chưa đủ điều kiện ký (cần SĐT và ${need}).`
          : `${ns.ho_ten || step.ma_nv} chưa đủ điều kiện ký (cần ${need} trên danh mục nhân sự).`
      );
    }
    signers.push({ ...step, ns, sdt: normalizeVnPhone(ns.sdt) });
  }

  const { data: phien, error: phienErr } = await supabase
    .from("TRINH_KY")
    .insert([
      {
        module,
        ho_so_id: hoSoId,
        ma_du_an: hoSo.ma_du_an,
        pdf_phat_hanh_url: hoSo.link_pdf_xuat,
        pdf_hash: pdfHash,
        trang_thai: TRINH_KY_STATUS.CHO_KY,
        buoc_hien_tai: 1,
        nguoi_trinh_ma_nv: nguoiTrinhMaNv,
      },
    ])
    .select("*")
    .single();
  if (phienErr) throw phienErr;

  const buocRows = signers.map((s) => ({
    trinh_ky_id: phien.id,
    stt: s.stt,
    vai_tro: s.vai_tro,
    ma_nv: s.ma_nv,
    ho_ten_snapshot: s.ns.ho_ten,
    sdt_snapshot: s.sdt,
    trang_thai: BUOC_STATUS.CHO,
  }));

  const { data: buocs, error: buocErr } = await supabase
    .from("TRINH_KY_BUOC")
    .insert(buocRows)
    .select("*")
    .order("stt");
  if (buocErr) throw buocErr;

  const lap = signers.find((s) => s.vai_tro === "nguoi_lap" || s.vai_tro === "nguoi_lap_cnks");
  const cnks = signers.find((s) => s.vai_tro === "cnks" || s.vai_tro === "nguoi_lap_cnks");
  const ld = signers.find((s) => s.vai_tro === "lanh_dao");

  await updateHoSoKyRecord(supabase, module, hoSoId, {
    trang_thai_ky_noi_bo: HO_SO_KY_STATUS.DANG_TRINH,
    trinh_ky_id: phien.id,
    nguoi_lap_ma_nv: lap?.ma_nv || nguoiLapMaNv || nguoiTrinhMaNv,
    chu_nhiem_ks_ma_nv: cnksMaNv,
    lanh_dao_duyet_ma_nv: lanhDaoMaNv,
    chu_nhiem_ks: cnks?.ns?.ho_ten || hoSo.chu_nhiem_ks,
    lanh_dao_duyet: ld?.ns?.ho_ten || hoSo.lanh_dao_duyet,
    nguoi_lap: lap?.ns?.ho_ten || hoSo.nguoi_lap,
    /** Trình lại trên PDF mới — bỏ link PDF đã ký cũ khỏi hồ sơ (phiên cũ vẫn trong lịch sử) */
    ...(trinhLai ? { link_pdf_da_ky: null, link_pdf_ky_dau: null } : {}),
  });

  await writeLog(supabase, {
    trinhKyId: phien.id,
    hanhDong: "trinh",
    maNv: nguoiTrinhMaNv,
    ip: meta.ip,
    userAgent: meta.userAgent,
    chiTiet: { buoc_count: buocs.length, pdf_hash: pdfHash, module, trinh_lai: trinhLai },
  });

  const tenDuAn = await fetchTenDuAn(supabase, hoSo.ma_du_an);
  const duAnLabel = formatDuAnChiTiet(hoSo.ma_du_an, tenDuAn);
  await writeLichSuKy(supabase, {
    module,
    hanhDong: trinhLai ? "TRINH_KY_LAI" : "TRINH_KY",
    chiTietNgan: trinhLai
      ? `Trình lại ký nội bộ ${cfg.label}: ${duAnLabel}`
      : `Trình ký nội bộ ${cfg.label}: ${duAnLabel}`,
    doiTuongId: hoSoId,
    maNv: nguoiTrinhMaNv,
    duLieuDong: {
      ma_du_an: hoSo.ma_du_an,
      ten_du_an: tenDuAn || null,
      trinh_ky_id: phien.id,
      trinh_lai: trinhLai,
      buoc_count: buocs.length,
    },
  });

  const first = buocs[0];
  const activated = await activateBuoc(supabase, first, {
    maDuAn: hoSo.ma_du_an,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return {
    trinhKyId: phien.id,
    buocCount: buocs.length,
    firstBuocId: first.id,
    notify: activated.notify,
    devToken: process.env.NODE_ENV !== "production" ? activated.token : undefined,
  };
}

/** @deprecated dùng createTrinhKy */
export async function createTrinhKyNvks(supabase, body, meta = {}) {
  return createTrinhKy(supabase, { ...body, module: TRINH_KY_MODULE_NVKS }, meta);
}

export async function cancelTrinhKy(supabase, { trinhKyId, maNv }, meta = {}) {
  const { data: phien, error } = await supabase.from("TRINH_KY").select("*").eq("id", trinhKyId).single();
  if (error || !phien) throw new Error("Không tìm thấy phiên trình ký.");
  if (phien.trang_thai !== TRINH_KY_STATUS.CHO_KY) {
    throw new Error("Chỉ hủy được phiên đang chờ ký.");
  }

  await supabase
    .from("TRINH_KY")
    .update({ trang_thai: TRINH_KY_STATUS.HUY, updated_at: new Date().toISOString() })
    .eq("id", trinhKyId);

  /** Hủy = về chưa trình: không giữ bước đã ký / PDF trung gian trên hồ sơ */
  await updateHoSoKyRecord(supabase, phien.module, phien.ho_so_id, {
    trang_thai_ky_noi_bo: HO_SO_KY_STATUS.CHUA_TRINH,
    trinh_ky_id: null,
    link_pdf_da_ky: null,
    link_pdf_ky_dau: null,
  });

  await writeLog(supabase, {
    trinhKyId,
    hanhDong: "huy",
    maNv,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  const cfg = getTrinhKyModuleConfig(phien.module);
  const tenDuAn = await fetchTenDuAn(supabase, phien.ma_du_an);
  const duAnLabel = formatDuAnChiTiet(phien.ma_du_an, tenDuAn);
  await writeLichSuKy(supabase, {
    module: phien.module,
    hanhDong: "HUY_TRINH_KY",
    chiTietNgan: `Hủy phiên trình ký ${cfg.label}: ${duAnLabel}`,
    doiTuongId: phien.ho_so_id,
    maNv,
    duLieuDong: {
      ma_du_an: phien.ma_du_an,
      ten_du_an: tenDuAn || null,
      trinh_ky_id: trinhKyId,
    },
  });

  return { ok: true };
}

export async function resendBuoc(supabase, { trinhKyId, maNv }, meta = {}) {
  const { data: phien } = await supabase.from("TRINH_KY").select("*").eq("id", trinhKyId).single();
  if (!phien || phien.trang_thai !== TRINH_KY_STATUS.CHO_KY) {
    throw new Error("Phiên không còn chờ ký.");
  }
  const { data: buoc } = await supabase
    .from("TRINH_KY_BUOC")
    .select("*")
    .eq("trinh_ky_id", trinhKyId)
    .eq("stt", phien.buoc_hien_tai)
    .single();
  if (!buoc) throw new Error("Không tìm thấy bước hiện tại.");

  const activated = await activateBuoc(supabase, buoc, {
    maDuAn: phien.ma_du_an,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  await writeLog(supabase, {
    trinhKyId,
    buocId: buoc.id,
    hanhDong: "gui_lai",
    maNv,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return {
    ok: true,
    notify: activated.notify,
    devToken: process.env.NODE_ENV !== "production" ? activated.token : undefined,
  };
}

async function findBuocByToken(supabase, token) {
  const th = hashToken(token);
  const { data: buoc, error } = await supabase
    .from("TRINH_KY_BUOC")
    .select("*")
    .eq("token_hash", th)
    .maybeSingle();
  if (error) throw error;
  if (!buoc) throw new Error("Link không hợp lệ hoặc đã hết hạn.");
  if (buoc.token_het_han && new Date(buoc.token_het_han).getTime() < Date.now()) {
    throw new Error("Link đã hết hạn. Yêu cầu gửi lại từ form hồ sơ.");
  }
  if (![BUOC_STATUS.DANG_CHO, BUOC_STATUS.DA_XEM].includes(buoc.trang_thai)) {
    throw new Error("Bước này đã xử lý xong.");
  }
  const { data: phien } = await supabase.from("TRINH_KY").select("*").eq("id", buoc.trinh_ky_id).single();
  if (!phien || phien.trang_thai !== TRINH_KY_STATUS.CHO_KY) {
    throw new Error("Phiên trình ký đã đóng.");
  }
  if (phien.buoc_hien_tai !== buoc.stt) {
    throw new Error("Chưa tới lượt ký của anh/chị.");
  }
  return { buoc, phien };
}

export async function getSessionByToken(supabase, token) {
  const { buoc, phien } = await findBuocByToken(supabase, token);
  return {
    trinhKyId: phien.id,
    maDuAn: phien.ma_du_an,
    module: phien.module,
    pdfUrl: phien.pdf_phat_hanh_url,
    vaiTro: buoc.vai_tro,
    vaiTroLabel: VAI_TRO_LABEL[buoc.vai_tro] || buoc.vai_tro,
    hoTen: buoc.ho_ten_snapshot,
    viewedAt: buoc.viewed_at,
    buocId: buoc.id,
  };
}

export async function markViewed(supabase, token, meta = {}) {
  const { buoc, phien } = await findBuocByToken(supabase, token);
  const now = new Date().toISOString();
  await supabase
    .from("TRINH_KY_BUOC")
    .update({
      trang_thai: BUOC_STATUS.DA_XEM,
      viewed_at: buoc.viewed_at || now,
      updated_at: now,
    })
    .eq("id", buoc.id);

  await writeLog(supabase, {
    trinhKyId: phien.id,
    buocId: buoc.id,
    hanhDong: "xem",
    maNv: buoc.ma_nv,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return { ok: true, viewedAt: buoc.viewed_at || now };
}

export async function requestOtp(supabase, token, meta = {}) {
  const { buoc, phien } = await findBuocByToken(supabase, token);
  if (!buoc.viewed_at && buoc.trang_thai !== BUOC_STATUS.DA_XEM) {
    throw new Error("Vui lòng mở xem tài liệu trước khi xác nhận.");
  }

  if (buoc.otp_het_han) {
    const remain = new Date(buoc.otp_het_han).getTime() - Date.now();
    // cooldown dựa trên OTP_TTL - remaining? Better: store last send in chi_tiet — use otp_het_han - OTP_TTL
    const sentAt = new Date(buoc.otp_het_han).getTime() - OTP_TTL_MS;
    if (Date.now() - sentAt < OTP_RESEND_COOLDOWN_MS) {
      throw new Error("Vui lòng đợi khoảng 1 phút trước khi gửi lại OTP.");
    }
  }

  const otp = generateOtp6();
  const otpHash = hashOtp(otp);
  const hetHan = new Date(Date.now() + OTP_TTL_MS).toISOString();
  await supabase
    .from("TRINH_KY_BUOC")
    .update({
      otp_hash: otpHash,
      otp_het_han: hetHan,
      otp_fail_count: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", buoc.id);

  const sms = await notifyOtpSms(buoc.sdt_snapshot, otp);

  // Dev: email OTP nếu SMS stub
  const ns = await fetchNhanSu(supabase, buoc.ma_nv);
  if (ns?.email && (sms.channel === "sms_stub" || !sms.ok)) {
    try {
      const { sendMailSimple } = await import("../email");
      await sendMailSimple({
        to: ns.email,
        subject: `iSurvey — OTP ký ${getTrinhKyModuleConfig(phien.module).otpEmailLabel} ${phien.ma_du_an}`,
        text: `Ma OTP: ${otp}\nHet han 5 phut.\n`,
      });
    } catch {
      /* ignore */
    }
  }

  await writeLog(supabase, {
    trinhKyId: phien.id,
    buocId: buoc.id,
    hanhDong: "gui_otp",
    maNv: buoc.ma_nv,
    ip: meta.ip,
    userAgent: meta.userAgent,
    chiTiet: { sms },
  });

  return {
    ok: true,
    sms,
    /** Chỉ trả OTP khi stub — tiện QA local */
    devOtp: sms.channel === "sms_stub" ? otp : undefined,
  };
}

/**
 * Stamp chữ ký cho bước đã xác thực + chuyển bước / hoàn tất.
 * Dùng chung cho OTP (token) và ký in-app (ma_nv).
 * Khi LĐ hoàn tất: sinh 2 PDF — +ký (chỉ chữ ký) và +ký dấu (ảnh slot 2 BGĐ).
 */
async function stampAndAdvanceBuoc(supabase, { buoc, phien }, meta = {}) {
  const pdfBytes = await downloadUrlBytes(phien.pdf_phat_hanh_url);
  const currentHash = hashPdfBytes(pdfBytes);
  if (currentHash !== phien.pdf_hash) {
    throw new Error("PDF phát hành đã thay đổi so với lúc trình ký. Hãy hủy và trình lại.");
  }

  let baseBytes = pdfBytes;
  if (phien.pdf_da_ky_url) {
    baseBytes = await downloadUrlBytes(phien.pdf_da_ky_url);
  }

  const isLd = buoc.vai_tro === VAI_TRO.LANH_DAO;
  const slot2Label = labelSlot2ForVaiTro(buoc.vai_tro);
  const ns = await fetchNhanSu(supabase, buoc.ma_nv);
  if (isLd && !ns?.chu_ky_path) throw new Error("Không tìm thấy ảnh ký chính.");
  if (!ns?.chu_ky_nhay_path) throw new Error(`Không tìm thấy ảnh ${slot2Label}.`);
  const imgChinh = isLd ? await downloadChuKy(supabase, ns.chu_ky_path) : null;
  const imgSlot2 = await downloadChuKy(supabase, ns.chu_ky_nhay_path);
  const roles = stampRolesForBuoc(buoc.vai_tro);
  const modCfg = getTrinhKyModuleConfig(phien.module);
  const positions = await loadStampPositions(supabase, modCfg.stampModule);
  const signedAt = new Date();
  /** Mẫu bìa: NL/CNKS → ký nháy; Lãnh đạo → ký chính (+ký); hoàn tất thêm bản ký dấu */
  const stampsKy = [];
  for (const role of roles) {
    if (role === VAI_TRO.LANH_DAO) {
      stampsKy.push({ role, imageBytes: imgChinh, signedAt });
    } else {
      stampsKy.push({ role: `${role}_nhay`, imageBytes: imgSlot2, signedAt });
    }
  }
  const stampedKy = await stampSignaturesOnPdf(baseBytes, stampsKy, positions);

  const folder = cleanForFileName(phien.ma_du_an);
  const uploadPdf = async (bytes, fileTag) => {
    const fileName = `${folder}_${fileTag}_${Date.now()}.pdf`;
    const storagePath = `${folder}/${fileName}`;
    const { error: upErr } = await supabase.storage.from(NVKS_EXPORT_BUCKET).upload(storagePath, bytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upErr) throw new Error(`Không lưu PDF đã ký: ${upErr.message}`);
    const { data: pub } = supabase.storage.from(NVKS_EXPORT_BUCKET).getPublicUrl(storagePath);
    return { signedUrl: pub?.publicUrl || "", fileName, storagePath };
  };

  const kyUp = await uploadPdf(stampedKy, modCfg.signedFileTag);
  const signedUrl = kyUp.signedUrl;
  const fileName = kyUp.fileName;

  const now = signedAt.toISOString();
  await supabase
    .from("TRINH_KY_BUOC")
    .update({
      trang_thai: BUOC_STATUS.DA_KY,
      signed_at: now,
      viewed_at: buoc.viewed_at || now,
      token_hash: null,
      otp_hash: null,
      updated_at: now,
    })
    .eq("id", buoc.id);

  await writeLog(supabase, {
    trinhKyId: phien.id,
    buocId: buoc.id,
    hanhDong: "ky_ok",
    maNv: buoc.ma_nv,
    ip: meta.ip,
    userAgent: meta.userAgent,
    chiTiet: { roles, signed_url: signedUrl, channel: meta.channel || "otp" },
  });

  const tenDuAn = await fetchTenDuAn(supabase, phien.ma_du_an);
  const duAnLabel = formatDuAnChiTiet(phien.ma_du_an, tenDuAn);
  const vaiTroLabel = VAI_TRO_LABEL[buoc.vai_tro] || buoc.vai_tro || "Người ký";
  await writeLichSuKy(supabase, {
    module: phien.module,
    hanhDong: "KY",
    chiTietNgan: `Ký hồ sơ ${modCfg.label} — ${vaiTroLabel}: ${duAnLabel}`,
    doiTuongId: phien.ho_so_id,
    maNv: buoc.ma_nv,
    duLieuDong: {
      ma_du_an: phien.ma_du_an,
      ten_du_an: tenDuAn || null,
      trinh_ky_id: phien.id,
      vai_tro: buoc.vai_tro,
      channel: meta.channel || "otp",
      file_name: fileName,
    },
  });

  const { data: allBuocs } = await supabase
    .from("TRINH_KY_BUOC")
    .select("*")
    .eq("trinh_ky_id", phien.id)
    .order("stt");

  const next = (allBuocs || []).find((b) => b.stt === buoc.stt + 1);
  if (next) {
    await supabase
      .from("TRINH_KY")
      .update({
        buoc_hien_tai: next.stt,
        pdf_da_ky_url: signedUrl,
        updated_at: now,
      })
      .eq("id", phien.id);

    await activateBuoc(supabase, next, {
      maDuAn: phien.ma_du_an,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return { ok: true, done: false, nextStt: next.stt, pdfDaKyUrl: signedUrl };
  }

  /** Hoàn tất: nếu LĐ — thêm bản +ký dấu từ cùng nền (trước khi chèn ký chính) */
  let kyDauUrl = null;
  let kyDauFileName = null;
  if (isLd) {
    const stampsDau = [{ role: `${VAI_TRO.LANH_DAO}_dau`, imageBytes: imgSlot2, signedAt }];
    const stampedDau = await stampSignaturesOnPdf(baseBytes, stampsDau, positions);
    const dauUp = await uploadPdf(stampedDau, modCfg.signedFileTagKyDau);
    kyDauUrl = dauUp.signedUrl;
    kyDauFileName = dauUp.fileName;
  }

  await supabase
    .from("TRINH_KY")
    .update({
      trang_thai: TRINH_KY_STATUS.HOAN_THANH,
      pdf_da_ky_url: signedUrl,
      ...(kyDauUrl ? { pdf_ky_dau_url: kyDauUrl } : {}),
      updated_at: now,
    })
    .eq("id", phien.id);

  await updateHoSoKyRecord(supabase, phien.module, phien.ho_so_id, {
    trang_thai_ky_noi_bo: HO_SO_KY_STATUS.DA_KY,
    link_pdf_da_ky: signedUrl,
    ...(kyDauUrl ? { link_pdf_ky_dau: kyDauUrl } : { link_pdf_ky_dau: null }),
    trinh_ky_id: phien.id,
  });

  await writeLichSuKy(supabase, {
    module: phien.module,
    hanhDong: "KY_HOAN_THANH",
    chiTietNgan: `Hoàn tất ký nội bộ ${modCfg.label}: ${duAnLabel}`,
    doiTuongId: phien.ho_so_id,
    maNv: buoc.ma_nv,
    duLieuDong: {
      ma_du_an: phien.ma_du_an,
      ten_du_an: tenDuAn || null,
      trinh_ky_id: phien.id,
      file_name: fileName,
      link_pdf_da_ky: signedUrl,
      ...(kyDauUrl
        ? { file_name_ky_dau: kyDauFileName, link_pdf_ky_dau: kyDauUrl }
        : {}),
    },
  });

  try {
    const { syncTaiLieuHoSoByTagSafe } = await import("../hoSoTaiLieu");
    await syncTaiLieuHoSoByTagSafe(supabase, {
      maDuAn: phien.ma_du_an,
      moduleLoai: modCfg.khoModuleLoai,
      tag: "pdf_da_ky",
      storagePath: signedUrl,
      displayName: fileName,
      nguoiUpMaNv: buoc.ma_nv,
    });
    if (kyDauUrl) {
      await syncTaiLieuHoSoByTagSafe(supabase, {
        maDuAn: phien.ma_du_an,
        moduleLoai: modCfg.khoModuleLoai,
        tag: "pdf_ky_dau",
        storagePath: kyDauUrl,
        displayName: kyDauFileName,
        nguoiUpMaNv: buoc.ma_nv,
      });
    }
  } catch {
    /* kho không chặn */
  }

  return {
    ok: true,
    done: true,
    pdfDaKyUrl: signedUrl,
    pdfKyDauUrl: kyDauUrl || null,
  };
}

export async function confirmBuoc(supabase, token, otp, meta = {}) {
  const { buoc, phien } = await findBuocByToken(supabase, token);
  if (!buoc.viewed_at && buoc.trang_thai !== BUOC_STATUS.DA_XEM) {
    throw new Error("Vui lòng xem tài liệu trước.");
  }
  if (!buoc.otp_hash || !buoc.otp_het_han) {
    throw new Error("Chưa gửi OTP. Bấm Đồng ý để nhận mã.");
  }
  if (new Date(buoc.otp_het_han).getTime() < Date.now()) {
    throw new Error("OTP đã hết hạn. Yêu cầu gửi lại.");
  }
  if ((buoc.otp_fail_count || 0) >= OTP_MAX_FAIL) {
    throw new Error("Nhập sai OTP quá nhiều lần. Yêu cầu gửi lại mã mới.");
  }
  if (hashOtp(otp) !== buoc.otp_hash) {
    await supabase
      .from("TRINH_KY_BUOC")
      .update({ otp_fail_count: (buoc.otp_fail_count || 0) + 1 })
      .eq("id", buoc.id);
    throw new Error("OTP không đúng.");
  }

  return stampAndAdvanceBuoc(supabase, { buoc, phien }, { ...meta, channel: "otp" });
}

async function findActiveBuocForSigner(supabase, buocId, maNv) {
  const id = String(buocId || "").trim();
  const signer = String(maNv || "").trim();
  if (!id || !signer) throw new Error("Thiếu bước ký hoặc mã nhân viên.");

  const { data: buoc, error } = await supabase.from("TRINH_KY_BUOC").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!buoc) throw new Error("Không tìm thấy bước ký.");
  if (String(buoc.ma_nv) !== signer) {
    throw new Error("Anh/chị không phải người ký của bước này.");
  }
  if (![BUOC_STATUS.DANG_CHO, BUOC_STATUS.DA_XEM].includes(buoc.trang_thai)) {
    throw new Error("Bước này đã xử lý xong.");
  }

  const { data: phien } = await supabase.from("TRINH_KY").select("*").eq("id", buoc.trinh_ky_id).single();
  if (!phien || phien.trang_thai !== TRINH_KY_STATUS.CHO_KY) {
    throw new Error("Phiên trình ký đã đóng.");
  }
  if (phien.buoc_hien_tai !== buoc.stt) {
    throw new Error("Chưa tới lượt ký của anh/chị.");
  }
  return { buoc, phien };
}

/** Ký trong app (đăng nhập) — không OTP. */
export async function signBuocInApp(supabase, { buocId, maNv }, meta = {}) {
  const { buoc, phien } = await findActiveBuocForSigner(supabase, buocId, maNv);
  const now = new Date().toISOString();
  if (!buoc.viewed_at) {
    await supabase
      .from("TRINH_KY_BUOC")
      .update({
        trang_thai: BUOC_STATUS.DA_XEM,
        viewed_at: now,
        updated_at: now,
      })
      .eq("id", buoc.id);
    buoc.viewed_at = now;
    buoc.trang_thai = BUOC_STATUS.DA_XEM;
    await writeLog(supabase, {
      trinhKyId: phien.id,
      buocId: buoc.id,
      hanhDong: "xem",
      maNv,
      ip: meta.ip,
      userAgent: meta.userAgent,
      chiTiet: { channel: "in_app" },
    });
  }
  return stampAndAdvanceBuoc(supabase, { buoc, phien }, { ...meta, channel: "in_app" });
}

/** Từ chối trong app. */
export async function rejectBuocInApp(supabase, { buocId, maNv, lyDo }, meta = {}) {
  const reason = String(lyDo || "").trim();
  if (reason.length < 3) throw new Error("Vui lòng nhập lý do từ chối (tối thiểu 3 ký tự).");

  const { buoc, phien } = await findActiveBuocForSigner(supabase, buocId, maNv);
  const now = new Date().toISOString();

  await supabase
    .from("TRINH_KY_BUOC")
    .update({
      trang_thai: BUOC_STATUS.TU_CHOI,
      ly_do_tu_choi: reason,
      token_hash: null,
      otp_hash: null,
      updated_at: now,
    })
    .eq("id", buoc.id);

  await supabase
    .from("TRINH_KY")
    .update({
      trang_thai: TRINH_KY_STATUS.TU_CHOI,
      ly_do_tu_choi: reason,
      updated_at: now,
    })
    .eq("id", phien.id);

  await updateHoSoKyRecord(supabase, phien.module, phien.ho_so_id, {
    trang_thai_ky_noi_bo: HO_SO_KY_STATUS.TU_CHOI,
    trinh_ky_id: phien.id,
  });

  await writeLog(supabase, {
    trinhKyId: phien.id,
    buocId: buoc.id,
    hanhDong: "tu_choi",
    maNv,
    ip: meta.ip,
    userAgent: meta.userAgent,
    chiTiet: { ly_do: reason, channel: "in_app" },
  });

  const cfg = getTrinhKyModuleConfig(phien.module);
  const tenDuAn = await fetchTenDuAn(supabase, phien.ma_du_an);
  const duAnLabel = formatDuAnChiTiet(phien.ma_du_an, tenDuAn);
  const vaiTroLabel = VAI_TRO_LABEL[buoc.vai_tro] || buoc.vai_tro || "Người ký";
  const lyDoNgan = reason.length > 80 ? `${reason.slice(0, 80)}…` : reason;
  await writeLichSuKy(supabase, {
    module: phien.module,
    hanhDong: "TU_CHOI_KY",
    chiTietNgan: `Từ chối ký ${cfg.label} — ${vaiTroLabel}: ${duAnLabel} — ${lyDoNgan}`,
    doiTuongId: phien.ho_so_id,
    maNv,
    duLieuDong: {
      ma_du_an: phien.ma_du_an,
      ten_du_an: tenDuAn || null,
      trinh_ky_id: phien.id,
      vai_tro: buoc.vai_tro,
      ly_do: reason,
      channel: "in_app",
    },
  });

  return { ok: true };
}

/**
 * Inbox: bước đang chờ đúng ma_nv (để KPI + danh sách ký).
 */
export async function listInboxChoKy(supabase, maNv) {
  const signer = String(maNv || "").trim();
  if (!signer) throw new Error("Thiếu mã nhân viên.");

  const { data: buocs, error } = await supabase
    .from("TRINH_KY_BUOC")
    .select(
      "id, stt, vai_tro, ma_nv, ho_ten_snapshot, trang_thai, viewed_at, trinh_ky_id, created_at, updated_at"
    )
    .eq("ma_nv", signer)
    .in("trang_thai", [BUOC_STATUS.DANG_CHO, BUOC_STATUS.DA_XEM])
    .order("updated_at", { ascending: false });
  if (error) throw error;
  if (!buocs?.length) return { items: [], choKy: 0 };

  const phienIds = [...new Set(buocs.map((b) => b.trinh_ky_id))];
  const { data: phiens, error: pErr } = await supabase
    .from("TRINH_KY")
    .select(
      "id, module, ho_so_id, ma_du_an, pdf_phat_hanh_url, pdf_da_ky_url, trang_thai, buoc_hien_tai, nguoi_trinh_ma_nv, created_at"
    )
    .in("id", phienIds)
    .eq("trang_thai", TRINH_KY_STATUS.CHO_KY);
  if (pErr) throw pErr;

  const phienMap = new Map((phiens || []).map((p) => [p.id, p]));

  const maList = [...new Set((phiens || []).map((p) => p.ma_du_an).filter(Boolean))];
  let tenByMa = {};
  if (maList.length) {
    const { data: projects } = await supabase
      .from("DANH_MUC_DA")
      .select("ma_du_an, ten_du_an")
      .in("ma_du_an", maList);
    for (const p of projects || []) {
      if (p.ma_du_an) tenByMa[p.ma_du_an] = p.ten_du_an || "";
    }
  }

  const items = [];
  for (const b of buocs) {
    const phien = phienMap.get(b.trinh_ky_id);
    if (!phien) continue;
    if (phien.buoc_hien_tai !== b.stt) continue;
    items.push({
      buocId: b.id,
      stt: b.stt,
      vaiTro: b.vai_tro,
      vaiTroLabel: VAI_TRO_LABEL[b.vai_tro] || b.vai_tro,
      maNv: b.ma_nv,
      hoTen: b.ho_ten_snapshot,
      trangThaiBuoc: b.trang_thai,
      trinhKyId: phien.id,
      module: phien.module,
      hoSoId: phien.ho_so_id,
      maDuAn: phien.ma_du_an,
      tenDuAn: tenByMa[phien.ma_du_an] || "",
      pdfUrl: phien.pdf_da_ky_url || phien.pdf_phat_hanh_url,
      pdfPhatHanhUrl: phien.pdf_phat_hanh_url,
      nguoiTrinhMaNv: phien.nguoi_trinh_ma_nv,
      createdAt: phien.created_at,
    });
  }

  return { items, choKy: items.length };
}

/**
 * Đếm lịch sử theo hồ sơ (module + ho_so_id):
 * — so_lan_trinh: số phiên trình ký của hồ sơ (mọi người trình — NL ≠ CNKS vẫn thấy Lần N)
 * — so_lan_ky: số lần người xem đã ký (bước da_ky) trên hồ sơ đó (cột BGĐ)
 */
export async function enrichTrinhKyLanSu(supabase, maNv, rows) {
  const list = rows || [];
  if (!list.length) return list;
  const signer = String(maNv || "").trim();
  if (!signer) {
    return list.map((r) => ({ ...r, so_lan_trinh: 0, so_lan_ky: 0 }));
  }

  const hoSoIds = [
    ...new Set(list.map((r) => r.ho_so_id || r.hoSoId).filter(Boolean).map(String)),
  ];
  if (!hoSoIds.length) {
    return list.map((r) => ({ ...r, so_lan_trinh: 0, so_lan_ky: 0 }));
  }

  const { data: phiens, error } = await supabase
    .from("TRINH_KY")
    .select("id, module, ho_so_id, nguoi_trinh_ma_nv, trang_thai")
    .in("ho_so_id", hoSoIds);
  if (error) throw error;

  const trinhCount = {};
  for (const p of phiens || []) {
    /** Bỏ phiên đã hủy — không tính vào «Lần N» */
    if (p.trang_thai === TRINH_KY_STATUS.HUY) continue;
    const k = `${p.module}|${p.ho_so_id}`;
    trinhCount[k] = (trinhCount[k] || 0) + 1;
  }

  const phienById = new Map((phiens || []).map((p) => [p.id, p]));
  const phienIds = [...phienById.keys()];
  const kyCount = {};
  if (phienIds.length) {
    const { data: buocs, error: bErr } = await supabase
      .from("TRINH_KY_BUOC")
      .select("trinh_ky_id")
      .eq("ma_nv", signer)
      .eq("trang_thai", BUOC_STATUS.DA_KY)
      .in("trinh_ky_id", phienIds);
    if (bErr) throw bErr;
    for (const b of buocs || []) {
      const p = phienById.get(b.trinh_ky_id);
      if (!p) continue;
      const k = `${p.module}|${p.ho_so_id}`;
      kyCount[k] = (kyCount[k] || 0) + 1;
    }
  }

  return list.map((r) => {
    const mod = r.module || "";
    const hid = r.ho_so_id || r.hoSoId || "";
    const k = `${mod}|${hid}`;
    return {
      ...r,
      so_lan_trinh: trinhCount[k] || 0,
      so_lan_ky: kyCount[k] || 0,
    };
  });
}

/**
 * Hồ sơ liên quan tới ma_nv đã tham gia ký / trình:
 * — phiên hoàn tất (tôi trình hoặc tôi đã ký), hoặc
 * — phiên còn chờ ký nhưng tôi đã ký xong bước của mình (vd. CNKS → chờ LĐ).
 */
export async function listHoSoDaKyForMaNv(supabase, maNv) {
  const signer = String(maNv || "").trim();
  if (!signer) throw new Error("Thiếu mã nhân viên.");

  const [{ data: signedBuocs, error: bErr }, { data: asTrinh, error: tErr }] = await Promise.all([
    supabase
      .from("TRINH_KY_BUOC")
      .select("trinh_ky_id")
      .eq("ma_nv", signer)
      .eq("trang_thai", BUOC_STATUS.DA_KY),
    supabase
      .from("TRINH_KY")
      .select("id")
      .eq("nguoi_trinh_ma_nv", signer)
      .eq("trang_thai", TRINH_KY_STATUS.HOAN_THANH),
  ]);
  if (bErr) throw bErr;
  if (tErr) throw tErr;

  const signedIdSet = new Set((signedBuocs || []).map((b) => b.trinh_ky_id).filter(Boolean));
  const ids = [
    ...new Set([
      ...signedIdSet,
      ...(asTrinh || []).map((r) => r.id),
    ].filter(Boolean)),
  ];
  if (!ids.length) return [];

  const { data: phiens, error } = await supabase
    .from("TRINH_KY")
    .select(
      "id, module, ho_so_id, ma_du_an, trang_thai, pdf_phat_hanh_url, pdf_da_ky_url, pdf_ky_dau_url, ly_do_tu_choi, created_at, updated_at, buoc_hien_tai, nguoi_trinh_ma_nv"
    )
    .in("id", ids)
    .in("trang_thai", [TRINH_KY_STATUS.HOAN_THANH, TRINH_KY_STATUS.CHO_KY])
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw error;

  /** Chỉ giữ phiên đang chờ nếu chính tôi đã ký một bước (không lẫn hồ sơ chỉ mới trình) */
  const filtered = (phiens || []).filter(
    (p) => p.trang_thai === TRINH_KY_STATUS.HOAN_THANH || signedIdSet.has(p.id)
  );

  const choKyIds = filtered
    .filter((p) => p.trang_thai === TRINH_KY_STATUS.CHO_KY)
    .map((p) => p.id);
  let choBuocByPhien = {};
  if (choKyIds.length) {
    const { data: dangCho } = await supabase
      .from("TRINH_KY_BUOC")
      .select("trinh_ky_id, stt, vai_tro, trang_thai")
      .in("trinh_ky_id", choKyIds)
      .in("trang_thai", [BUOC_STATUS.DANG_CHO, BUOC_STATUS.DA_XEM]);
    for (const b of dangCho || []) {
      choBuocByPhien[b.trinh_ky_id] = b;
    }
  }

  return filtered.map((p) => {
    const cho = choBuocByPhien[p.id];
    const choVaiTro = cho?.vai_tro || null;
    return {
      ...p,
      cho_vai_tro: choVaiTro,
      cho_vai_tro_label: choVaiTro ? VAI_TRO_LABEL[choVaiTro] || choVaiTro : null,
    };
  });
}

/**
 * KPI cá nhân: chờ tôi ký + hồ sơ tôi trình đang chờ / hồ sơ đã ký (trình hoặc tham gia ký).
 */
export async function getTrinhKyKpiForMaNv(supabase, maNv) {
  const signer = String(maNv || "").trim();
  if (!signer) throw new Error("Thiếu mã nhân viên.");

  const [inbox, daKyRows] = await Promise.all([
    listInboxChoKy(supabase, signer),
    listHoSoDaKyForMaNv(supabase, signer),
  ]);

  const { count: dangTrinh, error: e1 } = await supabase
    .from("TRINH_KY")
    .select("id", { count: "exact", head: true })
    .eq("nguoi_trinh_ma_nv", signer)
    .eq("trang_thai", TRINH_KY_STATUS.CHO_KY);
  if (e1) throw e1;

  return {
    choKy: inbox.choKy,
    hoSoChoKy: dangTrinh || 0,
    hoSoDaKy: daKyRows.length,
  };
}

const CO_CAU_ROLE_META = {
  nguoi_lap: { label: "Chờ Người lập", color: "#3b82f6" },
  cnks: { label: "Chờ CNKS", color: "#0d9488" },
  nguoi_lap_cnks: { label: "Chờ Người lập / CNKS", color: "#6366f1" },
  lanh_dao: { label: "Chờ Lãnh đạo", color: "#f59e0b" },
};

const CO_CAU_MODULE_META = {
  nvks: { label: "NVKS", color: "#0288D1" },
  paktks: { label: "PAKTKS", color: "#8E24AA" },
  nkks: { label: "NKKS", color: "#F57C00" },
  bcks: { label: "BCKS", color: "#388E3C" },
  ntks: { label: "NTKS", color: "#D32F2F" },
};

/**
 * Cơ cấu toàn hệ thống: phiên đang chờ ký — theo bước hiện tại + theo module.
 */
export async function getTrinhKyChoKyCoCau(supabase) {
  const { data: phiens, error } = await supabase
    .from("TRINH_KY")
    .select("id, module, buoc_hien_tai, ma_du_an")
    .eq("trang_thai", TRINH_KY_STATUS.CHO_KY);
  if (error) throw error;
  const list = phiens || [];
  if (!list.length) {
    return { tong: 0, byRole: [], byModule: [] };
  }

  const phienIds = list.map((p) => p.id);
  const { data: buocs, error: bErr } = await supabase
    .from("TRINH_KY_BUOC")
    .select("trinh_ky_id, stt, vai_tro, trang_thai")
    .in("trinh_ky_id", phienIds)
    .in("trang_thai", [BUOC_STATUS.DANG_CHO, BUOC_STATUS.DA_XEM]);
  if (bErr) throw bErr;

  const currentByPhien = new Map();
  for (const b of buocs || []) {
    const phien = list.find((p) => p.id === b.trinh_ky_id);
    if (!phien || phien.buoc_hien_tai !== b.stt) continue;
    currentByPhien.set(b.trinh_ky_id, b.vai_tro);
  }

  const roleCount = {};
  const moduleCount = {};
  for (const p of list) {
    const role = currentByPhien.get(p.id) || "lanh_dao";
    roleCount[role] = (roleCount[role] || 0) + 1;
    const mod = String(p.module || "nvks").toLowerCase();
    moduleCount[mod] = (moduleCount[mod] || 0) + 1;
  }

  const byRole = Object.keys(CO_CAU_ROLE_META).map((key) => ({
    key,
    name: CO_CAU_ROLE_META[key].label,
    value: roleCount[key] || 0,
    color: CO_CAU_ROLE_META[key].color,
  })).filter((r) => r.value > 0);

  // Nếu có vai_tro lạ
  for (const [key, value] of Object.entries(roleCount)) {
    if (CO_CAU_ROLE_META[key]) continue;
    byRole.push({
      key,
      name: VAI_TRO_LABEL[key] || key,
      value,
      color: "#94a3b8",
    });
  }

  const byModule = Object.entries(moduleCount).map(([key, value]) => ({
    key,
    name: CO_CAU_MODULE_META[key]?.label || key.toUpperCase(),
    value,
    color: CO_CAU_MODULE_META[key]?.color || "#64748b",
  }));

  return {
    tong: list.length,
    byRole,
    byModule,
  };
}

export async function rejectBuoc(supabase, token, lyDo, meta = {}) {
  const reason = String(lyDo || "").trim();
  if (reason.length < 3) throw new Error("Vui lòng nhập lý do từ chối (tối thiểu 3 ký tự).");

  const { buoc, phien } = await findBuocByToken(supabase, token);
  const now = new Date().toISOString();

  await supabase
    .from("TRINH_KY_BUOC")
    .update({
      trang_thai: BUOC_STATUS.TU_CHOI,
      ly_do_tu_choi: reason,
      token_hash: null,
      otp_hash: null,
      updated_at: now,
    })
    .eq("id", buoc.id);

  await supabase
    .from("TRINH_KY")
    .update({
      trang_thai: TRINH_KY_STATUS.TU_CHOI,
      ly_do_tu_choi: reason,
      updated_at: now,
    })
    .eq("id", phien.id);

  await updateHoSoKyRecord(supabase, phien.module, phien.ho_so_id, {
    trang_thai_ky_noi_bo: HO_SO_KY_STATUS.TU_CHOI,
    trinh_ky_id: phien.id,
  });

  await writeLog(supabase, {
    trinhKyId: phien.id,
    buocId: buoc.id,
    hanhDong: "tu_choi",
    maNv: buoc.ma_nv,
    ip: meta.ip,
    userAgent: meta.userAgent,
    chiTiet: { ly_do: reason },
  });

  const cfg = getTrinhKyModuleConfig(phien.module);
  const tenDuAn = await fetchTenDuAn(supabase, phien.ma_du_an);
  const duAnLabel = formatDuAnChiTiet(phien.ma_du_an, tenDuAn);
  const vaiTroLabel = VAI_TRO_LABEL[buoc.vai_tro] || buoc.vai_tro || "Người ký";
  const lyDoNgan = reason.length > 80 ? `${reason.slice(0, 80)}…` : reason;
  await writeLichSuKy(supabase, {
    module: phien.module,
    hanhDong: "TU_CHOI_KY",
    chiTietNgan: `Từ chối ký ${cfg.label} — ${vaiTroLabel}: ${duAnLabel} — ${lyDoNgan}`,
    doiTuongId: phien.ho_so_id,
    maNv: buoc.ma_nv,
    duLieuDong: {
      ma_du_an: phien.ma_du_an,
      ten_du_an: tenDuAn || null,
      trinh_ky_id: phien.id,
      vai_tro: buoc.vai_tro,
      ly_do: reason,
      channel: "otp",
    },
  });

  return { ok: true };
}

export async function getTrinhKyStatus(supabase, hoSoId, module = TRINH_KY_MODULE_NVKS) {
  const cfg = getTrinhKyModuleConfig(module);
  const { data: hoSo } = await supabase
    .from(cfg.table)
    .select("trang_thai_ky_noi_bo, trinh_ky_id, link_pdf_da_ky, link_pdf_ky_dau")
    .eq("id", hoSoId)
    .maybeSingle();
  const trangThai = hoSo?.trang_thai_ky_noi_bo || HO_SO_KY_STATUS.CHUA_TRINH;
  if (!hoSo?.trinh_ky_id) {
    return {
      trangThai,
      buocs: [],
      linkPdfDaKy: hoSo?.link_pdf_da_ky || null,
      linkPdfKyDau: hoSo?.link_pdf_ky_dau || null,
      phien: null,
    };
  }
  const { data: phien } = await supabase.from("TRINH_KY").select("*").eq("id", hoSo.trinh_ky_id).maybeSingle();

  /** Phiên đã hủy / không còn gắn hồ sơ → UI chưa trình; vẫn trả PDF đã ký nếu còn trên hồ sơ */
  if (
    !phien ||
    phien.trang_thai === TRINH_KY_STATUS.HUY ||
    trangThai === HO_SO_KY_STATUS.CHUA_TRINH
  ) {
    return {
      trangThai: HO_SO_KY_STATUS.CHUA_TRINH,
      buocs: [],
      linkPdfDaKy: hoSo?.link_pdf_da_ky || null,
      linkPdfKyDau: hoSo?.link_pdf_ky_dau || null,
      phien: null,
    };
  }

  const { data: buocs } = await supabase
    .from("TRINH_KY_BUOC")
    .select("id, stt, vai_tro, ma_nv, ho_ten_snapshot, trang_thai, viewed_at, signed_at, ly_do_tu_choi")
    .eq("trinh_ky_id", hoSo.trinh_ky_id)
    .order("stt");
  return {
    trangThai,
    linkPdfDaKy: hoSo.link_pdf_da_ky,
    linkPdfKyDau: hoSo.link_pdf_ky_dau || phien?.pdf_ky_dau_url || null,
    phien,
    buocs: buocs || [],
  };
}
