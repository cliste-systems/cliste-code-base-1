"use client";

import { OpenDashboardButton } from "@/app/(admin)/admin/organizations/[id]/open-dashboard-button";

import { SectionCard } from "./section-card";

export function FilesLinkSection({
  organizationId,
}: {
  organizationId: string;
}) {
  return (
    <SectionCard
      title="10. Files"
      description="Business files upload lives in the tenant dashboard. Structured fields and FAQs take precedence over uploaded files."
    >
      <OpenDashboardButton organizationId={organizationId} />
      <p className="text-muted-foreground text-xs">
        Uploaded price lists and FAQ documents supplement structured knowledge but
        do not override departments, hours, or approved FAQ answers.
      </p>
    </SectionCard>
  );
}
