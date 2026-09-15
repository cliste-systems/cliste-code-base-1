/** Post-call close-pipeline status persisted on call_logs. */
export type PostCallStatus = "pending" | "complete" | "partial" | "failed";

export type PostCallErrorStage =
  | "insert"
  | "postprocess"
  | "action_ticket"
  | "enrichment"
  | "webhook"
  | "close_handler";

export type PostCallErrorEntry = {
  stage: PostCallErrorStage;
  message: string;
  at: string;
};

export type ActionTicketDeliveryStatus = "confirmed" | "pending_review" | "failed";

export function isPostCallAttentionStatus(status: string | null | undefined): boolean {
  return status === "partial" || status === "failed";
}

export function isActionTicketUnderReview(
  deliveryStatus: string | null | undefined,
): boolean {
  return deliveryStatus === "pending_review" || deliveryStatus === "failed";
}

export function parsePostCallErrors(raw: unknown): PostCallErrorEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (entry): entry is PostCallErrorEntry =>
      entry != null &&
      typeof entry === "object" &&
      typeof (entry as PostCallErrorEntry).stage === "string" &&
      typeof (entry as PostCallErrorEntry).message === "string",
  );
}

export function appendPostCallError(
  existing: PostCallErrorEntry[],
  stage: PostCallErrorStage,
  message: string,
): PostCallErrorEntry[] {
  return [
    ...existing,
    { stage, message: message.slice(0, 500), at: new Date().toISOString() },
  ];
}

/** Client-safe copy — never expose internal error strings to store staff. */
export const ACTION_TICKET_UNDER_REVIEW_SUMMARY_PREFIX =
  "Under review — our team is confirming the details from this call.";

export const CALL_POST_PROCESSING_BANNER =
  "This call is being reviewed by the Hello Cara team — the shop order may not be fully synced yet.";
