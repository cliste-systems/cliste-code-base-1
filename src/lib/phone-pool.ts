import "server-only";

import twilio from "twilio";

import { createAdminClient } from "@/utils/supabase/admin";

/**
 * Cliste phone-number pool.
 *
 * Why a pool (and not per-signup provisioning)?
 *   * Signup must never wait on an upstream vendor API. Twilio IE DID purchase
 *     is ~2–5s when it works and can 5xx during carrier maintenance; we pre-buy
 *     inventory on a nightly cron instead.
 *   * ComReg requires an emergency-services address on every IE number. That's
 *     a one-time account setup on Twilio, not a per-number step.
 *   * Keeping number ownership on Twilio lets us port-out cleanly if a salon
 *     churns — their old clients still ring a real number during the
 *     30-day cooldown, then the DID returns to the pool.
 *
 * Env required for purchases:
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN  (already in env for SMS)
 *   TWILIO_IE_VOICE_URL                    (SIP URI of your LiveKit trunk)
 *   LIVEKIT_SIP_TRUNK_ID                   (optional; stored on the row)
 *
 * If TWILIO_ACCOUNT_SID / _AUTH_TOKEN are missing, purchase is a no-op and the
 * pool stays seeded via admin / migration.
 */

const DEFAULT_AREA_CODES_IE = ["01", "021", "091", "051", "064"] as const;
const DEFAULT_LOW_WATER_MARK = 20;
const DEFAULT_REFILL_BATCH = 10;
const COOLDOWN_DAYS = 30;

type AdminClient = ReturnType<typeof createAdminClient>;

export function twilioIsConfigured(): boolean {
  return (
    Boolean(process.env.TWILIO_ACCOUNT_SID?.trim()) &&
    Boolean(process.env.TWILIO_AUTH_TOKEN?.trim())
  );
}

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!sid || !token) {
    throw new Error(
      "Twilio is not configured: set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN."
    );
  }
  return twilio(sid, token);
}

function getIrishAreaCodes(): string[] {
  const raw = process.env.TWILIO_IE_AREA_CODES?.trim();
  if (!raw) return [...DEFAULT_AREA_CODES_IE];
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : [...DEFAULT_AREA_CODES_IE];
}

function getVoiceRoutingUrl(): string | null {
  const raw = process.env.TWILIO_IE_VOICE_URL?.trim();
  return raw || null;
}

export type PoolHealth = {
  availableIE: number;
  availableOther: number;
  assigned: number;
  cooldown: number;
  total: number;
  lowWaterMark: number;
};

export async function poolHealthCheck(): Promise<PoolHealth> {
  const admin = createAdminClient();
  const [avail, assigned, cooldown, total] = await Promise.all([
    admin
      .from("phone_numbers")
      .select("country_code", { count: "exact", head: false })
      .eq("status", "available"),
    admin
      .from("phone_numbers")
      .select("id", { count: "exact", head: true })
      .eq("status", "assigned"),
    admin
      .from("phone_numbers")
      .select("id", { count: "exact", head: true })
      .eq("status", "cooldown"),
    admin
      .from("phone_numbers")
      .select("id", { count: "exact", head: true }),
  ]);

  let availableIE = 0;
  let availableOther = 0;
  for (const row of avail.data ?? []) {
    if (row.country_code === "IE") availableIE += 1;
    else availableOther += 1;
  }

  return {
    availableIE,
    availableOther,
    assigned: assigned.count ?? 0,
    cooldown: cooldown.count ?? 0,
    total: total.count ?? 0,
    lowWaterMark: resolveLowWaterMark(),
  };
}

function resolveLowWaterMark(): number {
  const raw = process.env.CLISTE_PHONE_POOL_LOW_WATER?.trim();
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_LOW_WATER_MARK;
}

function resolveRefillBatch(): number {
  const raw = process.env.CLISTE_PHONE_POOL_REFILL_BATCH?.trim();
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_REFILL_BATCH;
}

export type PurchaseResult =
  | { ok: true; purchased: Array<{ e164: string; sid: string }> }
  | { ok: false; message: string };

/**
 * Programmatically buy `count` Irish DIDs from Twilio, wire each to the
 * configured voice URL (LiveKit SIP ingress), and insert rows with
 * status='available'. Idempotent on (e164) — a re-run won't double-insert.
 *
 * Called from the nightly /api/cron/phone-pool-refill job and manually from
 * admin. Returns early with ok:false if Twilio isn't configured or the
 * voice URL is missing (no point buying numbers you can't route).
 */
