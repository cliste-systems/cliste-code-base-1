import { MAX_SERVICE_CATALOG_ITEMS } from "@/lib/service-catalog-format";

export type ParsedBookingMenuService = {
  name: string;
  category: string;
  price: number | null;
  durationMinutes: number | null;
  notes: string;
};

/** Parse Fresha-style duration captions such as "35 min" or "1 hr 5 min". */
export function parseDurationCaption(text: string): number | null {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return null;

  let total = 0;
  const hrMatch = normalized.match(/(\d+)\s*hr/);
  if (hrMatch) total += Number(hrMatch[1]) * 60;

  const minMatch = normalized.match(/(\d+)\s*min/);
  if (minMatch) total += Number(minMatch[1]);

  if (total > 0) return total;

  const onlyNum = normalized.match(/^(\d+)$/);
  if (onlyNum) return Number(onlyNum[1]);

  return null;
}

function hostIsFresha(host: string): boolean {
  const lower = host.toLowerCase();
  return lower === "fresha.com" || lower.endsWith(".fresha.com");
}

function hostIsBooksy(host: string): boolean {
  const lower = host.toLowerCase();
  return lower === "booksy.com" || lower.endsWith(".booksy.com");
}

function parseFreshaPrice(value: unknown): number | null {
  if (typeof value !== "object" || value === null) return null;
  const price = Number((value as { value?: unknown }).value);
  return Number.isFinite(price) && price > 0 ? price : null;
}

type FreshaPageProps = {
  data?: { location?: { name?: unknown; services?: unknown } };
  liteLocation?: {
    name?: unknown;
    offeredCategories?: unknown;
  };
};

function parseFreshaNextData(html: string): FreshaPageProps | null {
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  );
  if (!match) return null;

  try {
    const data = JSON.parse(match[1]!) as {
      props?: { pageProps?: FreshaPageProps };
    };
    return data.props?.pageProps ?? null;
  } catch {
    return null;
  }
}

function parseFreshaBookingServices(
  serviceGroups: unknown,
): ParsedBookingMenuService[] {
  if (!Array.isArray(serviceGroups)) return [];

  const out: ParsedBookingMenuService[] = [];
  for (const group of serviceGroups) {
    if (typeof group !== "object" || group === null) continue;
    const rec = group as { name?: unknown; items?: unknown };
    const category = String(rec.name ?? "").trim().slice(0, 80);
    if (!Array.isArray(rec.items)) continue;

    for (const item of rec.items) {
      if (typeof item !== "object" || item === null) continue;
      const service = item as {
        name?: unknown;
        retailPrice?: unknown;
        caption?: unknown;
      };
      const name = String(service.name ?? "").trim().slice(0, 120);
      if (!name) continue;

      out.push({
        name,
        category,
        price: parseFreshaPrice(service.retailPrice),
        durationMinutes: parseDurationCaption(String(service.caption ?? "")),
        notes: "",
      });
      if (out.length >= MAX_SERVICE_CATALOG_ITEMS) return out;
    }
  }

  return out;
}

function parseFreshaLiteServices(
  liteLocation: FreshaPageProps["liteLocation"],
): ParsedBookingMenuService[] {
  if (typeof liteLocation !== "object" || liteLocation === null) return [];
  if (!Array.isArray(liteLocation.offeredCategories)) return [];

  const out: ParsedBookingMenuService[] = [];
  for (const group of liteLocation.offeredCategories) {
    if (typeof group !== "object" || group === null) continue;
    const rec = group as { name?: unknown; treatments?: unknown };
    const category = String(rec.name ?? "").trim().slice(0, 80);
    if (!Array.isArray(rec.treatments)) continue;

    for (const treatment of rec.treatments) {
      const name = String(treatment ?? "").trim().slice(0, 120);
      if (!name) continue;
      out.push({
        name,
        category,
        price: null,
        durationMinutes: null,
        notes: "",
      });
      if (out.length >= MAX_SERVICE_CATALOG_ITEMS) return out;
    }
  }

  return out;
}

function parseFreshaServices(html: string): ParsedBookingMenuService[] | null {
  const pageProps = parseFreshaNextData(html);
  if (!pageProps) return null;

  const fromBooking = parseFreshaBookingServices(
    pageProps.data?.location?.services,
  );
  if (fromBooking.length > 0) return fromBooking;

  const fromLite = parseFreshaLiteServices(pageProps.liteLocation);
  return fromLite.length > 0 ? fromLite : null;
}

/** Business name embedded in Fresha __NEXT_DATA__, when present. */
export function parseFreshaBusinessNameFromHtml(html: string): string | null {
  const pageProps = parseFreshaNextData(html);
  if (!pageProps) return null;

  const name =
    pageProps.liteLocation?.name ?? pageProps.data?.location?.name ?? null;
  const trimmed = String(name ?? "").trim();
  return trimmed.length > 0 ? trimmed.slice(0, 120) : null;
}

function parseBooksyServices(html: string): ParsedBookingMenuService[] | null {
  const pattern =
    /\{"@type":"Offer","name":"([^"]+)","priceCurrency":"([^"]+)","price":(\d+(?:\.\d+)?)/g;
  const out: ParsedBookingMenuService[] = [];
  const seen = new Set<string>();

  for (const match of html.matchAll(pattern)) {
    const name = match[1]!.trim().slice(0, 120);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const price = Number(match[3]);
    out.push({
      name,
      category: "",
      price: Number.isFinite(price) && price > 0 ? price : null,
      durationMinutes: null,
      notes: "",
    });
    if (out.length >= MAX_SERVICE_CATALOG_ITEMS) break;
  }

  return out.length > 0 ? out : null;
}

/**
 * Extract structured services from booking-platform HTML when embedded JSON is present.
 * Returns null when the host is unsupported or no parseable payload exists.
 */
export function parseBookingMenuFromHtml(
  host: string,
  html: string,
): ParsedBookingMenuService[] | null {
  if (hostIsFresha(host)) return parseFreshaServices(html);
  if (hostIsBooksy(host)) return parseBooksyServices(html);
  return null;
}
