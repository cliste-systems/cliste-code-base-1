"use client";

import { FileText } from "lucide-react";

import { DashboardAnimatedStack } from "@/components/dashboard/dashboard-animated-group";
import { SectionCard } from "@/components/dashboard/section-card";
import { buildCaraCapabilitiesFromPromptExtras } from "@/lib/call-handling-boundary";

import {
  deleteBusinessFile,
  updateBusinessFileMetadata,
  updateBusinessFileToggles,
  uploadBusinessFile,
} from "../agent-setup/business-files-actions";
import { BusinessFilesSection } from "../agent-setup/business-files-section";
import { FilesLintNotices } from "./files-lint-notices";
import { useCaraSetupForm } from "./cara-setup-form-context";

export function BusinessFilesTab() {
  const form = useCaraSetupForm();

  const caps = buildCaraCapabilitiesFromPromptExtras(
    form.promptExtras.routes,
    form.promptExtras.transferNumber,
  );
  const sendConfigured = caps.sendLink || caps.sendFile;

  return (
    <DashboardAnimatedStack embedded>
      <SectionCard
        flat
        icon={FileText}
        title="Files"
        description="Upload documents Cara can read from or send to callers."
        bodyClassName="p-0"
      >
        <FilesLintNotices />
        <div className="px-5 py-5">
          <BusinessFilesSection
            initialFiles={form.businessFiles}
            hasServiceCatalog={form.serviceCatalog.length > 0}
            hasFaqs={form.faqs.some(
              (faq) => faq.question.trim() && faq.answer.trim(),
            )}
            sendConfigured={sendConfigured}
            onFilesChange={form.setBusinessFiles}
          onUpload={uploadBusinessFile}
          onToggle={updateBusinessFileToggles}
          onUpdateMetadata={updateBusinessFileMetadata}
          onDelete={deleteBusinessFile}
          />
        </div>
      </SectionCard>
    </DashboardAnimatedStack>
  );
}
