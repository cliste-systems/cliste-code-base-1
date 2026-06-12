import "server-only";

import { completeOpenRouterChat } from "@/lib/openrouter-chat";
import { normalisePublicWebsiteUrl } from "@/lib/website-import-ssrf";
import { isRegulatedBusinessText } from "@/lib/classify-business-description";

export type WebsiteImportFaq = { question: string; answer: string };

export type WebsiteImportData = {
  businessDescription: string;
  services: string[];
  servicesNotOffered: string[];
  openingHours: string;
  serviceArea: string;
  faqs: WebsiteImportFaq[];
  address: string;
  eircode: string;
  regulated: boolean;
};

export type WebsiteImportResult =
  | { ok: true; data: WebsiteImportData }
  | { ok: false; message: string };

const FETCH_TIMEOUT_MS = 9000;
const MAX_TEXT_CHARS = 7000;
const EXTRA_PATHS = ["about", "about-us", "contact", "services"];

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchText(url: string, hops = 0): Promise<string | null> {
  if (hops > 5) return null;
  const parsed = await normalisePublicWebsiteUrl(url);
  if (!parsed) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: "manual",
      headers: { "User-Agent": "ClisteBot/1.0 (+https://clistesystems.ie)" },
      cache: "no-store",
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return null;
      const next = new URL(location, parsed).toString();
      return fetchText(next, hops + 1);
    }
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      return null;
    }
    const html = await res.text();
    return htmlToText(html);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function asStringArray(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    const s = String(entry ?? "").trim();
    if (s) out.push(s.slice(0, 200));
    if (out.length >= max) break;
  }
  return out;
}

function asFaqs(value: unknown, max: number): WebsiteImportFaq[] {
  if (!Array.isArray(value)) return [];
  const out: WebsiteImportFaq[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const rec = entry as Record<string, unknown>;
    const question = String(rec.question ?? "").trim().slice(0, 300);
    const answer = String(rec.answer ?? "").trim().slice(0, 800);
    if (question) out.push({ question, answer });
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Fetch a business website and use AI to extract the bits onboarding needs.
 * Best-effort: returns ok:false with a friendly message on any failure so the
 * caller can fall back to manual entry.
 */
export async function importBusinessFromWebsite(
  rawUrl: string,
): Promise<WebsiteImportResult> {
  const url = await normalisePublicWebsiteUrl(rawUrl);
  if (!url) {
    return { ok: false, message: "That doesn't look like a valid website address." };
  }

  const base = `${url.protocol}//${url.host}`;
  const pages: string[] = [];

  const home = await fetchText(url.toString());
  if (home) pages.push(home);

  for (const path of EXTRA_PATHS) {
    if (pages.join(" ").length > MAX_TEXT_CHARS) break;
    const extra = await fetchText(`${base}/${path}`);
    if (extra) pages.push(extra);
  }

  const text = pages.join("\n\n").slice(0, MAX_TEXT_CHARS).trim();
  if (text.length < 80) {
    return {
      ok: false,
      message:
        "We couldn't read enough from that site. You can fill the details in manually.",
    };
  }

  try {
    const raw = await completeOpenRouterChat({
      temperature: 0.2,
      maxTokens: 900,
      messages: [
        {
          role: "system",
          content: `You extract structured business details from website text for an Irish phone-assistant setup.
Return JSON only with this exact shape:
{"businessDescription":"1-2 sentence plain description of what the business does","services":["service",...],"servicesNotOffered":["thing not offered",...],"openingHours":"hours as written, or empty","serviceArea":"towns/areas served, or empty","faqs":[{"question":"...","answer":"..."}],"address":"street address if present, else empty","eircode":"Irish Eircode if present, else empty"}
Rules:
- Only use facts present in the text. Never invent prices, hours, or services.
- services / servicesNotOffered: short noun phrases, max 12 each.
- faqs: max 6, real Q&As a caller might ask (booking, hours, pricing policy, location).
- Keep everything concise.`,
        },
        {
          role: "user",
          content: text,
        },
      ],
    });

    const json = JSON.parse(raw) as Record<string, unknown>;
    const businessDescription = String(json.businessDescription ?? "")
      .trim()
      .slice(0, 600);

    if (businessDescription.length < 5) {
      return {
        ok: false,
        message:
          "We couldn't work out what the business does from that site. Add a short description instead.",
      };
    }

    const address = String(json.address ?? "").trim().slice(0, 200);
    const eircode = String(json.eircode ?? "").trim().slice(0, 12);

    const data: WebsiteImportData = {
      businessDescription,
      services: asStringArray(json.services, 12),
      servicesNotOffered: asStringArray(json.servicesNotOffered, 12),
      openingHours: String(json.openingHours ?? "").trim().slice(0, 400),
      serviceArea: String(json.serviceArea ?? "").trim().slice(0, 300),
      faqs: asFaqs(json.faqs, 6),
      address,
      eircode,
      regulated: isRegulatedBusinessText(`${businessDescription} ${text.slice(0, 2000)}`),
    };

    return { ok: true, data };
  } catch (err) {
    console.warn("[website-import] extract failed", err);
    return {
      ok: false,
      message: "We couldn't import from that site right now. You can fill it in manually.",
    };
  }
}
