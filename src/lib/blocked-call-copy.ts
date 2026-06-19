/** Staff-facing summary stored on `call_logs.ai_summary` for blocked inbound calls. */
export function blockedCallDashboardSummary(businessName: string): string {
  const name = businessName.trim() || "your business";
  return `This caller tried to reach ${name}, but their number is on your blocklist. Cliste stopped the call before Cara could answer.`;
}

/** Short TTS clip played to blocked callers before hang-up (voice worker). */
export function blockedCallSpokenMessage(businessName: string): string {
  const name = businessName.trim() || "this business";
  return `We're unable to put you through to ${name}. This line is operated by Cliste Systems on behalf of the business, and your number isn't authorised to connect. Goodbye.`;
}
