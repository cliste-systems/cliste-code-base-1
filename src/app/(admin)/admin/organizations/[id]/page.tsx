import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { parseCallRoutingMode } from "@/lib/call-routing";
import { loadOrganizationProvisioning } from "@/lib/load-provisioning-pipeline";
import { livekitUsNumbersEnabled } from "@/lib/livekit-us-numbers-flag";
import { parseOrganizationNiche } from "@/lib/organization-niche";
import { getTwilioMessagingRegion } from "@/lib/twilio-ie-messaging";
import { createAdminClient } from "@/utils/supabase/admin";

import { TenantProvisioningStageChip } from "../../tenant-provisioning-chip";
import { AccountPlanForm } from "./account-plan-form";
import { CallRoutingCard } from "./call-routing-card";
import { IrishPhoneCard } from "./irish-phone-card";
import { LiveKitPhoneCard } from "./livekit-phone-card";
import { OpenDashboardButton } from "./open-dashboard-button";
import { OrganizationNicheForm } from "./organization-niche-form";
import { PhoneLineVerifyCard } from "./phone-line-verify-card";
import { GoLiveCard } from "./go-live-card";
import {
  CaraTrainingLinkCard,
  ProvisioningStepsRail,
} from "./retail-org-sections";

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

  const { data: org } = await admin
    .from("organizations")
    .select(
      "id, name, slug, niche, greeting, custom_prompt, phone_number, account_id, call_routing_mode, fallback_number, store_public_number, divert_carrier, store_code, is_active",
    )
    .eq("id", id)
    .maybeSingle();

  if (!org) notFound();

  const niche = parseOrganizationNiche(org.niche);
  const isRetail = niche === "retail";

  if (isRetail) {
    const provisioning = await loadOrganizationProvisioning(id);
    const phoneStep = provisioning?.steps.find((s) => s.id === "phone_assigned");
    const routingStep = provisioning?.steps.find(
      (s) => s.id === "routing_configured",
    );
    const trainedStep = provisioning?.steps.find((s) => s.id === "cara_trained");

    const { data: firstCall } = await admin
      .from("call_logs")
      .select("created_at")
      .eq("organization_id", id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const clisteNumber = org.phone_number as string | null;
    let messagingRegion: string | null = null;
    let messagingRegionOk = false;
    let messagingRegionError: string | null = null;
    if (clisteNumber?.trim()) {
      const region = await getTwilioMessagingRegion(clisteNumber);
      messagingRegion = region.messagingRegion;
      messagingRegionOk = region.ok;
      messagingRegionError = region.error ?? null;
    }

    return (
      <div className="mx-auto max-w-6xl space-y-6 p-6 md:p-8">
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
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-foreground text-2xl font-semibold tracking-tight">
                  {org.name}
                </h1>
                {provisioning ? (
                  <TenantProvisioningStageChip stage={provisioning.stage} />
                ) : null}
              </div>
              <p className="text-muted-foreground mt-1 font-mono text-sm">
                {org.slug}
                {org.store_code ? ` · store ${org.store_code}` : ""}
              </p>
            </div>
            <OpenDashboardButton organizationId={org.id} />
          </div>
        </div>

        {provisioning ? (
          <ProvisioningStepsRail steps={provisioning.steps} />
        ) : null}

        <IrishPhoneCard
          organizationId={org.id}
          phoneNumber={clisteNumber}
          phoneAssignedComplete={phoneStep?.complete}
        />

        <CallRoutingCard
          organizationId={org.id}
          initialMode={parseCallRoutingMode(org.call_routing_mode)}
          initialTransferNumber={String(org.fallback_number ?? "")}
          initialStorePublicNumber={String(org.store_public_number ?? "")}
          initialDivertCarrier={String(org.divert_carrier ?? "")}
          clisteNumber={clisteNumber}
          routingConfiguredComplete={routingStep?.complete}
          retail
        />

        <PhoneLineVerifyCard
          organizationId={org.id}
          clisteNumber={clisteNumber}
          firstCallAt={(firstCall?.created_at as string | null) ?? null}
          messagingRegion={messagingRegion}
          messagingRegionOk={messagingRegionOk}
          messagingRegionError={messagingRegionError}
        />

        <CaraTrainingLinkCard
          organizationId={org.id}
          trainedComplete={trainedStep?.complete ?? false}
        />

        <GoLiveCard
          organizationId={org.id}
          isActive={org.is_active === true}
          readyForGoLive={provisioning?.readyForGoLive ?? false}
          missingStepLabel={
            provisioning
              ? (provisioning.steps.find(
                  (s) =>
                    [
                      "phone_assigned",
                      "routing_configured",
                      "greeting_compliant",
                      "hours_set",
                      "cara_trained",
                    ].includes(s.id) && !s.complete,
                )?.label ?? null)
              : null
          }
        />
      </div>
    );
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

  const showLivekit = livekitUsNumbersEnabled();

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
        initialMode={parseCallRoutingMode(org.call_routing_mode)}
        initialTransferNumber={String(org.fallback_number ?? "")}
        clisteNumber={org.phone_number}
      />

      {accountId ? (
        <AccountPlanForm accountId={accountId} initialPlanTier={planTier} />
      ) : null}

      <OrganizationNicheForm organizationId={org.id} initialNiche={niche} />

      {showLivekit ? (
        <LiveKitPhoneCard organizationId={org.id} phoneNumber={org.phone_number} />
      ) : null}
    </div>
  );
}
