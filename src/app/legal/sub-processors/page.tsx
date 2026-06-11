import type { Metadata } from "next";

import { SubProcessorsDocument } from "@/content/legal/sub-processors-document";

export const metadata: Metadata = {
  title: "Sub-processors — Cliste",
  description: "Third parties Cliste uses to deliver the voice and dashboard platform.",
};

export default function SubProcessorsPage() {
  return <SubProcessorsDocument variant="public" />;
}
