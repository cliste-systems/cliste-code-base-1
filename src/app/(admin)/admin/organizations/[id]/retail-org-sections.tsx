import Link from "next/link";

import type { TenantProvisioningStep } from "@/lib/tenant-provisioning-status";

export function ProvisioningStepsRail({
  steps,
}: {
  steps: TenantProvisioningStep[];
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Provisioning</h2>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((step) => (
          <li
            key={step.id}
            className="flex items-start gap-2 rounded-lg border border-slate-100 px-3 py-2"
          >
            <span
              className={
                step.complete
                  ? "mt-0.5 size-4 shrink-0 rounded-full bg-emerald-500 text-center text-[10px] leading-4 text-white"
                  : "mt-0.5 size-4 shrink-0 rounded-full border border-slate-300"
              }
              aria-hidden
            >
              {step.complete ? "✓" : ""}
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-medium text-slate-900">
                {step.label}
              </span>
              <span className="block text-[11px] text-slate-500">
                {step.detail}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CaraTrainingLinkCard({
  organizationId,
  trainedComplete = false,
}: {
  organizationId: string;
  trainedComplete?: boolean;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Train Cara</h2>
          <p className="mt-1 text-sm text-slate-600">
            Configure greeting, hours, departments, FAQs, and business rules.
            Saves compile the worker prompt — no manual system-instruction edits.
          </p>
        </div>
        {trainedComplete ? (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800 ring-1 ring-emerald-200/80 ring-inset">
            Complete
          </span>
        ) : null}
      </div>
      <Link
        href={`/admin/customers/${organizationId}/cara-training`}
        className="mt-4 inline-flex rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
      >
        Open Cara training
      </Link>
    </section>
  );
}
