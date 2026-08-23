import { adminBadgeClass } from "@/components/admin/admin-badge";

export const CLIENT_PROVISION_SOURCES = ["managed", "self_serve"] as const;

export type ClientProvisionSource = (typeof CLIENT_PROVISION_SOURCES)[number];

export type ClientProvisionFilter = ClientProvisionSource | "all";

export function isClientProvisionSource(v: string): v is ClientProvisionSource {
  return CLIENT_PROVISION_SOURCES.includes(v as ClientProvisionSource);
}

export function parseClientProvisionFilter(
  raw: string | null | undefined,
): ClientProvisionFilter {
  if (raw && isClientProvisionSource(raw)) return raw;
  return "all";
}

export function clientProvisionSourceLabel(
  source: ClientProvisionSource,
): string {
  return source === "managed" ? "Managed" : "Self-serve";
}

export function clientProvisionSourceDescription(
  source: ClientProvisionSource,
): string {
  return source === "managed"
    ? "Cliste-led setup and training"
    : "Customer self-serve signup";
}

export function clientProvisionSourceBadgeClass(
  _source: ClientProvisionSource,
): string {
  return adminBadgeClass;
}
