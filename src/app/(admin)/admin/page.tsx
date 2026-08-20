import Link from "next/link";
import { Suspense } from "react";
import {
  AlertTriangle,
  Building2,
  Euro,
  ExternalLink,
  LayoutGrid,
  LifeBuoy,
  Phone,
  Ticket,
  Wallet,
} from "lucide-react";

import {
  adminGlobalMetricPeriodShortLabel,
  getAdminGlobalMetricRange,
  parseAdminGlobalMetricPeriod,
} from "@/lib/admin-metric-range";
import { formatBookingValueEur, sumAppointmentBookingValueEur } from "@/lib/booking-value";
import {
  ORGANIZATION_NICHE_ADMIN_LABELS,
  parseOrganizationNiche,
} from "@/lib/organization-niche";
import { cn } from "@/lib/utils";
import { createAdminClient } from "@/utils/supabase/admin";

import { AdminDiagnosticsPanel } from "./admin-diagnostics-panel";
import { AdminMetricRangeToggle } from "./admin-metric-range-toggle";
import { AdminStatCard } from "./admin-stat-card";
import { NewClientDialog } from "./new-client-dialog";
import { TenantRowActions } from "./tenant-row-actions";

export const dynamic = "force-dynamic";

function formatInt(n: number): string {
  return new Intl.NumberFormat("en-IE").format(n);
}

function voiceCostUsdToEurRate(): number {
  const v = process.env.VOICE_COST_USD_TO_EUR?.trim();
  if (!v) return 0.93;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : 0.93;
}

function formatApproxEurFromUsd(usd: number): string {
  const eur = usd * voiceCostUsdToEurRate();
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(eur);
}

type CostEstimateJson = {
  totalUsd?: unknown;
  breakdown?: Record<string, unknown>;
};

function isMissingCostEstimateColumnError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("cost_estimate") ||
    (m.includes("column") && m.includes("does not exist") && m.includes("call_logs"))
  );
}

