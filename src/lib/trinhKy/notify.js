import { sendMailSimple } from "../email";

/**
 * Gửi SMS trình ký.
 * Phase 1: nếu có SMS_WEBHOOK_URL thì POST; không thì log + dựa email backup.
 */
export async function sendTrinhKySms(sdt, noiDung) {
  const phone = String(sdt || "").trim();
  const text = String(noiDung || "").trim();
  if (!phone || !text) {
    return { ok: false, channel: "sms", error: "Thiếu SĐT hoặc nội dung." };
  }

  const webhook = (process.env.SMS_WEBHOOK_URL || "").trim();
  if (webhook) {
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.SMS_WEBHOOK_TOKEN
            ? { Authorization: `Bearer ${process.env.SMS_WEBHOOK_TOKEN}` }
            : {}),
        },
        body: JSON.stringify({ to: phone, message: text }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return { ok: false, channel: "sms", error: `SMS HTTP ${res.status}: ${body}` };
      }
      return { ok: true, channel: "sms" };
    } catch (err) {
      return { ok: false, channel: "sms", error: err.message || String(err) };
    }
  }

  if (process.env.TRINH_KY_SMS_DEV_LOG === "1" || process.env.NODE_ENV !== "production") {
    console.info("[trinh-ky SMS stub]", phone, text);
  }
  return {
    ok: true,
    channel: "sms_stub",
    warning: "Chưa cấu hình SMS_WEBHOOK_URL — đã ghi log stub; dùng email backup.",
  };
}

export async function sendTrinhKyEmail({ to, subject, text }) {
  if (!to) return { ok: false, channel: "email", error: "Thiếu email." };
  try {
    await sendMailSimple({ to, subject, text });
    return { ok: true, channel: "email" };
  } catch (err) {
    return { ok: false, channel: "email", error: err.message || String(err) };
  }
}

export function buildKyLink(token) {
  const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "").replace(/\/$/, "");
  if (base) return `${base}/ky/${token}`;
  return `/ky/${token}`;
}

export async function notifyBuocKy({ sdt, email, hoTen, maDuAn, vaiTroLabel, token }) {
  const link = buildKyLink(token);
  const smsText = `[iSurvey] Ho so NVKS ${maDuAn} can xac nhan ky (${vaiTroLabel}). Xem: ${link}`;
  const sms = await sendTrinhKySms(sdt, smsText);

  let emailResult = { ok: false, skipped: true };
  if (email) {
    emailResult = await sendTrinhKyEmail({
      to: email,
      subject: `iSurvey — Xác nhận ký NVKS ${maDuAn}`,
      text: [
        `Kính gửi ${hoTen || "anh/chị"},`,
        "",
        `Hồ sơ NVKS dự án ${maDuAn} đang chờ xác nhận ký nội bộ (${vaiTroLabel}).`,
        "",
        `Mở link để xem tài liệu và xác nhận:`,
        link,
        "",
        "Link hết hạn sau 72 giờ. Không chuyển tiếp cho người khác.",
        "",
        "— iSurvey / Phòng Khảo sát NPSC",
      ].join("\n"),
    });
  }

  return { link, sms, email: emailResult };
}

export async function notifyOtpSms(sdt, otp) {
  return sendTrinhKySms(sdt, `[iSurvey] Ma OTP: ${otp}. Het han 5 phut.`);
}
