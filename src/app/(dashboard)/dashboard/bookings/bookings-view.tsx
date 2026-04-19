"use client";

import { format, startOfDay } from "date-fns";
import Link from "next/link";
import type { MouseEvent } from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CalendarDays,
  CalendarPlus,
  CalendarX,
  ChevronDown,
  Clock,
  FileText,
  Loader2,
  Mail,
  MessageSquareText,
  Phone,
  Scissors,
  Sparkles,
  Trash2,
  User,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { formatE164ForDisplay } from "@/lib/call-history-types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import type { DashboardBookingSlot } from "@/lib/booking-available-slots";

import {
  cancelAppointment,
  createAppointment,
  createRecurringAppointmentSeries,
  getBookingCallContext,
  getDashboardBookingSlots,
  listAddonsForBookingService,
  rescheduleAppointment,
  setAppointmentStatus,
  type BookingCallContext,
} from "./actions";

export type ServiceOption = {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
};

export type BookingSource = "ai_call" | "booking_link" | "dashboard";

export type AppointmentListRow = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  staff_id: string | null;
  service_id: string | null;
  start_time: string;
  end_time: string;
  status: string;
  source: BookingSource;
  /** Short code — same as customer confirmation SMS. */
  booking_reference: string | null;
  services: { name: string; price: number } | null;
  /** Set when the booking came from (or was tied to) a call. */
  call_log_id: string | null;
  /** Allergies, preferences, etc. — written by the AI or integrations. */
  ai_booking_notes: string | null;
  confirmation_sms_sent_at: string | null;
  confirmation_email_sent_at: string | null;
  /** 24h reminder SMS (Twilio cron); null if not sent. */
  reminder_sent_at: string | null;
  /** 24h reminder email (SendGrid cron); null if not sent. */
  reminder_email_sent_at: string | null;
  /**
   * Payment fields drive the PAID / UNPAID badge.
   * - null `payment_status` => no online payment was ever offered
   *   (treat as pay-in-person).
   * - 'pending' / 'unpaid' => awaiting payment; check
   *   `payment_link_sent_at` to show how long ago.
   * - 'paid' => use `paid_at`.
   * - 'failed' / 'refunded' => terminal states.
   */
  payment_status: string | null;
  amount_cents: number | null;
  /** Snapshot of full service price at booking time. */
  service_total_cents: number | null;
  /** When non-null, the up-front deposit Stripe was asked to collect. */
  deposit_cents: number | null;
  /** Generated server-side: service_total - amount_cents (clamped to 0). */
  balance_due_cents: number | null;
  currency: string | null;
  paid_at: string | null;
  payment_link_sent_at: string | null;
  stripe_checkout_session_id: string | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
  series_id: string | null;
  recurrence_rule: string | null;
};

