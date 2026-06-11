import { DashboardLegalDocumentPage } from "@/components/legal/dashboard-legal-document-page";
import { SubProcessorsDocument } from "@/content/legal/sub-processors-document";

export const metadata = {
  title: "Sub-processors — Legal — Cliste",
};

export default function DashboardLegalSubProcessorsPage() {
  return (
    <DashboardLegalDocumentPage>
      <SubProcessorsDocument variant="customer" />
    </DashboardLegalDocumentPage>
  );
}
