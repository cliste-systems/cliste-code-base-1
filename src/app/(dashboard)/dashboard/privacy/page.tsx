import { PrivacyToolsClient } from "./privacy-client";

export const metadata = {
  title: "Privacy tools — Cliste",
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#fafafa] pb-2">
      <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-gray-900">
            Privacy tools
          </h1>
          <p className="text-sm text-gray-600">
            Tools to help you respond to a customer&rsquo;s GDPR request &mdash;
            either a copy of their data (Article 15) or an erasure request
            (Article 17). All actions are logged in the security audit log.
          </p>
        </header>
        <PrivacyToolsClient />
        <section className="rounded-lg border border-gray-200 bg-white p-5 text-sm text-gray-600">
          <h2 className="text-base font-semibold text-gray-900">
            What gets exported / erased?
          </h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5">
            <li>
              <strong>Export</strong> &mdash; every appointment, call log and
              action-inbox ticket we hold for that phone number, scoped to your
              salon only.
            </li>
            <li>
              <strong>Erase</strong> &mdash; the customer&rsquo;s name, phone
              and email are replaced with a redaction marker; transcripts and
              AI summaries are nulled. The appointment time and price stay
              because Revenue requires you to keep books for 6 years.
            </li>
            <li>
              The customer can also email{" "}
              <strong>privacy@clistesystems.ie</strong> directly &mdash; we will
              forward to you, but you remain the data controller.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
