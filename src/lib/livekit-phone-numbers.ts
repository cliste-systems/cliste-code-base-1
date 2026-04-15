import { AccessToken } from "livekit-server-sdk";

/** HTTPS API host for Twirp (from `wss://project.livekit.cloud` → `https://project.livekit.cloud`). */
export function livekitHttpHostFromEnv(): string {
  const raw = process.env.LIVEKIT_URL?.trim();
  if (!raw) {
    throw new Error(
      "LIVEKIT_URL is not set (e.g. wss://your-project.livekit.cloud)."
    );
  }
  if (raw.startsWith("wss://")) {
    return "https://" + raw.slice("wss://".length).replace(/\/$/, "");
  }
  if (raw.startsWith("https://")) {
    return raw.replace(/\/$/, "");
  }
  if (raw.startsWith("http://")) {
    return raw.replace(/\/$/, "");
  }
  return "https://" + raw.replace(/\/$/, "");
}

async function sipAdminBearerJwt(): Promise<string> {
  const at = new AccessToken(undefined, undefined, { ttl: "10m" });
  at.addSIPGrant({ admin: true });
  return at.toJwt();
}

type TwirpErr = { msg?: string; message?: string };

async function phoneNumberTwirp<T>(
  method: string,
  body: Record<string, unknown>
): Promise<T> {
  const host = livekitHttpHostFromEnv();
  const token = await sipAdminBearerJwt();
  const url = `${host}/twirp/livekit.PhoneNumberService/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    let msg = text || res.statusText;
    try {
      const j = JSON.parse(text) as TwirpErr;
      if (j.msg) msg = j.msg;
      else if (j.message) msg = j.message;
    } catch {
      /* plain text */
    }
    throw new Error(msg);
  }

  return JSON.parse(text) as T;
}

export type SearchItem = {
  e164_format?: string;
  e164Format?: string;
};

export async function searchAvailableUsPhoneNumbers(
  limit = 15
): Promise<string[]> {
  const data = await phoneNumberTwirp<{ items?: SearchItem[] }>(
    "SearchPhoneNumbers",
    { country_code: "US", limit }
  );
  const items = data.items ?? [];
  const out: string[] = [];
  for (const it of items) {
    const e164 = it.e164_format ?? it.e164Format;
    if (e164?.startsWith("+")) out.push(e164);
  }
  return out;
}

export async function purchasePhoneNumbers(
  e164Numbers: string[],
  sipDispatchRuleId?: string | null
): Promise<string[]> {
  const body: Record<string, unknown> = { phone_numbers: e164Numbers };
  const rule = sipDispatchRuleId?.trim();
  if (rule) {
    body.sip_dispatch_rule_id = rule;
  }
  const data = await phoneNumberTwirp<{ phone_numbers?: SearchItem[] }>(
    "PurchasePhoneNumber",
    body
  );
  const rows = data.phone_numbers ?? [];
  return rows
    .map((r) => r.e164_format ?? r.e164Format)
    .filter((x): x is string => typeof x === "string" && x.startsWith("+"));
}
