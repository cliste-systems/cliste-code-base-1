import type { Metadata } from "next";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { Shield, Users } from "lucide-react";

import { createAdminClient } from "@/utils/supabase/admin";

import {
  type IdentityAccessRow,
  IdentityAccessTable,
} from "../identity-access-table";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cliste Admin — Identity & access",
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
          o.name?.trim() ? o.name.trim() : "Unnamed salon",
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
      const salonName = orgId
        ? (orgNameById.get(orgId) ?? "Unknown salon")
        : "—";

      const meta = user.user_metadata as Record<string, unknown> | undefined;
      const needsPassword =
        meta?.needs_password === true || meta?.needs_password === "true";

      return {
        userId: user.id,
        email: user.email?.trim() ?? "",
        organizationId: orgId,
        salonName,
        status: resolveStatus(user),
        passwordStatus: needsPassword ? "must_set" : "set",
        lastLoginLabel: formatLastLogin(user.last_sign_in_at),
      };
    });
  } catch (e) {
    loadError =
      e instanceof Error ? e.message : "Failed to load identity & access data.";
  }

  const userLabel =
    rows.length === 1 ? "1 user" : `${rows.length} users`;

  return (
    <div className="mx-auto max-w-[1100px] p-6 pb-24 sm:p-10 lg:p-12">
      <header className="mb-10">
        <div className="mb-3 flex items-center gap-2">
          <Shield
            className="size-4 shrink-0 text-gray-400"
            strokeWidth={1.5}
            aria-hidden
          />
          <p className="text-xs font-medium tracking-widest text-gray-500 uppercase">
            Identity &amp; access
          </p>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h1 className="text-3xl font-medium tracking-tight text-gray-900">
            Access log
          </h1>
          <div className="flex shrink-0 items-center gap-1.5 text-sm text-gray-400 sm:mb-0.5">
            <Users className="size-4 shrink-0" aria-hidden />
            <span className="tabular-nums">{userLabel}</span>
          </div>
        </div>
      </header>

      {loadError ? (
        <div className="rounded-xl border border-red-200/80 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-red-700">{loadError}</p>
        </div>
      ) : (
        <section aria-label="Auth users">
          <IdentityAccessTable rows={rows} />
        </section>
      )}
    </div>
  );
}
