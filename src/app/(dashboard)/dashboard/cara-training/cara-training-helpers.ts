import {
  formatCallDateTimeLabel,
  formatDurationLabel,
  formatE164ForDisplay,
} from "@/lib/call-history-types";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import {
  classifyTrainingItem,
  isGenericCaraQuestion,
  trainingListMetaLine,
  type TrainingAnswerPattern,
  type TrainingDismissReason,
  TRAINING_DISMISS_REASON_LABELS,
} from "@/lib/cara-training-admission";
import {
  parseCaraTrainingPatch,
  parseOwnerMessages,
  isStructuredHoursTopic,
  type CaraTrainingItemRow,
  type CaraTrainingPatch,
  type CaraTrainingSource,
  type CaraTrainingStatus,
  type CaraTrainingTargetSection,
} from "@/lib/cara-training-types";

export type CaraTrainingListItem = CaraTrainingItemRow & {
  call_facts?: TrainingCallFacts | null;
};

export type TrainingCallFacts = {
  whenLabel: string;
  durationLabel: string | null;
  callerLabel: string | null;
  repeatLabel: string | null;
};

export {
  type TrainingAnswerPattern,
  type TrainingDismissReason,
  TRAINING_DISMISS_REASON_LABELS,
};

export const CARA_TRAINING_SOURCE_LABELS: Record<CaraTrainingSource, string> = {
  call_gap: "From a call",
  action_inbox: "From Action Inbox",
  owner_initiated: "You taught Cara",
};

export const CARA_TRAINING_SECTION_LABELS: Record<
  CaraTrainingTargetSection,
  string
> = {
  faq: "Answers & files",
  services: "Services",
  services_not_offered: "Services — not offered",
  business_rules: "Call handling",
};

export const TRAINING_ANSWER_PATTERN_LABELS: Record<TrainingAnswerPattern, string> = {
  existence: "Facility or service",
  location: "Location or directions",
  price: "Price",
  hours: "Opening hours",
  policy: "Policy or instructions",
  temporary: "Temporary information",
  unclear: "Needs review",
  free_text: "Written answer",
};

export function rowToTrainingItem(row: Record<string, unknown>): CaraTrainingListItem {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    status: row.status as CaraTrainingStatus,
    source: row.source as CaraTrainingSource,
    call_log_id: row.call_log_id ? String(row.call_log_id) : null,
    action_ticket_id: row.action_ticket_id
      ? String(row.action_ticket_id)
      : null,
    gap_summary: String(row.gap_summary ?? ""),
    caller_context: row.caller_context ? String(row.caller_context) : null,
    cara_question: String(row.cara_question ?? ""),
    owner_messages: parseOwnerMessages(row.owner_messages),
    proposed_patch: parseCaraTrainingPatch(row.proposed_patch),
    applied_patch: parseCaraTrainingPatch(row.applied_patch),
    target_section: (row.target_section as CaraTrainingTargetSection) ?? null,
    applied_at: row.applied_at ? String(row.applied_at) : null,
    applied_by: row.applied_by ? String(row.applied_by) : null,
    dismissed_at: row.dismissed_at ? String(row.dismissed_at) : null,
    occurrence_count:
      typeof row.occurrence_count === "number" && row.occurrence_count > 0
        ? row.occurrence_count
        : 1,
    last_seen_at: row.last_seen_at
      ? String(row.last_seen_at)
      : String(row.created_at ?? new Date().toISOString()),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    knowledge_folder_id: row.knowledge_folder_id
      ? String(row.knowledge_folder_id)
      : null,
    knowledge_department_ids: Array.isArray(row.knowledge_department_ids)
      ? row.knowledge_department_ids.map(String)
      : [],
    knowledge_topic_labels: Array.isArray(row.knowledge_topic_labels)
      ? row.knowledge_topic_labels.map(String)
      : [],
  };
}

/** Link to the originating call in call history, when known. */
export function trainingItemCallHref(
  callLogId: string | null | undefined,
): string | null {
  const id = callLogId?.trim();
  if (!id) return null;
  return `${DASHBOARD_ROUTES.calls}?call=${encodeURIComponent(id)}`;
}

