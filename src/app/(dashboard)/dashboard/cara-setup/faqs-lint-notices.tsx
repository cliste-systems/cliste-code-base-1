"use client";

import { AgentConfigLintNotices } from "./agent-config-lint-notices";
import { useFaqsPageLintIssues } from "./use-agent-config-lint-issues";

export function FaqsLintNotices() {
  const issues = useFaqsPageLintIssues();

  return (
    <AgentConfigLintNotices
      issues={issues}
      variant="inset"
      sessionKey="cliste:dashboard:business-faqs:lint-intro-dismissed"
      dialogTitle="Review your FAQs"
      dialogDescription="A few things to tidy up so Cara stays accurate on calls."
    />
  );
}