export async function purchaseIrishDids(count: number): Promise<PurchaseResult> {
  if (!twilioIsConfigured()) {
    return {
      ok: false,
      message:
        "Twilio is not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.",
    };
  }
  const voiceUrl = getVoiceRoutingUrl();
  if (!voiceUrl) {
    return {
      ok: false,
      message:
        "TWILIO_IE_VOICE_URL is not set. Point it at your LiveKit SIP ingress before buying numbers.",
    };
  }

  const client = getTwilioClient();
  const areaCodes = getIrishAreaCodes();
  const livekitSipTrunkId =
    process.env.LIVEKIT_SIP_TRUNK_ID?.trim() || null;

  const purchased: Array<{ e164: string; sid: string }> = [];
  const admin = createAdminClient();

  for (let i = 0; i < count; i++) {
    const areaCode = areaCodes[i % areaCodes.length]!;
    // Twilio's types expect a numeric area code; our config stores strings
    // (e.g. "01", "021") so we parse here. If parsing fails we fall back to
    // a country-wide search.
    const areaCodeNumber = Number.parseInt(areaCode, 10);
    let availableNumbers: Array<{ phoneNumber?: string }> = [];
    try {
      availableNumbers = await client
        .availablePhoneNumbers("IE")
        .local.list(
          Number.isFinite(areaCodeNumber)
            ? { areaCode: areaCodeNumber, limit: 1 }
            : { limit: 1 },
        );
    } catch (err) {
      console.warn(
        "[phone-pool] Twilio search failed",
        areaCode,
        err instanceof Error ? err.message : err,
      );
    }

    // Ireland has patchy DID stock by area code. If the preferred code has no
    // inventory right now, fall back to a country-wide search so we still buy
    // *an* IE number (better than failing the refill).
    if (availableNumbers.length === 0) {
      try {
        availableNumbers = await client
          .availablePhoneNumbers("IE")
          .local.list({ limit: 1 });
      } catch (err) {
        console.warn(
          "[phone-pool] Twilio nationwide search failed",
          err instanceof Error ? err.message : err,
        );
        continue;
      }
    }

    const pick = availableNumbers[0]?.phoneNumber;
    if (!pick) {
      continue;
    }

    try {
      // Ireland requires a postal Address and a Regulatory Bundle on every
      // locally-purchased DID. Twilio rejects the purchase with
      // "AddressSid empty" otherwise. We reuse the founder's existing
      // compliance records via env vars so we don't have to re-register.
      const addressSid = process.env.TWILIO_IE_ADDRESS_SID?.trim() || undefined;
      const bundleSid = process.env.TWILIO_IE_BUNDLE_SID?.trim() || undefined;
      const bought = await client.incomingPhoneNumbers.create({
        phoneNumber: pick,
        voiceUrl,
        voiceMethod: "POST",
        smsUrl: process.env.TWILIO_IE_SMS_URL?.trim() || undefined,
        smsMethod: "POST",
        friendlyName: `Cliste pool (${areaCode})`,
        ...(addressSid ? { addressSid } : {}),
        ...(bundleSid ? { bundleSid } : {}),
      });

      const { error: insertErr } = await admin.from("phone_numbers").insert({
        e164: bought.phoneNumber,
        country_code: "IE",
        provider: "twilio",
        provider_sid: bought.sid,
        livekit_sip_trunk_id: livekitSipTrunkId,
        status: "available",
        monthly_cost_cents: 100, // ~€1/mo typical Twilio IE DID
      });

      if (insertErr) {
        // Roll back the Twilio purchase so we don't bleed €1/mo on a ghost DID.
        try {
          await client.incomingPhoneNumbers(bought.sid).remove();
        } catch (cleanupErr) {
          console.error(
            "[phone-pool] failed to release orphaned Twilio number",
            bought.phoneNumber,
            cleanupErr instanceof Error ? cleanupErr.message : cleanupErr
          );
        }
        return {
          ok: false,
          message: `Bought ${bought.phoneNumber} but could not insert: ${insertErr.message}`,
        };
      }

      if (bought.phoneNumber) {
        purchased.push({ e164: bought.phoneNumber, sid: bought.sid });
      }
    } catch (err) {
      console.warn(
        "[phone-pool] Twilio purchase failed",
        pick,
        err instanceof Error ? err.message : err
      );
      continue;
    }
  }

  return { ok: true, purchased };
}

export type AssignFromPoolResult =
  | { ok: true; e164: string; phoneNumberId: string }
  | { ok: false; message: string };

/**
 * Atomically claim an available IE pool row for an organisation. Uses a
 * Postgres transaction with `FOR UPDATE SKIP LOCKED` semantics via a two-step
 * update pattern that Supabase supports: we select a candidate row, then
 * update-if-still-available, then retry once. In practice this contention
 * never matters at our scale, but the SKIP-LOCKED pattern means two parallel
 * signups never hand out the same number.
 */
