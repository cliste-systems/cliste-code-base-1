import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";

import { getClientAccountSession } from "@/lib/client-account-session";
import { resolveOrganizationDisplayName } from "@/lib/organization-display-name";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

import { SignOutButton } from "./sign-out-button";

export const metadata: Metadata = {
  title: "Your Cliste account",
  description: "Past bookings, rebook, and saved salons.",
};

const SALON_TZ = "Europe/Dublin";

type AppointmentRow = {
  id: string;
  organization_id: string;
  service_id: string;
  start_time: string;
  end_time: string;
  status: string;
  customer_name: string;
  booking_reference: string | null;
};

type OrgLookup = Record<
  string,
  { slug: string; name: string; logo_url: string | null; address: string | null }
>;

type ServiceLookup = Record<string, { name: string; price: number }>;

function formatEur(price: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: Number.isInteger(price) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(price);
}

export default async function ClientAccountPage() {
  const session = await getClientAccountSession();
  if (!session) {
    redirect("/account/sign-in?next=%2Faccount");
  }

  const email = session.user.email?.trim().toLowerCase() ?? "";
  const supabase = await createClient();

  const { data: favRows } = await supabase
    .from("client_favorite_salons")
    .select("organization_id, created_at")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false });

  let appointments: AppointmentRow[] = [];
  let orgLookup: OrgLookup = {};
  let serviceLookup: ServiceLookup = {};

  if (email) {
    // Use the admin client: appointments table isn't readable anonymously,
    // and there's no auth.uid() link on the row. We scope strictly by the
    // verified session email so this cannot leak other users' data.
    try {
      const admin = createAdminClient();
      const { data: apptRows } = await admin
        .from("appointments")
        .select(
          "id, organization_id, service_id, start_time, end_time, status, customer_name, booking_reference",
        )
        .eq("customer_email", email)
        .order("start_time", { ascending: false })
        .limit(25);

      appointments = (apptRows ?? []) as AppointmentRow[];

      const orgIds = new Set<string>();
      const serviceIds = new Set<string>();
      for (const a of appointments) {
        if (a.organization_id) orgIds.add(a.organization_id);
        if (a.service_id) serviceIds.add(a.service_id);
      }
      for (const row of favRows ?? []) {
        if (row.organization_id) orgIds.add(row.organization_id);
      }

      if (orgIds.size > 0) {
        const { data: orgs } = await admin
          .from("organizations")
          .select("id, slug, name, logo_url, address")
          .in("id", [...orgIds]);
        for (const o of orgs ?? []) {
          orgLookup[o.id] = {
            slug: o.slug,
            name: resolveOrganizationDisplayName(o.name, o.slug) || "Salon",
            logo_url: o.logo_url ?? null,
            address: o.address ?? null,
          };
        }
      }

      if (serviceIds.size > 0) {
        const { data: services } = await admin
          .from("services")
          .select("id, name, price")
          .in("id", [...serviceIds]);
        for (const s of services ?? []) {
          serviceLookup[s.id] = {
            name: s.name?.trim() || "Service",
            price: Number(s.price) || 0,
          };
        }
      }
    } catch {
      appointments = [];
      orgLookup = {};
      serviceLookup = {};
    }
  }

  const now = Date.now();
  const upcoming = appointments.filter(
    (a) =>
      new Date(a.start_time).getTime() >= now &&
      a.status !== "cancelled" &&
      a.status !== "no_show",
  );
  const history = appointments.filter(
    (a) =>
      !(
        new Date(a.start_time).getTime() >= now &&
        a.status !== "cancelled" &&
        a.status !== "no_show"
      ),
  );

  const favoriteOrgs = (favRows ?? [])
    .map((row) => {
      const org = orgLookup[row.organization_id];
      if (!org) return null;
      return { organization_id: row.organization_id, ...org };
    })
    .filter(
      (o): o is {
        organization_id: string;
        slug: string;
        name: string;
        logo_url: string | null;
        address: string | null;
      } => o !== null,
    );

  return (
    <div className="min-h-[100dvh] bg-[#f7f9fb] pb-20">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="text-xs tracking-widest text-zinc-500 uppercase transition-colors hover:text-emerald-600"
          >
            ← Cliste
          </Link>
          <SignOutButton />
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-10 sm:px-6">
        <section>
          <h1 className="text-3xl font-light tracking-tight text-black sm:text-4xl">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Signed in as{" "}
            <span className="font-medium text-zinc-800">{email || "—"}</span>
          </p>
        </section>

        <section>
          <h2 className="mb-4 text-sm font-medium tracking-widest text-zinc-500 uppercase">
            Upcoming bookings
          </h2>
          {upcoming.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 shadow-[0_4px_16px_-6px_rgba(0,0,0,0.04)]">
              No upcoming bookings. Browse{" "}
              <Link
                href="/"
                className="font-medium text-emerald-700 underline-offset-4 hover:underline"
              >
                salons on Cliste
              </Link>{" "}
              to book one.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {upcoming.map((a) => {
                const org = orgLookup[a.organization_id];
                const svc = serviceLookup[a.service_id];
                return (
                  <BookingCard
                    key={a.id}
                    appointment={a}
                    org={org}
                    service={svc}
                    mode="upcoming"
                  />
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-sm font-medium tracking-widest text-zinc-500 uppercase">
            Past bookings
          </h2>
          {history.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 shadow-[0_4px_16px_-6px_rgba(0,0,0,0.04)]">
              You haven&apos;t booked on Cliste yet — when you do, bookings
              will show up here so you can rebook in one tap.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {history.slice(0, 10).map((a) => {
                const org = orgLookup[a.organization_id];
                const svc = serviceLookup[a.service_id];
                return (
                  <BookingCard
                    key={a.id}
                    appointment={a}
                    org={org}
                    service={svc}
                    mode="past"
                  />
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-sm font-medium tracking-widest text-zinc-500 uppercase">
            Saved salons
          </h2>
          {favoriteOrgs.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 shadow-[0_4px_16px_-6px_rgba(0,0,0,0.04)]">
              Tap the heart on a salon&apos;s page to save it here.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {favoriteOrgs.map((o) => (
                <Link
                  key={o.organization_id}
                  href={`/${o.slug}`}
                  className="group flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_4px_16px_-6px_rgba(0,0,0,0.04)] transition-all hover:border-emerald-400 hover:shadow-[0_10px_24px_-10px_rgba(16,185,129,0.25)]"
                >
                  <SalonAvatar name={o.name} logoUrl={o.logo_url} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-black">
                      {o.name}
                    </p>
                    {o.address ? (
                      <p className="truncate text-xs text-zinc-500">
                        {o.address}
                      </p>
                    ) : null}
                  </div>
                  <span className="text-xs font-medium tracking-wide text-emerald-700 transition-transform group-hover:translate-x-0.5">
                    Book →
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function BookingCard({
  appointment,
  org,
  service,
  mode,
}: {
  appointment: AppointmentRow;
  org: OrgLookup[string] | undefined;
  service: ServiceLookup[string] | undefined;
  mode: "upcoming" | "past";
}) {
  const when = new Date(appointment.start_time);
  const dateLabel = formatInTimeZone(when, SALON_TZ, "EEE d MMM yyyy");
  const timeLabel = formatInTimeZone(when, SALON_TZ, "HH:mm");
  const status = appointment.status;

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_4px_16px_-6px_rgba(0,0,0,0.04)] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <SalonAvatar name={org?.name ?? "Salon"} logoUrl={org?.logo_url ?? null} />
        <div className="min-w-0">
          <p className="truncate text-base font-medium text-black">
            {service?.name ?? "Service"}{" "}
            {service?.price ? (
              <span className="text-sm font-normal text-zinc-500">
                · {formatEur(service.price)}
              </span>
            ) : null}
          </p>
          <p className="truncate text-sm text-zinc-500">
            {org?.name ?? "Salon"} · {dateLabel} at {timeLabel}
          </p>
          {appointment.booking_reference ? (
            <p className="mt-1 text-[11px] tracking-wider text-zinc-400 uppercase">
              Ref {appointment.booking_reference}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <StatusChip status={status} />
        {org?.slug ? (
          <Link
            href={`/${org.slug}`}
            className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-600"
          >
            {mode === "upcoming" ? "View" : "Book again"}
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function StatusChip({ status }: { status: string }) {
  const normalized = (status || "").toLowerCase();
  const styles =
    normalized === "cancelled"
      ? "bg-red-50 text-red-700 border-red-200"
      : normalized === "no_show"
        ? "bg-amber-50 text-amber-800 border-amber-200"
        : normalized === "completed"
          ? "bg-zinc-100 text-zinc-700 border-zinc-200"
          : "bg-emerald-50 text-emerald-800 border-emerald-200";
  const label =
    normalized === "no_show"
      ? "No-show"
      : normalized
        ? normalized.charAt(0).toUpperCase() + normalized.slice(1)
        : "Booked";
  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide ${styles}`}
    >
      {label}
    </span>
  );
}

function SalonAvatar({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl: string | null;
}) {
  const initials = (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  if (logoUrl && /^(https?:|data:image\/)/i.test(logoUrl)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        className="h-11 w-11 shrink-0 rounded-lg object-cover"
      />
    );
  }
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-sm font-medium text-white">
      {initials || "?"}
    </div>
  );
}
