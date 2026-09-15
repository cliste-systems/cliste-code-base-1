import {
  mergeIncomingCallEvent,
  shouldClearCallsIncomingPlaceholder,
  type CallsIncomingPlaceholder,
} from "@/lib/calls-incoming-placeholder";
import type { DashboardIncomingCallDetail } from "@/lib/dashboard-live-events";

const STORAGE_PREFIX = "cliste:calls-incoming:";

function storageKey(organizationId: string): string {
  return `${STORAGE_PREFIX}${organizationId.trim()}`;
}

export function readCallsIncomingPlaceholderSession(
  organizationId: string,
): CallsIncomingPlaceholder | null {
  if (typeof window === "undefined" || !organizationId.trim()) return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(organizationId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CallsIncomingPlaceholder;
    if (parsed?.phase !== "in_progress" && parsed?.phase !== "loading") {
      return null;
    }
    if (!parsed.startedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCallsIncomingPlaceholderSession(
  organizationId: string,
  placeholder: CallsIncomingPlaceholder | null,
): void {
  if (typeof window === "undefined" || !organizationId.trim()) return;
  const key = storageKey(organizationId);
  try {
    if (!placeholder) {
      window.sessionStorage.removeItem(key);
      return;
    }
    window.sessionStorage.setItem(key, JSON.stringify(placeholder));
  } catch {
    /* ignore quota / private mode */
  }
}

export function mergeCallsIncomingPlaceholderSession(
  organizationId: string,
  detail: DashboardIncomingCallDetail,
): CallsIncomingPlaceholder {
  const current = readCallsIncomingPlaceholderSession(organizationId);
  const next = mergeIncomingCallEvent(current, detail);
  writeCallsIncomingPlaceholderSession(organizationId, next);
  return next;
}

export function clearCallsIncomingPlaceholderSessionIfLoaded(
  organizationId: string,
  calls: ReadonlyArray<{ id: string; createdAt: string }>,
): void {
  const saved = readCallsIncomingPlaceholderSession(organizationId);
  if (!saved) return;
  if (shouldClearCallsIncomingPlaceholder(saved, calls)) {
    writeCallsIncomingPlaceholderSession(organizationId, null);
  }
}
