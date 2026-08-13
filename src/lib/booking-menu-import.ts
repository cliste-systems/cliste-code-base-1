import "server-only";

import { completeOpenRouterChat } from "@/lib/openrouter-chat";
import {
  parseBookingMenuFromHtml,
  parseFreshaBusinessNameFromHtml,
} from "@/lib/booking-menu-platform-parsers";
import { isRegulatedBusinessText } from "@/lib/classify-business-description";
import type { ServiceCatalogDraft } from "@/lib/service-catalog-format";
import {
  dedupeCatalogDraftsWithStats,
  MAX_SERVICE_CATALOG_ITEMS,
} from "@/lib/service-catalog-format";
import { normalisePublicWebsiteUrl } from "@/lib/website-import-ssrf";
import { fetchPublicPageHtml, htmlToText } from "@/lib/website-import";
import { assessBookingImportQuality } from "@/lib/booking-import-quality";
import type { BookingMenuImportService } from "@/lib/booking-menu-import-shared";

export type { BookingMenuImportService } from "@/lib/booking-menu-import-shared";
export { formatBookingImportSuccessMessage } from "@/lib/booking-menu-import-shared";

export type BookingMenuImportData = {
  services: BookingMenuImportService[];
  bookingUrl: string;
  regulated: boolean;
  quality: "high" | "low";
  qualityMessage?: string;
  mergedCount: number;
};

export type BookingMenuImportResult =
  | { ok: true; data: BookingMenuImportData }
  | { ok: false; message: string };

const MAX_TEXT_CHARS = 9000;
const PHOREST_FEW_SERVICES_THRESHOLD = 5;

const KNOWN_BOOKING_HOSTS = [
  "fresha.com",
  "phorest.com",
  "booksy.com",
  "treatwell.ie",
  "treatwell.co.uk",
  "treatwell.com",
  "saloniq.com",
  "timely.com",
];

const EXTRA_BOOKING_PATHS = ["services", "menu", "book", "booking", "treatments"];

const PHOREST_IMPORT_MESSAGE =
  "Phorest menus load in the browser — add services manually, or use a Fresha/Booksy link if you have one.";

const PHOREST_FEW_SERVICES_MESSAGE =
  "We only found a few services on that Phorest page — Phorest loads its full menu in the browser. Add the rest manually, or use a Fresha/Booksy link if you have one.";

function hostLooksLikeBookingPlatform(host: string): boolean {
  const lower = host.toLowerCase();
  return KNOWN_BOOKING_HOSTS.some(
    (known) => lower === known || lower.endsWith(`.${known}`),
  );
}

function hostIsPhorest(host: string): boolean {
  const lower = host.toLowerCase();
  return lower === "phorest.com" || lower.endsWith(".phorest.com");
}

function hostIsFresha(host: string): boolean {
  const lower = host.toLowerCase();
  return lower === "fresha.com" || lower.endsWith(".fresha.com");
}

/** Regulated check scoped to imported menu content — not Fresha footer / nearby venues. */
function regulatedFromImportedMenu(
  services: BookingMenuImportService[],
  businessHint = "",
): boolean {
  const blob = [
    businessHint,
    ...services.map((s) => `${s.name} ${s.category} ${s.notes}`.trim()),
  ]
    .filter(Boolean)
    .join(" ");
  return blob.length > 0 && isRegulatedBusinessText(blob);
}

function freshaBusinessHintFromHtml(htmlPages: string[]): string {
  for (const html of htmlPages) {
    const name = parseFreshaBusinessNameFromHtml(html);
    if (name) return name;
  }
  return "";
}

function asImportedServices(value: unknown): BookingMenuImportService[] {
  if (!Array.isArray(value)) return [];
  const out: BookingMenuImportService[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const rec = entry as Record<string, unknown>;
    const name = String(rec.name ?? "").trim().slice(0, 120);
    if (!name) continue;
    const category = String(rec.category ?? "").trim().slice(0, 80);
    const priceRaw = rec.price;
    const price =
      priceRaw === null || priceRaw === undefined
        ? null
        : Number(priceRaw);
    const durationRaw = rec.durationMinutes ?? rec.duration_minutes;
    const durationMinutes =
      durationRaw === null || durationRaw === undefined
        ? null
        : Number(durationRaw);
    const notes = String(rec.notes ?? "").trim().slice(0, 300);
    out.push({
      name,
      category,
      price:
        price !== null && Number.isFinite(price) && price > 0 ? price : null,
      durationMinutes:
        durationMinutes !== null &&
        Number.isFinite(durationMinutes) &&
        durationMinutes > 0
          ? Math.round(durationMinutes)
          : null,
      notes,
    });
    if (out.length >= MAX_SERVICE_CATALOG_ITEMS) break;
  }
  return out;
}

function bookingServiceToDraft(
  service: BookingMenuImportService,
): ServiceCatalogDraft {
  return {
    name: service.name,
    category: service.category || null,
    price: service.price ?? 0,
    durationMinutes: service.durationMinutes ?? 0,
    description: null,
    aiVoiceNotes: service.notes || null,
    policyFlags: [],
    source: "booking_import",
  };
}

function draftToBookingService(draft: ServiceCatalogDraft): BookingMenuImportService {
  return {
    name: draft.name,
    category: draft.category ?? "",
    price: draft.price > 0 ? draft.price : null,
    durationMinutes:
      draft.durationMinutes > 0 ? draft.durationMinutes : null,
    notes: draft.aiVoiceNotes ?? "",
  };
}

export function dedupeBookingImportServicesWithStats(
  services: BookingMenuImportService[],
): { services: BookingMenuImportService[]; mergedCount: number } {
  const { drafts, mergedCount } = dedupeCatalogDraftsWithStats(
    services.map(bookingServiceToDraft),
  );
  return {
    services: drafts.map(draftToBookingService),
    mergedCount,
  };
}

