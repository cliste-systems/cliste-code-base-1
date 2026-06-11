import type { RoutingActionSummary } from "@/lib/cara-custom-prompt";

/** Actions Cara can perform, derived from Call Flow configuration. */
export type CaraCapabilities = {
  transfer: boolean;
  /** Calendar / appointment booking — not available until Call Flow supports it. */
  book: boolean;
  sendLink: boolean;
  sendFile: boolean;
  email: boolean;
  whatsapp: boolean;
  /** Always available — messages go to the Action Inbox. */
  takeMessage: boolean;
};

export function deriveCaraCapabilities(
  routes: RoutingActionSummary[] | undefined,
  transferNumber: string | undefined,
): CaraCapabilities {
  const actionBlob = (routes ?? [])
    .map((r) => r.action.toLowerCase())
    .join(" ");

  return {
    transfer: Boolean(transferNumber?.trim()),
    book: false,
    sendLink:
      actionBlob.includes("text them the saved link") ||
      actionBlob.includes("saved link"),
    sendFile: actionBlob.includes("saved file"),
    email: actionBlob.includes("email"),
    whatsapp: actionBlob.includes("whatsapp"),
    takeMessage: true,
  };
}

/** Plain-English lines for the compiled prompt available-actions list. */
export function formatAvailableActionsForPrompt(
  caps: CaraCapabilities,
): string[] {
  const items: string[] = [
    "Take a message (name, number, and what they need) for your Action Inbox",
  ];
  if (caps.transfer) {
    items.push("Put them through to someone on the team");
  }
  if (caps.sendLink) {
    items.push("Text them a link");
  }
  if (caps.sendFile) {
    items.push("Text them a file");
  }
  if (caps.email) {
    items.push("Take their details and pass them to the team by email");
  }
  if (caps.whatsapp) {
    items.push("Follow up on WhatsApp");
  }
  return items;
}

/** Natural first-person line for a configured call-flow route. */
export function routePhraseForPrompt(
  trigger: string,
  action: string,
  instruction?: string,
): string {
  const topic = trigger.trim();
  const lower = action.trim().toLowerCase();
  let line: string;
  if (lower.includes("link")) {
    line = `If they ask about ${topic}, I can text them the link.`;
  } else if (lower.includes("file")) {
    line = `If they ask about ${topic}, I can text them the file.`;
  } else if (lower.includes("email")) {
    line = `If they ask about ${topic}, I pass their details to the team by email.`;
  } else if (lower.includes("whatsapp")) {
    line = `If they ask about ${topic}, I follow up on WhatsApp.`;
  } else if (lower.includes("put them through") || lower.includes("transfer")) {
    line = `If they ask about ${topic}, I try to put them through — if there's no answer I take a message.`;
  } else {
    line = `If they ask about ${topic}, I take a message for the team.`;
  }
  const extra = instruction?.trim();
  return extra ? `${line} ${extra}` : line;
}
