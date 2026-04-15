"use client";

import { format, startOfDay } from "date-fns";
import Link from "next/link";
import type { MouseEvent } from "react";
import {
  useCallback,
  useEffect,
  useState,
  useTransition,
} from "react";
import {
  AlertTriangle,
  CalendarDays,
  CalendarPlus,
  CalendarX,
  ChevronDown,
  Clock,
  FileText,
  Loader2,
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
  getBookingCallContext,
  getDashboardBookingSlots,
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
  /** 24h reminder SMS (Twilio cron); null if not sent. */
  reminder_sent_at: string | null;
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
            ? "bg-gray-400"
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
  /** Salon calendar “today” (Europe/Dublin by default) for min date + default picker. */
  minBookingDateYmd: string;
};

export function BookingsView({
  appointments,
  services,
  minBookingDateYmd,
}: BookingsViewProps) {
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
  const [formError, setFormError] = useState<string | null>(null);
  const [bookingSmsNotice, setBookingSmsNotice] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [slotIso, setSlotIso] = useState("");
  const [availableSlots, setAvailableSlots] = useState<DashboardBookingSlot[]>(
    []
  );
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const resetForm = useCallback(() => {
    setCustomerName("");
    setCustomerPhone("");
    setServiceId(services[0]?.id ?? "");
    setDate("");
    setSlotIso("");
    setAvailableSlots([]);
    setSlotsError(null);
    setFormError(null);
    setDatePickerOpen(false);
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
    if (!open || !date || !serviceId) {
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSlotsLoading(true);
      setSlotsError(null);
      void getDashboardBookingSlots({ dateYmd: date, serviceId }).then(
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
  }, [open, date, serviceId]);

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
      const result = await createAppointment({
        customerName,
        customerPhone,
        serviceId,
        startTimeIso: slotIso,
      });
      if (!result.ok) {
        setFormError(result.message);
        return;
      }
      setBookingSmsNotice(result.confirmationSmsFailed ?? null);
      setOpen(false);
      resetForm();
    });
  }, [
    customerName,
    customerPhone,
    serviceId,
    date,
    slotIso,
    resetForm,
  ]);

  const openCancelDialog = useCallback((row: AppointmentListRow) => {
    if (row.status.toLowerCase() !== "confirmed") return;
    setCancelError(null);
    setCancelTarget(row);
  }, []);

  const executeCancelBooking = useCallback(() => {
    if (!cancelTarget) return;
    const id = cancelTarget.id;
    startCancelTransition(async () => {
      const result = await cancelAppointment(id);
      setCancelTarget(null);
      if (!result.ok) {
        setCancelError(result.message);
      }
    });
  }, [cancelTarget]);

  const onCancelDialogOpenChange = useCallback(
    (next: boolean) => {
      if (!next && !pendingCancel) {
        setCancelTarget(null);
      }
    },
    [pendingCancel]
  );

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

      {bookingSmsNotice ? (
        <Alert
          className="mb-4 border-amber-200/80 bg-amber-50/80 text-amber-950 [&>svg]:text-amber-700"
          role="alert"
        >
          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
          <div className="min-w-0">
            <AlertTitle>Booking saved — confirmation SMS not sent</AlertTitle>
            <AlertDescription className="text-amber-900/90">
              {bookingSmsNotice}
            </AlertDescription>
            <button
              type="button"
              className="mt-2 text-xs font-medium text-amber-900 underline-offset-2 hover:underline"
              onClick={() => setBookingSmsNotice(null)}
            >
              Dismiss
            </button>
          </div>
        </Alert>
      ) : null}

      {appointments.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white py-12 text-center text-sm text-gray-500 shadow-sm">
          No upcoming appointments. Add one with New booking.
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
                  {appointments.map((row) => (
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
                        <StatusPill status={row.status} />
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
            {appointments.map((row) => (
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
                  <p className="text-xs text-gray-400">Tap for notes, call &amp; texts</p>
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
                </div>

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
                    Text messages
                  </h3>
                  <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
                    <div className="flex items-center justify-between gap-4 px-3 py-2.5">
                      <span className="text-sm text-gray-600">Confirmation</span>
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
                      <span className="text-sm text-gray-600">Reminder</span>
                      {detailRow.reminder_sent_at ? (
                        <span className="text-sm font-medium text-gray-900 tabular-nums">
                          Sent {formatDetailTimestamp(detailRow.reminder_sent_at)}
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
              ) : (
                "Cancel booking"
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
                Only open slots are shown. SMS confirmation sends when Twilio is
                set up.
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
