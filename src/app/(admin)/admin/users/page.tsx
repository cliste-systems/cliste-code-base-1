import type { Metadata } from "next";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { Users } from "lucide-react";

import {
  ADMIN_LIST_PAGE_CLASS,
  AdminListCard,
} from "@/components/admin/admin-list-card";
import {
  AdminErrorCard,
  AdminPageShell,
} from "@/components/admin/admin-page-shell";
import { PRODUCT_NAME } from "@/lib/company-details";
import { isAdminEmailAllowlisted } from "@/lib/admin-session";
import { createAdminClient } from "@/utils/supabase/admin";

import {
  type IdentityAccessRow,
  IdentityAccessTable,
} from "../identity-access-table";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} Admin — Identity & access`,
};

function formatLastLogin(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return `Today at ${d.toLocaleTimeString("en-IE", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })}`;
  }
  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) {
    return `Yesterday at ${d.toLocaleTimeString("en-IE", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })}`;
  }
  return d.toLocaleString("en-IE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function resolveStatus(user: User): IdentityAccessRow["status"] {
  const bannedUntil = user.banned_until;
  if (bannedUntil) {
    const t = new Date(bannedUntil).getTime();
    if (!Number.isNaN(t) && t > Date.now()) return "suspended";
  }
  if (user.email_confirmed_at) return "active";
  return "pending";
}

async function listAllAuthUsers(admin: SupabaseClient) {
  const users: User[] = [];
  let page = 1;
  const perPage = 1000;
  for (let guard = 0; guard < 500; guard++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) {
      throw new Error(error.message);
    }
    users.push(...data.users);
    if (data.nextPage === null || data.users.length === 0) break;
    page = data.nextPage;
  }
  return users;
}

export default async function AdminIdentityAccessPage() {
  let loadError: string | null = null;
  let rows: IdentityAccessRow[] = [];

  try {
    const admin = createAdminClient();
    const authUsers = await listAllAuthUsers(admin);

    const [{ data: profileRows, error: profileError }, { data: orgRows, error: orgError }] =
      await Promise.all([
        admin.from("profiles").select("id, organization_id"),
        admin.from("organizations").select("id, name"),
      ]);

    if (profileError) throw new Error(profileError.message);
    if (orgError) throw new Error(orgError.message);

    const orgNameById = new Map<string, string>();
    for (const o of orgRows ?? []) {
      if (o.id) {
        orgNameById.set(
          o.id,
          o.name?.trim() ? o.name.trim() : "Unnamed client",
        );
      }
    }

    const profileOrgByUserId = new Map<string, string | null>();
    for (const p of profileRows ?? []) {
      profileOrgByUserId.set(p.id, p.organization_id ?? null);
    }

    const sorted = [...authUsers].sort((a, b) => {
      const ta = a.last_sign_in_at
        ? new Date(a.last_sign_in_at).getTime()
        : 0;
      const tb = b.last_sign_in_at
        ? new Date(b.last_sign_in_at).getTime()
        : 0;
      return tb - ta;
    });

    rows = sorted.map((user) => {
      const orgId = profileOrgByUserId.get(user.id) ?? null;
      const organizationName = orgId
        ? (orgNameById.get(orgId) ?? "Unknown client")
        : "—";

      const meta = user.user_metadata as Record<string, unknown> | undefined;
      const appMeta = user.app_metadata as Record<string, unknown> | undefined;
      const needsPassword =
        meta?.needs_password === true || meta?.needs_password === "true";
      const adminConsoleLocked = isAdminEmailAllowlisted(user.email);
      const adminConsoleAccess =
        adminConsoleLocked ||
        appMeta?.cliste_admin_console === true ||
        appMeta?.cliste_admin_console === "true";

      return {
        userId: user.id,
        email: user.email?.trim() ?? "",
        organizationId: orgId,
        organizationName,
        status: resolveStatus(user),
        passwordStatus: needsPassword ? "must_set" : "set",
        lastLoginLabel: formatLastLogin(user.last_sign_in_at),
        adminConsoleAccess,
        adminConsoleLocked,
      };
    });
  } catch (e) {
    loadError =
      e instanceof Error ? e.message : "Failed to load identity & access data.";
  }

  const countLabel =
    rows.length === 1 ? "1 user" : `${rows.length} users`;

  return (
    <AdminPageShell
      icon={Users}
      title="Identity & access"
      description="Use each user's action menu to grant or revoke admin console access."
      className={ADMIN_LIST_PAGE_CLASS}
    >
      {loadError ? (
        <AdminErrorCard message={loadError} />
      ) : (
        <AdminListCard countLabel={countLabel}>
          <IdentityAccessTable rows={rows} bare />
        </AdminListCard>
      )}
    </AdminPageShell>
  );
}