function formatAppointmentDateLine(isoStart: string): string {
  const s = new Date(isoStart);
  if (Number.isNaN(s.getTime())) return isoStart;
  return s.toLocaleDateString("en-IE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatAppointmentTimeRange(isoStart: string, isoEnd: string): string {
  const s = new Date(isoStart);
  const e = new Date(isoEnd);
  if (Number.isNaN(s.getTime())) return "";
  const t0 = s.toLocaleTimeString("en-IE", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const t1 = Number.isNaN(e.getTime())
    ? ""
    : e.toLocaleTimeString("en-IE", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
  return t1 ? `${t0} – ${t1}` : t0;
}

function formatEur(n: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Local calendar label for the date picker (avoids UTC weekday drift). */
function parseYmdLocal(ymd: string): Date {
  const parts = ymd.split("-").map(Number);
  const y = parts[0];
  const mo = parts[1];
  const d = parts[2];
  if (!y || !mo || !d) return new Date();
  return new Date(y, mo - 1, d);
}

function formatPickerDateHeading(ymd: string): string {
  const parts = ymd.split("-").map(Number);
  const y = parts[0];
  const mo = parts[1];
  const d = parts[2];
  if (!y || !mo || !d) return "";
  return new Date(y, mo - 1, d).toLocaleDateString("en-IE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Short label for the date trigger button. */
function formatBookingDateButton(ymd: string): string {
  const parts = ymd.split("-").map(Number);
  const y = parts[0];
  const mo = parts[1];
  const d = parts[2];
  if (!y || !mo || !d) return "";
  return new Date(y, mo - 1, d).toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatSlotTimeButton(iso: string): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "";
  return t.toLocaleTimeString("en-IE", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const newBookingFieldClass =
  "h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 shadow-sm outline-none transition-[border-color,box-shadow] placeholder:text-gray-400 focus-visible:border-gray-900 focus-visible:ring-2 focus-visible:ring-gray-900/10";

const newBookingSelectClass =
  "h-11 w-full cursor-pointer appearance-none rounded-lg border border-gray-200 bg-white px-3 pr-10 text-sm text-gray-900 shadow-sm outline-none transition-[border-color,box-shadow] focus-visible:border-gray-900 focus-visible:ring-2 focus-visible:ring-gray-900/10 disabled:cursor-not-allowed disabled:opacity-50 [&>option]:bg-white";

function formatDetailTimestamp(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function telHref(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  let digits = t.replace(/[^\d+]/g, "");
  if (!digits) return null;
  if (!digits.startsWith("+")) digits = `+${digits}`;
  return `tel:${digits}`;
}

function customerInitial(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  return t[0]!.toUpperCase();
}

function statusLabel(status: string): string {
  if (!status) return "";
  const s = status.toLowerCase();
  if (s === "no_show") return "No-show";
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

function StatusPill({ status }: { status: string }) {
  const label = statusLabel(status);
  const s = status.toLowerCase();
  const dot =
    s === "confirmed"
      ? "bg-gray-900"
      : s === "pending"
        ? "bg-gray-400"
        : s === "cancelled"
          ? "bg-red-500"
          : s === "completed"
            ? "bg-emerald-500"
            : s === "no_show"
              ? "bg-amber-500"
              : "bg-gray-400";
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 shadow-sm">
      <div className={cn("size-1.5 shrink-0 rounded-full", dot)} aria-hidden />
      {label}
    </div>
  );
}

function BookingSourceBadge({ source }: { source: BookingSource }) {
  if (source === "ai_call") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-gray-200/80 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 shadow-sm">
        <Sparkles className="size-3 text-gray-500" aria-hidden />
        AI Booked
      </span>
    );
  }
  if (source === "booking_link") {
    return (
      <span className="inline-flex rounded-md border border-gray-200/80 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 shadow-sm">
        Online
      </span>
    );
  }
  return null;
}

/**
 * Compact "5 min ago" / "2 h ago" / "3 d ago" — used by PaymentBadge so
 * the salon can see at a glance how stale an unpaid booking is. Falls
 * back to a date for anything older than ~7 days.
 */
function shortRelativeTime(iso: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const diffMs = Date.now() - t;
  const sec = Math.max(0, Math.round(diffMs / 1000));
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} h ago`;
  const day = Math.round(hr / 24);
  if (day <= 7) return `${day} d ago`;
  return new Date(t).toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
  });
}

/**
 * Visible PAID / UNPAID indicator on every booking row. The "reason"
 * line tells the salon WHY a booking is unpaid:
 *   - paid_at set                            => "Paid · {time}"
 *   - payment_status in (pending|unpaid)
 *     and payment_link_sent_at set           => "Awaiting payment · link sent {ago}"
 *   - payment_status in (pending|unpaid)
 *     and no link timestamp                  => "Awaiting payment"
 *   - payment_status = 'failed'              => "Payment failed"
 *   - payment_status = 'refunded'            => "Refunded"
 *   - payment_status null                    => "Pay in person"
 */
function PaymentBadge({
  appt,
  detailed,
}: {
  appt: Pick<
    AppointmentListRow,
    | "payment_status"
    | "paid_at"
    | "payment_link_sent_at"
    | "stripe_checkout_session_id"
    | "amount_cents"
    | "service_total_cents"
    | "deposit_cents"
    | "balance_due_cents"
    | "currency"
  >;
  /** When true, render the second-line reason text. Used in the detail dialog. */
  detailed?: boolean;
}) {
  const status = (appt.payment_status ?? "").toLowerCase();
  let label = "Pay in person";
  let reason: string | null = null;
  let dot = "bg-gray-400";
  let cls =
    "inline-flex items-center gap-1.5 rounded-md border border-gray-200/80 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 shadow-sm";

  if (status === "paid") {
    label = "Paid";
    reason = appt.paid_at ? `Paid ${shortRelativeTime(appt.paid_at)}` : null;
    dot = "bg-emerald-500";
    cls =
      "inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 shadow-sm";
  } else if (status === "deposit_paid") {
    label = "Deposit paid";
    const balance =
      typeof appt.balance_due_cents === "number" ? appt.balance_due_cents : 0;
    if (balance > 0) {
      reason = `${formatEur(balance / 100)} due in salon`;
    } else if (appt.paid_at) {
      reason = `Deposit received ${shortRelativeTime(appt.paid_at)}`;
    }
    dot = "bg-blue-500";
    cls =
      "inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 shadow-sm";
  } else if (status === "pending" || status === "unpaid") {
    label = "Unpaid";
    reason = appt.payment_link_sent_at
      ? `Payment link sent ${shortRelativeTime(appt.payment_link_sent_at)} — awaiting customer`
      : "Awaiting payment";
    dot = "bg-amber-500";
    cls =
      "inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 shadow-sm";
  } else if (status === "failed") {
    label = "Unpaid";
    reason = "Payment attempt failed — resend link";
    dot = "bg-red-500";
    cls =
      "inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 shadow-sm";
  } else if (status === "refunded") {
    label = "Refunded";
    reason = appt.paid_at
      ? `Originally paid ${shortRelativeTime(appt.paid_at)}`
      : null;
    dot = "bg-gray-400";
    cls =
      "inline-flex items-center gap-1.5 rounded-md border border-gray-200/80 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 shadow-sm";
  } else {
    // payment_status is null => no online payment was ever set up.
    reason = "No online payment requested";
  }

  return (
    <div className="flex flex-col gap-0.5">
      <span className={cls}>
        <span className={cn("size-1.5 shrink-0 rounded-full", dot)} aria-hidden />
        {label}
      </span>
      {detailed && reason ? (
        <span className="pl-0.5 text-[11px] leading-tight text-gray-500">
          {reason}
        </span>
      ) : null}
    </div>
  );
}

function PhoneLine({
  raw,
  inset,
}: {
  raw: string;
  /** Align under customer name past avatar (desktop table). */
  inset?: boolean;
}) {
  const display = formatE164ForDisplay(raw.trim() || raw);
  const href = telHref(raw);
  const pad = inset !== false ? "pl-10" : "pl-0";
  if (!href) {
    return (
      <div className={cn("text-xs text-gray-500 tabular-nums", pad)}>
        {display || "—"}
      </div>
    );
  }
  return (
    <a
      href={href}
      className={cn(
        "block text-xs text-gray-500 tabular-nums underline-offset-2 hover:text-gray-900 hover:underline",
        pad,
      )}
    >
      {display}
    </a>
  );
}

type BookingsViewProps = {
  appointments: AppointmentListRow[];
  services: ServiceOption[];
  staff: { id: string; name: string }[];
  /** Salon calendar “today” (Europe/Dublin by default) for min date + default picker. */
  minBookingDateYmd: string;
};

type BookingTab = "upcoming" | "today" | "past" | "cancelled";

const TABS: { id: BookingTab; label: string }[] = [
  { id: "upcoming", label: "Upcoming" },
  { id: "today", label: "Today" },
  { id: "past", label: "Past" },
  { id: "cancelled", label: "Cancelled" },
];

function inSameLocalDay(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

function filterAppointmentsForTab(
  rows: AppointmentListRow[],
  tab: BookingTab,
): AppointmentListRow[] {
  const now = new Date();
  switch (tab) {
    case "upcoming":
      return rows.filter(
        (r) =>
          r.status !== "cancelled" &&
          new Date(r.end_time).getTime() >= now.getTime(),
      );
    case "today":
      return rows.filter(
        (r) =>
          r.status !== "cancelled" &&
          inSameLocalDay(r.start_time, now),
      );
    case "past":
      return rows.filter(
        (r) =>
          r.status !== "cancelled" &&
          new Date(r.end_time).getTime() < now.getTime(),
      );
    case "cancelled":
      return rows.filter((r) => r.status === "cancelled");
    default:
      return rows;
  }
}

export function BookingsView({
  appointments,
  services,
  staff,
  minBookingDateYmd,
}: BookingsViewProps) {
  const [activeTab, setActiveTab] = useState<BookingTab>("upcoming");
  const [selectedStaffId, setSelectedStaffId] = useState<string | "">(
    "",
  );
  const [statusPendingId, setStatusPendingId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [rescheduleTarget, setRescheduleTarget] =
    useState<AppointmentListRow | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>("");
  const [rescheduleSlots, setRescheduleSlots] = useState<DashboardBookingSlot[]>(
    [],
  );
  const [rescheduleSlotsLoading, setRescheduleSlotsLoading] =
    useState<boolean>(false);
  const [rescheduleSlotsError, setRescheduleSlotsError] = useState<string | null>(
    null,
  );
  const [rescheduleSlotIso, setRescheduleSlotIso] = useState<string>("");
  const [reschedulePending, startReschedule] = useTransition();
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const [reschedulePickerOpen, setReschedulePickerOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<AppointmentListRow | null>(null);
  const [callDetail, setCallDetail] = useState<BookingCallContext | null>(null);
  const [callPending, setCallPending] = useState(false);
  const [callLoadError, setCallLoadError] = useState<string | null>(null);
  const [pendingCreate, startCreateTransition] = useTransition();
  const [pendingCancel, startCancelTransition] = useTransition();
  const [cancelTarget, setCancelTarget] = useState<AppointmentListRow | null>(
    null
  );
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelReasonChoice, setCancelReasonChoice] = useState<string>("");
  const [cancelScopeFollowing, setCancelScopeFollowing] = useState(false);
  const [cancelReasonOther, setCancelReasonOther] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [bookingChannelNotices, setBookingChannelNotices] = useState<{
    sms?: string;
    email?: string;
  } | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [slotIso, setSlotIso] = useState("");
  const [availableSlots, setAvailableSlots] = useState<DashboardBookingSlot[]>(
    []
  );
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [availableAddons, setAvailableAddons] = useState<
    Array<{ id: string; name: string; priceCents: number; durationMinutes: number }>
  >([]);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatFrequency, setRepeatFrequency] = useState<
    "weekly" | "fortnightly" | "monthly"
  >("weekly");
  const [repeatCount, setRepeatCount] = useState(6);

  const resetForm = useCallback(() => {
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setServiceId(services[0]?.id ?? "");
    setDate("");
    setSlotIso("");
    setAvailableSlots([]);
    setSlotsError(null);
    setFormError(null);
    setDatePickerOpen(false);
    setRepeatEnabled(false);
    setRepeatFrequency("weekly");
    setRepeatCount(6);
    setAvailableAddons([]);
    setSelectedAddonIds([]);
  }, [services]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (next) {
        setDate(minBookingDateYmd);
        setSlotIso("");
        setAvailableSlots([]);
        setSlotsError(null);
        setFormError(null);
        setDatePickerOpen(false);
      } else {
        resetForm();
      }
    },
    [resetForm, minBookingDateYmd]
  );

  useEffect(() => {
    if (!open || !serviceId) {
      setAvailableAddons([]);
      setSelectedAddonIds([]);
      return;
    }
    let cancelled = false;
    setSelectedAddonIds([]);
    void listAddonsForBookingService({ serviceId }).then((r) => {
      if (cancelled) return;
      if (r.ok) {
        setAvailableAddons(r.addons);
      } else {
        setAvailableAddons([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, serviceId]);

  const addonDurationTotal = useMemo(
    () =>
      availableAddons
        .filter((a) => selectedAddonIds.includes(a.id))
        .reduce((sum, a) => sum + (a.durationMinutes || 0), 0),
    [availableAddons, selectedAddonIds],
  );

  useEffect(() => {
    if (!open || !date || !serviceId) {
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSlotsLoading(true);
      setSlotsError(null);
      void getDashboardBookingSlots({
        dateYmd: date,
        serviceId,
        extraDurationMinutes: addonDurationTotal,
      }).then(
        (r) => {
          if (cancelled) return;
          setSlotsLoading(false);
          if (!r.ok) {
            setSlotsError(r.message);
            setAvailableSlots([]);
            setSlotIso("");
            return;
          }
          setAvailableSlots(r.slots);
          setSlotIso((prev) => {
            if (prev && r.slots.some((s) => s.startIso === prev)) {
              return prev;
            }
            return "";
          });
        }
      );
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, date, serviceId, addonDurationTotal]);

  const submit = useCallback(() => {
    setFormError(null);
    if (!date) {
      setFormError("Choose a date.");
      return;
    }
    if (!slotIso) {
      setFormError("Choose an available time.");
      return;
    }
    startCreateTransition(async () => {
      if (repeatEnabled) {
        const seriesRes = await createRecurringAppointmentSeries({
          customerName,
          customerPhone,
          customerEmail,
          serviceId,
          startTimeIso: slotIso,
          frequency: repeatFrequency,
          count: Math.max(2, Math.min(26, repeatCount || 2)),
        });
        if (!seriesRes.ok) {
          setFormError(seriesRes.message);
          return;
        }
        const skipped = seriesRes.skipped.length;
        setBookingChannelNotices(
          skipped > 0
            ? {
                sms: `Created ${seriesRes.created} of ${seriesRes.created + skipped} bookings. ${skipped} skipped (likely overlap or off-hours): pick those manually.`,
              }
            : null,
        );
        setOpen(false);
        resetForm();
        return;
      }

      const result = await createAppointment({
        customerName,
        customerPhone,
        customerEmail,
        serviceId,
        startTimeIso: slotIso,
        addonIds: selectedAddonIds,
      });
      if (!result.ok) {
        setFormError(result.message);
        return;
      }
      setBookingChannelNotices(
        result.confirmationSmsFailed || result.confirmationEmailFailed
          ? {
              ...(result.confirmationSmsFailed
                ? { sms: result.confirmationSmsFailed }
                : {}),
              ...(result.confirmationEmailFailed
                ? { email: result.confirmationEmailFailed }
                : {}),
            }
          : null,
      );
      setOpen(false);
      resetForm();
    });
  }, [
    customerName,
    customerPhone,
    customerEmail,
    serviceId,
    date,
    slotIso,
    repeatEnabled,
    repeatFrequency,
    repeatCount,
    selectedAddonIds,
    resetForm,
  ]);

  const openCancelDialog = useCallback((row: AppointmentListRow) => {
    if (row.status.toLowerCase() !== "confirmed") return;
    setCancelError(null);
    setCancelReasonChoice("");
    setCancelReasonOther("");
    setCancelScopeFollowing(false);
    setCancelTarget(row);
  }, []);

  const executeCancelBooking = useCallback(() => {
    if (!cancelTarget) return;
    const id = cancelTarget.id;
    const seriesId = cancelTarget.series_id;
    const startIso = cancelTarget.start_time;
    const reason =
      cancelReasonChoice === "other"
        ? cancelReasonOther.trim()
        : cancelReasonChoice.trim();
    startCancelTransition(async () => {
      if (cancelScopeFollowing && seriesId) {
        const { cancelAppointmentSeriesFollowing } = await import("./actions");
        const seriesRes = await cancelAppointmentSeriesFollowing({
          seriesId,
          fromIso: startIso,
          reason: reason || null,
        });
        setCancelTarget(null);
        setCancelReasonChoice("");
        setCancelReasonOther("");
        setCancelScopeFollowing(false);
        if (!seriesRes.ok) {
          setCancelError(seriesRes.message);
        }
        return;
      }
      const result = await cancelAppointment(id, {
        reason: reason || null,
      });
      setCancelTarget(null);
      setCancelReasonChoice("");
      setCancelReasonOther("");
      setCancelScopeFollowing(false);
      if (!result.ok) {
        setCancelError(result.message);
      }
    });
  }, [
    cancelTarget,
    cancelReasonChoice,
    cancelReasonOther,
    cancelScopeFollowing,
  ]);

  const onCancelDialogOpenChange = useCallback(
    (next: boolean) => {
      if (!next && !pendingCancel) {
        setCancelTarget(null);
      }
    },
    [pendingCancel]
  );

  useEffect(() => {
    if (!rescheduleTarget) {
      setRescheduleDate("");
      setRescheduleSlots([]);
      setRescheduleSlotIso("");
      setRescheduleSlotsError(null);
      setRescheduleError(null);
      return;
    }
    const startTime = new Date(rescheduleTarget.start_time);
    const ymd = `${startTime.getFullYear()}-${String(
      startTime.getMonth() + 1,
    ).padStart(2, "0")}-${String(startTime.getDate()).padStart(2, "0")}`;
    setRescheduleDate(ymd);
    setRescheduleSlotIso("");
    setRescheduleError(null);
  }, [rescheduleTarget]);

  useEffect(() => {
    if (!rescheduleTarget || !rescheduleDate) return;
    const serviceId = rescheduleTarget.service_id;
    if (!serviceId) return;
    let cancelled = false;
    setRescheduleSlotsLoading(true);
    setRescheduleSlotsError(null);
    void getDashboardBookingSlots({
      dateYmd: rescheduleDate,
      serviceId,
      staffId: rescheduleTarget.staff_id ?? undefined,
    }).then((r) => {
      if (cancelled) return;
      setRescheduleSlotsLoading(false);
      if (!r.ok) {
        setRescheduleSlotsError(r.message);
        setRescheduleSlots([]);
        return;
      }
      setRescheduleSlots(r.slots);
    });
    return () => {
      cancelled = true;
    };
  }, [rescheduleTarget, rescheduleDate]);

  const submitReschedule = useCallback(() => {
    if (!rescheduleTarget || !rescheduleSlotIso) {
      setRescheduleError("Pick a new time.");
      return;
    }
    setRescheduleError(null);
    const id = rescheduleTarget.id;
    const slot = rescheduleSlots.find((s) => s.startIso === rescheduleSlotIso);
    if (!slot) {
      setRescheduleError("Pick a new time.");
      return;
    }
    startReschedule(async () => {
      const result = await rescheduleAppointment({
        appointmentId: id,
        newStartIso: slot.startIso,
        staffId: rescheduleTarget.staff_id ?? null,
      });
      if (!result.ok) {
        setRescheduleError(result.message);
        return;
      }
      setRescheduleTarget(null);
      setDetailRow(null);
    });
  }, [rescheduleTarget, rescheduleSlotIso, rescheduleSlots]);

  useEffect(() => {
    if (!detailRow?.call_log_id) {
      const clear = window.setTimeout(() => {
        setCallDetail(null);
        setCallLoadError(null);
        setCallPending(false);
      }, 0);
      return () => window.clearTimeout(clear);
    }
    let cancelled = false;
    const start = window.setTimeout(() => {
      setCallPending(true);
      setCallLoadError(null);
      setCallDetail(null);
      void getBookingCallContext(detailRow.id).then((r) => {
        if (cancelled) return;
        setCallPending(false);
        if (!r.ok) {
          setCallLoadError(r.message);
          return;
        }
        setCallDetail(r.call);
      });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(start);
    };
  }, [detailRow?.id, detailRow?.call_log_id]);

  const openBookingDetail = useCallback((row: AppointmentListRow) => {
    setDetailRow(row);
  }, []);

  const onBookingRowClick = useCallback(
    (e: MouseEvent, row: AppointmentListRow) => {
      if ((e.target as HTMLElement).closest("button, a")) return;
      openBookingDetail(row);
    },
    [openBookingDetail],
  );

  const cancelButton = (row: AppointmentListRow) =>
    row.status.toLowerCase() === "confirmed" ? (
      <button
        type="button"
        disabled={pendingCancel}
        onClick={() => openCancelDialog(row)}
        className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-gray-900/20 focus-visible:outline-none disabled:opacity-50"
        aria-label="Cancel booking"
      >
        <Trash2 className="size-5" aria-hidden />
      </button>
    ) : (
      <span className="inline-flex w-9 justify-center text-xs text-gray-400">
        —
      </span>
    );

  const filteredAppointments = useMemo(
    () => filterAppointmentsForTab(appointments, activeTab),
    [appointments, activeTab],
  );

  const tabCounts = useMemo(() => {
    const counts: Record<BookingTab, number> = {
      upcoming: 0,
      today: 0,
      past: 0,
      cancelled: 0,
    };
    for (const t of TABS) {
      counts[t.id] = filterAppointmentsForTab(appointments, t.id).length;
    }
    return counts;
  }, [appointments]);

  const updateBookingStatus = useCallback(
    (row: AppointmentListRow, status: "completed" | "no_show") => {
      setStatusError(null);
      setStatusPendingId(row.id);
      void setAppointmentStatus({
        appointmentId: row.id,
        status,
      })
        .then((res) => {
          if (!res.ok) setStatusError(res.message);
        })
        .finally(() => setStatusPendingId(null));
    },
    [],
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col px-6 py-8 lg:px-12 lg:py-12">
      <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl font-medium tracking-tight text-gray-900">
            Appointments
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-500">
            Upcoming and in-progress visits only (newest bookings first). Past
            appointments stay in your database for history and reporting—they
            are just hidden here so the list stays actionable.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={services.length === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-gray-900/10 transition-all hover:bg-gray-800 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CalendarPlus className="size-5 shrink-0" aria-hidden />
          New booking
        </button>
      </header>

      {services.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500">
          Add services in{" "}
          <span className="font-medium text-gray-900">Storefront</span> before
          you can create a booking.
        </p>
      ) : null}

      {cancelError ? (
        <p className="mb-4 text-sm text-red-600" role="alert">
          {cancelError}
        </p>
      ) : null}

      {bookingChannelNotices ? (
        <Alert
          className="mb-4 border-amber-200/80 bg-amber-50/80 text-amber-950 [&>svg]:text-amber-700"
          role="alert"
        >
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
          <div className="min-w-0">
            <AlertTitle>Booking saved — some notifications did not send</AlertTitle>
            <AlertDescription className="space-y-2 text-amber-900/90">
              {bookingChannelNotices.sms ? (
                <p>
                  <span className="font-medium">SMS:</span>{" "}
                  {bookingChannelNotices.sms}
                </p>
              ) : null}
              {bookingChannelNotices.email ? (
                <p>
                  <span className="font-medium">Email:</span>{" "}
                  {bookingChannelNotices.email}
                </p>
              ) : null}
            </AlertDescription>
            <button
              type="button"
              className="mt-2 text-xs font-medium text-amber-900 underline-offset-2 hover:underline"
              onClick={() => setBookingChannelNotices(null)}
            >
              Dismiss
            </button>
          </div>
        </Alert>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
        {TABS.map((t) => {
          const isActive = t.id === activeTab;
          const count = tabCounts[t.id];
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-gray-900 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-100",
              )}
            >
              {t.label}
              <span
                className={cn(
                  "ml-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[11px] tabular-nums",
                  isActive
                    ? "bg-white/15 text-white"
                    : "bg-gray-100 text-gray-500",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {statusError ? (
        <p className="mb-4 text-sm text-red-600" role="alert">
          {statusError}
        </p>
      ) : null}

      {filteredAppointments.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white py-12 text-center text-sm text-gray-500 shadow-sm">
          {activeTab === "upcoming"
            ? "No upcoming appointments. Add one with New booking."
            : activeTab === "today"
              ? "Nothing scheduled today."
              : activeTab === "past"
                ? "No past appointments in the last 6 months."
                : "No cancelled appointments."}
        </div>
      ) : (
        <>
          <div className="hidden w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm md:block">
            <div className="w-full overflow-x-auto">
              <table className="min-w-[800px] w-full border-collapse whitespace-nowrap text-left">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/80">
                    <th className="w-[25%] px-6 py-4 text-xs font-medium tracking-widest text-gray-500 uppercase">
                      Date &amp; time
                    </th>
                    <th className="w-[25%] px-6 py-4 text-xs font-medium tracking-widest text-gray-500 uppercase">
                      Customer
                    </th>
                    <th className="w-[20%] px-6 py-4 text-xs font-medium tracking-widest text-gray-500 uppercase">
                      Service
                    </th>
                    <th className="w-[20%] px-6 py-4 text-xs font-medium tracking-widest text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="w-[10%] px-6 py-4 text-right text-xs font-medium tracking-widest text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAppointments.map((row) => (
                    <tr
                      key={row.id}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openBookingDetail(row);
                        }
                      }}
                      onClick={(e) => onBookingRowClick(e, row)}
                      className={cn(
                        "group cursor-pointer transition-colors hover:bg-gray-50/50",
                        row.status.toLowerCase() === "cancelled" &&
                          "bg-red-50/40 hover:bg-red-50/60",
                      )}
                    >
                      <td className="px-6 py-4 align-top">
                        <div className="text-sm font-medium text-gray-900">
                          {formatAppointmentDateLine(row.start_time)}
                        </div>
                        <div className="text-sm text-gray-500 tabular-nums">
                          {formatAppointmentTimeRange(
                            row.start_time,
                            row.end_time
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="mb-1 flex items-center gap-3">
                          <div className="flex size-7 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-gradient-to-tr from-gray-200 to-gray-100 text-xs font-medium text-gray-600 shadow-sm">
                            {customerInitial(row.customer_name)}
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {row.customer_name}
                          </span>
                        </div>
                        <PhoneLine raw={row.customer_phone} inset />
                        {row.customer_email ? (
                          <div
                            className={cn(
                              "mt-0.5 text-xs text-gray-500",
                              "pl-10",
                            )}
                          >
                            {row.customer_email}
                          </div>
                        ) : null}
                        {row.booking_reference ? (
                          <div className="mt-1 font-mono text-xs text-gray-500">
                            Ref {row.booking_reference}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-medium text-gray-900">
                            {row.services?.name ?? "—"}
                          </span>
                          {row.services != null ? (
                            <>
                              <span className="text-gray-400">•</span>
                              <span className="text-gray-600 tabular-nums">
                                {formatEur(Number(row.services.price))}
                              </span>
                            </>
                          ) : null}
                        </div>
                        <BookingSourceBadge source={row.source} />
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="flex flex-col items-start gap-1.5">
                          <StatusPill status={row.status} />
                          <PaymentBadge appt={row} />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right align-top">
                        <span onClick={(e) => e.stopPropagation()} className="inline-flex">
                          {cancelButton(row)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:hidden">
            {filteredAppointments.map((row) => (
              <div
                key={row.id}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openBookingDetail(row);
                  }
                }}
                onClick={(e) => onBookingRowClick(e, row)}
                className={cn(
                  "cursor-pointer overflow-hidden rounded-2xl border text-left shadow-sm transition-colors",
                  row.status.toLowerCase() === "cancelled"
                    ? "border-red-200 bg-red-50/50 hover:border-red-300"
                    : "border-gray-200 bg-white hover:border-gray-300",
                )}
              >
                <div className="space-y-3 p-4">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {formatAppointmentDateLine(row.start_time)}
                    </div>
                    <div className="text-sm text-gray-500 tabular-nums">
                      {formatAppointmentTimeRange(
                        row.start_time,
                        row.end_time,
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-gradient-to-tr from-gray-200 to-gray-100 text-xs font-medium text-gray-600 shadow-sm">
                      {customerInitial(row.customer_name)}
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      {row.customer_name}
                    </span>
                  </div>
                  <PhoneLine raw={row.customer_phone} inset={false} />
                  {row.customer_email ? (
                    <p className="text-xs text-gray-500">{row.customer_email}</p>
                  ) : null}
                  {row.booking_reference ? (
                    <div className="font-mono text-xs text-gray-500">
                      Ref {row.booking_reference}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                      <span className="font-medium text-gray-900">
                        {row.services?.name ?? "—"}
                      </span>
                      <BookingSourceBadge source={row.source} />
                    </div>
                    <span onClick={(e) => e.stopPropagation()}>
                      {cancelButton(row)}
                    </span>
                  </div>
                  <div className="-mt-1">
                    <PaymentBadge appt={row} detailed />
                  </div>
                  <p className="text-xs text-gray-400">
                    Tap for notes, call, texts &amp; email
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Dialog
        open={detailRow !== null}
        onOpenChange={(next) => {
          if (!next) {
            setDetailRow(null);
            setCallDetail(null);
            setCallLoadError(null);
          }
        }}
      >
        <DialogContent
          className="max-h-[min(90vh,720px)] gap-0 overflow-y-auto border border-gray-200/80 bg-white p-0 sm:max-w-lg"
          showCloseButton
        >
          {detailRow ? (
            <>
              <DialogHeader className="border-b border-gray-100 px-6 py-5 text-left">
                <DialogTitle className="text-gray-900">Booking details</DialogTitle>
                <DialogDescription className="mt-1 text-left text-sm text-gray-500">
                  <span className="font-medium text-gray-700">
                    {formatAppointmentDateLine(detailRow.start_time)}
                  </span>
                  <span className="text-gray-400"> · </span>
                  <span className="tabular-nums">
                    {formatAppointmentTimeRange(
                      detailRow.start_time,
                      detailRow.end_time,
                    )}
                  </span>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 px-6 py-5">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">Customer</span>
                    <span className="text-right font-medium text-gray-900">
                      {detailRow.customer_name}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">Phone</span>
                    <span className="text-right tabular-nums text-gray-900">
                      {formatE164ForDisplay(
                        detailRow.customer_phone.trim() || detailRow.customer_phone,
                      ) || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">Email</span>
                    <span className="max-w-[60%] break-all text-right text-gray-900">
                      {detailRow.customer_email?.trim() || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">Service</span>
                    <span className="text-right font-medium text-gray-900">
                      {detailRow.services?.name ?? "—"}
                      {detailRow.services != null ? (
                        <span className="text-gray-500">
                          {" "}
                          · {formatEur(Number(detailRow.services.price))}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  {detailRow.booking_reference ? (
                    <div className="flex justify-between gap-4">
                      <span className="text-gray-500">Booking ref</span>
                      <span className="text-right font-mono text-gray-900">
                        {detailRow.booking_reference}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span className="text-gray-500">Source</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <BookingSourceBadge source={detailRow.source} />
                      <StatusPill status={detailRow.status} />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-start justify-between gap-2 pt-1">
                    <span className="text-gray-500">Payment</span>
                    <div className="text-right">
                      <PaymentBadge appt={detailRow} detailed />
                    </div>
                  </div>
                </div>

                {detailRow.status === "cancelled" ? (
                  <div className="rounded-md border border-red-200 bg-red-50/60 p-3 text-sm">
                    <p className="text-xs font-medium uppercase tracking-wider text-red-700">
                      Cancelled
                    </p>
                    <p className="mt-1 text-gray-900">
                      {detailRow.cancel_reason
                        ? detailRow.cancel_reason
                        : "No reason recorded"}
                    </p>
                    {detailRow.cancelled_at ? (
                      <p className="mt-1 text-xs text-gray-500">
                        on {formatAppointmentDateLine(detailRow.cancelled_at)}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {detailRow.status === "confirmed" ||
                detailRow.status === "completed" ||
                detailRow.status === "no_show" ? (
                  <div>
                    <h3 className="mb-2 text-xs font-medium tracking-wider text-gray-500 uppercase">
                      Quick actions
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          detailRow.status === "completed"
                            ? "default"
                            : "outline"
                        }
                        disabled={statusPendingId === detailRow.id}
                        onClick={() =>
                          updateBookingStatus(detailRow, "completed")
                        }
                      >
                        Mark complete
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          detailRow.status === "no_show"
                            ? "destructive"
                            : "outline"
                        }
                        disabled={statusPendingId === detailRow.id}
                        onClick={() =>
                          updateBookingStatus(detailRow, "no_show")
                        }
                      >
                        Mark no-show
                      </Button>
                      {detailRow.status === "confirmed" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setRescheduleTarget(detailRow)}
                        >
                          Reschedule
                        </Button>
                      ) : null}
                      {detailRow.status === "confirmed" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="ml-auto text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => openCancelDialog(detailRow)}
                        >
                          Cancel booking
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div>
                  <h3 className="mb-2 text-xs font-medium tracking-wider text-gray-500 uppercase">
                    Guest notes (AI)
                  </h3>
                  <p className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-gray-800">
                    {detailRow.ai_booking_notes?.trim()
                      ? detailRow.ai_booking_notes.trim()
                      : "No notes recorded yet. Your AI receptionist can add allergies and other details when this booking is updated from a call."}
                  </p>
                  {detailRow.call_log_id ? (
                    <div className="mt-3">
                      <Link
                        href={`/dashboard/call-history?call=${encodeURIComponent(detailRow.call_log_id)}`}
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "inline-flex w-full items-center justify-center gap-2 sm:w-auto",
                        )}
                      >
                        <FileText className="size-4 shrink-0" aria-hidden />
                        View call transcript
                      </Link>
                    </div>
                  ) : null}
                </div>

                <div>
                  <h3 className="mb-2 flex items-center gap-2 text-xs font-medium tracking-wider text-gray-500 uppercase">
                    <Phone className="size-3.5 text-gray-400" aria-hidden />
                    Call
                  </h3>
                  {!detailRow.call_log_id ? (
                    <p className="text-sm text-gray-500">
                      No call is linked to this booking.
                    </p>
                  ) : callPending ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Loading call…
                    </div>
                  ) : callLoadError ? (
                    <p className="text-sm text-red-600">{callLoadError}</p>
                  ) : !callDetail ? (
                    <p className="text-sm text-gray-500">
                      Call details are no longer available.
                    </p>
                  ) : (
                    <div className="space-y-3 rounded-lg border border-gray-100 bg-white px-3 py-3 text-sm">
                      <div className="flex flex-wrap justify-between gap-2 text-gray-600">
                        <span className="tabular-nums">
                          {formatDetailTimestamp(callDetail.created_at)}
                        </span>
                        <span>{formatE164ForDisplay(callDetail.caller_number)}</span>
                      </div>
                      {callDetail.ai_summary?.trim() ? (
                        <p className="leading-relaxed text-gray-800">
                          <span className="font-medium text-gray-700">Summary: </span>
                          {callDetail.ai_summary.trim()}
                        </p>
                      ) : null}
                      <ScrollArea className="max-h-40 rounded-md border border-gray-100 bg-gray-50/50">
                        <p className="p-3 text-xs leading-relaxed whitespace-pre-wrap text-gray-700">
                          {(callDetail.transcript_review ?? callDetail.transcript)?.trim()
                            ? (callDetail.transcript_review ?? callDetail.transcript)!.trim()
                            : "No transcript stored for this call."}
                        </p>
                      </ScrollArea>
                      <Link
                        href={`/dashboard/call-history?call=${encodeURIComponent(detailRow.call_log_id!)}`}
                        className="inline-flex text-xs font-medium text-gray-700 underline-offset-2 hover:underline"
                      >
                        Open in call history
                      </Link>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="mb-2 flex items-center gap-2 text-xs font-medium tracking-wider text-gray-500 uppercase">
                    <MessageSquareText className="size-3.5 text-gray-400" aria-hidden />
                    SMS &amp; email
                  </h3>
                  <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
                    <div className="flex items-center justify-between gap-4 px-3 py-2.5">
                      <span className="text-sm text-gray-600">SMS confirmation</span>
                      {detailRow.confirmation_sms_sent_at ? (
                        <span className="text-sm font-medium text-gray-900 tabular-nums">
                          Sent{" "}
                          {formatDetailTimestamp(detailRow.confirmation_sms_sent_at)}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">Not sent</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-4 px-3 py-2.5">
                      <span className="text-sm text-gray-600">Email confirmation</span>
                      {detailRow.confirmation_email_sent_at ? (
                        <span className="text-sm font-medium text-gray-900 tabular-nums">
                          Sent{" "}
                          {formatDetailTimestamp(detailRow.confirmation_email_sent_at)}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">Not sent</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-4 px-3 py-2.5">
                      <span className="text-sm text-gray-600">SMS reminder (~24h)</span>
                      {detailRow.reminder_sent_at ? (
                        <span className="text-sm font-medium text-gray-900 tabular-nums">
                          Sent {formatDetailTimestamp(detailRow.reminder_sent_at)}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">Not sent</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-4 px-3 py-2.5">
                      <span className="text-sm text-gray-600">Email reminder (~24h)</span>
                      {detailRow.reminder_email_sent_at ? (
                        <span className="text-sm font-medium text-gray-900 tabular-nums">
                          Sent{" "}
                          {formatDetailTimestamp(detailRow.reminder_email_sent_at)}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">Not sent</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={cancelTarget !== null} onOpenChange={onCancelDialogOpenChange}>
        <DialogContent
          className="border border-gray-200/80 bg-white sm:max-w-md"
          showCloseButton={!pendingCancel}
        >
          <DialogHeader>
            <DialogTitle className="text-gray-900">
              Cancel this booking?
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              This will mark the appointment as{" "}
              <span className="font-medium text-gray-900">cancelled</span>. It
              stays on your calendar and bookings list in{" "}
              <span className="font-medium text-red-700">red</span> so you can see
              the slot history.
            </DialogDescription>
            {cancelTarget ? (
              <div className="rounded-md border border-gray-200 bg-gray-50/80 px-3 py-2 text-sm text-gray-900">
                <p className="font-medium">{cancelTarget.customer_name}</p>
                <div className="mt-1 space-y-0.5 text-gray-600">
                  <p className="font-medium text-gray-900">
                    {formatAppointmentDateLine(cancelTarget.start_time)}
                  </p>
                  <p className="text-sm tabular-nums">
                    {formatAppointmentTimeRange(
                      cancelTarget.start_time,
                      cancelTarget.end_time
                    )}
                  </p>
                </div>
                {cancelTarget.services?.name ? (
                  <p className="mt-2 text-gray-600">{cancelTarget.services.name}</p>
                ) : null}
              </div>
            ) : null}
          </DialogHeader>
          <div className="space-y-3 px-1">
            <Label className="text-sm font-medium text-gray-700">
              Reason (optional, kept for your records)
            </Label>
            <select
              value={cancelReasonChoice}
              onChange={(e) => setCancelReasonChoice(e.target.value)}
              disabled={pendingCancel}
              className="block w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus-visible:border-gray-900 focus-visible:ring-1 focus-visible:ring-gray-900 focus-visible:outline-none"
            >
              <option value="">No reason given</option>
              <option value="Client requested">Client requested</option>
              <option value="Client no longer needs">
                Client no longer needs
              </option>
              <option value="Stylist unavailable">Stylist unavailable</option>
              <option value="Salon closure">Salon closure</option>
              <option value="Duplicate booking">Duplicate booking</option>
              <option value="No-show risk">No-show risk</option>
              <option value="other">Other (write below)…</option>
            </select>
            {cancelReasonChoice === "other" ? (
              <Input
                value={cancelReasonOther}
                onChange={(e) =>
                  setCancelReasonOther(e.target.value.slice(0, 200))
                }
                disabled={pendingCancel}
                placeholder="Short reason (max 200 chars)"
                className="border-gray-200 bg-white"
              />
            ) : null}

            {cancelTarget?.series_id ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Recurring booking
                </p>
                <div className="mt-2 space-y-2 text-sm">
                  <label className="flex items-start gap-2">
                    <input
                      type="radio"
                      name="cancel-scope"
                      checked={!cancelScopeFollowing}
                      onChange={() => setCancelScopeFollowing(false)}
                      disabled={pendingCancel}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="font-medium text-gray-900">This booking only</span>
                      <span className="block text-xs text-gray-600">
                        Future bookings in this series stay on the diary.
                      </span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2">
                    <input
                      type="radio"
                      name="cancel-scope"
                      checked={cancelScopeFollowing}
                      onChange={() => setCancelScopeFollowing(true)}
                      disabled={pendingCancel}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="font-medium text-gray-900">
                        This and all following bookings
                      </span>
                      <span className="block text-xs text-gray-600">
                        Cancels every confirmed booking in this series from this date forward.
                      </span>
                    </span>
                  </label>
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={pendingCancel}
              onClick={() => setCancelTarget(null)}
            >
              Keep booking
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pendingCancel}
              className="gap-1.5"
              onClick={executeCancelBooking}
            >
              {pendingCancel ? (
                <>
                  <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
                  Cancelling…
                </>
              ) : cancelScopeFollowing && cancelTarget?.series_id ? (
                "Cancel this and following"
              ) : (
                "Cancel booking"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={rescheduleTarget !== null}
        onOpenChange={(next) => {
          if (!next && !reschedulePending) setRescheduleTarget(null);
        }}
      >
        <DialogContent
          className="border border-gray-200/80 bg-white sm:max-w-md"
          showCloseButton={!reschedulePending}
        >
          <DialogHeader>
            <DialogTitle className="text-gray-900">
              Reschedule booking
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Pick a new date and time. The customer is{" "}
              <span className="font-medium text-gray-900">not</span> notified
              automatically — let them know yourself.
            </DialogDescription>
          </DialogHeader>

          {rescheduleTarget ? (
            <div className="space-y-4">
              <div className="rounded-md border border-gray-200 bg-gray-50/80 px-3 py-2 text-sm">
                <p className="font-medium text-gray-900">
                  {rescheduleTarget.customer_name}
                </p>
                <p className="text-gray-600">
                  {rescheduleTarget.services?.name ?? "Service"} —{" "}
                  {formatAppointmentDateLine(rescheduleTarget.start_time)},{" "}
                  {formatAppointmentTimeRange(
                    rescheduleTarget.start_time,
                    rescheduleTarget.end_time,
                  )}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reschedule-date">Date</Label>
                <Popover
                  open={reschedulePickerOpen}
                  onOpenChange={setReschedulePickerOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start"
                    >
                      <CalendarIcon className="mr-2 size-4" aria-hidden />
                      {rescheduleDate
                        ? format(new Date(rescheduleDate), "PPP")
                        : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={
                        rescheduleDate ? new Date(rescheduleDate) : undefined
                      }
                      onSelect={(d) => {
                        if (!d) return;
                        const ymd = `${d.getFullYear()}-${String(
                          d.getMonth() + 1,
                        ).padStart(2, "0")}-${String(d.getDate()).padStart(
                          2,
                          "0",
                        )}`;
                        setRescheduleDate(ymd);
                        setReschedulePickerOpen(false);
                      }}
                      disabled={(d) =>
                        d <
                        startOfDay(
                          new Date(`${minBookingDateYmd}T00:00:00`),
                        )
                      }
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>New time</Label>
                {rescheduleSlotsLoading ? (
                  <Skeleton className="h-9 w-full" />
                ) : rescheduleSlotsError ? (
                  <p className="text-sm text-red-600">
                    {rescheduleSlotsError}
                  </p>
                ) : rescheduleSlots.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No open slots that day.
                  </p>
                ) : (
                  <ScrollArea className="h-48 rounded-md border border-gray-200">
                    <div className="grid grid-cols-3 gap-1.5 p-2">
                      {rescheduleSlots.map((slot) => {
                        const isActive = slot.startIso === rescheduleSlotIso;
                        return (
                          <button
                            key={slot.startIso}
                            type="button"
                            onClick={() => setRescheduleSlotIso(slot.startIso)}
                            className={cn(
                              "rounded-md border px-2 py-1.5 text-xs font-medium tabular-nums transition-colors",
                              isActive
                                ? "border-gray-900 bg-gray-900 text-white"
                                : "border-gray-200 bg-white text-gray-700 hover:border-gray-400",
                            )}
                          >
                            {format(new Date(slot.startIso), "HH:mm")}
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>

              {rescheduleError ? (
                <p className="text-sm text-red-600" role="alert">
                  {rescheduleError}
                </p>
              ) : null}
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={reschedulePending}
              onClick={() => setRescheduleTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={reschedulePending || !rescheduleSlotIso}
              className="gap-1.5"
              onClick={submitReschedule}
            >
              {reschedulePending ? (
                <>
                  <Loader2
                    className="size-3.5 shrink-0 animate-spin"
                    aria-hidden
                  />
                  Saving…
                </>
              ) : (
                "Move booking"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="max-h-[min(90vh,720px)] gap-0 overflow-hidden border-gray-200/90 bg-white p-0 shadow-xl sm:max-w-lg"
          showCloseButton
        >
          <div className="border-b border-gray-100 bg-gradient-to-b from-gray-50/80 to-white px-6 pt-6 pb-5">
            <DialogHeader className="gap-1 text-left sm:text-left">
              <div className="flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-lg bg-gray-900 text-white shadow-sm">
                  <CalendarPlus className="size-4" aria-hidden />
                </span>
                <DialogTitle className="text-lg font-semibold tracking-tight text-gray-900">
                  New booking
                </DialogTitle>
              </div>
              <DialogDescription className="pl-11 text-sm leading-relaxed text-gray-500">
                Only open slots are shown. SMS sends when Twilio is configured;
                add their email below if you want them to get a confirmation in their inbox too.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[min(60vh,520px)] overflow-y-auto px-6 py-5">
            <div className="space-y-6">
              <div>
                <p className="mb-3 text-xs font-semibold tracking-wider text-gray-400 uppercase">
                  Customer
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label
                      htmlFor="bk-name"
                      className="flex items-center gap-1.5 text-sm font-medium text-gray-700"
                    >
                      <User className="size-3.5 text-gray-400" aria-hidden />
                      Name
                    </Label>
                    <Input
                      id="bk-name"
                      className={newBookingFieldClass}
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      autoComplete="name"
                      placeholder="Full name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="bk-phone"
                      className="flex items-center gap-1.5 text-sm font-medium text-gray-700"
                    >
                      <Phone className="size-3.5 text-gray-400" aria-hidden />
                      Phone
                    </Label>
                    <Input
                      id="bk-phone"
                      className={newBookingFieldClass}
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      autoComplete="tel"
                      placeholder="+353 87 123 4567"
                    />
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <Label
                    htmlFor="bk-email"
                    className="flex items-center gap-1.5 text-sm font-medium text-gray-700"
                  >
                    <Mail className="size-3.5 text-gray-400" aria-hidden />
                    Email <span className="font-normal text-gray-400">(optional)</span>
                  </Label>
                  <Input
                    id="bk-email"
                    className={newBookingFieldClass}
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    autoComplete="email"
                    placeholder="client@example.com"
                  />
                </div>
              </div>

              <div>
                <p className="mb-3 text-xs font-semibold tracking-wider text-gray-400 uppercase">
                  Service
                </p>
                <div className="space-y-2">
                  <Label
                    htmlFor="bk-service"
                    className="flex items-center gap-1.5 text-sm font-medium text-gray-700"
                  >
                    <Scissors className="size-3.5 text-gray-400" aria-hidden />
                    What they&apos;re booking
                  </Label>
                  <div className="relative">
                    <select
                      id="bk-service"
                      className={newBookingSelectClass}
                      value={serviceId}
                      onChange={(e) => {
                        setServiceId(e.target.value);
                        setSlotIso("");
                      }}
                    >
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} · {s.duration_minutes} min ·{" "}
                          {formatEur(s.price)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-gray-400"
                      aria-hidden
                    />
                  </div>
                  {availableAddons.length > 0 ? (
                    <div className="mt-3 rounded-lg border border-gray-200 bg-white/60 p-3">
                      <p className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
                        Add-ons
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        Each add-on extends the booking length and the total price.
                      </p>
                      <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {availableAddons.map((a) => {
                          const checked = selectedAddonIds.includes(a.id);
                          return (
                            <label
                              key={a.id}
                              className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm ${
                                checked
                                  ? "border-gray-900 bg-gray-50"
                                  : "border-gray-200 bg-white"
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="size-4 rounded border-gray-300"
                                checked={checked}
                                onChange={(e) => {
                                  setSelectedAddonIds((prev) => {
                                    if (e.target.checked) {
                                      return prev.includes(a.id)
                                        ? prev
                                        : [...prev, a.id];
                                    }
                                    return prev.filter((x) => x !== a.id);
                                  });
                                  setSlotIso("");
                                }}
                              />
                              <span className="min-w-0 flex-1 truncate font-medium text-gray-900">
                                {a.name}
                              </span>
                              <span className="shrink-0 text-xs tabular-nums text-gray-600">
                                {a.durationMinutes > 0
                                  ? `+${a.durationMinutes}m`
                                  : ""}
                                {a.priceCents > 0
                                  ? `${a.durationMinutes > 0 ? " · " : ""}+${formatEur(a.priceCents / 100)}`
                                  : ""}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-xl border border-gray-200/90 bg-gray-50/50 p-4 shadow-inner">
                <p className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wider text-gray-500 uppercase">
                  <CalendarDays className="size-3.5" aria-hidden />
                  Date &amp; time
                </p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="bk-date-trigger"
                      className="text-sm font-medium text-gray-700"
                    >
                      Date
                    </Label>
                    <Popover
                      modal={false}
                      open={datePickerOpen}
                      onOpenChange={setDatePickerOpen}
                    >
                      <PopoverTrigger
                        id="bk-date-trigger"
                        type="button"
                        className={cn(
                          newBookingFieldClass,
                          "flex w-full items-center justify-between gap-2 font-normal",
                        )}
                      >
                        <span
                          className={cn(
                            "min-w-0 truncate",
                            date ? "text-gray-900" : "text-gray-400",
                          )}
                        >
                          {date
                            ? formatBookingDateButton(date)
                            : "Select a date"}
                        </span>
                        <CalendarDays
                          className="size-4 shrink-0 text-gray-400"
                          aria-hidden
                        />
                      </PopoverTrigger>
                      <PopoverContent
                        align="start"
                        className="w-auto border-gray-200 p-2 shadow-xl"
                        side="bottom"
                        sideOffset={8}
                      >
                        <Calendar
                          mode="single"
                          selected={date ? parseYmdLocal(date) : undefined}
                          onSelect={(d) => {
                            if (d) {
                              setDate(format(d, "yyyy-MM-dd"));
                              setSlotIso("");
                              setDatePickerOpen(false);
                            }
                          }}
                          defaultMonth={
                            date
                              ? parseYmdLocal(date)
                              : parseYmdLocal(minBookingDateYmd)
                          }
                          disabled={{
                            before: startOfDay(parseYmdLocal(minBookingDateYmd)),
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    {date ? (
                      <p className="text-xs text-gray-500">
                        {formatPickerDateHeading(date)}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-end justify-between gap-2">
                        <Label
                          className="flex items-center gap-1.5 text-sm font-medium text-gray-700"
                          id="bk-slot-label"
                        >
                          <Clock className="size-3.5 text-gray-400" aria-hidden />
                          Available times
                        </Label>
                        {availableSlots.length > 1 ? (
                          <span className="text-xs text-gray-400">
                            Scroll the list — {availableSlots.length} slots
                          </span>
                        ) : null}
                      </div>
                    {slotsLoading ? (
                      <div
                        className="grid grid-cols-4 gap-1.5 sm:grid-cols-5 md:grid-cols-6"
                        aria-labelledby="bk-slot-label"
                        aria-live="polite"
                      >
                        {Array.from({ length: 12 }).map((_, i) => (
                          <Skeleton
                            key={i}
                            className="h-8 rounded-md bg-gray-200/80"
                          />
                        ))}
                      </div>
                    ) : availableSlots.length > 0 ? (
                      <ScrollArea
                        className="h-36 rounded-xl border border-gray-200/80 bg-white p-1.5 shadow-sm sm:h-40"
                        aria-labelledby="bk-slot-label"
                      >
                        <div
                          className="grid grid-cols-4 gap-1.5 pr-2 sm:grid-cols-5 md:grid-cols-6"
                          role="listbox"
                          aria-label="Available start times"
                        >
                          {availableSlots.map((s) => {
                            const selected = slotIso === s.startIso;
                            return (
                              <button
                                key={s.startIso}
                                type="button"
                                role="option"
                                aria-selected={selected}
                                onClick={() => setSlotIso(s.startIso)}
                                className={cn(
                                  "min-w-0 rounded-md border px-1.5 py-1.5 text-center text-xs leading-tight font-medium tabular-nums transition-colors sm:px-2 sm:text-[13px]",
                                  selected
                                    ? "border-gray-900 bg-gray-900 text-white shadow-sm"
                                    : "border-gray-200 bg-white text-gray-900 hover:border-gray-400 hover:bg-gray-50",
                                )}
                              >
                                {formatSlotTimeButton(s.startIso)}
                              </button>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    ) : null}
                    </div>

                    {slotsError ? (
                      <div
                        className="flex gap-2 rounded-lg border border-red-200 bg-red-50/80 px-3 py-2.5 text-sm text-red-800"
                        role="alert"
                      >
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                        {slotsError}
                      </div>
                    ) : null}

                    {!slotsLoading &&
                    !slotsError &&
                    date &&
                    availableSlots.length === 0 ? (
                      <div className="flex gap-3 rounded-xl border border-dashed border-amber-200/90 bg-amber-50/50 px-4 py-3 text-sm text-amber-950">
                        <CalendarX
                          className="mt-0.5 size-5 shrink-0 text-amber-700/80"
                          aria-hidden
                        />
                        <div className="min-w-0 space-y-1">
                          <p className="font-medium text-amber-950">
                            No openings on this day
                          </p>
                          <p className="text-pretty text-amber-900/85">
                            Try another date, or check{" "}
                            <Link
                              href="/dashboard/settings"
                              className="font-semibold text-amber-950 underline decoration-amber-700/40 underline-offset-2 hover:decoration-amber-950"
                            >
                              business hours
                            </Link>{" "}
                            if this should be open.
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">Repeat booking</p>
                    <p className="text-xs text-gray-600">
                      Create a recurring series. The first booking confirmation is
                      sent; the rest are added silently to the diary.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={repeatEnabled}
                      onChange={(e) => setRepeatEnabled(e.target.checked)}
                      className="size-4 rounded border-gray-300"
                    />
                    <span>{repeatEnabled ? "On" : "Off"}</span>
                  </label>
                </div>
                {repeatEnabled ? (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-700">Frequency</label>
                      <select
                        value={repeatFrequency}
                        onChange={(e) =>
                          setRepeatFrequency(
                            e.target.value as "weekly" | "fortnightly" | "monthly",
                          )
                        }
                        className="h-10 w-full rounded-md border border-gray-200 bg-white px-2 text-sm"
                      >
                        <option value="weekly">Weekly</option>
                        <option value="fortnightly">Every 2 weeks</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-700">
                        Number of bookings
                      </label>
                      <input
                        type="number"
                        min={2}
                        max={26}
                        value={repeatCount}
                        onChange={(e) =>
                          setRepeatCount(parseInt(e.target.value || "0", 10) || 0)
                        }
                        className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm"
                      />
                      <p className="text-[11px] text-gray-500">
                        Includes the first booking. Max 26.
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>

              {formError ? (
                <div
                  className="flex gap-2 rounded-lg border border-red-200 bg-red-50/80 px-3 py-2.5 text-sm text-red-800"
                  role="alert"
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  {formError}
                </div>
              ) : null}
            </div>
          </div>

          <DialogFooter className="mx-0 mb-0 gap-3 border-t border-gray-200 bg-gray-50/90 px-6 py-4 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="h-11 border-gray-200 bg-white px-5"
              onClick={() => handleOpenChange(false)}
              disabled={pendingCreate}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="h-11 gap-2 px-6"
              disabled={
                pendingCreate ||
                slotsLoading ||
                !!slotsError ||
                !slotIso ||
                availableSlots.length === 0
              }
              onClick={() => submit()}
            >
              {pendingCreate ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : repeatEnabled ? (
                `Create ${Math.max(2, Math.min(26, repeatCount || 0))} bookings`
              ) : (
                "Confirm booking"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
