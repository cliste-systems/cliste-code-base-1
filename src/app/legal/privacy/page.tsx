import type { Metadata } from "next";

import { PrivacyNoticeDocument } from "@/content/legal/privacy-document";

export const metadata: Metadata = {
  title: "Privacy notice — Cliste",
  description:
    "How Cliste Systems processes business and caller personal data for the AI voice inbox platform.",
};

export default function PrivacyPage() {
  return <PrivacyNoticeDocument />;
}
