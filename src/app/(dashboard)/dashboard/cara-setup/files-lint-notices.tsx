"use client";

import { AgentConfigLintNotices } from "./agent-config-lint-notices";
import { useFilesPageLintIssues } from "./use-agent-config-lint-issues";

export function FilesLintNotices() {
  const issues = useFilesPageLintIssues();

  return (
    <AgentConfigLintNotices
      issues={issues}
      variant="inset"
      sessionKey="cliste:dashboard:business-files:lint-intro-dismissed"
      dialogTitle="Review your files"
      dialogDescription="A few things to tidy up so Cara stays accurate on calls."
    />
  );
}