export function buildTrainingCallFacts(
  item: CaraTrainingItemRow,
  callLog?: {
    created_at: string;
    duration_seconds: number;
    caller_number: string;
  } | null,
): TrainingCallFacts | null {
  if (item.source !== "call_gap") return null;

  const whenIso =
    callLog?.created_at?.trim() ||
    item.last_seen_at?.trim() ||
    item.created_at?.trim();
  if (!whenIso) return null;

  const durationSeconds = callLog?.duration_seconds;
  const caller = callLog?.caller_number?.trim();

  return {
    whenLabel: formatCallDateTimeLabel(whenIso),
    durationLabel:
      typeof durationSeconds === "number" && Number.isFinite(durationSeconds)
        ? formatDurationLabel(durationSeconds)
        : null,
    callerLabel: caller ? formatE164ForDisplay(caller) : null,
    repeatLabel:
      item.occurrence_count > 1
        ? `Asked ${item.occurrence_count} times`
        : null,
  };
}

export function trainingCallFactSegments(facts: TrainingCallFacts): string[] {
  return [
    facts.whenLabel,
    facts.durationLabel,
    facts.callerLabel,
    facts.repeatLabel,
  ].filter((segment): segment is string => Boolean(segment));
}

export function formatTrainingDateTime(iso: string): string {
  return formatCallDateTimeLabel(iso);
}

export function patchPreviewLines(patch: CaraTrainingPatch): string[] {
  switch (patch.kind) {
    case "faq":
      return [`Question: ${patch.question}`, `Answer: ${patch.answer}`];
    case "service_offered":
      return [`Add to what you offer: ${patch.label}`];
    case "service_not_offered":
      return [`Add to what you don't offer: ${patch.label}`];
    case "business_rule":
      return [`Add business rule: ${patch.rule}`];
  }
}

/** Review preview — approved facts Cara will rely on, not verbatim call wording. */
export function understoodPreviewLines(patch: CaraTrainingPatch): string[] {
  switch (patch.kind) {
    case "faq":
      return [patch.answer.trim()];
    case "business_rule":
      return [patch.rule.trim()];
    default:
      return patchPreviewLines(patch);
  }
}

export function isOpenTrainingStatus(status: CaraTrainingStatus): boolean {
  return status === "awaiting_answer" || status === "draft_ready";
}

function truncateTrainingLabel(text: string, max = 120): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

function gapSummaryWithoutCallerPrefix(gapSummary: string): string {
  return gapSummary
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^Caller:\s*[^.]+\.\s*/i, "")
    .trim();
}

/** Clear question heading for list rows and detail — never raw ticket summaries. */
export function trainingDisplayQuestion(item: CaraTrainingListItem): string {
  const patch = item.applied_patch ?? item.proposed_patch;
  if (patch?.kind === "faq" && patch.question.trim()) {
    return truncateTrainingLabel(patch.question);
  }

  const admission = classifyTrainingItem(item);
  if (admission.admit) {
    return truncateTrainingLabel(admission.displayQuestion);
  }

  const question = item.cara_question.trim();
  if (question && !isGenericCaraQuestion(question)) {
    return truncateTrainingLabel(question);
  }

  const fromGap = gapSummaryWithoutCallerPrefix(item.gap_summary);
  if (fromGap) return truncateTrainingLabel(fromGap);
  return "Review this question";
}

/** @deprecated Use trainingDisplayQuestion */
export function trainingTopicLabel(item: CaraTrainingListItem): string {
  return trainingDisplayQuestion(item);
}

export function trainingAnswerPattern(item: CaraTrainingListItem): TrainingAnswerPattern {
  const admission = classifyTrainingItem(item);
  return admission.admit ? admission.answerPattern : "free_text";
}

/** @deprecated Quick Yes/No controls removed — all items use written answers. */
export function trainingUsesQuickAnswerControls(
  _item: CaraTrainingListItem,
): boolean {
  return false;
}

