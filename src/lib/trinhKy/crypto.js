import { createHash, randomBytes, randomInt } from "crypto";

export function sha256Hex(input) {
  return createHash("sha256").update(input).digest("hex");
}

export function hashToken(plain) {
  return sha256Hex(String(plain || ""));
}

export function generateToken() {
  return randomBytes(32).toString("base64url");
}

export function generateOtp6() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashOtp(otp) {
  return sha256Hex(`otp:${String(otp || "").trim()}`);
}

/** Hash nội dung PDF (Buffer | Uint8Array | ArrayBuffer) */
export function hashPdfBytes(bytes) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  return createHash("sha256").update(buf).digest("hex");
}