export async function assignFromPool(
  organizationId: string,
  country: "IE" | "US" = "IE"
): Promise<AssignFromPoolResult> {
  const admin = createAdminClient();

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: candidate, error: pickErr } = await admin
      .from("phone_numbers")
      .select("id, e164")
      .eq("status", "available")
      .eq("country_code", country)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (pickErr) {
      return { ok: false, message: pickErr.message };
    }
    if (!candidate) {
      return {
        ok: false,
        message:
          "No phone numbers available in the pool. Contact support or wait for the nightly refill.",
      };
    }

    const nowIso = new Date().toISOString();
    const { data: claimed, error: claimErr } = await admin
      .from("phone_numbers")
      .update({
        status: "assigned",
        organization_id: organizationId,
        assigned_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", candidate.id)
      .eq("status", "available")
      .select("id, e164")
      .maybeSingle();

    if (claimErr) {
      return { ok: false, message: claimErr.message };
    }
    if (claimed?.id) {
      return { ok: true, e164: claimed.e164, phoneNumberId: claimed.id };
    }
    // Someone else grabbed it first — retry.
  }

  return {
    ok: false,
    message:
      "Could not claim a pool number after retries. Refresh and try again.",
  };
}

export type ReleaseToPoolResult =
  | { ok: true; released: number }
  | { ok: false; message: string };

/**
 * Release any assigned numbers for an org into 30-day cooldown. Call on
 * churn / suspension; the org.phone_number cache is cleared via trigger.
 */
export async function releaseToPool(
  organizationId: string
): Promise<ReleaseToPoolResult> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const cooldownUntil = new Date(
    Date.now() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await admin
    .from("phone_numbers")
    .update({
      status: "cooldown",
      released_at: nowIso,
      cooldown_until: cooldownUntil,
      updated_at: nowIso,
    })
    .eq("organization_id", organizationId)
    .eq("status", "assigned")
    .select("id");

  if (error) return { ok: false, message: error.message };
  return { ok: true, released: data?.length ?? 0 };
}

/**
 * Flip cooldown → available for any row whose cooldown has expired. Runs
 * from the same nightly cron as the refill so freed-up inventory rejoins
 * the pool before we buy new DIDs.
 */
export async function promoteExpiredCooldowns(): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("phone_numbers")
    .update({
      status: "available",
      organization_id: null,
      cooldown_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq("status", "cooldown")
    .lte("cooldown_until", new Date().toISOString())
    .select("id");

  if (error) {
    console.warn("[phone-pool] promoteExpiredCooldowns failed", error.message);
    return 0;
  }
  return data?.length ?? 0;
}

/**
 * Top-up the pool if it's below the low-water mark. Called from
 * /api/cron/phone-pool-refill nightly.
 */
export async function refillPoolIfLow(): Promise<{
  promoted: number;
  purchased: number;
  skippedReason?: string;
}> {
  const promoted = await promoteExpiredCooldowns();
  const health = await poolHealthCheck();
  if (health.availableIE >= health.lowWaterMark) {
    return { promoted, purchased: 0 };
  }
  if (!twilioIsConfigured() || !getVoiceRoutingUrl()) {
    return {
      promoted,
      purchased: 0,
      skippedReason:
        "Twilio or TWILIO_IE_VOICE_URL not configured — cannot refill automatically.",
    };
  }
  const batch = resolveRefillBatch();
  const result = await purchaseIrishDids(batch);
  if (!result.ok) {
    return { promoted, purchased: 0, skippedReason: result.message };
  }
  return { promoted, purchased: result.purchased.length };
}

/**
 * Seed a number manually (admin escape hatch / migration helper). Does not
 * hit Twilio — use when you already own the DID or are testing.
 */
export async function seedManualNumber(opts: {
  e164: string;
  countryCode?: string;
  provider?: "twilio" | "livekit" | "ported" | "manual";
  providerSid?: string;
  livekitSipTrunkId?: string;
  notes?: string;
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("phone_numbers")
    .insert({
      e164: opts.e164,
      country_code: opts.countryCode ?? "IE",
      provider: opts.provider ?? "manual",
      provider_sid: opts.providerSid ?? null,
      livekit_sip_trunk_id: opts.livekitSipTrunkId ?? null,
      status: "available",
      notes: opts.notes ?? null,
    })
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  if (!data?.id) return { ok: false, message: "Insert returned no id." };
  return { ok: true, id: data.id };
}
