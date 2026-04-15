import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import {
  AlertTriangle,
  Building2,
  Euro,
  ExternalLink,
  Eye,
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

import { AdminMetricRangeToggle } from "./admin-metric-range-toggle";
import { NewSalonDialog } from "./new-salon-dialog";
import { TenantRowActions } from "./tenant-row-actions";

export const dynamic = "force-dynamic";

function formatInt(n: number): string {
  return new Intl.NumberFormat("en-IE").format(n);
}

/** Worker stores heuristic costs in USD; admin shows ≈ EUR using this multiplier (tune to FX). */
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

function AdminMetricCard({
  title,
  icon,
  value,
  subtitle,
  secondaryAction,
  className,
  titleClassName,
  valueClassName,
  topRowClassName,
}: {
  title: string;
  icon: ReactNode;
  value: ReactNode;
  subtitle?: string | null;
  secondaryAction?: ReactNode;
  className?: string;
  titleClassName?: string;
  valueClassName?: string;
  topRowClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-start justify-between gap-3",
          topRowClassName ?? "text-gray-500",
        )}
      >
        <span
          className={cn(
            "min-w-0 text-xs font-medium tracking-wider uppercase",
            titleClassName,
          )}
        >
          {title}
        </span>
        <div className="mt-0.5 shrink-0 text-gray-400 [&_svg]:size-4 [&_svg]:shrink-0">
          {icon}
        </div>
      </div>
      <div className="mt-2 flex h-5 shrink-0 items-center justify-between gap-2">
        {subtitle ? (
          <p className="min-w-0 flex-1 truncate text-[11px] font-medium tracking-wide text-gray-400 uppercase">
            {subtitle}
          </p>
        ) : (
          <span className="min-w-0 flex-1" aria-hidden />
        )}
        {secondaryAction ? (
          <div className="shrink-0">{secondaryAction}</div>
        ) : null}
      </div>
      <div
        className={cn(
          "mt-auto pt-4 text-3xl font-medium tracking-tight text-gray-900 tabular-nums",
          valueClassName,
        )}
      >
        {value}
      </div>
    </div>
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
  /** DB column missing — do not fail the rest of the dashboard. */
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
    openSupportTickets = supportRes.error
      ? 0
      : (supportRes.count ?? 0);
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
      /* Other errors: leave estimates at zero; avoid breaking admin. */
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

  return (
    <div className="mx-auto max-w-[1280px] p-6 pb-24 sm:p-10 lg:p-12">
      <header className="mb-12 flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
        <div>
          <p className="mb-2 text-xs font-medium tracking-widest text-gray-500 uppercase">
            Platform
          </p>
          <h1 className="text-3xl font-medium tracking-tight text-gray-900">
            Overview
          </h1>
        </div>
        <NewSalonDialog />
      </header>

      {loadError ? (
        <div
          className="mb-8 rounded-xl border border-red-200 bg-red-50/50 p-4 shadow-sm sm:p-5"
          role="alert"
        >
          <p className="text-sm font-medium text-red-800">{loadError}</p>
          <p className="mt-2 text-xs text-red-700/80">
            Check Supabase credentials and that required tables exist. Voice cost metrics load
            separately and will not block other cards once fixed.
          </p>
        </div>
      ) : null}

      <section className="mb-14" aria-labelledby="global-metrics-heading">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2
            id="global-metrics-heading"
            className="px-1 text-sm font-medium text-gray-900"
          >
            Global metrics
          </h2>
          <Suspense
            fallback={
              <div className="h-9 w-[220px] max-w-full animate-pulse rounded-full bg-gray-100" />
            }
          >
            <AdminMetricRangeToggle />
          </Suspense>
        </div>

        <div
          className={cn(
            "mb-5 rounded-xl border px-4 py-3 sm:px-5",
            voiceCostSchemaMissing
              ? "border-amber-200/90 bg-amber-50/60"
              : "border-gray-200 bg-gray-50/80",
          )}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg border",
                  voiceCostSchemaMissing
                    ? "border-amber-200 bg-white text-amber-700"
                    : "border-gray-200 bg-white text-gray-500",
                )}
              >
                <Wallet className="size-4" strokeWidth={1.5} aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Est. voice infrastructure cost
                </p>
                <p className="text-[11px] text-gray-500">
                  {periodShort} · ≈ EUR (USD estimates × {voiceCostUsdToEurRate()}) · LiveKit,
                  STT, LLM, TTS, Twilio
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
              <span className="text-2xl font-medium tracking-tight text-gray-900 tabular-nums sm:text-3xl">
                {voiceCostSchemaMissing
                  ? "—"
                  : voiceCostCallsWithEstimate > 0
                    ? formatApproxEurFromUsd(estimatedVoiceCostUsd)
                    : "—"}
              </span>
            </div>
          </div>
          {voiceCostSchemaMissing ? (
            <p className="mt-3 border-t border-amber-200/80 pt-3 text-sm text-amber-950/90">
              Add the <span className="font-mono text-xs">cost_estimate</span> column to{" "}
              <span className="font-mono text-xs">call_logs</span> (SQL migration in the voice worker
              repo), then redeploy the agent. The rest of this page works without it.
            </p>
          ) : voiceCostCallsWithEstimate > 0 ? (
            <details className="mt-3 border-t border-gray-200/90 pt-3">
              <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-900">
                Cost breakdown ({formatInt(voiceCostCallsWithEstimate)} call
                {voiceCostCallsWithEstimate === 1 ? "" : "s"})
              </summary>
              <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 font-mono text-xs text-gray-600 sm:grid-cols-4">
                <li>LiveKit {formatApproxEurFromUsd(voiceCostBreakdown.livekit)}</li>
                <li>STT {formatApproxEurFromUsd(voiceCostBreakdown.stt)}</li>
                <li>LLM {formatApproxEurFromUsd(voiceCostBreakdown.llmVoice)}</li>
                <li>TTS {formatApproxEurFromUsd(voiceCostBreakdown.tts)}</li>
                <li>Twilio voice {formatApproxEurFromUsd(voiceCostBreakdown.twilioVoice)}</li>
                <li>Twilio SMS {formatApproxEurFromUsd(voiceCostBreakdown.twilioSms)}</li>
                <li>Post-call LLM {formatApproxEurFromUsd(voiceCostBreakdown.postprocessLlm)}</li>
                <li>Supabase {formatApproxEurFromUsd(voiceCostBreakdown.supabase)}</li>
              </ul>
              <p className="mt-2 text-[11px] text-gray-500">
                Stored as USD in <span className="font-mono">call_logs</span>; shown as ≈ EUR here. Set{" "}
                <span className="font-mono">VOICE_COST_USD_TO_EUR</span> (e.g. 0.93) in this app&apos;s env.
                Tune worker <span className="font-mono">CALL_COST_*</span> against vendor invoices.
              </p>
            </details>
          ) : (
            <p className="mt-3 border-t border-gray-200/90 pt-3 text-sm text-gray-600">
              No calls with cost data in this period yet. New calls will populate after the migration
              and worker update.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 sm:items-stretch lg:grid-cols-3 xl:grid-cols-6">
          <AdminMetricCard
            title="Organizations"
            icon={<Building2 strokeWidth={1.5} aria-hidden />}
            value={formatInt(orgCount)}
          />

          <AdminMetricCard
            title="Calls"
            icon={<Phone strokeWidth={1.5} aria-hidden />}
            subtitle={periodShort}
            value={formatInt(callsInRange)}
          />

          <AdminMetricCard
            title="Booking value"
            icon={<Euro strokeWidth={1.5} aria-hidden />}
            subtitle={periodShort}
            value={formatBookingValueEur(bookingValueEur)}
          />

          <AdminMetricCard
            title="Action inbox"
            icon={<Ticket strokeWidth={1.5} aria-hidden />}
            subtitle="Open · voice AI"
            value={formatInt(openTickets)}
          />

          <AdminMetricCard
            className={cn(
              urgentEngineeringOpen > 0
                ? "animate-pulse border-2 border-red-400 bg-red-50/90 ring-2 ring-red-300/70"
                : undefined,
            )}
            title="Urgent"
            icon={
              <AlertTriangle
                className={cn(
                  urgentEngineeringOpen > 0 ? "text-red-600" : undefined,
                )}
                strokeWidth={1.5}
                aria-hidden
              />
            }
            topRowClassName={
              urgentEngineeringOpen > 0 ? "text-red-800/90" : "text-gray-500"
            }
            titleClassName={
              urgentEngineeringOpen > 0 ? "font-semibold" : "font-medium"
            }
            value={formatInt(urgentEngineeringOpen)}
            valueClassName={
              urgentEngineeringOpen > 0
                ? "font-semibold text-red-700"
                : undefined
            }
          />

          <AdminMetricCard
            title="Support inbox"
            icon={<LifeBuoy strokeWidth={1.5} aria-hidden />}
            secondaryAction={
              <Link
                href="/admin/support"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-600 hover:text-gray-900"
              >
                <Eye className="size-3.5 text-gray-500" strokeWidth={1.5} aria-hidden />
                View
              </Link>
            }
            value={formatInt(openSupportTickets)}
          />
        </div>
      </section>

      {!loadError && urgentEngineeringTickets.length > 0 ? (
        <section className="mb-14" aria-labelledby="eng-call-queue-heading">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2
                id="eng-call-queue-heading"
                className="px-1 text-sm font-medium text-red-900"
              >
                Calls — engineering queue
              </h2>
              <p className="mt-1 max-w-3xl px-1 text-sm leading-relaxed text-red-900/80">
                Flagged when the AI could not answer due to missing training data, a tool
                failure, or something that needs a dashboard or product fix. Routine
                handoffs (e.g. caller asked for a named person only) stay out of this list.
                Open the tenant to adjust AI instructions, services, or integrations.
              </p>
            </div>
          </div>
          <ul className="space-y-3">
            {urgentEngineeringTickets.map((t) => {
              const org = embeddedOrgName(t.organizations);
              return (
                <li
                  key={t.id}
                  className="rounded-xl border-2 border-red-300 bg-red-50/80 p-4 shadow-sm sm:p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-md bg-red-600 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-white uppercase">
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
                        <span className="font-mono text-xs text-red-900/80">
                          {t.caller_number}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap text-red-950">
                        {t.summary}
                      </p>
                      <p className="text-xs text-red-800/70">
                        {formatDate(t.created_at)}
                      </p>
                    </div>
                    {org ? (
                      <Link
                        href={`/admin/organizations/${t.organization_id}`}
                        className={cn(
                          "inline-flex shrink-0 items-center justify-center rounded-lg border border-red-400 bg-white px-3 py-2 text-xs font-semibold text-red-900 shadow-sm",
                          "hover:bg-red-100/80",
                        )}
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
      ) : !loadError && urgentEngineeringOpen === 0 ? (
        <section className="mb-10" aria-labelledby="eng-call-queue-empty">
          <h2
            id="eng-call-queue-empty"
            className="sr-only"
          >
            Engineering queue
          </h2>
          <p className="rounded-lg border border-gray-200/80 bg-gray-50/80 px-4 py-3 text-sm text-gray-600">
            Nothing in the urgent queue right now. When a call needs engineering
            attention, it will show above in red.
          </p>
        </section>
      ) : null}

      <section aria-labelledby="tenants-heading">
        <h2
          id="tenants-heading"
          className="mb-6 px-1 text-sm font-medium text-gray-900"
        >
          Tenant management
        </h2>

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead>
              <tr className="border-b border-gray-200 bg-[#fafafa]/50">
                <th className="px-5 py-3 text-xs font-medium text-gray-500">
                  Name
                </th>
                <th className="px-5 py-3 text-xs font-medium text-gray-500">
                  Slug
                </th>
                <th className="px-5 py-3 text-xs font-medium text-gray-500">
                  Tier
                </th>
                <th className="px-5 py-3 text-xs font-medium text-gray-500">
                  Niche
                </th>
                <th className="px-5 py-3 text-xs font-medium text-gray-500">
                  Created
                </th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {organizations.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-12 text-center text-sm text-gray-500"
                  >
                    No organizations yet. Use &quot;New salon&quot; to provision
                    one.
                  </td>
                </tr>
              ) : (
                organizations.map((org) => (
                  <tr
                    key={org.id}
                    className="group transition-colors hover:bg-gray-50/50"
                  >
                    <td className="px-5 py-4 text-sm font-medium whitespace-nowrap text-gray-900">
                      <Link
                        href={`/admin/organizations/${org.id}`}
                        className="hover:underline"
                      >
                        {org.name}
                      </Link>
                    </td>
                    <td className="px-5 py-4 font-mono text-sm whitespace-nowrap text-gray-500">
                      {org.slug}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center rounded-md border border-gray-200/50 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 capitalize">
                        {org.tier}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm whitespace-nowrap text-gray-900">
                      {
                        ORGANIZATION_NICHE_ADMIN_LABELS[
                          parseOrganizationNiche(org.niche)
                        ]
                      }
                    </td>
                    <td className="px-5 py-4 text-sm font-normal whitespace-nowrap text-gray-500">
                      {formatDate(org.created_at)}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/organizations/${org.id}`}
                          className={cn(
                            "inline-flex items-center justify-center rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-colors",
                            "hover:bg-gray-100 focus:ring-2 focus:ring-gray-200 focus:outline-none",
                          )}
                        >
                          Configure AI
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
      </section>
    </div>
  );
}
