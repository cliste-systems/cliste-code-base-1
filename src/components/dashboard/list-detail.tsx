import type { ComponentPropsWithoutRef, ReactNode } from "react";
import Link from "next/link";

import {
  DASHBOARD_CARD_SURFACE,
  DASHBOARD_HOME_CARD,
} from "@/components/dashboard/dashboard-surface";
import { cn } from "@/lib/utils";

/**
 * Shared master/detail layout used by Calls, Action Inbox and Contacts.
 * List on the left, detail panel on the right; stacks on small screens with a
 * capped list height so the detail pane stays usable on phones.
 */
export function ListDetailLayout({
  list,
  detail,
  className,
}: {
  list: ReactNode;
  detail: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden max-lg:grid-rows-[minmax(0,42vh)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,420px)] lg:grid-rows-[minmax(0,1fr)] lg:gap-4",
        className,
      )}
    >
      {list}
      <div className="flex h-full min-h-0 flex-col overflow-hidden">{detail}</div>
    </div>
  );
}

/** Surfaced card column for the detail pane. */
export function DetailPanelShell({
  children,
  surface = "default",
}: {
  children: ReactNode;
  /** `home` — same card chrome as `/dashboard` panels. */
  /** `embedded` — inside a split pane; no outer border or shadow. */
  surface?: "default" | "home" | "embedded";
}) {
  return (
    <section
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden",
        surface === "embedded" && "bg-[#fbfcfb]",
        surface === "home" && DASHBOARD_HOME_CARD,
        surface === "default" && DASHBOARD_CARD_SURFACE,
      )}
    >
      {children}
    </section>
  );
}

export function DetailPanelHeader({
  eyebrow,
  title,
  subtitle,
  meta,
  badges,
}: {
  eyebrow: string;
  title: string;
  subtitle?: ReactNode;
  meta?: ReactNode;
  badges?: ReactNode;
}) {
  return (
    <div className="shrink-0 border-b border-[#dfe7e2] bg-[#f6faf7] px-5 py-5">
      <p className="text-[11px] font-semibold tracking-[0.12em] text-[#6b7c75] uppercase">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-[20px] font-semibold tracking-tight text-[#11181d]">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-1 text-[13px] text-[#5b6b65]">{subtitle}</p>
      ) : null}
      {meta ? <p className="mt-1 text-[12px] text-[#6b7c75]">{meta}</p> : null}
      {badges ? <div className="mt-4 flex flex-wrap gap-2">{badges}</div> : null}
    </div>
  );
}

export function DetailPanelBody({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
} & ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-y-contain bg-[#fbfcfb] px-5 py-5",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function DetailPanelFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-wrap gap-2 border-t border-[#dfe7e2] bg-[#f6faf7] px-5 py-4">
      {children}
    </div>
  );
}

export function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold tracking-[0.1em] text-[#6b7c75] uppercase">
        {title}
      </h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}

/** Inset surface used inside detail sections (follow-ups, transcripts). */
export function DetailInset({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-[#d9e2dd] bg-white p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DetailActionButton({
  children,
  onClick,
  href,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  /** Use "submit" inside a <form action={...}>. */
  type?: "button" | "submit";
}) {
  const className = cn(
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#b9c8c1] bg-[#fbfcfb] px-3 text-[13px] font-medium text-[#35443f] transition-colors hover:bg-white",
    disabled && "pointer-events-none opacity-40",
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  );
}
