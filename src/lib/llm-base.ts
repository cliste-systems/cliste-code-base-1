/**
 * Resolves a user-overridable LLM-API base URL but only honours the
 * override if the host is on a small allowlist of known LLM gateways.
 *
 * Why: `OPENROUTER_API_BASE` is read from the runtime env in two places
 * (`cara/chat/route.ts`, `cara-conversation-topic.ts`) and passed to
 * `fetch()`. If the env var were ever set (intentionally or by a
 * compromised deploy config) to an attacker-controlled host, every
 * dashboard chat message — plus the bearer token — would be exfiltrated.
 *
 * We deliberately accept a small, curated list. Adding a new gateway
 * (e.g. an LLM proxy you operate) is a one-line code change, on
 * purpose: env vars alone shouldn't be enough to redirect outbound
 * traffic carrying API keys.
 */

const ALLOWED_OPENROUTER_HOSTS: ReadonlySet<string> = new Set([
  "openrouter.ai",
  // Add internal LLM proxies / private OpenRouter mirrors here. Always
  // a hostname only — no protocol, port or path.
]);

const DEFAULT_OPENROUTER_BASE = "https://openrouter.ai/api/v1/chat/completions";

export function resolveOpenRouterBase(): string {
  const raw = process.env.OPENROUTER_API_BASE?.trim();
  if (!raw) return DEFAULT_OPENROUTER_BASE;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[llm-base] OPENROUTER_API_BASE is not a valid URL — falling back to openrouter.ai default",
      );
    }
    return DEFAULT_OPENROUTER_BASE;
  }
  if (parsed.protocol !== "https:") {
    console.warn(
      "[llm-base] OPENROUTER_API_BASE must be https — refusing override",
    );
    return DEFAULT_OPENROUTER_BASE;
  }
  if (!ALLOWED_OPENROUTER_HOSTS.has(parsed.hostname.toLowerCase())) {
    console.warn(
      "[llm-base] OPENROUTER_API_BASE host",
      parsed.hostname,
      "not in allowlist — refusing override",
    );
    return DEFAULT_OPENROUTER_BASE;
  }
  return raw;
}
