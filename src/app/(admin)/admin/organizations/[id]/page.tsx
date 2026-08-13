import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { parseCallRoutingMode } from "@/lib/call-routing";
import { parseOrganizationNiche } from "@/lib/organization-niche";
import { createAdminClient } from "@/utils/supabase/admin";

import { AccountPlanForm } from "./account-plan-form";
import { AIBrainConfigForm } from "./ai-brain-config-form";
import { CallRoutingCard } from "./call-routing-card";
import { IrishPhoneCard } from "./irish-phone-card";
import { LiveKitPhoneCard } from "./livekit-phone-card";
import { OpenDashboardButton } from "./open-dashboard-button";
import { OrganizationNicheForm } from "./organization-niche-form";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminOrganizationDetailPage({ params }: PageProps) {
  const { id } = await params;

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return (
      <div className="mx-auto max-w-3xl p-6 md:p-8">
        <p className="text-destructive text-sm">
          {e instanceof Error ? e.message : "Admin client unavailable."}
        </p>
      </div>
    );
  }

  const { data: org, error } = await admin
    .from("organizations")
    .select(
      "id, name, slug, niche, greeting, custom_prompt, updated_at, phone_number, account_id, call_routing_mode, fallback_number",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !org) {
    notFound();
  }

  const accountId = (org as { account_id?: string | null }).account_id ?? null;
  let planTier = "pro";
  if (accountId) {
    const { data: account } = await admin
      .from("accounts")
      .select("plan_tier")
      .eq("id", accountId)
      .maybeSingle();
    if (account?.plan_tier) planTier = account.plan_tier as string;
  }

  return (
    <div className="mx-auto min-h-dvh max-w-3xl space-y-8 p-6 md:p-8">
      <div>
        <Link
          href="/admin"
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm font-medium"
        >
          <ChevronLeft className="size-4" aria-hidden />
          All organizations
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-foreground text-2xl font-semibold tracking-tight">
              {org.name}
            </h1>
            <p className="text-muted-foreground mt-1 font-mono text-sm">
              {org.slug}
            </p>
          </div>
          <OpenDashboardButton organizationId={org.id} />
        </div>
      </div>

      <IrishPhoneCard organizationId={org.id} phoneNumber={org.phone_number} />

      <CallRoutingCard
        organizationId={org.id}
        initialMode={parseCallRoutingMode(
          (org as { call_routing_mode?: string | null }).call_routing_mode,
        )}
        initialTransferNumber={
          (org as { fallback_number?: string | null }).fallback_number ?? ""
        }
        clisteNumber={org.phone_number}
      />

      {accountId ? (
        <AccountPlanForm accountId={accountId} initialPlanTier={planTier} />
      ) : null}

      <OrganizationNicheForm
        organizationId={org.id}
        initialNiche={parseOrganizationNiche(
          (org as { niche?: string | null }).niche,
        )}
      />

      <p className="text-muted-foreground text-sm leading-relaxed">
        Opening hours, FAQs, and store details are edited in the client
        dashboard (use &quot;Open dashboard as tenant&quot; above to change
        them on the client&apos;s behalf).
      </p>

      <AIBrainConfigForm
        organizationId={org.id}
        greeting={org.greeting}
        customPrompt={org.custom_prompt}
      />

      <LiveKitPhoneCard
        organizationId={org.id}
        phoneNumber={org.phone_number}
      />
    </div>
  );
}
