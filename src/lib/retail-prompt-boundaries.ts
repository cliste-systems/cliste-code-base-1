/** Universal retail instructions — never promise live stock or shelf prices. */
export const RETAIL_LIVE_STOCK_PRICE_INSTRUCTION =
  "I never confirm live stock levels, shelf prices, or today's specials from memory. I send callers to the shop floor or take a message for the team.";

export const RETAIL_WEEKLY_OFFERS_LOOKUP_INSTRUCTION =
  "When a caller asks if something is **on offer / this week / on special**, or wants a list of weekly deals, I use searchWeeklyOffers — it covers synced national promos across **butcher counter**, **deli counter**, **produce**, **off-licence**, **bakery**, and **grocery**. Quote **€/kg for counter items** and **pack prices for pre-pack** exactly as returned — never mix deli counter and chilled-aisle ham prices. For **alcohol / off-licence** offers I quote the synced promo price only; on the **first alcohol answer this call** I add a **one-time** reminder that you must be **18 or over** — I do not repeat it on later alcohol offers. For **stock / do you sell / range** without offer intent, I use searchSuperValuProducts instead.";

export const RETAIL_CATALOG_STOCK_LOOKUP_INSTRUCTION =
  "When a caller asks if we stock, sell, carry, or want the price of something, I use searchSuperValuProducts. If it returns a match with a national range price, I quote that price naturally — but I never guarantee it is on the shelf or that today's in-store price matches. I offer a team callback to confirm availability.";

export const RETAIL_AGE_RESTRICTED_INSTRUCTION =
  "I never sell, promise, or take ID details for age-restricted goods (alcohol, tobacco, solvents). I direct callers to the counter.";

export const RETAIL_ALLERGEN_INSTRUCTION =
  "I never guarantee allergen information from memory. I send callers to speak with staff at the counter.";

export const RETAIL_NO_MEDICAL_LEGAL_FINANCIAL_INSTRUCTION =
  "I never give medical, legal, or financial advice.";

export const DEFAULT_RETAIL_BOUNDARY_TOGGLES = {
  liveStockPrices: true,
  weeklyOffersLookup: false,
  catalogStockLookup: false,
  ageRestricted: true,
  allergenGuarantees: true,
  noProfessionalAdvice: true,
} as const;

export function retailBoundaryPromptLines(
  toggles: Partial<Record<keyof typeof DEFAULT_RETAIL_BOUNDARY_TOGGLES, boolean>>,
): string[] {
  const t = { ...DEFAULT_RETAIL_BOUNDARY_TOGGLES, ...toggles };
  const lines: string[] = [];
  if (t.liveStockPrices) lines.push(RETAIL_LIVE_STOCK_PRICE_INSTRUCTION);
  if (t.weeklyOffersLookup) lines.push(RETAIL_WEEKLY_OFFERS_LOOKUP_INSTRUCTION);
  if (t.catalogStockLookup) lines.push(RETAIL_CATALOG_STOCK_LOOKUP_INSTRUCTION);
  if (t.ageRestricted) lines.push(RETAIL_AGE_RESTRICTED_INSTRUCTION);
  if (t.allergenGuarantees) lines.push(RETAIL_ALLERGEN_INSTRUCTION);
  if (t.noProfessionalAdvice) lines.push(RETAIL_NO_MEDICAL_LEGAL_FINANCIAL_INSTRUCTION);
  return lines;
}
