"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Bot, MessageSquare, PhoneCall } from "lucide-react";

import { DASHBOARD_HINT_CLASS } from "@/components/dashboard/dashboard-surface";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { cn } from "@/lib/utils";

import type { RoutingSetupContext } from "./routing-setup-context";

type Props = {
  setup: RoutingSetupContext;
};

export function RoutingCaraBaselinePanel({ setup }: Props) {
  const collectItems = setup.detailsToCollect;

  return (
    <aside className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-5 sm:p-6">
      <p className="text-[11px] font-medium uppercase tracking-[0.09em] text-slate-500">
        From Cara Setup
      </p>
      <h2 className="mt-1.5 text-[16px] font-semibold tracking-tight text-[#0b1220]">
        How every call starts
      </h2>
      <p className={cn(DASHBOARD_HINT_CLASS, "mt-1")}>
        Read-only here — edit in Setup.
      </p>

      <div className="mt-6 space-y-6">
        <BaselineBlock
          icon={PhoneCall}
          title="Greeting"
          href={`${DASHBOARD_ROUTES.caraSetup}/general`}
        >
          <p className="text-[13px] leading-relaxed text-slate-700">
            {setup.greetingPreview || "Add your greeting in Cara Setup."}
          </p>
        </BaselineBlock>

        <BaselineBlock icon={Bot} title="Answers questions" href={DASHBOARD_ROUTES.caraSetup}>
          <p className="text-[13px] leading-relaxed text-slate-600">
            Hours, location, services, areas, common questions, and files — Cara
            answers from Setup, not from routes below.
          </p>
        </BaselineBlock>

        <BaselineBlock
          icon={MessageSquare}
          title="Message payload"
          href={`${DASHBOARD_ROUTES.caraSetup}/call-handling`}
        >
          <p className="mb-2.5 text-[12px] text-slate-500">
            When she takes a message, she collects:
          </p>
          <div className="flex flex-wrap gap-2">
            <CollectChip label="Name" fixed />
            <CollectChip label="Phone number" fixed />
            {collectItems.map((item) => (
              <CollectChip key={item} label={item} />
            ))}
          </div>
        </BaselineBlock>

        <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-3.5">
          <p className="text-[13px] leading-relaxed text-slate-600">
            <span className="font-medium text-[#0b1220]">
              &ldquo;Can I speak to a person?&rdquo;
            </span>{" "}
            {setup.transferAllowed ? (
              <>
                Cara offers transfer to{" "}
                <span className="font-medium text-[#0b1220]">
                  {setup.transferNumber}
                </span>
                , or takes a message if that fails.
              </>
            ) : (
              <>
                Cara takes a message. Add a transfer number in{" "}
                <Link
                  href={DASHBOARD_ROUTES.settings}
                  className="font-medium text-[#0b1220] underline underline-offset-2"
                >
                  Settings
                </Link>{" "}
                to enable live transfer.
              </>
            )}
          </p>
        </div>
      </div>
    </aside>
  );
}

function BaselineBlock({
  icon: Icon,
  title,
  href,
  children,
}: {
  icon: typeof PhoneCall;
  title: string;
  href: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2 border-b border-slate-200/70 pb-6 last:border-b-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm ring-1 ring-slate-200/80">
            <Icon className="size-4" aria-hidden />
          </span>
          <h3 className="text-[14px] font-semibold text-[#0b1220]">{title}</h3>
        </div>
        <Link
          href={href}
          className="shrink-0 pt-0.5 text-[12px] font-medium text-slate-600 underline-offset-2 hover:text-[#0b1220] hover:underline"
        >
          Edit in Setup
        </Link>
      </div>
      {children}
    </div>
  );
}

function CollectChip({ label, fixed }: { label: string; fixed?: boolean }) {
  return (
    <span
      className={
        fixed
          ? "inline-flex rounded-lg bg-slate-200/70 px-2.5 py-1 text-[12px] font-medium text-slate-700"
          : "inline-flex rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[12px] text-slate-700"
      }
    >
      {label}
    </span>
  );
}