function aggregateCallCostEstimates(
  rows: { cost_estimate: CostEstimateJson | null }[] | null,
): {
  totalUsd: number;
  callsWithEstimate: number;
  breakdown: Record<string, number>;
} {
  const breakdown: Record<string, number> = {
    livekit: 0,
    stt: 0,
    llmVoice: 0,
    tts: 0,
    twilioVoice: 0,
    twilioSms: 0,
    supabase: 0,
    postprocessLlm: 0,
  };
  let totalUsd = 0;
  let callsWithEstimate = 0;
  for (const row of rows ?? []) {
    const ce = row.cost_estimate;
    if (!ce || typeof ce !== "object") continue;
    const t = ce.totalUsd;
    if (typeof t !== "number" || !Number.isFinite(t)) continue;
    totalUsd += t;
    callsWithEstimate += 1;
    const b = ce.breakdown;
    if (!b || typeof b !== "object") continue;
    for (const k of Object.keys(breakdown)) {
      const v = b[k];
      if (typeof v === "number" && Number.isFinite(v)) {
        breakdown[k] += v;
      }
    }
  }
  return { totalUsd, callsWithEstimate, breakdown };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function embeddedOrgName(
  org: { name: string; slug: string } | { name: string; slug: string }[] | null,
): { name: string; slug: string } | null {
  if (!org) return null;
  return Array.isArray(org) ? org[0] ?? null : org;
}

function VoiceCostDetails({
  callsInRange,
  voiceCostCallsWithEstimate,
  voiceCostBreakdown,
  estimatedVoiceCostUsd,
}: {
  callsInRange: number;
  voiceCostCallsWithEstimate: number;
  voiceCostBreakdown: Record<string, number>;
  estimatedVoiceCostUsd: number;
}) {
  if (voiceCostCallsWithEstimate === 0) return null;

  return (
    <details className="mt-6 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-[0_1px_0_rgba(15,23,42,0.04)] sm:px-5">
      <summary className="cursor-pointer list-none text-sm font-medium text-slate-700 [&::-webkit-details-marker]:hidden">
        Voice infrastructure breakdown
      </summary>
      <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-xs text-slate-600 sm:grid-cols-4">
        <li>LiveKit {formatApproxEurFromUsd(voiceCostBreakdown.livekit)}</li>
        <li>STT {formatApproxEurFromUsd(voiceCostBreakdown.stt)}</li>
        <li>LLM {formatApproxEurFromUsd(voiceCostBreakdown.llmVoice)}</li>
        <li>TTS {formatApproxEurFromUsd(voiceCostBreakdown.tts)}</li>
        <li>Twilio voice {formatApproxEurFromUsd(voiceCostBreakdown.twilioVoice)}</li>
        <li>Twilio SMS {formatApproxEurFromUsd(voiceCostBreakdown.twilioSms)}</li>
        <li>Post-call LLM {formatApproxEurFromUsd(voiceCostBreakdown.postprocessLlm)}</li>
        <li>Supabase {formatApproxEurFromUsd(voiceCostBreakdown.supabase)}</li>
      </ul>
      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        {formatInt(voiceCostCallsWithEstimate)} call
        {voiceCostCallsWithEstimate === 1 ? "" : "s"} with cost data
        {callsInRange > voiceCostCallsWithEstimate
          ? ` · ${formatInt(callsInRange - voiceCostCallsWithEstimate)} without estimates`
          : ""}
        . ≈{" "}
        {formatApproxEurFromUsd(
          estimatedVoiceCostUsd / voiceCostCallsWithEstimate,
        )}{" "}
        per estimated call.
      </p>
    </details>
  );
}

type AdminHomePageProps = {
  searchParams?: Promise<{ period?: string }>;
};

export default async function AdminHomePage({ searchParams }: AdminHomePageProps) {
  const sp = searchParams ? await searchParams : {};
  const metricPeriod = parseAdminGlobalMetricPeriod(sp.period);
  const { startIso: rangeStartIso, endExclusiveIso: rangeEndExclusiveIso } =
    getAdminGlobalMetricRange(metricPeriod);
  const periodShort = adminGlobalMetricPeriodShortLabel(metricPeriod);

  let orgCount = 0;
  let callsInRange = 0;
  let openTickets = 0;
  let urgentEngineeringOpen = 0;
  let openSupportTickets = 0;
  let bookingValueEur = 0;
  let estimatedVoiceCostUsd = 0;
  let voiceCostCallsWithEstimate = 0;
  let voiceCostBreakdown: Record<string, number> = {
    livekit: 0,
    stt: 0,
    llmVoice: 0,
    tts: 0,
    twilioVoice: 0,
    twilioSms: 0,
    supabase: 0,
    postprocessLlm: 0,
  };
  let voiceCostSchemaMissing = false;
  let organizations: {
    id: string;
    name: string;
    slug: string;
    tier: string;
    niche: string | null;
    created_at: string;
  }[] = [];
  type UrgentEngineeringRow = {
    id: string;
    caller_number: string;
    summary: string;
    created_at: string;
    organization_id: string;
    organizations: { name: string; slug: string } | { name: string; slug: string }[] | null;
  };
  let urgentEngineeringTickets: UrgentEngineeringRow[] = [];
  let loadError: string | null = null;

  try {
    const admin = createAdminClient();

    const [
      orgsRes,
      callsRes,
      ticketsRes,
      urgentCountRes,
      urgentListRes,
      supportRes,
      listRes,
      bookingValueSum,
    ] = await Promise.all([
      admin.from("organizations").select("id", { count: "exact", head: true }),
      admin
        .from("call_logs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", rangeStartIso)
        .lt("created_at", rangeEndExclusiveIso),
      admin
        .from("action_tickets")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),
      admin
        .from("action_tickets")
        .select("id", { count: "exact", head: true })
        .eq("status", "open")
        .eq("engineering_priority", "urgent"),
      admin
        .from("action_tickets")
        .select(
          "id, caller_number, summary, created_at, organization_id, organizations ( name, slug )",
        )
        .eq("status", "open")
        .eq("engineering_priority", "urgent")
        .order("created_at", { ascending: false })
        .limit(40),
      admin
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),
      admin
        .from("organizations")
        .select("id, name, slug, tier, niche, created_at")
        .order("created_at", { ascending: false }),
      sumAppointmentBookingValueEur(admin, {
        rangeStartIso,
        rangeEndExclusiveIso,
      }),
    ]);

    if (orgsRes.error) throw new Error(orgsRes.error.message);
    if (callsRes.error) throw new Error(callsRes.error.message);
    if (ticketsRes.error) throw new Error(ticketsRes.error.message);
    if (urgentCountRes.error) throw new Error(urgentCountRes.error.message);
    if (urgentListRes.error) throw new Error(urgentListRes.error.message);
    if (listRes.error) throw new Error(listRes.error.message);

    orgCount = orgsRes.count ?? 0;
    callsInRange = callsRes.count ?? 0;
    openTickets = ticketsRes.count ?? 0;
    urgentEngineeringOpen = urgentCountRes.count ?? 0;
    urgentEngineeringTickets = (urgentListRes.data ?? []) as UrgentEngineeringRow[];
    bookingValueEur = bookingValueSum;
    openSupportTickets = supportRes.error ? 0 : (supportRes.count ?? 0);
    organizations = listRes.data ?? [];

    const callCostsRes = await admin
      .from("call_logs")
      .select("cost_estimate")
      .gte("created_at", rangeStartIso)
      .lt("created_at", rangeEndExclusiveIso);

    if (callCostsRes.error) {
      if (isMissingCostEstimateColumnError(callCostsRes.error.message)) {
        voiceCostSchemaMissing = true;
      }
    } else {
      const agg = aggregateCallCostEstimates(
        (callCostsRes.data ?? []) as { cost_estimate: CostEstimateJson | null }[],
      );
      estimatedVoiceCostUsd = agg.totalUsd;
      voiceCostCallsWithEstimate = agg.callsWithEstimate;
      voiceCostBreakdown = agg.breakdown;
    }
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Failed to load admin data.";
  }

  const infraCostLabel =
    voiceCostSchemaMissing
      ? "—"
      : voiceCostCallsWithEstimate > 0
        ? formatApproxEurFromUsd(estimatedVoiceCostUsd)
        : "—";

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm">
            <LayoutGrid className="size-5" strokeWidth={1.5} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Platform
            </p>
            <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight text-[#0b1220]">
              Overview
            </h1>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-600">
              Live tenant activity, support queues, and provisioning tools.
            </p>
          </div>
        </div>
        {process.env.ADMIN_ALLOW_MANUAL_CREATE === "1" ? (
          <NewClientDialog />
        ) : null}
      </header>

      {loadError ? (
        <div
          className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4"
          role="alert"
        >
          <p className="text-sm font-medium text-red-800">{loadError}</p>
          <p className="mt-1 text-xs text-red-700/80">
            Check Supabase credentials and that required tables exist.
          </p>
        </div>
      ) : null}

      <section className="mb-8" aria-labelledby="global-metrics-heading">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2
              id="global-metrics-heading"
              className="text-sm font-semibold text-[#0b1220]"
            >
              Global metrics
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Rolling totals for the selected period.
            </p>
          </div>
          <Suspense
            fallback={
              <div className="h-9 w-[220px] max-w-full animate-pulse rounded-full bg-slate-100" />
            }
          >
            <AdminMetricRangeToggle />
          </Suspense>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <AdminStatCard
            label="Organizations"
            value={formatInt(orgCount)}
            icon={<Building2 className="size-4" strokeWidth={1.5} aria-hidden />}
          />
          <AdminStatCard
            label="Calls"
            hint={periodShort}
            value={formatInt(callsInRange)}
            icon={<Phone className="size-4" strokeWidth={1.5} aria-hidden />}
          />
          <AdminStatCard
            label="Booking value"
            hint={periodShort}
            value={formatBookingValueEur(bookingValueEur)}
            icon={<Euro className="size-4" strokeWidth={1.5} aria-hidden />}
          />
          <AdminStatCard
            label="Est. infra cost"
            hint={
              voiceCostSchemaMissing
                ? "Cost column missing"
                : voiceCostCallsWithEstimate > 0
                  ? `${periodShort} · ≈ EUR`
                  : periodShort
            }
            value={infraCostLabel}
            icon={<Wallet className="size-4" strokeWidth={1.5} aria-hidden />}
          />
          <AdminStatCard
            label="Action inbox"
            hint="Open · voice AI"
            value={formatInt(openTickets)}
            icon={<Ticket className="size-4" strokeWidth={1.5} aria-hidden />}
          />
          <AdminStatCard
            label="Urgent engineering"
            value={formatInt(urgentEngineeringOpen)}
            tone={urgentEngineeringOpen > 0 ? "urgent" : "default"}
            icon={
              <AlertTriangle
                className="size-4"
                strokeWidth={1.5}
                aria-hidden
              />
            }
          />
          <AdminStatCard
            label="Support inbox"
            value={formatInt(openSupportTickets)}
            href="/admin/support"
            icon={<LifeBuoy className="size-4" strokeWidth={1.5} aria-hidden />}
          />
        </div>

        {voiceCostSchemaMissing ? (
          <p className="mt-4 rounded-lg border border-amber-200/80 bg-amber-50/70 px-3 py-2.5 text-xs text-amber-950">
            Voice cost estimates need the{" "}
            <code className="font-mono">cost_estimate</code> column on{" "}
            <code className="font-mono">call_logs</code>. Other metrics still load
            normally.
          </p>
        ) : (
          <VoiceCostDetails
            callsInRange={callsInRange}
            voiceCostCallsWithEstimate={voiceCostCallsWithEstimate}
            voiceCostBreakdown={voiceCostBreakdown}
            estimatedVoiceCostUsd={estimatedVoiceCostUsd}
          />
        )}
      </section>

      {!loadError && urgentEngineeringTickets.length > 0 ? (
        <section className="mb-8" aria-labelledby="eng-call-queue-heading">
          <div className="mb-4">
            <h2
              id="eng-call-queue-heading"
              className="text-sm font-semibold text-red-900"
            >
              Engineering queue
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-red-900/75">
              Calls that need product or AI configuration fixes — not routine
              callbacks.
            </p>
          </div>
          <ul className="space-y-3">
            {urgentEngineeringTickets.map((t) => {
              const org = embeddedOrgName(t.organizations);
              return (
                <li
                  key={t.id}
                  className="rounded-xl border border-red-200 bg-red-50/60 p-4 sm:p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">
                          Urgent
                        </span>
                        {org ? (
                          <Link
                            href={`/admin/organizations/${t.organization_id}`}
                            className="inline-flex items-center gap-1 text-sm font-semibold text-red-950 hover:underline"
                          >
                            {org.name}
                            <ExternalLink className="size-3.5 opacity-70" aria-hidden />
                          </Link>
                        ) : (
                          <span className="text-sm font-medium text-red-950">
                            Unknown tenant
                          </span>
                        )}
                        <span className="font-mono text-xs text-red-900/70">
                          {t.caller_number}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap text-red-950">
                        {t.summary}
                      </p>
                      <p className="text-xs text-red-800/60">
                        {formatDate(t.created_at)}
                      </p>
                    </div>
                    {org ? (
                      <Link
                        href={`/admin/organizations/${t.organization_id}`}
                        className="inline-flex shrink-0 items-center justify-center rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-900 hover:bg-red-100/70"
                      >
                        Configure tenant
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="mb-8" aria-labelledby="tenants-heading">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2
              id="tenants-heading"
              className="text-sm font-semibold text-[#0b1220]"
            >
              Tenants
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {organizations.length === 0
                ? "No organizations provisioned yet."
                : `${formatInt(organizations.length)} organization${organizations.length === 1 ? "" : "s"}.`}
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_0_rgba(15,23,42,0.04)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="px-4 py-3 text-xs font-medium text-slate-500">
                    Name
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-500">
                    Slug
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-500">
                    Tier
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-500">
                    Niche
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-500">
                    Created
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {organizations.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-sm text-slate-500"
                    >
                      No tenants yet.
                    </td>
                  </tr>
                ) : (
                  organizations.map((org) => (
                    <tr
                      key={org.id}
                      className="transition-colors hover:bg-slate-50/70"
                    >
                      <td className="px-4 py-3.5 text-sm font-medium whitespace-nowrap text-[#0b1220]">
                        <Link
                          href={`/admin/organizations/${org.id}`}
                          className="hover:underline"
                        >
                          {org.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs whitespace-nowrap text-slate-500">
                        {org.slug}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 capitalize">
                          {org.tier}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-sm whitespace-nowrap text-slate-700">
                        {
                          ORGANIZATION_NICHE_ADMIN_LABELS[
                            parseOrganizationNiche(org.niche)
                          ]
                        }
                      </td>
                      <td className="px-4 py-3.5 text-sm whitespace-nowrap text-slate-500">
                        {formatDate(org.created_at)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/admin/organizations/${org.id}`}
                            className="inline-flex items-center rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-[#0b1220]"
                          >
                            Configure
                          </Link>
                          <TenantRowActions
                            organizationId={org.id}
                            organizationName={org.name}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <AdminDiagnosticsPanel />
    </div>
  );
}
