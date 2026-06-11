import Link from "next/link";

import { DashboardAnimatedStack } from "@/components/dashboard/dashboard-animated-group";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";

import { PrivacyToolsClient } from "../../privacy/privacy-client";

export const metadata = {
  title: "Data requests — Legal — Cliste",
};

export default function LegalDataRequestsPage() {
  return (
    <DashboardAnimatedStack>
      <PrivacyToolsClient />

      <section className="grid grid-cols-1 lg:grid-cols-2 lg:divide-x lg:divide-slate-100">
        <div className="space-y-3 px-5 py-5">
          <h2 className="text-[15px] font-semibold tracking-tight text-[#0b1220]">
            What is included?
          </h2>
          <p className="text-[13px] text-slate-500">
            Actions apply to your business only and are recorded in the security
            audit log.
          </p>
          <ul className="list-disc space-y-2 pl-5 text-[13px] leading-relaxed text-slate-600">
            <li>
              <strong className="font-medium text-[#0b1220]">Export</strong> —
              every appointment, call log (including transcripts and AI summaries
              where still retained), and action-inbox ticket for that phone number
              in your account.
            </li>
            <li>
              <strong className="font-medium text-[#0b1220]">Erase</strong> —
              name, phone, and email are redacted; transcripts and AI summaries
              are removed.
            </li>
            <li>
              Customers can also email{" "}
              <a
                href="mailto:privacy@clistesystems.ie"
                className="font-medium text-[#0b1220] underline-offset-2 hover:underline"
              >
                privacy@clistesystems.ie
              </a>
              . You remain the data controller; we act as processor.
            </li>
          </ul>
        </div>

        <div className="space-y-3 border-t border-slate-100 px-5 py-5 lg:border-t-0">
          <h2 className="text-[15px] font-semibold tracking-tight text-[#0b1220]">
            Website wording for your customers
          </h2>
          <p className="text-[13px] text-slate-500">
            Add something like this to your site — swap in your business name and
            contact details.
          </p>
          <blockquote className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-[12px] leading-relaxed text-slate-700">
            When you call [Business name], your call may be answered by our AI
            phone assistant provided by Cliste Systems. Calls may be recorded and
            transcribed to handle your request. We use Cliste to process this data
            on our behalf. For privacy requests, contact us directly or email
            privacy@clistesystems.ie.
          </blockquote>
          <p className="text-[12px] text-slate-500">
            Full legal documents are in the tabs above. Need help?{" "}
            <Link
              href={DASHBOARD_ROUTES.support}
              className="font-medium text-[#0b1220] underline-offset-2 hover:underline"
            >
              Support
            </Link>
          </p>
        </div>
      </section>
    </DashboardAnimatedStack>
  );
}
