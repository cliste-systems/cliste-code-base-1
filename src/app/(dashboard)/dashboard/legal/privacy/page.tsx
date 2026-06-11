import { DashboardLegalDocumentPage } from "@/components/legal/dashboard-legal-document-page";
import { PrivacyNoticeDocument } from "@/content/legal/privacy-document";

export const metadata = {
  title: "Privacy notice — Legal — Cliste",
};

export default function DashboardLegalPrivacyPage() {
  return (
    <DashboardLegalDocumentPage>
      <PrivacyNoticeDocument />
    </DashboardLegalDocumentPage>
  );
}
