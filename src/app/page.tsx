import type { Metadata } from "next";
import { PRODUCT_NAME } from "@/lib/company-details";
import { TEST_LINE_E164 } from "@/lib/call-testing-types";
import Link from "next/link";
import { Phone } from "lucide-react";

import { cn } from "@/lib/utils";

const linkButton =
  "inline-flex h-8 shrink-0 items-center justify-center rounded-lg px-2.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: "AI voice agent that answers every call for your business.",
};

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="max-w-lg space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">{PRODUCT_NAME}</h1>
        <p className="text-muted-foreground text-sm">
          AI voice agent for your business. Sign in to manage calls, your Action
          Inbox, routing, and agent setup.
        </p>
      </div>

      <section className="border-border bg-muted/40 max-w-md rounded-xl border px-5 py-4 text-center">
        <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
          Try Cara live
        </p>
        <a
          href={`tel:${TEST_LINE_E164}`}
          className="text-foreground inline-flex items-center justify-center gap-2 text-lg font-semibold tracking-tight hover:underline"
        >
          <Phone className="size-4 shrink-0" aria-hidden />
          +353 74 938 9378
        </a>
        <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
          Ring the demo line to hear Cara in action. Calls may be recorded and
          transcribed. You&apos;ll speak to Cara, our AI assistant — not a human.
        </p>
      </section>
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
      </div>
      <footer className="mt-4 max-w-lg text-center text-xs text-muted-foreground">
        <p>
          <Link href="/legal/terms" className="underline-offset-2 hover:underline">
            Terms
          </Link>
          {" · "}
          <Link href="/legal/privacy" className="underline-offset-2 hover:underline">
            Privacy
          </Link>
          {" · "}
          <Link href="/legal/dpa" className="underline-offset-2 hover:underline">
            DPA
          </Link>
          {" · "}
          <Link
            href="/legal/sub-processors"
            className="underline-offset-2 hover:underline"
          >
            Sub-processors
          </Link>
          {" · "}
          <Link href="/legal/cookies" className="underline-offset-2 hover:underline">
            Cookies
          </Link>
        </p>
      </footer>
    </div>
  );
}
