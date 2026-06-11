import type { Metadata } from "next";

import { DpaDocument } from "@/content/legal/dpa-document";

export const metadata: Metadata = {
  title: "Data Processing Agreement — Cliste",
  description:
    "GDPR Article 28 data processing agreement between Cliste Systems (processor) and your business (controller).",
};

export default function DpaPage() {
  return <DpaDocument />;
}
