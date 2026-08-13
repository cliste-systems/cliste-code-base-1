"use client";

import { AgentConfigLintNotices } from "./agent-config-lint-notices";
import { useServicesPageLintIssues } from "./use-agent-config-lint-issues";

type Props = {
  importError: string | null;
  onImportErrorHandled: () => void;
};

export function ServicesLintNotices({
  importError,
  onImportErrorHandled,
}: Props) {
  const issues = useServicesPageLintIssues();

  return (
    <AgentConfigLintNotices
      issues={issues}
      variant="inset"
      sessionKey="cliste:dashboard:business-services:lint-intro-dismissed"
      dialogTitle="Review your service menu"
      dialogDescription="A few things to tidy up so Cara stays accurate on calls."
      importError={importError}
      onImportErrorHandled={onImportErrorHandled}
    />
  );
}
