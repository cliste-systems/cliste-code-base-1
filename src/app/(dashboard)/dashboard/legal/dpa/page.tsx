import { DashboardLegalDocumentPage } from "@/components/legal/dashboard-legal-document-page";
import { DpaDocument } from "@/content/legal/dpa-document";

export const metadata = {
  title: "DPA — Legal — Cliste",
};

export default function DashboardLegalDpaPage() {
  return (
    <DashboardLegalDocumentPage>
      <DpaDocument />
    </DashboardLegalDocumentPage>
  );
}
