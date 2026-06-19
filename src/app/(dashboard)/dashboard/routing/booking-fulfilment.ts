import {
  cleanCaptureFields,
  composeCaptureDetailsNote,
  defaultCaptureFieldsForBusinessType,
  ensureRequiredCaptureFields,
  type CaraCaptureField,
} from "@/app/(onboarding)/onboarding/knowledge/train-cara-capture-fields";

import type { SavedRoute } from "./route-models";

export type BookingFulfilmentMethod = "link" | "callback" | "both";

export const BOOKING_CALLBACK_DESCRIPTION =
  "Booking request only — team calls back. Do not confirm slots or deposits.";

/** Machine-detectable marker for inferring the "both" method on load. */
export const BOOKING_BACKUP_DESCRIPTION_PREFIX = "BOOKING_BACKUP:";

export const BOOKING_FULFILMENT_OPTIONS: {
  value: BookingFulfilmentMethod;
  label: string;
}[] = [
  {
    value: "link",
    label: "Text them a link to book themselves",
  },
  {
    value: "callback",
    label: "Take their details, your team rings back",
  },
  {
    value: "both",
    label: "Both — text the link and log a backup request",
  },
];

export function isBookingInquiryRoute(
  route: Pick<SavedRoute, "templateId">,
): boolean {
  return route.templateId === "booking-inquiry";
}

export function hasBookingBackupMarker(description: string | undefined): boolean {
  return String(description ?? "").includes(BOOKING_BACKUP_DESCRIPTION_PREFIX);
}

export function buildBookingBackupDescription(captureNote: string): string {
  const note = captureNote.trim();
  return `${BOOKING_BACKUP_DESCRIPTION_PREFIX} Also text the booking link, then log a backup booking request in Action Inbox. Capture: ${note}. Do not confirm appointments.`;
}

export function stripBookingBackupDescription(
  description: string | undefined,
): string | undefined {
  const raw = String(description ?? "").trim();
  if (!raw || !raw.includes(BOOKING_BACKUP_DESCRIPTION_PREFIX)) {
    return description?.trim() || undefined;
  }
  return undefined;
}

/** Extract capture note embedded in a backup description (for round-trip). */
export function captureNoteFromBackupDescription(
  description: string | undefined,
): string | null {
  const raw = String(description ?? "");
  if (!raw.includes(BOOKING_BACKUP_DESCRIPTION_PREFIX)) return null;
  const match = raw.match(/Capture:\s*(.+?)\.\s*Do not confirm appointments/i);
  return match?.[1]?.trim() || null;
}

export function defaultBookingCaptureFields(
  niche: string,
  businessType: string,
  orgFields?: unknown,
): CaraCaptureField[] {
  const fromOrg = orgFields ? cleanCaptureFields(orgFields) : [];
  if (fromOrg.length >= 2) {
    return ensureRequiredCaptureFields(fromOrg);
  }
  return defaultCaptureFieldsForBusinessType(businessType, niche);
}

export function inferBookingFulfilmentMethod(
  route: Pick<SavedRoute, "templateId" | "outcome" | "description">,
): BookingFulfilmentMethod {
  if (!isBookingInquiryRoute(route)) return "link";
  if (route.outcome === "action_inbox") return "callback";
  if (
    route.outcome === "send_link" &&
    hasBookingBackupMarker(route.description)
  ) {
    return "both";
  }
  return "link";
}

export function applyBookingFulfilmentMethod(
  route: SavedRoute,
  method: BookingFulfilmentMethod,
  captureFields: CaraCaptureField[],
): SavedRoute {
  const captureNote = composeCaptureDetailsNote(captureFields);

  switch (method) {
    case "link":
      return {
        ...route,
        templateId: "booking-inquiry",
        outcome: "send_link",
        note: "",
        description: stripBookingBackupDescription(route.description),
        linkDelivery: route.linkDelivery ?? "sms",
      };
    case "callback":
      return {
        ...route,
        templateId: "booking-inquiry",
        outcome: "action_inbox",
        note: captureNote,
        description: BOOKING_CALLBACK_DESCRIPTION,
        linkDelivery: undefined,
        url: "",
        businessFileId: null,
      };
    case "both":
      return {
        ...route,
        templateId: "booking-inquiry",
        outcome: "send_link",
        note: captureNote,
        description: buildBookingBackupDescription(captureNote),
        linkDelivery: route.linkDelivery ?? "sms",
      };
    default:
      return route;
  }
}

export function syncBookingRouteFromCaptureFields(
  route: SavedRoute,
  method: BookingFulfilmentMethod,
  captureFields: CaraCaptureField[],
): SavedRoute {
  if (!isBookingInquiryRoute(route)) return route;
  if (method === "link") return route;
  return applyBookingFulfilmentMethod(route, method, captureFields);
}

export function bookingFlowReady(
  route: SavedRoute,
  method: BookingFulfilmentMethod,
  captureFields: CaraCaptureField[],
): boolean {
  const fieldsOk = ensureRequiredCaptureFields(captureFields).length >= 2;

  switch (method) {
    case "link":
      return Boolean(route.url.trim()) && Boolean(route.linkDelivery);
    case "callback":
      return fieldsOk;
    case "both":
      return (
        Boolean(route.url.trim()) &&
        Boolean(route.linkDelivery) &&
        fieldsOk
      );
    default:
      return false;
  }
}

export function bookingStep4Label(method: BookingFulfilmentMethod): string {
  switch (method) {
    case "link":
      return "Which booking link?";
    case "callback":
      return "What should Cara note down?";
    case "both":
      return "Booking link and capture fields";
    default:
      return "Choose destination";
  }
}
