import { LegalAcceptForm } from "./legal-accept-form";
import { loadLegalAcceptPageData } from "./load-legal-accept-page-data";

export const dynamic = "force-dynamic";

export default async function DashboardLegalAcceptPage() {
  const data = await loadLegalAcceptPageData();

  if (data.missing.length === 0) {
    return null;
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 py-2">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-[#0b1220]">
          Accept updated legal terms
        </h1>
        <p className="text-sm leading-relaxed text-slate-600">
          Before you continue using Cliste, please review and accept the
          documents below. We keep a timestamped record for compliance.
        </p>
      </div>

      <LegalAcceptForm missing={data.missing} />
    </div>
  );
}
