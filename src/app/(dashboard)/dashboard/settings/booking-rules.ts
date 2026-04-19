/**
 * Booking rules schema + parser.
 *
 * Lives outside the `"use server"` actions file because Next.js requires every
 * export from a `"use server"` module to be an async function. Pure helpers
 * and types must live in their own module so server components / the form can
 * import them without tripping the compiler.
 */

export type BookingRules = {
  slotIntervalMin: number;
  minNoticeMin: number;
  maxAdvanceDays: number;
  cancellationPolicy: string;
  cancellationWindowHours: number;
  allowDoubleBooking: boolean;
  autoConfirmOnline: boolean;
};

export const DEFAULT_BOOKING_RULES: BookingRules = {
  slotIntervalMin: 15,
  minNoticeMin: 60,
  maxAdvanceDays: 60,
  cancellationPolicy: "",
  cancellationWindowHours: 24,
  allowDoubleBooking: false,
  autoConfirmOnline: true,
};

export function parseBookingRulesFromDb(raw: unknown): BookingRules {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_BOOKING_RULES };
  const r = raw as Record<string, unknown>;
  const num = (k: string, d: number) => {
    const v = r[k];
    return typeof v === "number" && Number.isFinite(v) ? v : d;
  };
  const bool = (k: string, d: boolean) => {
    const v = r[k];
    return typeof v === "boolean" ? v : d;
  };
  const str = (k: string, d: string) => {
    const v = r[k];
    return typeof v === "string" ? v : d;
  };
  return {
    slotIntervalMin: num(
      "slot_interval_min",
      DEFAULT_BOOKING_RULES.slotIntervalMin,
    ),
    minNoticeMin: num("min_notice_min", DEFAULT_BOOKING_RULES.minNoticeMin),
    maxAdvanceDays: num(
      "max_advance_days",
      DEFAULT_BOOKING_RULES.maxAdvanceDays,
    ),
    cancellationPolicy: str(
      "cancellation_policy",
      DEFAULT_BOOKING_RULES.cancellationPolicy,
    ),
    cancellationWindowHours: num(
      "cancellation_window_hours",
      DEFAULT_BOOKING_RULES.cancellationWindowHours,
    ),
    allowDoubleBooking: bool(
      "allow_double_booking",
      DEFAULT_BOOKING_RULES.allowDoubleBooking,
    ),
    autoConfirmOnline: bool(
      "auto_confirm_online",
      DEFAULT_BOOKING_RULES.autoConfirmOnline,
    ),
  };
}
