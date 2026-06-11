import type { Metadata } from "next";

import { TermsDocument } from "@/content/legal/terms-document";

export const metadata: Metadata = {
  title: "Terms of service — Cliste",
  description: "Terms for using the Cliste AI voice receptionist platform.",
};

export default function TermsPage() {
  return <TermsDocument />;
}
