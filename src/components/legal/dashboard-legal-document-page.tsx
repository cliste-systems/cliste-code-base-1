import type { ReactNode } from "react";

import { DashboardAnimatedStack } from "@/components/dashboard/dashboard-animated-group";
import { LegalDocumentBody } from "@/components/legal/legal-document";

export function DashboardLegalDocumentPage({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <DashboardAnimatedStack>
      <section className="px-5 py-6 sm:px-6 sm:py-7">
        <LegalDocumentBody>{children}</LegalDocumentBody>
      </section>
    </DashboardAnimatedStack>
  );
}
