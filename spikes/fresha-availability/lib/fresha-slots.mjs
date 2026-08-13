/**
 * Parse Fresha GraphQL booking-flow responses into shadow-calendar slots.
 *
 * Confirmed shape (Jun 2026, Sligo test salon):
 *   data.bookingFlowActionButtonPressed.screenTime.day.timeslots[]
 *   when day.__typename === "BookingFlowScreenTimeDayAvailable"
 *
 * Each timeslot:
 *   { time: "10:55 AM", action: { id: '[{"type":"onScreenTimeSet","date":"2026-06-23","time":39300},...]' } }
 *   `time` in action JSON = seconds from local midnight.
 */

/** @typedef {{ orgRef: string, serviceName: string, staffRef: string|null, startIso: string, endIso: string, source: 'fresha_public', capturedAt: string, label?: string }} ShadowSlot */

/**
 * @param {unknown} actionId
 * @returns {{ date?: string, timeSeconds?: number } | null}
 */
export function parseFreshaTimeAction(actionId) {
  if (typeof actionId !== 'string') return null;
  try {
    const parsed = JSON.parse(actionId);
    const payload = Array.isArray(parsed) ? parsed[0] : parsed;
    if (!payload || typeof payload !== 'object') return null;
    return {
      date: typeof payload.date === 'string' ? payload.date : undefined,
      timeSeconds: typeof payload.time === 'number' ? payload.time : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * @param {string} dateIso YYYY-MM-DD
 * @param {number} secondsFromMidnight
 * @returns {string}
 */
export function freshaLocalStartIso(dateIso, secondsFromMidnight) {
  const h = Math.floor(secondsFromMidnight / 3600);
  const m = Math.floor((secondsFromMidnight % 3600) / 60);
  const s = secondsFromMidnight % 60;
  const pad = (n) => String(n).padStart(2, '0');
  // Fresha IE salons: treat as Europe/Dublin local wall time (+01:00 in summer).
  return `${dateIso}T${pad(h)}:${pad(m)}:${pad(s)}+01:00`;
}

/**
 * @param {string} startIso
 * @param {number} durationMinutes
 * @returns {string}
 */
export function addMinutesIso(startIso, durationMinutes) {
  const d = new Date(startIso);
  d.setMinutes(d.getMinutes() + durationMinutes);
  const pad = (n) => String(n).padStart(2, '0');
  const offset = startIso.includes('+01:00') ? '+01:00' : 'Z';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${offset}`;
}

/**
 * Find timeslot arrays anywhere in a Fresha GraphQL body.
 * @param {unknown} root
 * @returns {Array<{ time?: string, action?: { id?: string } }>}
 */
export function extractFreshaTimeslots(root) {
  /** @type {Array<{ time?: string, action?: { id?: string } }>} */
  const found = [];

  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (
      node.__typename === 'BookingFlowScreenTimeDayAvailable' &&
      Array.isArray(node.timeslots)
    ) {
      found.push(...node.timeslots);
    }
    for (const child of Object.values(node)) walk(child);
  }

  walk(root);
  return found;
}

/**
 * @param {unknown} rawJson GraphQL body or array of capture records
 * @param {{ orgRef?: string, serviceName?: string, serviceDurationMinutes?: number, capturedAt?: string, filterDate?: string, staffRef?: string|null }} meta
 * @returns {ShadowSlot[]}
 */
export function normalizeToShadowSlots(rawJson, meta = {}) {
  const capturedAt = meta.capturedAt ?? new Date().toISOString();
  const orgRef = meta.orgRef ?? 'unknown-fresha-org';
  const serviceName = meta.serviceName ?? 'Unknown service';
  const durationMinutes = meta.serviceDurationMinutes ?? 35;
  const staffRef = meta.staffRef ?? null;
  const filterDate = meta.filterDate;

  /** @type {unknown[]} */
  const roots = Array.isArray(rawJson)
    ? rawJson.map((c) => c?.body ?? c?.responseBody).filter(Boolean)
    : [rawJson?.responseBody ?? rawJson?.body ?? rawJson];

  /** @type {ShadowSlot[]} */
  const slots = [];
  const seen = new Set();

  for (const root of roots) {
    for (const slot of extractFreshaTimeslots(root)) {
      const label = slot.time;
      const action = parseFreshaTimeAction(slot.action?.id);
      if (!action?.date || action.timeSeconds == null) continue;
      if (filterDate && action.date !== filterDate) continue;

      const startIso = freshaLocalStartIso(action.date, action.timeSeconds);
      const endIso = addMinutesIso(startIso, durationMinutes);
      const key = `${startIso}|${serviceName}`;
      if (seen.has(key)) continue;
      seen.add(key);

      slots.push({
        orgRef,
        serviceName,
        staffRef,
        startIso,
        endIso,
        source: 'fresha_public',
        capturedAt,
        ...(label ? { label } : {}),
      });
    }
  }

  return slots.sort((a, b) => a.startIso.localeCompare(b.startIso));
}

/**
 * @param {unknown} root
 * @returns {boolean}
 */
export function isDayFullyBooked(root) {
  const text = JSON.stringify(root);
  return (
    text.includes('BookingFlowScreenTimeDayUnavailable') ||
    /fully booked/i.test(text)
  );
}

/**
 * @param {ShadowSlot[]} slots
 * @param {string} hhmm e.g. "10:55"
 * @returns {ShadowSlot|undefined}
 */
export function findSlotNearTime(slots, hhmm) {
  return slots.find((s) => s.label?.includes(hhmm) || s.startIso.includes(`T${hhmm}`));
}
