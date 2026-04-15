export type DevProductTier = "native" | "connect";

export const DEV_TIER_COOKIE = "cliste_dev_tier";

/** 1 year — dev-only cookie for previewing Connect vs Native UI. */
export const DEV_TIER_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function parseDevProductTier(value: string | undefined): DevProductTier {
  return value === "connect" ? "connect" : "native";
}
