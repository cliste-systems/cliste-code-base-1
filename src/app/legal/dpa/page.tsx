import type { Metadata } from "next";

import { CLISTE_COMPANY } from "@/lib/company-details";
import { DpaDocument } from "@/content/legal/dpa-document";

export const metadata: Metadata = {
  title: "Data Processing Agreement — Cliste",
  description:
    `GDPR Article 28 data processing agreement between ${CLISTE_COMPANY.legalName} (processor) and your business (controller).`,
};

export default function DpaPage() {
  return <DpaDocument />;
}
