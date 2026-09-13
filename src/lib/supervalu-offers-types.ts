export type RetailWeeklyOfferRow = {
  id: string;
  organization_id: string | null;
  retail_banner: string;
  sync_batch_id: string;
  product_name: string;
  department: string;
  current_price_eur: number;
  was_price_eur: number | null;
  discount_label: string | null;
  price_per_unit: string | null;
  sku: string | null;
  offer_week_start: string;
  offer_week_end: string;
  source_url: string | null;
  search_text: string;
  synced_at: string;
};

export type SupervaluGatewayProduct = {
  productId?: string;
  sku?: string;
  name?: string;
  price?: string;
  priceNumeric?: number;
  wholePrice?: number;
  wasPrice?: string;
  wasPriceNumeric?: number;
  priceLabel?: string;
  pricePerUnit?: string;
  priceSource?: string;
  attributes?: Record<string, unknown> & {
    altCategory?: string;
  };
  url?: string;
};

export type SupervaluOffersSyncResult = {
  ok: true;
  syncBatchId: string;
  offerCount: number;
  organizationsUpdated: number;
  offerWeekStart: string;
  offerWeekEnd: string;
  syncedAt: string;
} | {
  ok: false;
  message: string;
};

export const SUPERVALU_OFFERS_SYNC_SOURCE = "supervalu_national";

export const SUPERVALU_STOREFRONT_STORE_ID =
  process.env.SUPERVALU_STOREFRONT_STORE_ID?.trim() || "5550";

/** Meat / butcher categories for the pilot sync scope. */
export const SUPERVALU_MEAT_CATEGORY_SEEDS: {
  categoryId: string;
  department: string;
}[] = [
  { categoryId: "O411190", department: "Butcher" },
  { categoryId: "O411290", department: "Butcher" },
  { categoryId: "O411195", department: "Butcher" },
  { categoryId: "O411215", department: "Butcher" },
  { categoryId: "O303440", department: "Butcher" },
  { categoryId: "O300470", department: "Butcher" },
  { categoryId: "O303395", department: "Butcher" },
  { categoryId: "O200088", department: "Butcher" },
  { categoryId: "O411335", department: "Butcher" },
  { categoryId: "O300545", department: "Deli" },
];
