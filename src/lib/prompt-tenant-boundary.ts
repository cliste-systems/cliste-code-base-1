const ROLE_MARKER_PATTERN = /^(system|assistant|user)\s*:/gim;
const BOUNDARY_ESCAPE_PATTERN = /<<<|>>>/g;

/** Neutralize untrusted tenant text before embedding in a Cara prompt. */
export function neutralizeUntrustedPromptText(text: string): string {
  let result = text.replace(BOUNDARY_ESCAPE_PATTERN, "");
  result = result.replace(ROLE_MARKER_PATTERN, "$1 (text):");
  result = result.replace(/"/g, "'");
  return result;
}

function sanitizeBoundaryLabel(label: string): string {
  const normalized = label
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
  return normalized || "UNTRUSTED";
}

/**
 * Wrap untrusted tenant content in explicit delimiters so it cannot be mistaken
 * for system instructions during prompt compilation.
 */
export function wrapUntrustedTenantContent(label: string, text: string): string {
  const safeLabel = sanitizeBoundaryLabel(label);
  const neutralized = neutralizeUntrustedPromptText(text);
  return `<<<${safeLabel}_START>>>\n${neutralized}\n<<<${safeLabel}_END>>>`;
}

/** Escape and neutralize owner free text embedded in quoted prompt lines. */
export function sanitizePromptFreeText(text: string): string {
  return neutralizeUntrustedPromptText(text);
}
