import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import { BookingNetworkLanding } from "@/components/booking-network-landing";
import {
  hostMatchesConfiguredBookingHost,
  resolveAppSiteOrigin,
} from "@/lib/booking-site-origin";
import { cn } from "@/lib/utils";

const linkButton =
  "inline-flex h-8 shrink-0 items-center justify-center rounded-lg px-2.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (hostMatchesConfiguredBookingHost(host)) {
    return {
      title: "Cliste — Book",
      description:
        "Online booking for salons, barbershops, and local businesses.",
    };
  }
  return {
    title: "Cliste Systems",
    description: "AI voice receptionist control plane for Irish salons",
  };
}

function AppHome() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="max-w-lg space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Cliste Systems
        </h1>
        <p className="text-muted-foreground text-sm">
          Control plane scaffold: salon dashboard, agency admin, and public
          booking routes are wired. Next steps: Supabase auth and data layer.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/dashboard"
          className={cn(
            linkButton,
            "bg-primary text-primary-foreground hover:bg-primary/80",
          )}
        >
          Open dashboard
        </Link>
        <Link
          href="/admin"
          className={cn(
            linkButton,
            "border-border bg-background hover:bg-muted hover:text-foreground border dark:border-input dark:hover:bg-input/30 dark:hover:bg-input/50",
          )}
        >
          Agency admin
        </Link>
        <Link
          href="/demo-salon"
          className={cn(
            linkButton,
            "hover:bg-muted hover:text-foreground dark:hover:bg-muted/50",
          )}
        >
          Sample public page
        </Link>
      </div>
    </div>
  );
}

export default async function Home() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (hostMatchesConfiguredBookingHost(host)) {
    const appOrigin = resolveAppSiteOrigin()?.origin ?? null;
    return <BookingNetworkLanding appOrigin={appOrigin} />;
  }
  return <AppHome />;
}
