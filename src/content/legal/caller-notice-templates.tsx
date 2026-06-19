"use client";

import { useCallback, useState } from "react";
import { Check, Copy } from "lucide-react";
import Link from "next/link";

import { LegalInlineLink } from "@/components/legal/legal-path-context";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import {
  CALLER_NOTICE_TEMPLATES,
  type CallerNoticeTemplateId,
} from "@/lib/caller-notice-templates";
import { cn } from "@/lib/utils";

type CallerNoticeTemplatesProps = {
  acknowledgedAt: string | null;
};

function formatAcknowledgedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-IE", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function CopyTemplateButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-[#0b1220] transition-colors hover:bg-slate-50",
        copied && "border-emerald-200 bg-emerald-50 text-emerald-900",
      )}
    >
      {copied ? (
        <>
          <Check className="size-3.5" aria-hidden />
          Copied
        </>
      ) : (
        <>
          <Copy className="size-3.5" aria-hidden />
          Copy
        </>
      )}
    </button>
  );
}

function TemplateCard({
  id,
  title,
  description,
  body,
}: {
  id: CallerNoticeTemplateId;
  title: string;
  description: string;
  body: string;
}) {
  return (
    <article
      id={`caller-notice-${id}`}
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-[15px] font-semibold tracking-tight text-[#0b1220]">
            {title}
          </h2>
          <p className="text-[13px] leading-relaxed text-slate-500">{description}</p>
        </div>
        <CopyTemplateButton text={body} />
      </div>
      <pre className="mt-4 whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50/80 px-4 py-3 font-sans text-[12px] leading-relaxed text-slate-700">
        {body}
      </pre>
      <p className="mt-2 text-[11px] text-slate-500">
        Replace <code className="rounded bg-slate-100 px-1">[Business name]</code> and{" "}
        <code className="rounded bg-slate-100 px-1">[Your email]</code> before publishing.
      </p>
    </article>
  );
}

export function CallerNoticeTemplates({
  acknowledgedAt,
}: CallerNoticeTemplatesProps) {
  return (
    <div className="space-y-6 px-5 py-5">
      <div className="space-y-3">
        <p className="text-[14px] leading-relaxed text-slate-600">
          You are the <strong className="font-medium text-[#0b1220]">data controller</strong>{" "}
          for your callers&rsquo; personal data. Cliste acts as your{" "}
          <strong className="font-medium text-[#0b1220]">processor</strong>. Under GDPR
          Articles 13 and 14 you must tell callers —{" "}
          <em>before they call</em> — that an AI assistant may answer, and that calls
          may be recorded and transcribed. Use the templates below on your website, in
          your premises, or in your online listings.
        </p>
        {acknowledgedAt ? (
          <p className="text-[12px] text-slate-500">
            You confirmed caller privacy information at onboarding on{" "}
            <time dateTime={acknowledgedAt}>{formatAcknowledgedAt(acknowledgedAt)}</time>.
          </p>
        ) : null}
        <p className="text-[13px] text-slate-500">
          Mention <em>categories</em> of recipients (hosting, AI speech services) in your
          notice — see{" "}
          <LegalInlineLink href="/dashboard/legal/sub-processors">
            Sub-processors
          </LegalInlineLink>{" "}
          for guidance. Cara&rsquo;s spoken greeting also discloses AI and recording when
          calls connect.
        </p>
      </div>

      <div className="space-y-4">
        {CALLER_NOTICE_TEMPLATES.map((template) => (
          <TemplateCard key={template.id} {...template} />
        ))}
      </div>

      <p className="text-[12px] text-slate-500">
        Need to export or erase a caller&rsquo;s data? Use{" "}
        <Link
          href={DASHBOARD_ROUTES.legalDataRequests}
          className="font-medium text-[#0b1220] underline-offset-2 hover:underline"
        >
          Data requests
        </Link>
        . Questions?{" "}
        <Link
          href={DASHBOARD_ROUTES.support}
          className="font-medium text-[#0b1220] underline-offset-2 hover:underline"
        >
          Support
        </Link>
        .
      </p>
    </div>
  );
}