export function quickAnswerDetailsPlaceholder(
  item: CaraTrainingListItem,
  choice: ExistenceQuickChoice,
): string {
  const pattern = trainingAnswerPattern(item);
  if (pattern === "location" && choice === "yes") {
    return "e.g. In the mall corridor, just outside the shop entrance.";
  }
  if (pattern === "location" && choice === "no") {
    return "e.g. We don't have customer toilets on site.";
  }
  if (pattern === "existence" && choice === "no") {
    return "e.g. We don't have a coin machine for customers.";
  }
  return "Add a location, restriction or other useful detail.";
}

export function quickAnswerChoiceHint(item: CaraTrainingListItem): string {
  const pattern = trainingAnswerPattern(item);
  if (pattern === "location") {
    return "Yes means you have them — tell Cara where. No means you don't — say what callers should hear.";
  }
  return "Yes or No answers the question. Add detail below if callers need more context.";
}

export function quickAnswerFieldCopy(
  item: CaraTrainingListItem,
  choice: ExistenceQuickChoice,
): { label: string; helper: string; required: boolean } {
  const pattern = trainingAnswerPattern(item);

  if (pattern === "location" && choice === "yes") {
    return {
      label: "What should Cara know?",
      helper:
        "Write it in your own words. Cara will tidy it up and answer callers naturally.",
      required: true,
    };
  }
  if (pattern === "location" && choice === "no") {
    return {
      label: "What should Cara know?",
      helper:
        "Write it in your own words. Cara will tidy it up and answer callers naturally.",
      required: true,
    };
  }
  if (choice === "no") {
    return {
      label: "What should Cara know?",
      helper:
        "Write it in your own words. Cara will tidy it up and answer callers naturally.",
      required: false,
    };
  }
  if (choice === "depends") {
    return {
      label: "What should Cara know?",
      helper:
        "Write it in your own words. Cara will tidy it up and answer callers naturally.",
      required: true,
    };
  }
  return {
    label: "What should Cara know?",
    helper:
      "Write it in your own words. Cara will tidy it up and answer callers naturally.",
    required: false,
  };
}

export function trainingListSubtitle(item: CaraTrainingListItem): string {
  const base = trainingListMetaLine(item);
  if (trainingItemIsDeferred(item)) {
    return `${base} · To check later`;
  }
  if (item.status === "draft_ready") {
    return `${base} · Ready to review`;
  }
  return base;
}

export function trainingDetailMeta(item: CaraTrainingListItem): string {
  const parts = [
    CARA_TRAINING_SOURCE_LABELS[item.source],
    formatTrainingDateTime(item.last_seen_at || item.created_at),
  ].filter(Boolean);
  return parts.join(" · ");
}

export function lastOwnerAnswer(item: CaraTrainingListItem): string | null {
  const answer = item.owner_messages
    .filter((message) => message.role === "user")
    .at(-1)
    ?.content?.trim();
  return answer || null;
}

/** Restore the employee's raw answer when returning from draft review. */
export function restoreOwnerAnswerForEdit(item: CaraTrainingListItem): string {
  return lastOwnerAnswer(item) ?? "";
}

