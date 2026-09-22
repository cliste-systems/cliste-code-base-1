import { formatInTimeZone } from "date-fns-tz";

const DUBLIN = "Europe/Dublin";

export type RetailPromotionRow = {
  promotion_type: string | null;
  loyalty_required: boolean | null;
  loyalty_program: string | null;
  offer_price_eur: number | null;
  regular_price_eur: number | null;
  label: string | null;
  valid_from: string;
  valid_to: string;
};

export type RetailStorePriceListing = {
  regular_price_eur: number | null;
  display_price_eur: number | null;
  price_per_unit: string | null;
  source_price_label: string | null;
  retail_promotions: RetailPromotionRow[];
};

export type RetailWeeklyPriceRow = {
  current_price_eur: number | null;
  was_price_eur: number | null;
  discount_label: string | null;
  price_per_unit: string | null;
};

export type RetailPricePresentation = {
  currentPriceEur: number | null;
  regularPriceEur: number | null;
  pricePerUnit: string | null;
  offerLabel: string | null;
  isOnOffer: boolean;
  promotionType: string | null;
  loyaltyRequired: boolean;
  loyaltyProgram: string | null;
  isMultibuy: boolean;
  savingsEur: number | null;
  savingsPercent: number | null;
};

function positiveNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function inferPromotionTypeFromLabel(
  label: string | null | undefined,
): string | null {
  const value = String(label ?? "").trim();
  if (!value) return null;
  if (/real\s+rewards|rewards?\s+price/i.test(value)) return "loyalty";
  if (/\b\d+\s*for\s*[€£]?\s*\d/i.test(value)) return "multibuy";
  if (/half[ -]?price|50\s*%\s*off/i.test(value)) return "half_price";
  if (/save\s*\d+(?:[.,]\d+)?\s*%/i.test(value)) return "percentage";
  if (/save\s*[€£]\s*\d/i.test(value)) return "money_off";
  return "standard_offer";
}

function buildPresentation(input: {
  currentPriceEur: number | null;
  regularPriceEur: number | null;
  pricePerUnit: string | null;
  offerLabel: string | null;
  promotionType: string | null;
  loyaltyRequired: boolean;
  loyaltyProgram: string | null;
  isOnOffer: boolean;
}): RetailPricePresentation {
  const current = positiveNumber(input.currentPriceEur);
  const regular = positiveNumber(input.regularPriceEur);
  const savings =
    current != null && regular != null && regular > current
      ? Number((regular - current).toFixed(2))
      : null;
  const percent =
    savings != null && regular != null
      ? Number(((savings / regular) * 100).toFixed(1))
      : null;
  const inferred = input.promotionType ?? inferPromotionTypeFromLabel(input.offerLabel);

  return {
    currentPriceEur: current,
    regularPriceEur: regular,
    pricePerUnit: input.pricePerUnit?.trim() || null,
    offerLabel: input.offerLabel?.trim() || null,
    isOnOffer: input.isOnOffer,
    promotionType: inferred,
    loyaltyRequired:
      input.loyaltyRequired ||
      /real\s+rewards|rewards?\s+price/i.test(input.offerLabel ?? ""),
    loyaltyProgram:
      input.loyaltyProgram?.trim() ||
      (/real\s+rewards|rewards?\s+price/i.test(input.offerLabel ?? "")
        ? "Real Rewards"
        : null),
    isMultibuy:
      inferred === "multibuy" ||
      /\b\d+\s*for\s*[€£]?\s*\d/i.test(input.offerLabel ?? ""),
    savingsEur: savings,
    savingsPercent: percent,
  };
}

export function resolveStoredRetailPrice(
  listing: RetailStorePriceListing,
  reference = new Date(),
): RetailPricePresentation {
  const today = formatInTimeZone(reference, DUBLIN, "yyyy-MM-dd");
  const activePromotions = (listing.retail_promotions ?? []).filter(
    (promo) => promo.valid_from <= today && promo.valid_to >= today,
  );
  const promo =
    activePromotions.find((row) => row.loyalty_required === true) ??
    activePromotions[0] ??
    null;

  const current =
    positiveNumber(promo?.offer_price_eur) ??
    positiveNumber(listing.display_price_eur) ??
    positiveNumber(listing.regular_price_eur);
  const regular =
    positiveNumber(promo?.regular_price_eur) ??
    positiveNumber(listing.regular_price_eur);

  return buildPresentation({
    currentPriceEur: current,
    regularPriceEur: regular,
    pricePerUnit: listing.price_per_unit,
    offerLabel: promo?.label ?? listing.source_price_label,
    promotionType: promo?.promotion_type ?? null,
    loyaltyRequired: promo?.loyalty_required === true,
    loyaltyProgram: promo?.loyalty_program ?? null,
    isOnOffer: promo != null,
  });
}

export function resolveNationalRetailPrice(input: {
  regularPriceEur: number | null;
  weeklyOffer?: RetailWeeklyPriceRow | null;
}): RetailPricePresentation {
  const offer = input.weeklyOffer ?? null;
  if (offer) {
    return buildPresentation({
      currentPriceEur: positiveNumber(offer.current_price_eur),
      regularPriceEur:
        positiveNumber(offer.was_price_eur) ??
        positiveNumber(input.regularPriceEur),
      pricePerUnit: offer.price_per_unit,
      offerLabel: offer.discount_label,
      promotionType: inferPromotionTypeFromLabel(offer.discount_label),
      loyaltyRequired: false,
      loyaltyProgram: null,
      isOnOffer: true,
    });
  }

  return buildPresentation({
    currentPriceEur: positiveNumber(input.regularPriceEur),
    regularPriceEur: positiveNumber(input.regularPriceEur),
    pricePerUnit: null,
    offerLabel: null,
    promotionType: null,
    loyaltyRequired: false,
    loyaltyProgram: null,
    isOnOffer: false,
  });
}

export function formatRetailPriceEur(value: number | null): string | null {
  if (value == null) return null;
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
