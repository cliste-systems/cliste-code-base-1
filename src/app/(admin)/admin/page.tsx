import Link from "next/link";
import { Suspense } from "react";
import {
  AlertTriangle,
  Building2,
  LayoutGrid,
  LifeBuoy,
  Phone,
  Ticket,
} from "lucide-react";

import {
  DashboardStatStrip,
  type DashboardStatStripItem,
} from "@/components/dashboard/dashboard-stat-strip";
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
import { createAdminClient } from "@/utils/supabase/admin";

import { AdminDiagnosticsPanel } from "./admin-diagnostics-panel";
import { AdminMetricRangeToggle } from "./admin-metric-range-toggle";
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
} {
  let totalUsd = 0;
  let callsWithEstimate = 0;
  for (const row of rows ?? []) {
    const ce = row.cost_estimate;
    if (!ce || typeof ce !== "object") continue;
    const t = ce.totalUsd;
    if (typeof t !== "number" || !Number.isFinite(t)) continue;
    totalUsd += t;
    callsWithEstimate += 1;
  }
  return { totalUsd, callsWithEstimate };
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
    }
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Failed to load admin data.";
  }

  const metricStats: DashboardStatStripItem[] = [
    {
      label: "Organizations",
      value: formatInt(orgCount),
      icon: Building2,
    },
    {
      label: `Calls · ${periodShort.toLowerCase()}`,
      value: formatInt(callsInRange),
      icon: Phone,
    },
    {
      label: "Open inbox",
      value: formatInt(openTickets),
      icon: Ticket,
    },
    {
      label: "Urgent",
      value: formatInt(urgentEngineeringOpen),
      icon: AlertTriangle,
    },
    {
      label: "Support",
      value: formatInt(openSupportTickets),
      href: "/admin/support",
      icon: LifeBuoy,
    },
  ];

  const infraCostLabel =
    voiceCostSchemaMissing
      ? null
      : voiceCostCallsWithEstimate > 0
        ? formatApproxEurFromUsd(estimatedVoiceCostUsd)
        : null;

  return (
    <div className="mx-auto max-w-[1080px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600">
            <LayoutGrid className="size-5" strokeWidth={1.5} aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[#0b1220] sm:text-2xl">
              Overview
            </h1>
            <p className="text-sm text-slate-500">
              Platform activity and tenants
            </p>
          </div>
        </div>
        {process.env.ADMIN_ALLOW_MANUAL_CREATE === "1" ? (
          <NewClientDialog />
        ) : null}
      </header>

      {loadError ? (
        <div
          className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3"
          role="alert"
        >
          <p className="text-sm font-medium text-red-800">{loadError}</p>
        </div>
      ) : null}

      <section
        className="mb-6 overflow-hidden rounded-xl border border-slate-200/80 bg-white"
        aria-labelledby="global-metrics-heading"
      >
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <h2
            id="global-metrics-heading"
            className="text-sm font-semibold text-[#0b1220]"
          >
            Global metrics
          </h2>
          <Suspense
            fallback={
              <div className="h-8 w-[200px] animate-pulse rounded-full bg-slate-100" />
            }
          >
            <AdminMetricRangeToggle />
          </Suspense>
        </div>
        <div className="px-2 py-3 sm:px-3 sm:py-4">
          <DashboardStatStrip stats={metricStats} compact />
        </div>
      </section>

      {!loadError && urgentEngineeringTickets.length > 0 ? (
        <section className="mb-6" aria-labelledby="eng-call-queue-heading">
          <h2
            id="eng-call-queue-heading"
            className="mb-3 text-sm font-semibold text-red-900"
          >
            Engineering queue
          </h2>
          <ul className="space-y-2">
            {urgentEngineeringTickets.map((t) => {
              const org = embeddedOrgName(t.organizations);
              return (
                <li
                  key={t.id}
                  className="rounded-lg border border-red-200 bg-red-50/70 px-4 py-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        {org ? (
                          <Link
                            href={`/admin/organizations/${t.organization_id}`}
                            className="font-semibold text-red-950 hover:underline"
                          >
                            {org.name}
                          </Link>
                        ) : (
                          <span className="font-medium text-red-950">
                            Unknown tenant
                          </span>
                        )}
                        <span className="text-xs text-red-800/70">
                          {t.caller_number}
                        </span>
                      </div>
                      <p className="text-sm text-red-950">{t.summary}</p>
                      <p className="text-xs text-red-800/60">
                        {formatDate(t.created_at)}
                      </p>
                    </div>
                    {org ? (
                      <Link
                        href={`/admin/organizations/${t.organization_id}`}
                        className="shrink-0 text-xs font-medium text-red-900 hover:underline"
                      >
                        Manage
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="mb-6" aria-labelledby="tenants-heading">
        <h2
          id="tenants-heading"
          className="mb-3 text-sm font-semibold text-[#0b1220]"
        >
          Tenants
          <span className="ml-2 font-normal text-slate-500">
            ({formatInt(organizations.length)})
          </span>
        </h2>

        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white">
          {organizations.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">
              No tenants yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {organizations.map((org) => (
                <li
                  key={org.id}
                  className="flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5"
                >
                  <Link
                    href={`/admin/organizations/${org.id}`}
                    className="min-w-0 flex-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40"
                  >
                    <p className="truncate text-sm font-medium text-[#0b1220] hover:underline">
                      {org.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {
                        ORGANIZATION_NICHE_ADMIN_LABELS[
                          parseOrganizationNiche(org.niche)
                        ]
                      }
                      {" · "}
                      <span className="capitalize">{org.tier}</span>
                      {" · "}
                      {org.slug}
                    </p>
                  </Link>
                  <p className="hidden shrink-0 text-xs text-slate-400 sm:block">
                    {formatDateShort(org.created_at)}
                  </p>
                  <TenantRowActions
                    organizationId={org.id}
                    organizationName={org.name}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <AdminDiagnosticsPanel
        bookingValue={formatBookingValueEur(bookingValueEur)}
        infraCost={infraCostLabel}
        periodLabel={periodShort}
        voiceCostSchemaMissing={voiceCostSchemaMissing}
      />
    </div>
  );
}
