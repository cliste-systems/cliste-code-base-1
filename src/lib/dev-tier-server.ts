import { cookies } from "next/headers";

import {
  DEV_TIER_COOKIE,
  type DevProductTier,
  parseDevProductTier,
} from "@/lib/dev-tier";

export async function getDevProductTier(): Promise<DevProductTier> {
  const jar = await cookies();
  return parseDevProductTier(jar.get(DEV_TIER_COOKIE)?.value);
}

/**
 * In development, the Dev Tier toggle cookie overrides the org row so you can
 * preview Connect vs Native. In production, only the database tier is used.
 */
export async function getEffectiveProductTier(
  databaseTier: string | undefined | null
): Promise<DevProductTier> {
  const fromDb: DevProductTier =
    databaseTier === "native" ? "native" : "connect";
  if (process.env.NODE_ENV !== "development") {
    return fromDb;
  }
  return getDevProductTier();
}
