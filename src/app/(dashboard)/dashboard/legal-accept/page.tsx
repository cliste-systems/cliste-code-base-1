import { LegalAcceptForm } from "./legal-accept-form";
import { loadLegalAcceptPageData } from "./load-legal-accept-page-data";

export const dynamic = "force-dynamic";

export default async function DashboardLegalAcceptPage() {
  const data = await loadLegalAcceptPageData();

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="space-y-2 text-center sm:text-left">
        <h1 className="text-xl font-semibold tracking-tight text-[#0b1220]">
          Before you continue
        </h1>
        <p className="text-sm leading-relaxed text-slate-600">
          Please review and accept the documents below to use Cliste. We keep a
          timestamped record for compliance.
        </p>
      </div>

      <LegalAcceptForm missing={data.missing} />
    </div>
  );
}
