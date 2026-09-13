import { formatInTimeZone, toZonedTime } from "date-fns-tz";

import {
  SUPERVALU_MEAT_CATEGORY_SEEDS,
  type SupervaluGatewayProduct,
} from "@/lib/supervalu-offers-types";

const DUBLIN = "Europe/Dublin";

export type NormalizedWeeklyOffer = {
  productName: string;
  department: string;
  currentPriceEur: number;
  wasPriceEur: number | null;
  discountLabel: string | null;
  pricePerUnit: string | null;
  sku: string | null;
  sourceUrl: string | null;
  searchText: string;
};

export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function currentSupervaluOfferWeek(reference = new Date()): {
  start: string;
  end: string;
} {
  const dublin = toZonedTime(reference, DUBLIN);
  const day = dublin.getDay();
  const daysSinceThursday = (day + 3) % 7;
  const start = new Date(dublin);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - daysSinceThursday);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return {
    start: formatInTimeZone(start, DUBLIN, "yyyy-MM-dd"),
    end: formatInTimeZone(end, DUBLIN, "yyyy-MM-dd"),
  };
}

export function isPromotionalSupervaluProduct(
  product: SupervaluGatewayProduct,
): boolean {
  const current = Number(product.priceNumeric ?? product.wholePrice ?? 0);
  const was = Number(product.wasPriceNumeric ?? 0);
  if (product.priceSource === "tpr") return true;
  if (was > 0 && was > current) return true;
  if (String(product.priceLabel ?? "").trim()) return true;
  return false;
}

export function normalizeSupervaluGatewayProduct(
  product: SupervaluGatewayProduct,
  department: string,
): NormalizedWeeklyOffer | null {
  const productName = String(product.name ?? "").trim();
  if (!productName) return null;

  const currentPriceEur = Number(product.priceNumeric ?? product.wholePrice ?? 0);
  if (!Number.isFinite(currentPriceEur) || currentPriceEur <= 0) return null;
  if (!isPromotionalSupervaluProduct(product)) return null;

  const wasRaw = Number(product.wasPriceNumeric ?? 0);
  const wasPriceEur =
    Number.isFinite(wasRaw) && wasRaw > currentPriceEur ? wasRaw : null;
  const sku = String(product.sku ?? product.productId ?? "").trim() || null;
  const altCategory = String(product.attributes?.altCategory ?? "").trim();
  const resolvedDepartment = altCategory || department;

  return {
    productName,
    department: resolvedDepartment,
    currentPriceEur,
    wasPriceEur,
    discountLabel: String(product.priceLabel ?? "").trim() || null,
    pricePerUnit: String(product.pricePerUnit ?? "").trim() || null,
    sku,
    sourceUrl: String(product.url ?? "").trim() || null,
    searchText: normalizeSearchText(
      [productName, resolvedDepartment, sku ?? ""].filter(Boolean).join(" "),
    ),
  };
}

export { SUPERVALU_MEAT_CATEGORY_SEEDS };
