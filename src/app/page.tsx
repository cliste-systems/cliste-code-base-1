import { headers } from "next/headers";
import Link from "next/link";

import {
  hostMatchesConfiguredBookingHost,
  resolveBookingSiteOrigin,
} from "@/lib/booking-site-origin";
import { cn } from "@/lib/utils";

const linkButton =
  "inline-flex h-8 shrink-0 items-center justify-center rounded-lg px-2.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

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

function BookingHostHome() {
  const origin = resolveBookingSiteOrigin()?.origin ?? "";
  const example = origin ? `${origin}/your-salon` : "/your-salon";

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="max-w-md space-y-3 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Book with your salon
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Open the booking link your salon sent you (text, email, or social).
          It looks like the example below — replace the last part with your
          salon&apos;s name.
        </p>
        <p className="text-foreground rounded-lg border bg-muted/40 px-3 py-2 font-mono text-xs break-all">
          {example}
        </p>
      </div>
    </div>
  );
}

export default async function Home() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (hostMatchesConfiguredBookingHost(host)) return <BookingHostHome />;
  return <AppHome />;
}
