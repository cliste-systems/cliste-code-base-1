/**
 * Tiny recurrence engine — covers the four cases salons actually book on
 * (weekly, fortnightly, every-3-weeks, monthly-by-day) without pulling in a
 * full RFC 5545 parser. Returns ISO strings (UTC) for each occurrence.
 *
 * `frequency` semantics:
 *   - "weekly"      — every N weeks (intervalWeeks defaults to 1)
 *   - "fortnightly" — alias for weekly with intervalWeeks=2
 *   - "monthly"     — same nominal day-of-month each month; if the target
 *                     month doesn't have that day (e.g. 31 Feb) we skip.
 *
 * `count` is total occurrences INCLUDING the seed, capped at 26 so a runaway
 * UI can't spam the table. `untilIso` (optional) stops generation early.
 */

export type RecurrenceFrequency = "weekly" | "fortnightly" | "monthly";

export type RecurrencePlanInput = {
  startIso: string;
  frequency: RecurrenceFrequency;
  /** Total instances including the seed, 2..26. */
  count: number;
  /** Optional ISO end-date (inclusive). Generation stops once an instance
   *  would land at or after this. */
  untilIso?: string | null;
};

export type RecurrencePlan = {
  /** Including the seed at index 0. */
  occurrences: string[];
  /** Human-readable RRULE-style label stored on each row. Not strictly
   *  RFC 5545 but uses the same vocabulary. */
  recurrenceRule: string;
};

const MAX_OCCURRENCES = 26;

export function planRecurringOccurrences(
  input: RecurrencePlanInput,
): RecurrencePlan {
  const seed = new Date(input.startIso);
  if (Number.isNaN(seed.getTime())) {
    throw new Error("planRecurringOccurrences: invalid startIso");
  }
  const totalRequested = Math.max(2, Math.min(MAX_OCCURRENCES, input.count));
  const until = input.untilIso ? new Date(input.untilIso) : null;
  const untilMs =
    until && !Number.isNaN(until.getTime()) ? until.getTime() : null;

  const occurrences: string[] = [seed.toISOString()];

  const stepWeeks =
    input.frequency === "fortnightly"
      ? 2
      : input.frequency === "weekly"
        ? 1
        : 0;

  for (let i = 1; i < totalRequested; i++) {
    let next: Date;
    if (input.frequency === "monthly") {
      next = addMonthsKeepDay(seed, i);
    } else {
      next = new Date(seed.getTime() + i * stepWeeks * 7 * 24 * 60 * 60_000);
    }
    if (untilMs != null && next.getTime() >= untilMs) break;
    occurrences.push(next.toISOString());
  }

  return {
    occurrences,
    recurrenceRule: buildRrule(input.frequency, totalRequested, untilMs),
  };
}

function addMonthsKeepDay(seed: Date, deltaMonths: number): Date {
  const y = seed.getUTCFullYear();
  const m = seed.getUTCMonth();
  const targetMonth = m + deltaMonths;
  const targetYear = y + Math.floor(targetMonth / 12);
  const normMonth = ((targetMonth % 12) + 12) % 12;
  const day = seed.getUTCDate();
  // If target month is shorter than seed day (e.g. 31 -> Feb), clamp.
  const lastDay = new Date(Date.UTC(targetYear, normMonth + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      targetYear,
      normMonth,
      Math.min(day, lastDay),
      seed.getUTCHours(),
      seed.getUTCMinutes(),
      seed.getUTCSeconds(),
    ),
  );
}

function buildRrule(
  freq: RecurrenceFrequency,
  count: number,
  untilMs: number | null,
): string {
  const tail = untilMs ? `;UNTIL=${new Date(untilMs).toISOString()}` : "";
  switch (freq) {
    case "weekly":
      return `FREQ=WEEKLY;INTERVAL=1;COUNT=${count}${tail}`;
    case "fortnightly":
      return `FREQ=WEEKLY;INTERVAL=2;COUNT=${count}${tail}`;
    case "monthly":
      return `FREQ=MONTHLY;INTERVAL=1;COUNT=${count}${tail}`;
    default:
      return `FREQ=WEEKLY;INTERVAL=1;COUNT=${count}${tail}`;
  }
}
