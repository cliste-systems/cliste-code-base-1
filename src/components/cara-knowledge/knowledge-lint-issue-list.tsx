"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertCircle, AlertTriangle, ArrowRight } from "lucide-react";

import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { cn } from "@/lib/utils";
import type { KnowledgeLintIssue } from "@/lib/cara-knowledge-lint";

type ParsedIssue = {
  title: string;
  body: string;
  highlights?: string[];
};

function actionLabelForIssue(issue: KnowledgeLintIssue): string {
  if (issue.action === "add_faq") return "Add as FAQ";
  const href = issue.href ?? "";
  if (href.includes(DASHBOARD_ROUTES.routing)) return "Set up Call flow";
  if (href.includes(DASHBOARD_ROUTES.businessServices)) return "Edit services";
  if (href.includes(DASHBOARD_ROUTES.businessFaqs)) return "Review FAQs";
  if (href.includes(DASHBOARD_ROUTES.businessFiles)) return "Review files";
  if (issue.secondaryHref?.includes(DASHBOARD_ROUTES.businessFiles)) {
    return "Review file";
  }
  return "Review";
}

function fieldTitle(field: string): string {
  switch (field) {
    case "servicesOffered":
    case "servicesOfferedRaw":
      return "Services";
    case "servicesNotOffered":
    case "servicesNotOfferedRaw":
      return "Exclusions";
    case "businessRules":
    case "rulesRaw":
      return "Business rules";
    case "faqs":
      return "FAQs";
    case "detailsToCollect":
    case "captureFields":
      return "Details to collect";
    case "openingHours":
      return "Opening hours";
    default:
      return "Needs attention";
  }
}

function parseKnowledgeLintIssue(issue: KnowledgeLintIssue): ParsedIssue {
  const msg = issue.message;

  const nearDup = msg.match(
    /^"(.+)" is very similar to "(.+)" — consider keeping one\.$/,
  );
  if (nearDup) {
    return {
      title: "Similar names in your menu",
      body: "These look like the same service — keep one so Cara stays clear on calls.",
      highlights: [nearDup[1], nearDup[2]],
    };
  }

  const duplicate = msg.match(
    /^Duplicate entry: "(.+)" matches "(.+)" — remove one\.$/,
  );
  if (duplicate) {
    return {
      title: "Duplicate entry",
      body: "Remove one of these — Cara only needs a single version.",
      highlights: [duplicate[1], duplicate[2]],
    };
  }

  const ruleConflict = msg.match(/^"(.+)" — (.+)$/);
  if (ruleConflict) {
    if (issue.action === "add_faq") {
      return {
        title: "Booking policy",
        body: ruleConflict[2],
        highlights: [ruleConflict[1]],
      };
    }
    return {
      title: "Rule needs Call flow setup",
      body: ruleConflict[2],
      highlights: [ruleConflict[1]],
    };
  }

  if (issue.id.startsWith("rule-file-")) {
    const fileConflict = msg.match(
      /^You've told Cara never to quote prices, but "(.+)" is a price list she can read aloud — (.+)$/,
    );
    if (fileConflict) {
      return {
        title: "Price list vs business rule",
        body: fileConflict[2],
        highlights: [fileConflict[1]],
      };
    }
  }

  if (issue.id.startsWith("duplicate-kind-")) {
    return {
      title: "Overlapping documents",
      body: msg,
    };
  }

  if (issue.id.startsWith("faq-file-price-")) {
    return {
      title: "FAQ may not match file prices",
      body: msg,
    };
  }

  if (issue.id.startsWith("catalog-near-dup-")) {
    return {
      title: "Similar service",
      body: msg,
    };
  }

  const dashParts = msg.split(" — ");
  if (dashParts.length >= 2 && dashParts[0].length <= 72) {
    return {
      title: dashParts[0],
      body: dashParts.slice(1).join(" — "),
    };
  }

  return {
    title: fieldTitle(issue.field),
    body: msg,
  };
}

function IssueHighlights({ items }: { items: string[] }) {
  return (
    <ul className="mt-2 space-y-1.5">
      {items.map((item) => (
        <li
          key={item}
          className="rounded-lg border border-slate-200/90 bg-slate-50/90 px-2.5 py-1.5 text-[12px] leading-snug text-slate-800"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

function LintIssueRow({
  issue,
  isBlock,
  pathname,
}: {
  issue: KnowledgeLintIssue;
  isBlock: boolean;
  pathname: string;
}) {
  const parsed = parseKnowledgeLintIssue(issue);
  const Icon = isBlock ? AlertCircle : AlertTriangle;
  const primaryHref =
    issue.href && issue.href !== pathname ? issue.href : undefined;
  const secondaryHref =
    issue.secondaryHref && issue.secondaryHref !== pathname
      ? issue.secondaryHref
      : undefined;

  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          isBlock ? "text-red-600" : "text-slate-500",
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-slate-900">{parsed.title}</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600">
          {parsed.body}
        </p>
        {parsed.highlights?.length ? (
          <IssueHighlights items={parsed.highlights} />
        ) : null}
        {primaryHref || secondaryHref || (issue.action === "add_faq" && issue.sourceText) ? (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {issue.action === "add_faq" && issue.sourceText ? (
              <span className="text-[12px] text-slate-600">
                Add this as an FAQ on the{" "}
                <Link
                  href={issue.href ?? DASHBOARD_ROUTES.businessFaqs}
                  className="font-medium text-[#0b1220] underline underline-offset-2"
                >
                  FAQs page
                </Link>
                .
              </span>
            ) : null}
            {primaryHref ? (
              <Link
                href={primaryHref}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-medium text-slate-800 transition-colors hover:bg-slate-50"
              >
                {actionLabelForIssue(issue)}
                <ArrowRight className="size-3" aria-hidden />
              </Link>
            ) : null}
            {secondaryHref ? (
              <Link
                href={secondaryHref}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-medium text-slate-800 transition-colors hover:bg-slate-50"
              >
                Review file
                <ArrowRight className="size-3" aria-hidden />
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function visibleLintIssues(issues: KnowledgeLintIssue[]): {
  show: KnowledgeLintIssue[];
  isBlock: boolean;
} {
  const blockers = issues.filter((issue) => issue.severity === "block");
  const warnings = issues.filter((issue) => issue.severity !== "block");
  const show = blockers.length > 0 ? blockers : warnings;
  return { show, isBlock: blockers.length > 0 };
}

type KnowledgeLintIssueListProps = {
  issues: KnowledgeLintIssue[];
  className?: string;
};

export function KnowledgeLintIssueList({
  issues,
  className,
}: KnowledgeLintIssueListProps) {
  const pathname = usePathname();
  const { show, isBlock } = visibleLintIssues(issues);

  if (show.length === 0) return null;

  return (
    <ul className={cn("divide-y divide-slate-100", className)}>
      {show.map((issue) => (
        <LintIssueRow
          key={issue.id}
          issue={issue}
          isBlock={isBlock}
          pathname={pathname}
        />
      ))}
    </ul>
  );
}