function dedupeServices(
  services: BookingMenuImportService[],
): BookingMenuImportService[] {
  return dedupeBookingImportServicesWithStats(services).services;
}

function bookingPathsForHost(host: string): string[] {
  if (hostIsPhorest(host)) {
    return [...EXTRA_BOOKING_PATHS, "book/service-selection"];
  }
  return EXTRA_BOOKING_PATHS;
}

export function bookingImportToCatalogDrafts(
  services: BookingMenuImportService[],
): ServiceCatalogDraft[] {
  return dedupeCatalogDraftsWithStats(
    services.map(bookingServiceToDraft),
  ).drafts;
}

export function bookingImportToCatalogDraftsWithStats(
  services: BookingMenuImportService[],
): { drafts: ServiceCatalogDraft[]; mergedCount: number } {
  return dedupeCatalogDraftsWithStats(services.map(bookingServiceToDraft));
}

/**
 * Fetch a public booking/menu page and extract structured services for review.
 */
export async function importBookingMenuFromUrl(
  rawUrl: string,
): Promise<BookingMenuImportResult> {
  const url = await normalisePublicWebsiteUrl(rawUrl);
  if (!url) {
    return {
      ok: false,
      message: "That doesn't look like a valid booking link.",
    };
  }

  const host = url.hostname.toLowerCase();
  const htmlPages: string[] = [];
  const primaryHtml = await fetchPublicPageHtml(url.toString());
  if (primaryHtml) htmlPages.push(primaryHtml);

  if (hostLooksLikeBookingPlatform(host)) {
    const base = `${url.protocol}//${url.host}${url.pathname.replace(/\/$/, "")}`;
    for (const path of bookingPathsForHost(host)) {
      const extra = await fetchPublicPageHtml(`${base}/${path}`);
      if (extra) htmlPages.push(extra);
    }
  }

  let structuredServices: BookingMenuImportService[] = [];
  for (const html of htmlPages) {
    const parsed = parseBookingMenuFromHtml(host, html);
    if (parsed?.length) {
      structuredServices = dedupeServices([...structuredServices, ...parsed]);
    }
  }

  if (structuredServices.length > 0) {
    const businessHint = hostIsFresha(host)
      ? freshaBusinessHintFromHtml(htmlPages)
      : "";
    const deduped = dedupeBookingImportServicesWithStats(
      structuredServices.slice(0, MAX_SERVICE_CATALOG_ITEMS),
    );
    const assessed = assessBookingImportQuality(deduped.services);
    return {
      ok: true,
      data: {
        services: deduped.services,
        bookingUrl: url.toString(),
        regulated: regulatedFromImportedMenu(deduped.services, businessHint),
        mergedCount: deduped.mergedCount,
        ...assessed,
      },
    };
  }

  const pages = htmlPages.map(htmlToText).filter((page) => page.length > 0);
  const text = pages.join("\n\n").slice(0, MAX_TEXT_CHARS).trim();
  if (text.length < 60) {
    return {
      ok: false,
      message: hostIsPhorest(host)
        ? PHOREST_IMPORT_MESSAGE
        : "We couldn't read enough from that booking page. Add your services manually, or try your main website link instead.",
    };
  }

  try {
    const raw = await completeOpenRouterChat({
      temperature: 0.2,
      maxTokens: 1400,
      messages: [
        {
          role: "system",
          content: `You extract a salon or beauty service menu from booking-page text for an Irish phone-assistant setup.
Return JSON only with this exact shape:
{"services":[{"name":"service name","category":"category or empty","price":number_or_null,"durationMinutes":number_or_null,"notes":"short optional note"}]}
Rules:
- Only use services and prices explicitly present in the text. Never invent prices, durations, or services.
- price: numeric EUR amount only when clearly shown; otherwise null.
- durationMinutes: integer minutes only when clearly shown (e.g. "45 min", "1 hr 30 min"); otherwise null.
- category: short grouping like "Cut", "Colour", "Nails" when obvious; else empty string.
- Max ${MAX_SERVICE_CATALOG_ITEMS} services. Prefer the main bookable treatments callers ask about.
- Skip products, gift cards, and staff bios.`,
        },
        {
          role: "user",
          content: `Booking URL host: ${host}\n\nPage text:\n${text}`,
        },
      ],
    });

    const json = JSON.parse(raw) as Record<string, unknown>;
    const deduped = dedupeBookingImportServicesWithStats(
      asImportedServices(json.services),
    );
    const services = deduped.services;

    if (services.length === 0) {
      return {
        ok: false,
        message: hostIsPhorest(host)
          ? PHOREST_IMPORT_MESSAGE
          : "We couldn't find any services on that page. Add them manually, or try a different booking link.",
      };
    }

    if (
      hostIsPhorest(host) &&
      services.length < PHOREST_FEW_SERVICES_THRESHOLD
    ) {
      return {
        ok: false,
        message: PHOREST_FEW_SERVICES_MESSAGE,
      };
    }

    const businessHint = hostIsFresha(host)
      ? freshaBusinessHintFromHtml(htmlPages)
      : "";
    const assessed = assessBookingImportQuality(services);
    return {
      ok: true,
      data: {
        services,
        bookingUrl: url.toString(),
        regulated: regulatedFromImportedMenu(services, businessHint),
        mergedCount: deduped.mergedCount,
        ...assessed,
      },
    };
  } catch (err) {
    console.warn("[booking-menu-import] extract failed", err);
    return {
      ok: false,
      message: hostIsPhorest(host)
        ? PHOREST_IMPORT_MESSAGE
        : "We couldn't import from that booking link right now. You can add services manually.",
    };
  }
}
