"use client";

import type { ReactNode } from "react";

import {
  DASHBOARD_HINT_CLASS,
  DASHBOARD_SECTION_TITLE_CLASS,
} from "@/components/dashboard/dashboard-surface";
import { useLegalPathVariant } from "@/components/legal/legal-path-context";
import { cn } from "@/lib/utils";
import { LEGAL_LAST_UPDATED } from "@/lib/legal-pages";

/** ISO date for `<time dateTime>` from LEGAL_LAST_UPDATED (e.g. "12 June 2026" → "2026-06-12"). */
function legalLastUpdatedIso(): string {
  const parsed = new Date(LEGAL_LAST_UPDATED);
  if (Number.isNaN(parsed.getTime())) return "2026-06-12";
  return parsed.toISOString().slice(0, 10);
}

export { LEGAL_LAST_UPDATED };

type LegalPageHeaderProps = {
  title: string;
  description?: string;
  lastUpdated?: string;
};

export function LegalPageHeader({
  title,
  description,
  lastUpdated = LEGAL_LAST_UPDATED,
}: LegalPageHeaderProps) {
  const variant = useLegalPathVariant();
  const isDashboard = variant === "dashboard";

  if (isDashboard) {
    return (
      <header className="space-y-2 border-b border-slate-100 pb-5">
        <h2 className={DASHBOARD_SECTION_TITLE_CLASS}>{title}</h2>
        {description ? (
          <p className={cn("max-w-2xl", DASHBOARD_HINT_CLASS)}>{description}</p>
        ) : null}
        <p className="text-[12px] text-slate-500">
          Last updated{" "}
          <time dateTime={legalLastUpdatedIso()} className="font-medium text-slate-600">
            {lastUpdated}
          </time>
        </p>
      </header>
    );
  }

  return (
    <header className="space-y-2 border-b border-slate-100 pb-6">
      <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-400">
        Legal document
      </p>
      <h1 className="text-[1.375rem] font-semibold tracking-tight text-[#0b1220] sm:text-[1.5rem]">
        {title}
      </h1>
      {description ? (
        <p className="text-[14px] leading-relaxed text-slate-600">
          {description}
        </p>
      ) : null}
      <p className="text-[12px] text-slate-500">
        Last updated{" "}
        <time dateTime={legalLastUpdatedIso()} className="font-medium text-slate-600">
          {lastUpdated}
        </time>
      </p>
    </header>
  );
}

type LegalSectionProps = {
  id?: string;
  title: string;
  children: ReactNode;
};

export function LegalSection({ id, title, children }: LegalSectionProps) {
  return (
    <section id={id} className="scroll-mt-24 space-y-2.5">
      <h2 className="text-[15px] font-semibold tracking-tight text-[#0b1220]">
        {title}
      </h2>
      <div className="space-y-2.5 text-slate-700 [&_p]:leading-relaxed">
        {children}
      </div>
    </section>
  );
}

type LegalTableProps = {
  headers: string[];
  rows: ReactNode[][];
};

export function LegalTable({ headers, rows }: LegalTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[32rem] border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/90">
            {headers.map((h) => (
              <th
                key={h}
                scope="col"
                className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr
              key={i}
              className="border-b border-slate-100 last:border-0 even:bg-slate-50/40"
            >
              {cells.map((cell, j) => (
                <td
                  key={j}
                  className="px-4 py-2.5 align-top text-slate-700 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LegalList({
  children,
  ordered,
}: {
  children: ReactNode;
  ordered?: boolean;
}) {
  if (ordered) {
    return (
      <ol className="list-decimal space-y-1.5 pl-5 marker:text-slate-500">
        {children}
      </ol>
    );
  }
  return (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-slate-400">{children}</ul>
  );
}

export function LegalCallout({
  children,
  variant = "neutral",
}: {
  children: ReactNode;
  variant?: "neutral" | "info";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3.5 py-3 text-[13px] leading-relaxed",
        variant === "info"
          ? "border-slate-200 bg-slate-50 text-slate-800"
          : "border-slate-200 bg-slate-50/80 text-slate-700",
      )}
    >
      {children}
    </div>
  );
}

export function LegalDocumentBody({ children }: { children: ReactNode }) {
  const variant = useLegalPathVariant();
  return (
    <div
      className={cn(
        "space-y-8",
        variant === "public" && "max-w-none text-[14px] leading-relaxed",
      )}
    >
      {children}
    </div>
  );
}
