import { createHash } from "crypto";

import { timingSafeEqualUtf8 } from "@/lib/timing-safe-equal";

export const PUBLIC_BOOKING_OTP_TTL_MS = 10 * 60 * 1000;
export const PUBLIC_BOOKING_OTP_MAX_ATTEMPTS = 5;

export function generateSixDigitOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function hashBookingOtpCode(
  organizationId: string,
  phoneE164: string,
  code: string,
): string {
  const pepper =
    process.env.BOOKING_OTP_PEPPER?.trim() || "dev-booking-otp-pepper-change-me";
  return createHash("sha256")
    .update(`${pepper}:${organizationId}:${phoneE164}:${code.trim()}`)
    .digest("hex");
}

export async function otpCodesEqual(
  a: string,
  b: string,
): Promise<boolean> {
  return timingSafeEqualUtf8(a, b);
}
