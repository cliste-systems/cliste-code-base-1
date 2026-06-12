import type { User } from "@supabase/supabase-js";

import type { DashboardSessionProfile } from "@/lib/dashboard-session";

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (
    (parts[0]![0] ?? "") + (parts[parts.length - 1]![0] ?? "")
  ).toUpperCase();
}
import { resolveOrganizationDisplayName } from "@/lib/organization-display-name";

export type DashboardAccountSummary = {
  initials: string;
  displayName: string;
  subtitle: string;
};

export function formatDashboardProfileRole(
  role: string | null | undefined,
): string {
  const r = (role ?? "").trim();
  if (!r) return "Member";
  return r.charAt(0).toUpperCase() + r.slice(1).toLowerCase();
}

export function buildDashboardAccountSummary(
  profile: DashboardSessionProfile,
  user: User,
  account: { name: string | null; slug: string | null } | null,
): DashboardAccountSummary {
  const displayName =
    profile.name?.trim() ||
    user.email?.split("@")[0]?.replace(/[._-]+/g, " ").trim() ||
    "Account";
  const accountName =
    resolveOrganizationDisplayName(account?.name, account?.slug) ||
    "Your business";

  return {
    initials: initialsFromName(displayName),
    displayName,
    subtitle: `${formatDashboardProfileRole(profile.role)} · ${accountName}`,
  };
}