/** Short caller excerpt for the detail workspace. */
export function trainingSourceExcerpt(item: CaraTrainingListItem): string | null {
  const topic = trainingDisplayQuestion(item).toLowerCase();
  const context = item.caller_context
    ?.replace(/^__demo__\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (context && context.length > 0) {
    if (context.length > topic.length + 12) {
      return truncateTrainingLabel(context, 320);
    }
  }

  const gap = gapSummaryWithoutCallerPrefix(item.gap_summary);
  if (!gap) return null;
  if (gap.toLowerCase() === topic) return null;
  if (/\border:\s*/i.test(gap) || gap.length > topic.length + 24) {
    return truncateTrainingLabel(gap, 320);
  }
  return null;
}

export function trainingAnswerPlaceholder(
  item: CaraTrainingListItem,
): string {
  const pattern = trainingAnswerPattern(item);

  switch (pattern) {
    case "existence":
      return "e.g. Yes — we have a coin machine beside the front tills.";
    case "location":
      return "e.g. The toilets are in the mall, just outside the shop entrance.";
    case "price":
      return "e.g. €12.99 per kg on the fresh meat counter this week.";
    case "hours":
      return "e.g. The hot counter closes at 8pm on weekdays.";
    case "policy":
      return "e.g. We need 48 hours notice for personalised celebration cakes.";
    case "temporary":
      return "e.g. We're closing at 5pm today for stocktake.";
    case "unclear":
      return "e.g. Write what callers should hear.";
    default:
      return "e.g. Yes — we deliver within 10 km of the store.";
  }
}

export function trainingAnswerHelperText(item: CaraTrainingListItem): string {
  if (trainingItemIsDeferred(item)) {
    return "Marked to check later — tap Ready to answer when you want to respond.";
  }
  return "Type the fact in your own words. Cara will tidy it for callers.";
}

export function trainingStatusLabel(status: CaraTrainingStatus): string {
  switch (status) {
    case "applied":
      return "Saved";
    case "draft_ready":
      return "Review answer";
    default:
      return "Needs input";
  }
}

export function trainingStatusVariant(
  status: CaraTrainingStatus,
): "brand" | "info" | "attention" {
  switch (status) {
    case "applied":
      return "brand";
    case "draft_ready":
      return "info";
    default:
      return "attention";
  }
}

export type ExistenceQuickChoice = "yes" | "no" | "depends";

export type ExistenceAnswerFormState = {
  choice: ExistenceQuickChoice | null;
  yesNoDetails: string;
  dependsExplanation: string;
  showYesNoDetails: boolean;
  useFreeText: boolean;
};

export function emptyExistenceAnswerForm(): ExistenceAnswerFormState {
  return {
    choice: null,
    yesNoDetails: "",
    dependsExplanation: "",
    showYesNoDetails: false,
    useFreeText: false,
  };
}

export function existenceDetailsForSubmit(
  form: ExistenceAnswerFormState,
): string {
  if (form.choice === "depends") return form.dependsExplanation.trim();
  return form.yesNoDetails.trim();
}

export function canReviewExistenceAnswer(
  item: CaraTrainingListItem,
  form: ExistenceAnswerFormState,
): boolean {
  if (!form.choice || form.useFreeText) return false;
  if (form.choice === "depends") {
    return form.dependsExplanation.trim().length > 0;
  }
  const field = quickAnswerFieldCopy(item, form.choice);
  if (field.required) {
    return form.yesNoDetails.trim().length > 0;
  }
  return true;
}

export function formatExistenceOwnerMessage(input: {
  choice: ExistenceQuickChoice;
  details?: string | null;
}): string {
  const details = input.details?.trim() ?? "";
  if (input.choice === "depends") {
    return details || "It depends.";
  }
  if (input.choice === "yes") {
    return details ? `Yes — ${details}` : "Yes.";
  }
  return details ? `No — ${details}` : "No.";
}

export function parseExistenceOwnerMessage(content: string): {
  choice: ExistenceQuickChoice;
  details: string;
} | null {
  const trimmed = content.trim();
  if (trimmed === "Yes.") return { choice: "yes", details: "" };
  if (trimmed === "No.") return { choice: "no", details: "" };
  const yesMatch = trimmed.match(/^Yes\s*[—-]\s*(.+)$/is);
  if (yesMatch) return { choice: "yes", details: yesMatch[1]?.trim() ?? "" };
  const noMatch = trimmed.match(/^No\s*[—-]\s*(.+)$/is);
  if (noMatch) return { choice: "no", details: noMatch[1]?.trim() ?? "" };
  if (/^it depends\.?$/i.test(trimmed)) {
    return { choice: "depends", details: "" };
  }
  return null;
}

export function restoreExistenceAnswerForm(
  item: CaraTrainingListItem,
): ExistenceAnswerFormState {
  const empty = emptyExistenceAnswerForm();
  if (
    item.status !== "draft_ready" ||
    item.proposed_patch?.kind !== "faq"
  ) {
    return empty;
  }

  const patch = item.proposed_patch;
  const owner = lastOwnerAnswer(item)?.trim() ?? "";
  const parsed = parseExistenceOwnerMessage(owner);
  if (parsed) {
    if (parsed.choice === "depends") {
      return {
        ...empty,
        choice: "depends",
        dependsExplanation: parsed.details || owner,
      };
    }
    return {
      ...empty,
      choice: parsed.choice,
      yesNoDetails: parsed.details,
      showYesNoDetails: parsed.details.length > 0,
    };
  }

  const patchAnswer = patch.answer.trim();
  const lowerPatch = patchAnswer.toLowerCase();

  if (lowerPatch.startsWith("no")) {
    return {
      ...empty,
      choice: "no",
      yesNoDetails: owner || patchAnswer,
      showYesNoDetails: true,
    };
  }
  if (lowerPatch.startsWith("yes")) {
    return {
      ...empty,
      choice: "yes",
      yesNoDetails: owner || patchAnswer.replace(/^yes\.?\s*/i, ""),
      showYesNoDetails: true,
    };
  }

  return {
    ...empty,
    choice: "depends",
    dependsExplanation: owner || patchAnswer,
  };
}

export function buildExistenceFaqPatch(input: {
  question: string;
  choice: ExistenceQuickChoice;
  details?: string | null;
}): CaraTrainingPatch {
  const question = input.question.trim().endsWith("?")
    ? input.question.trim()
    : `${input.question.trim()}?`;
  const details = input.details?.trim() ?? "";

  if (input.choice === "yes") {
    return {
      kind: "faq",
      question,
      answer: details || "Yes.",
    };
  }
  if (input.choice === "no") {
    return {
      kind: "faq",
      question,
      answer: details || "No.",
    };
  }
  if (!details) {
    throw new Error("Add the conditions Cara should mention.");
  }
  return {
    kind: "faq",
    question,
    answer: details,
  };
}

export function isStructuredHoursTopicText(text: string): boolean {
  return isStructuredHoursTopic(text);
}

export const TRAINING_DEFERRED_MESSAGE =
  "Deferred — manager will check and answer later.";

export function trainingItemIsDeferred(item: CaraTrainingListItem): boolean {
  if (item.status !== "awaiting_answer") return false;
  return item.owner_messages.some(
    (message) =>
      message.role === "assistant" &&
      message.content.startsWith("Deferred —"),
  );
}

export function applyDeferredToTrainingItem(
  item: CaraTrainingListItem,
): CaraTrainingListItem {
  if (trainingItemIsDeferred(item)) return item;
  const now = new Date().toISOString();
  return {
    ...item,
    owner_messages: [
      ...item.owner_messages,
      { role: "assistant", content: TRAINING_DEFERRED_MESSAGE, at: now },
    ],
    last_seen_at: now,
    updated_at: now,
  };
}

export function clearDeferredFromTrainingItem(
  item: CaraTrainingListItem,
): CaraTrainingListItem {
  const owner_messages = item.owner_messages.filter(
    (message) =>
      !(
        message.role === "assistant" &&
        message.content.startsWith("Deferred —")
      ),
  );
  return {
    ...item,
    owner_messages,
    updated_at: new Date().toISOString(),
  };
}

export function toggleTrainingItemDeferred(
  item: CaraTrainingListItem,
): CaraTrainingListItem {
  return trainingItemIsDeferred(item)
    ? clearDeferredFromTrainingItem(item)
    : applyDeferredToTrainingItem(item);
}

export function sortOpenTrainingItems(
  items: CaraTrainingListItem[],
): CaraTrainingListItem[] {
  return [...items].sort((a, b) => {
    const aDeferred = trainingItemIsDeferred(a);
    const bDeferred = trainingItemIsDeferred(b);
    if (aDeferred !== bDeferred) return aDeferred ? -1 : 1;
    return (
      new Date(b.last_seen_at || b.created_at).getTime() -
      new Date(a.last_seen_at || a.created_at).getTime()
    );
  });
}

export function trainingOpenStatusLabel(item: CaraTrainingListItem): string {
  if (trainingItemIsDeferred(item)) return "Waiting for your answer";
  return trainingStatusLabel(item.status);
}
