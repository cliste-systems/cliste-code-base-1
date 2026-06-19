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

function parseFreshaServices(html: string): ParsedBookingMenuService[] | null {
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  );
  if (!match) return null;

  let data: unknown;
  try {
    data = JSON.parse(match[1]!);
  } catch {
    return null;
  }

  const pageProps = (data as { props?: { pageProps?: { data?: { location?: { services?: unknown } } } } })
    .props?.pageProps?.data?.location?.services;
  if (!Array.isArray(pageProps)) return null;

  const out: ParsedBookingMenuService[] = [];
  for (const group of pageProps) {
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
        description?: unknown;
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

  return out.length > 0 ? out : null;
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
