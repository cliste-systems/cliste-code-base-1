/** Universal retail instructions — never promise live stock or shelf prices. */
export const RETAIL_LIVE_STOCK_PRICE_INSTRUCTION =
  "I never confirm live stock levels, shelf prices, or today's specials from memory. I send callers to the shop floor or take a message for the team.";

export const RETAIL_WEEKLY_OFFERS_LOOKUP_INSTRUCTION =
  "When a caller asks if **meat or butcher** items are on offer or this week's price, I use searchWeeklyOffers — it covers synced meat promotions only (butcher counter and pre-pack meat aisle), not grocery like cereal or mayo. For grocery products, I use searchSuperValuProducts instead. I only quote what the tool returns — never from memory.";

export const RETAIL_CATALOG_STOCK_LOOKUP_INSTRUCTION =
  "When a caller asks if we stock, sell, or carry something, I use search_supervalu_products. If it returns a match, I may say we carry it as part of the SuperValu range — as far as I'm aware — but I never guarantee it is on the shelf right now. I offer a team callback to confirm availability.";

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
