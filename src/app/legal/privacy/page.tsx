import type { Metadata } from "next";

import { CLISTE_COMPANY } from "@/lib/company-details";
import { PrivacyNoticeDocument } from "@/content/legal/privacy-document";

export const metadata: Metadata = {
  title: "Privacy notice — Cliste",
  description:
    `How ${CLISTE_COMPANY.legalName} processes business and caller personal data for the AI voice inbox platform.`,
};

export default function PrivacyPage() {
  return <PrivacyNoticeDocument />;
}
