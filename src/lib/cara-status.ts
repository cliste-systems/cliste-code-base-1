/**
 * Operational status for the dashboard Cara Status card (real org + call data only).
 */

import type { CaraLastCallSnapshot } from "@/lib/cara-last-call";
import { isCaraOnline } from "@/lib/cara-online-since";
import { formatPhoneForDisplay } from "@/lib/phone-display";

export type { CaraLastCallSnapshot } from "@/lib/cara-last-call";

export type CaraStatusRow = {
  value: string;
  subtext: string;
};

export type CaraStatusSnapshot = {
  liveStatus: CaraStatusRow;
  phoneLine: CaraStatusRow;
  openFollowUps: CaraStatusRow;
  isOnline: boolean;
  lastCall: CaraLastCallSnapshot | null;
};

export function buildCaraStatus(input: {
  lifecycleStatus: string;
  isActive: boolean;
  phoneNumber: string | null;
  openFollowUpCount: number;
  periodPhrase: string;
  lastCall?: CaraLastCallSnapshot | null;
}): CaraStatusSnapshot {
  const phoneRaw = input.phoneNumber?.trim() || null;
  const phoneDisplay = phoneRaw ? formatPhoneForDisplay(phoneRaw) : null;
  const status = input.lifecycleStatus.trim() || "active";
  const isActive = input.isActive;
  const online = isCaraOnline({
    lifecycleStatus: status,
    isActive,
    phoneNumber: phoneRaw,
  });

  const liveStatus: CaraStatusRow =
    online
      ? { value: "Live", subtext: "Ready for incoming calls" }
      : {
          value: "Setup needed",
          subtext: "Finish setup before calls are answered",
        };

  const phoneLine: CaraStatusRow = phoneDisplay
    ? { value: "Connected", subtext: phoneDisplay }
    : {
        value: "Not connected",
        subtext: "No business number on your account yet",
      };

  const n = input.openFollowUpCount;
  const openFollowUps: CaraStatusRow =
    n > 0
      ? {
          value: String(n),
          subtext: `Open in Action Inbox ${input.periodPhrase}`,
        }
      : {
          value: "Clear",
          subtext: `No open follow-ups ${input.periodPhrase}`,
        };

  const lastCall = input.lastCall ?? null;

  return {
    liveStatus,
    phoneLine,
    openFollowUps,
    isOnline: online,
    lastCall,
  };
}
