import {
  SUPERVALU_STOREFRONT_STORE_ID,
  type SupervaluGatewayProduct,
} from "@/lib/supervalu-offers-types";

export const SUPERVALU_GATEWAY_BASE = "https://storefrontgateway.supervalu.ie/api";
export const SUPERVALU_GATEWAY_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
export const SUPERVALU_GATEWAY_PAGE_SIZE = 100;

export type SupervaluGatewaySearchResponse = {
  total?: number;
  count?: number;
  categoryName?: string;
  items?: SupervaluGatewayProduct[];
};

export async function fetchSupervaluGatewayJson(
  url: string,
): Promise<SupervaluGatewaySearchResponse> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": SUPERVALU_GATEWAY_USER_AGENT,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`SuperValu gateway HTTP ${response.status} for ${url}`);
  }
  return (await response.json()) as SupervaluGatewaySearchResponse;
}

export async function fetchSupervaluGatewaySearch(input: {
  query: string;
  storeId?: string;
  take?: number;
  skip?: number;
  promotionsOnly?: boolean;
}): Promise<SupervaluGatewayProduct[]> {
  const storeId = input.storeId ?? SUPERVALU_STOREFRONT_STORE_ID;
  const take = input.take ?? SUPERVALU_GATEWAY_PAGE_SIZE;
  const skip = input.skip ?? 0;
  const promoPart = input.promotionsOnly ? "&sort=ppfreq&fpromotions=True" : "";
  const url =
    `${SUPERVALU_GATEWAY_BASE}/stores/${encodeURIComponent(storeId)}/search` +
    `?q=${encodeURIComponent(input.query)}&take=${take}&skip=${skip}${promoPart}`;
  const payload = await fetchSupervaluGatewayJson(url);
  return payload.items ?? [];
}
