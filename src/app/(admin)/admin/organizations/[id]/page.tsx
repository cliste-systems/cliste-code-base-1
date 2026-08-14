import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { parseAgentFaqs } from "@/app/(dashboard)/dashboard/agent-setup/agent-faqs";
import {
  evaluateStoreHealth,
  parseWarmTransferHardwareStatus,
} from "@/lib/admin-store-health";
import { parseCallRoutingMode } from "@/lib/call-routing";
import { isBusinessHoursUnset } from "@/lib/business-hours";
import { parseOrganizationNiche } from "@/lib/organization-niche";
import { cn } from "@/lib/utils";
import { createAdminClient } from "@/utils/supabase/admin";

import { AccountPlanForm } from "./account-plan-form";
import { AdminNotesCard } from "./admin-notes-card";
import { AIBrainConfigForm } from "./ai-brain-config-form";
import { CallRoutingCard } from "./call-routing-card";
import { IrishPhoneCard } from "./irish-phone-card";
import { LiveKitPhoneCard } from "./livekit-phone-card";
import { OpenDashboardButton } from "./open-dashboard-button";
import { OrganizationNicheForm } from "./organization-niche-form";
import { WarmTransferHardwareCard } from "./warm-transfer-hardware-card";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

function formatDate(iso: string | null): string {
  if (!iso) return "No calls yet";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IE", { dateStyle: "medium", timeStyle: "short" });
}

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
      "id, name, slug, niche, greeting, custom_prompt, updated_at, phone_number, account_id, call_routing_mode, fallback_number, agent_faqs, business_hours, admin_notes, warm_transfer_hardware_status, warm_transfer_hardware_notes",
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

  const [
    { count: departmentCount },
    { count: openLearnableGaps },
    { data: lastCall },
    { data: openGaps },
  ] = await Promise.all([
    admin
      .from("store_departments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", id),
    admin
      .from("cara_training_items")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", id)
      .in("status", ["awaiting_answer", "draft_ready"])
      .neq("gap_kind", "live_info"),
    admin
      .from("call_logs")
      .select("created_at")
      .eq("organization_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("cara_training_items")
      .select("id, gap_summary, gap_kind, status, created_at")
      .eq("organization_id", id)
      .in("status", ["awaiting_answer", "draft_ready"])
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const faqCount = parseAgentFaqs(org.agent_faqs).length;
  const health = evaluateStoreHealth({
    phoneNumber: org.phone_number,
    hoursConfigured: !isBusinessHoursUnset(org.business_hours),
    faqCount,
    departmentCount: departmentCount ?? 0,
    transferNumber: org.fallback_number,
    callRoutingMode: org.call_routing_mode,
    hardwareStatus: parseWarmTransferHardwareStatus(
      org.warm_transfer_hardware_status,
    ),
    openLearnableGaps: openLearnableGaps ?? 0,
    lastCallAt: lastCall?.created_at ? String(lastCall.created_at) : null,
  });

  const learnableGaps = (openGaps ?? []).filter(
    (g) => String(g.gap_kind ?? "learnable") !== "live_info",
  );

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

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Store health</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {health.readyCount} of {health.checks.length} checks ready · last
              call {formatDate(health.lastCallAt)} · {health.openLearnableGaps}{" "}
              open teachable gaps
            </p>
          </div>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-semibold",
              health.warmTransfer.ready
                ? "bg-emerald-100 text-emerald-900"
                : "bg-amber-100 text-amber-950",
            )}
          >
            Warm transfer {health.warmTransfer.label}
          </span>
        </div>
        <ul className="mt-4 divide-y divide-gray-100">
          {health.checks.map((check) => (
            <li
              key={check.id}
              className="flex items-start justify-between gap-3 py-2.5 text-sm"
            >
              <span className="font-medium text-gray-900">{check.label}</span>
              <span
                className={cn(
                  "max-w-[60%] text-right",
                  check.ok ? "text-emerald-800" : "text-amber-800",
                )}
              >
                {check.detail}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {learnableGaps.length > 0 ? (
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Open knowledge gaps</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Teachable items waiting on the store. Live stock/price questions are
            dismissed automatically and do not appear here.
          </p>
          <ul className="mt-3 space-y-2">
            {learnableGaps.map((gap) => (
              <li
                key={String(gap.id)}
                className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2 text-sm"
              >
                <p className="font-medium text-gray-900">
                  {String(gap.gap_summary ?? "").trim() || "Untitled gap"}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {String(gap.status)} · {formatDate(String(gap.created_at))}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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

      <WarmTransferHardwareCard
        organizationId={org.id}
        initialStatus={parseWarmTransferHardwareStatus(
          org.warm_transfer_hardware_status,
        )}
        initialNotes={org.warm_transfer_hardware_notes ?? ""}
        computedLabel={health.warmTransfer.label}
        computedReasons={health.warmTransfer.reasons}
      />

      <AdminNotesCard
        organizationId={org.id}
        initialNotes={org.admin_notes ?? ""}
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
        Opening hours, departments, and FAQs are edited in the client dashboard
        (use &quot;Open dashboard as tenant&quot; above to change them on the
        client&apos;s behalf).
      </p>

      <AIBrainConfigForm
        organizationId={org.id}
        greeting={org.greeting}
        customPrompt={org.custom_prompt}
      />

      {process.env.ADMIN_SHOW_LIVEKIT_US_PHONE === "1" ? (
        <LiveKitPhoneCard
          organizationId={org.id}
          phoneNumber={org.phone_number}
        />
      ) : null}
    </div>
  );
}
