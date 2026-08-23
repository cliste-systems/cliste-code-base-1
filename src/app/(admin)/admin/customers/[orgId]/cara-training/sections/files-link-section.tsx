"use client";

import { OpenDashboardButton } from "@/app/(admin)/admin/organizations/[id]/open-dashboard-button";
import { CaraTrainingField } from "@/components/admin/cara-training-field";

import { SectionCard } from "./section-card";

export function FilesLinkSection({
  organizationId,
}: {
  organizationId: string;
}) {
  return (
    <SectionCard
      title="10. Files"
      description="Uploads in the tenant dashboard can supplement structured knowledge."
    >
      <CaraTrainingField
        label="Business files"
        feed="prompt"
        hint="Cara reads files you enable for answers. Structured fields and FAQs still take precedence."
      >
        <OpenDashboardButton organizationId={organizationId} />
      </CaraTrainingField>
    </SectionCard>
  );
}
