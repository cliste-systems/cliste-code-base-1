"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { KnowledgeLintIssue } from "@/lib/cara-knowledge-lint";
import { inlineLintIssuesFor } from "@/lib/cara-knowledge-lint";
import { cleanBusinessRules } from "@/lib/agent-business-rules";

import { AddQuestionDialog } from "./add-question-dialog";
import { useCaraSetupForm } from "./cara-setup-form-context";
import { useAgentConfigLintIssues } from "./use-agent-config-lint-issues";

type AgentConfigLintContextValue = {
  issues: KnowledgeLintIssue[];
  inlineIssuesFor: (field: string, targetKey?: string) => KnowledgeLintIssue[];
  openAddFaqFromLint: (sourceText: string) => void;
};

const AgentConfigLintContext = createContext<AgentConfigLintContextValue | null>(
  null,
);

export function AgentConfigLintProvider({ children }: { children: ReactNode }) {
  const form = useCaraSetupForm();
  const issues = useAgentConfigLintIssues();
  const [addFaqOpen, setAddFaqOpen] = useState(false);
  const [addFaqPrefill, setAddFaqPrefill] = useState("");

  const inlineIssuesFor = useCallback(
    (field: string, targetKey?: string) =>
      inlineLintIssuesFor(issues, field, targetKey),
    [issues],
  );

  const openAddFaqFromLint = useCallback((sourceText: string) => {
    setAddFaqPrefill(sourceText.trim());
    setAddFaqOpen(true);
  }, []);

  const value = useMemo(
    () => ({
      issues,
      inlineIssuesFor,
      openAddFaqFromLint,
    }),
    [issues, inlineIssuesFor, openAddFaqFromLint],
  );

  return (
    <AgentConfigLintContext.Provider value={value}>
      {children}
      <AddQuestionDialog
        open={addFaqOpen}
        onOpenChange={setAddFaqOpen}
        existingFaqs={form.faqs}
        routes={form.promptExtras.routes}
        transferNumber={form.promptExtras.transferNumber}
        businessRules={cleanBusinessRules(form.businessRulesItems)}
        onAdd={(faq) => {
          form.setFaqs([...form.faqs, faq]);
          setAddFaqOpen(false);
        }}
        initialQuestion=""
        initialAnswer={addFaqPrefill}
      />
    </AgentConfigLintContext.Provider>
  );
}

export function useAgentConfigLint(): AgentConfigLintContextValue {
  const ctx = useContext(AgentConfigLintContext);
  if (!ctx) {
    throw new Error("useAgentConfigLint must be used within AgentConfigLintProvider");
  }
  return ctx;
}

export function useAgentConfigLintOptional(): AgentConfigLintContextValue | null {
  return useContext(AgentConfigLintContext);
}
