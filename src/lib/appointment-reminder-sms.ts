/** Timezone for SMS copy (Irish salons default). Override with APPOINTMENT_REMINDER_TIMEZONE. */
export function getReminderTimezone(): string {
  return (
    process.env.APPOINTMENT_REMINDER_TIMEZONE?.trim() ||
    process.env.SALON_TIMEZONE?.trim() ||
    "Europe/Dublin"
  );
}

export function reminderSmsBody(input: {
  customerName: string;
  salonName: string;
  serviceName: string;
  startTimeIso: string;
  /** Same code as confirmation SMS — helps callers quote it on the phone. */
  bookingReference?: string | null;
}): string {
  const tz = getReminderTimezone();
  const first =
    input.customerName.trim().split(/\s+/)[0] || "there";
  const start = new Date(input.startTimeIso);
  let when: string;
  try {
    when = start.toLocaleString("en-IE", {
      timeZone: tz,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    when = start.toLocaleString("en-IE", { hour12: true });
  }
  const ref = input.bookingReference?.trim();
  const refBit = ref ? ` Ref: ${ref}.` : "";
  return `Hi ${first}, reminder: you have ${input.serviceName} at ${input.salonName} on ${when}.${refBit} See you then! — ${input.salonName}`;
}
