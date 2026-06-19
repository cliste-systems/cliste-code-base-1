const TWILIO_ROUTES_V3_BASE = "https://routes.twilio.com/v3/PhoneNumbers";

export type TwilioMessagingRegionStatus = {
  e164: string;
  messagingRegion: string | null;
  voiceRegion: string | null;
  ok: boolean;
  error?: string;
};

function twilioAuthHeader(): string | null {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!sid || !token) return null;
  return `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`;
}

/** Read Twilio V3 regional config for an E.164 number. */
export async function getTwilioMessagingRegion(
  e164: string,
): Promise<TwilioMessagingRegionStatus> {
  const auth = twilioAuthHeader();
  if (!auth) {
    return {
      e164,
      messagingRegion: null,
      voiceRegion: null,
      ok: false,
      error: "Twilio not configured",
    };
  }

  const encoded = encodeURIComponent(e164);
  const res = await fetch(`${TWILIO_ROUTES_V3_BASE}/${encoded}`, {
    headers: { Authorization: auth },
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) detail = body.message;
    } catch {
      /* ignore */
    }
    return {
      e164,
      messagingRegion: null,
      voiceRegion: null,
      ok: false,
      error: detail,
    };
  }

  const body = (await res.json()) as {
    messaging_region?: string | null;
    messagingRegion?: string | null;
    voice_region?: string | null;
    voiceRegion?: string | null;
  };

  return {
    e164,
    messagingRegion: body.messagingRegion ?? body.messaging_region ?? null,
    voiceRegion: body.voiceRegion ?? body.voice_region ?? null,
    ok: true,
  };
}

/**
 * Configure a Twilio number for EU SMS data residency (IE1).
 * Safe to call repeatedly — Twilio treats identical updates as idempotent.
 */
export async function ensureTwilioIe1MessagingRegion(
  e164: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const auth = twilioAuthHeader();
  if (!auth) {
    return { ok: false, message: "Twilio not configured" };
  }

  const encoded = encodeURIComponent(e164);
  const res = await fetch(`${TWILIO_ROUTES_V3_BASE}/${encoded}`, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ messagingRegion: "ie1" }).toString(),
  });

  if (res.status >= 200 && res.status < 300) {
    return { ok: true };
  }

  let detail = res.statusText;
  try {
    const body = (await res.json()) as { message?: string };
    if (body.message) detail = body.message;
  } catch {
    /* ignore */
  }

  return { ok: false, message: detail };
}
