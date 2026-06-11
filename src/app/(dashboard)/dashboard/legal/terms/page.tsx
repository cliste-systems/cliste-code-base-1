import { DashboardLegalDocumentPage } from "@/components/legal/dashboard-legal-document-page";
import { TermsDocument } from "@/content/legal/terms-document";

export const metadata = {
  title: "Terms — Legal — Cliste",
};

export default function DashboardLegalTermsPage() {
  return (
    <DashboardLegalDocumentPage>
      <TermsDocument />
    </DashboardLegalDocumentPage>
  );
}
