import { DashboardLegalDocumentPage } from "@/components/legal/dashboard-legal-document-page";
import { CookiesDocument } from "@/content/legal/cookies-document";

export const metadata = {
  title: "Cookies — Legal — Cliste",
};

export default function DashboardLegalCookiesPage() {
  return (
    <DashboardLegalDocumentPage>
      <CookiesDocument />
    </DashboardLegalDocumentPage>
  );
}
