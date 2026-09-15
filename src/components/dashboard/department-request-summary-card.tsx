import { cn } from "@/lib/utils";
import type { StructuredCaptureSummary } from "@/lib/department-request-summary";
import {
  departmentRequestFieldLabel,
  filterDepartmentRequestFieldsForDisplay,
} from "@/lib/department-request-summary";

type DepartmentRequestSummaryCardProps = {
  summary: StructuredCaptureSummary;
  callerName: string;
  callerDisplay: string;
  callerTel?: string | null;
  showCallerName?: boolean;
  className?: string;
};

export function DepartmentRequestSummaryCard({
  summary,
  callerName,
  callerDisplay,
  callerTel,
  showCallerName = true,
  className,
}: DepartmentRequestSummaryCardProps) {
  const requestFields = filterDepartmentRequestFieldsForDisplay(
    summary.fields,
    showCallerName ? callerName : "",
  );
  const phone = callerDisplay.trim();

  return (
    <div
      className={cn(
        "mt-4 overflow-hidden rounded-xl border border-[#e8eeea] bg-[#fbfcfb]",
        className,
      )}
    >
      <div className="border-b border-[#e8eeea] bg-white px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Request
        </p>
        <p className="mt-1 text-[18px] font-semibold leading-snug tracking-tight text-[#0b1220]">
          {summary.header}
        </p>
      </div>

      <dl className="divide-y divide-[#e8eeea]">
        <div className="grid gap-1 px-4 py-3 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-x-4 sm:gap-y-0">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Caller
          </dt>
          <dd className="text-[15px] font-semibold leading-snug text-[#0b1220]">
            {showCallerName ? callerName.trim() || "Unknown caller" : "Unknown caller"}
          </dd>
        </div>

        <div className="grid gap-1 px-4 py-3 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-x-4 sm:gap-y-0">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Phone
          </dt>
          <dd className="text-[15px] font-semibold leading-snug text-[#0b1220]">
            {phone && callerTel ? (
              <a
                href={callerTel}
                className="tabular-nums text-[#353D42] underline-offset-2 hover:underline"
              >
                {phone}
              </a>
            ) : phone ? (
              <span className="tabular-nums">{phone}</span>
            ) : (
              <span className="text-slate-500">No phone on file</span>
            )}
          </dd>
        </div>

        {requestFields.map((field) => (
          <div
            key={`${field.label}-${field.value}`}
            className="grid gap-1 px-4 py-3 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-x-4 sm:gap-y-0"
          >
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {departmentRequestFieldLabel(field.label)}
            </dt>
            <dd
              className={cn(
                "text-[15px] font-semibold leading-snug text-[#0b1220]",
                field.unconfirmed && "text-amber-900",
              )}
            >
              {field.value}
              {field.unconfirmed ? (
                <span className="ml-2 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                  Unconfirmed
                </span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
