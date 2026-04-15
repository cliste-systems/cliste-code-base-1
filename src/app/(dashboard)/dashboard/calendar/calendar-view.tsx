"use client";

import Link from "next/link";
import {
  useCallback,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CalendarAppointment } from "@/lib/calendar-appointment";
import {
  UNASSIGNED_STAFF_ID,
  initialsFromName,
  type CalendarStaffMember,
} from "@/lib/calendar-staff";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Wand2,
} from "lucide-react";

const START_HOUR = 9;
const END_HOUR = 18;
const HOUR_REM = 8;
/** Matches Aura mock: one hour = 8rem; appointments positioned by minute within the hour. */

type Clock = { h: number; m: number };

type Variant = "indigo" | "amber" | "slate" | "red";

type DayBlock = {
  id: string;
  columnId: string;
  start: Clock;
  end: Clock;
  service: string;
  client: string;
  variant: Variant;
  showAiBadge: boolean;
  dimmed: boolean;
  cancelled: boolean;
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return startOfDay(x);
}

function formatDayHeading(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTimeLabel24(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function minutesFromGridStart(h: number, m: number): number {
  return (h - START_HOUR) * 60 + m;
}

function slotStyle(start: Clock, end: Clock) {
  const startMin = minutesFromGridStart(start.h, start.m);
  const endMin = minutesFromGridStart(end.h, end.m);
  const topRem = (startMin / 60) * HOUR_REM;
  const heightRem = ((endMin - startMin) / 60) * HOUR_REM;
  return {
    top: `${topRem}rem`,
    height: `${Math.max(heightRem, 1.25)}rem`,
  };
}

function formatRange24(start: Clock, end: Clock): string {
  return `${formatTimeLabel24(start.h, start.m)} - ${formatTimeLabel24(end.h, end.m)}`;
}

function formatDurationShort(start: Clock, end: Clock): string {
  const a = minutesFromGridStart(start.h, start.m);
  const b = minutesFromGridStart(end.h, end.m);
  const mins = b - a;
  const h = mins / 60;
  if (mins <= 0) return "";
  if (h < 1) return `${mins}m`;
  const rounded = Math.round(h * 2) / 2;
  if (rounded % 1 === 0) return `${rounded}h`;
  return `${rounded}h`;
}

function sameLocalCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toClock(d: Date): Clock {
  return { h: d.getHours(), m: d.getMinutes() };
}

function clipToDayGrid(
  start: Date,
  end: Date,
  day: Date,
): { start: Clock; end: Clock } | null {
  const day0 = startOfDay(day);
  const next = addDays(day0, 1);
  if (end.getTime() <= day0.getTime() || start.getTime() >= next.getTime()) {
    return null;
  }

  const winStart = new Date(day0);
  winStart.setHours(START_HOUR, 0, 0, 0);
  const winEnd = new Date(day0);
  winEnd.setHours(END_HOUR, 0, 0, 0);

  const clippedStart = new Date(Math.max(start.getTime(), winStart.getTime()));
  const clippedEnd = new Date(Math.min(end.getTime(), winEnd.getTime()));
  if (clippedEnd.getTime() <= clippedStart.getTime()) return null;

  return { start: toClock(clippedStart), end: toClock(clippedEnd) };
}

function variantForAppointment(
  source: CalendarAppointment["source"],
  cancelled: boolean,
): Variant {
  if (cancelled) return "red";
  switch (source) {
    case "ai_call":
      return "indigo";
    case "booking_link":
      return "amber";
    default:
      return "slate";
  }
}

function toMonthInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

function applyMonthYearKeepingDay(
  prev: Date,
  year: number,
  monthIndex: number,
): Date {
  const day = prev.getDate();
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return startOfDay(new Date(year, monthIndex, Math.min(day, lastDay)));
}

function columnIdForAppointment(
  appt: CalendarAppointment,
  staffIdSet: Set<string>,
): string {
  if (!appt.staff_id) return UNASSIGNED_STAFF_ID;
  if (staffIdSet.has(appt.staff_id)) return appt.staff_id;
  return UNASSIGNED_STAFF_ID;
}

function staffLabelForColumn(
  columnId: string,
  staffMembers: CalendarStaffMember[],
): string {
  if (columnId === UNASSIGNED_STAFF_ID) return "Unassigned";
  return staffMembers.find((s) => s.id === columnId)?.name ?? "Staff";
}

const VARIANT_DESKTOP: Record<
  Variant,
  {
    border: string;
    bg: string;
    title: string;
    time: string;
    client: string;
    badge: string;
    avatar: string;
  }
> = {
  indigo: {
    border: "border-indigo-500",
    bg: "bg-indigo-50",
    title: "text-indigo-900",
    time: "text-indigo-600",
    client: "text-indigo-800",
    badge: "border-indigo-100 text-indigo-700",
    avatar: "bg-indigo-200 text-indigo-800",
  },
  amber: {
    border: "border-amber-500",
    bg: "bg-amber-50",
    title: "text-amber-900",
    time: "text-amber-600",
    client: "text-amber-800",
    badge: "border-amber-100 text-amber-700",
    avatar: "bg-amber-200 text-amber-800",
  },
  slate: {
    border: "border-slate-500",
    bg: "bg-slate-50",
    title: "text-slate-900",
    time: "text-slate-600",
    client: "text-slate-800",
    badge: "border-slate-200 text-slate-700",
    avatar: "bg-slate-200 text-slate-800",
  },
  red: {
    border: "border-red-500",
    bg: "bg-red-50",
    title: "text-red-950",
    time: "text-red-700",
    client: "text-red-900",
    badge: "border-red-200 text-red-800",
    avatar: "bg-red-200 text-red-900",
  },
};

type CalendarViewProps = {
  appointments: CalendarAppointment[];
  staffMembers: CalendarStaffMember[];
};

export function CalendarView({
  appointments,
  staffMembers,
}: CalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [mobileStaffFilter, setMobileStaffFilter] = useState<string>("all");

  const onMonthYearChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      if (!v || !/^\d{4}-\d{2}$/.test(v)) return;
      const [ys, ms] = v.split("-");
      const year = parseInt(ys, 10);
      const monthIndex = parseInt(ms, 10) - 1;
      if (Number.isNaN(year) || Number.isNaN(monthIndex)) return;
      setSelectedDate((d) => applyMonthYearKeepingDay(d, year, monthIndex));
    },
    [],
  );

  const hourCount = END_HOUR - START_HOUR;
  const gridBodyHeight = `${hourCount * HOUR_REM}rem`;

  const hours = useMemo(() => {
    const list: number[] = [];
    for (let h = START_HOUR; h < END_HOUR; h++) list.push(h);
    return list;
  }, []);

  const staffIdSet = useMemo(
    () => new Set(staffMembers.map((s) => s.id)),
    [staffMembers],
  );

  const dayBlocks = useMemo(() => {
    const out: DayBlock[] = [];

    for (const appt of appointments) {
      const start = new Date(appt.start_time);
      const end = new Date(appt.end_time);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;

      if (!sameLocalCalendarDay(start, selectedDate)) continue;

      const clip = clipToDayGrid(start, end, selectedDate);
      if (!clip) continue;

      const cancelled = appt.status === "cancelled";
      const columnId = columnIdForAppointment(appt, staffIdSet);

      out.push({
        id: appt.id,
        columnId,
        start: clip.start,
        end: clip.end,
        service: appt.service_name,
        client: appt.customer_name,
        variant: variantForAppointment(appt.source, cancelled),
        showAiBadge: appt.source === "ai_call" && !cancelled,
        dimmed: appt.status === "completed" || cancelled,
        cancelled,
      });
    }

    out.sort(
      (a, b) =>
        minutesFromGridStart(a.start.h, a.start.m) -
        minutesFromGridStart(b.start.h, b.start.m),
    );
    return out;
  }, [appointments, selectedDate, staffIdSet]);

  const showUnassignedColumn = useMemo(() => {
    return dayBlocks.some((b) => b.columnId === UNASSIGNED_STAFF_ID);
  }, [dayBlocks]);

  const columnIds = useMemo(() => {
    const base = staffMembers.map((s) => s.id);
    if (showUnassignedColumn) return [UNASSIGNED_STAFF_ID, ...base];
    return base;
  }, [staffMembers, showUnassignedColumn]);

  const isToday = useMemo(() => {
    const t = startOfDay(new Date());
    return selectedDate.getTime() === t.getTime();
  }, [selectedDate]);

  const goToday = useCallback(() => {
    setSelectedDate(startOfDay(new Date()));
  }, []);

  const goPrev = useCallback(() => {
    setSelectedDate((d) => addDays(d, -1));
  }, []);

  const goNext = useCallback(() => {
    setSelectedDate((d) => addDays(d, 1));
  }, []);

  const mobileFilteredBlocks = useMemo(() => {
    if (mobileStaffFilter === "all") return dayBlocks;
    return dayBlocks.filter((b) => b.columnId === mobileStaffFilter);
  }, [dayBlocks, mobileStaffFilter]);

  const mobileListBlocks = useMemo(() => {
    return [...dayBlocks].sort(
      (a, b) =>
        minutesFromGridStart(a.start.h, a.start.m) -
        minutesFromGridStart(b.start.h, b.start.m),
    );
  }, [dayBlocks]);

  const morningBlocks = useMemo(
    () => mobileListBlocks.filter((b) => b.start.h < 12),
    [mobileListBlocks],
  );
  const afternoonBlocks = useMemo(
    () => mobileListBlocks.filter((b) => b.start.h >= 12),
    [mobileListBlocks],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden antialiased">
      {/* Toolbar — Aura */}
      <div className="shrink-0 border-b border-gray-200 bg-white px-4 py-3 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50 p-0.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <button
                  type="button"
                  onClick={goPrev}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-all hover:bg-white hover:text-gray-900 hover:shadow-sm"
                  aria-label="Previous day"
                >
                  <ChevronLeft className="size-[18px]" strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  onClick={goToday}
                  className={cn(
                    "px-3 text-sm font-medium transition-colors",
                    isToday ? "text-gray-900" : "text-gray-900 hover:text-gray-600",
                  )}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-all hover:bg-white hover:text-gray-900 hover:shadow-sm"
                  aria-label="Next day"
                >
                  <ChevronRight className="size-[18px]" strokeWidth={1.5} />
                </button>
              </div>
              <h2 className="flex items-center gap-2 text-lg font-medium tracking-tight text-gray-900">
                <CalendarDays
                  className="size-5 shrink-0 text-gray-400"
                  strokeWidth={1.5}
                  aria-hidden
                />
                {formatDayHeading(selectedDate)}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="calendar-month-year" className="sr-only">
                Month
              </Label>
              <Input
                id="calendar-month-year"
                type="month"
                value={toMonthInputValue(selectedDate)}
                onChange={onMonthYearChange}
                className="h-9 w-full max-w-[11rem] rounded-lg border-gray-200 bg-white text-sm shadow-sm sm:w-[11rem]"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative md:hidden">
              <Label htmlFor="cal-staff-mobile" className="sr-only">
                Staff view
              </Label>
              <select
                id="cal-staff-mobile"
                value={mobileStaffFilter}
                onChange={(e) => setMobileStaffFilter(e.target.value)}
                className="flex h-9 w-40 items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1"
              >
                <option value="all">All staff</option>
                {showUnassignedColumn ? (
                  <option value={UNASSIGNED_STAFF_ID}>Unassigned</option>
                ) : null}
                {staffMembers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <Link
              href="/dashboard/bookings"
              className="hidden items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800 md:inline-flex"
            >
              <Plus className="size-[18px]" strokeWidth={2} aria-hidden />
              New appointment
            </Link>
          </div>
        </div>
      </div>

      {/* Calendar body — keep white; grey page bg was showing through gaps and the header filler */}
      <div className="relative min-h-0 flex-1 overflow-auto bg-white calendar-day-scroll">
        {/* Desktop — resource grid */}
        <div className="hidden min-h-full md:block">
          <div className="relative w-max min-w-full bg-white shadow-sm">
            {/* Sticky header */}
            <div className="sticky top-0 z-40 flex w-max min-w-full border-b border-gray-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <div
                className="sticky left-0 z-50 w-20 shrink-0 self-stretch border-r border-gray-200 bg-white shadow-[1px_0_2px_rgba(0,0,0,0.02)]"
                aria-hidden
              />
              <div className="flex min-w-0 flex-1 bg-white">
                {columnIds.map((cid) => {
                  const member = staffMembers.find((s) => s.id === cid);
                  const label =
                    cid === UNASSIGNED_STAFF_ID
                      ? "Unassigned"
                      : member?.name ?? "Staff";
                  const initials =
                    cid === UNASSIGNED_STAFF_ID
                      ? "?"
                      : initialsFromName(label);
                  return (
                    <div
                      key={cid}
                      className="flex w-[240px] shrink-0 cursor-pointer flex-col items-center justify-center gap-1.5 border-r border-gray-200 py-3 transition-colors hover:bg-gray-50"
                    >
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-gray-100 text-sm font-medium text-gray-600 shadow-sm"
                        aria-hidden
                      >
                        {initials.length <= 2 ? initials : initials.slice(0, 2)}
                      </div>
                      <span className="text-[13px] font-medium tracking-tight text-gray-900">
                        {label.length > 18
                          ? `${label.slice(0, 16)}…`
                          : label}
                      </span>
                    </div>
                  );
                })}
                <div className="min-h-[4.5rem] min-w-[40px] flex-1 bg-white" aria-hidden />
              </div>
            </div>

            {/* Grid body */}
            <div className="relative flex w-max min-w-full bg-white">
              {/* Time axis */}
              <div className="sticky left-0 z-30 w-20 shrink-0 border-r border-gray-200 bg-white text-xs font-medium text-gray-400 shadow-[1px_0_2px_rgba(0,0,0,0.02)]">
                {hours.map((h, i) => (
                  <div
                    key={h}
                    className={cn(
                      "relative h-32 border-b border-gray-100",
                      i === hours.length - 1 && "border-b-0",
                    )}
                  >
                    <span className="absolute -top-2.5 right-3 z-10 bg-white px-1">
                      {formatTimeLabel24(h, 0)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Staff columns */}
              <div className="relative flex min-w-0 flex-1 bg-white">
                {/* Hour lines */}
                <div
                  className="pointer-events-none absolute inset-0 z-0 flex flex-col"
                  aria-hidden
                >
                  {hours.map((h, i) => (
                    <div
                      key={`grid-${h}`}
                      className={cn(
                        "h-32 border-b border-gray-100/50",
                        i === hours.length - 1 && "border-b-0",
                      )}
                    />
                  ))}
                </div>

                {columnIds.map((cid) => (
                  <div
                    key={cid}
                    className="group/col relative z-10 w-[240px] shrink-0 cursor-crosshair border-r border-gray-200"
                  >
                    <div className="pointer-events-none absolute inset-y-0 left-0 right-0 hidden bg-gray-50/30 group-hover/col:block" />
                    <div
                      className="pointer-events-none absolute top-0 right-0 left-0"
                      style={{ height: gridBodyHeight }}
                    >
                      {dayBlocks
                        .filter((b) => b.columnId === cid)
                        .map((appt) => (
                          <DesktopAppointmentBlock
                            key={appt.id}
                            appt={appt}
                          />
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile — list + FAB */}
        <div className="flex min-h-full flex-col gap-4 bg-white p-4 md:hidden">
          {mobileStaffFilter === "all" ? (
            <>
              {morningBlocks.length > 0 ? (
                <>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Morning
                    </span>
                    <div className="h-px flex-1 bg-gray-100" />
                  </div>
                  {morningBlocks.map((block) => (
                    <MobileAppointmentRow
                      key={block.id}
                      block={block}
                      staffLabel={staffLabelForColumn(
                        block.columnId,
                        staffMembers,
                      )}
                    />
                  ))}
                </>
              ) : null}
              {afternoonBlocks.length > 0 ? (
                <>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Afternoon
                    </span>
                    <div className="h-px flex-1 bg-gray-100" />
                  </div>
                  {afternoonBlocks.map((block) => (
                    <MobileAppointmentRow
                      key={block.id}
                      block={block}
                      staffLabel={staffLabelForColumn(
                        block.columnId,
                        staffMembers,
                      )}
                    />
                  ))}
                </>
              ) : null}
              {mobileListBlocks.length === 0 ? <EmptyDayMessage /> : null}
            </>
          ) : (
            <div className="relative pb-20">
              {mobileFilteredBlocks.length === 0 ? (
                <EmptyDayMessage />
              ) : (
                <SingleDayColumn
                  blocks={mobileFilteredBlocks}
                  hours={hours}
                  gridBodyHeight={gridBodyHeight}
                />
              )}
            </div>
          )}

          <div className="fixed bottom-6 right-6 z-50 md:hidden">
            <Link
              href="/dashboard/bookings"
              className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-900 text-white shadow-lg shadow-gray-900/20 transition-colors hover:bg-gray-800 focus:outline-none focus:ring-4 focus:ring-gray-900/20"
              aria-label="New appointment"
            >
              <Plus className="size-7" strokeWidth={2} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function DesktopAppointmentBlock({ appt }: { appt: DayBlock }) {
  const pos = slotStyle(appt.start, appt.end);
  const v = VARIANT_DESKTOP[appt.variant];

  return (
    <div
      className={cn(
        "pointer-events-auto absolute left-1 right-1.5 overflow-hidden rounded-r-lg border-l-[3px] p-2.5 shadow-[0_2px_4px_rgba(0,0,0,0.02)] transition-shadow hover:shadow-md",
        v.border,
        v.bg,
        appt.dimmed && "opacity-70",
        appt.cancelled && "opacity-80",
      )}
      style={{
        top: pos.top,
        height: pos.height,
      }}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <span
          className={cn(
            "text-[13px] font-semibold leading-tight tracking-tight",
            v.title,
            appt.cancelled && "line-through decoration-red-800/50",
          )}
        >
          {appt.service}
        </span>
        {appt.showAiBadge ? (
          <span
            className={cn(
              "flex shrink-0 items-center gap-0.5 rounded border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider shadow-sm",
              v.badge,
            )}
          >
            <Wand2 className="size-3" strokeWidth={1.5} aria-hidden />
            AI
          </span>
        ) : null}
      </div>
      <div
        className={cn(
          "mb-1 flex items-center gap-1 text-[11px] font-medium",
          v.time,
        )}
      >
        <Clock className="size-3.5 shrink-0" strokeWidth={1.5} aria-hidden />
        {formatRange24(appt.start, appt.end)}
      </div>
      <div className={cn("flex items-center gap-1.5 text-[12px] font-medium", v.client)}>
        <div
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px]",
            v.avatar,
          )}
        >
          {initialsFromName(appt.client).slice(0, 2)}
        </div>
        <span className={cn(appt.cancelled && "line-through")}>{appt.client}</span>
      </div>
    </div>
  );
}

function MobileAppointmentRow({
  block,
  staffLabel,
}: {
  block: DayBlock;
  staffLabel: string;
}) {
  const v = VARIANT_DESKTOP[block.variant];
  const dur = formatDurationShort(block.start, block.end);

  return (
    <div className="relative flex gap-3">
      <div className="mt-0.5 w-14 shrink-0 text-right text-sm font-medium text-gray-900 tabular-nums">
        {formatTimeLabel24(block.start.h, block.start.m)}
      </div>
      <div
        className={cn(
          "flex-1 rounded-r-lg border border-l-[3px] p-3 shadow-sm",
          v.border,
          v.bg,
          block.dimmed && "opacity-75",
        )}
      >
        <div className="mb-1 flex items-start justify-between gap-2">
          <h4
            className={cn(
              "text-sm font-semibold leading-tight",
              v.title,
              block.cancelled && "line-through",
            )}
          >
            {block.service}
          </h4>
          <div className="flex shrink-0 items-center gap-1.5">
            {block.showAiBadge ? (
              <span
                className={cn(
                  "flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                  v.badge,
                )}
              >
                <Wand2 className="size-3" strokeWidth={1.5} aria-hidden />
                AI
              </span>
            ) : null}
            {dur ? (
              <span className={cn("text-xs font-medium", v.time)}>{dur}</span>
            ) : null}
          </div>
        </div>
        <div className={cn("flex flex-wrap items-center gap-2 text-xs font-medium", v.client)}>
          <div
            className={cn(
              "flex h-4 w-4 items-center justify-center rounded-full text-[8px]",
              v.avatar,
            )}
          >
            {initialsFromName(staffLabel).slice(0, 2)}
          </div>
          <span>
            {staffLabel} •{" "}
            <span className="font-normal text-gray-700">{block.client}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function EmptyDayMessage() {
  return (
    <p className="py-8 text-center text-sm text-gray-500">
      No appointments on this day. Add one under Bookings or when your AI agent
      confirms a slot, it will appear here.
    </p>
  );
}

function SingleDayColumn({
  blocks,
  hours,
  gridBodyHeight,
}: {
  blocks: DayBlock[];
  hours: number[];
  gridBodyHeight: string;
}) {
  if (blocks.length === 0) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center px-4">
        <EmptyDayMessage />
      </div>
    );
  }
  return (
    <div className="relative min-h-[28rem]">
      <div className="pointer-events-none flex flex-col pl-14" aria-hidden>
        {hours.map((h, i) => (
          <div
            key={`mgrid-${h}`}
            className={cn(
              "h-32 border-b border-gray-100/50",
              i === hours.length - 1 && "border-b-0",
            )}
          />
        ))}
      </div>
      <div
        className="pointer-events-none absolute top-0 right-0 left-14"
        style={{ height: gridBodyHeight }}
      >
        {blocks.map((appt) => (
          <MobileDayBlock key={appt.id} appt={appt} />
        ))}
      </div>
      <div className="absolute top-0 bottom-0 left-0 w-12 border-r border-gray-200 bg-white">
        {hours.map((h) => (
          <div
            key={`ml-${h}`}
            className="flex h-32 items-start justify-end border-b border-gray-100 pr-1 pt-1 text-[11px] font-medium text-gray-400"
          >
            {formatTimeLabel24(h, 0)}
          </div>
        ))}
      </div>
    </div>
  );
}

function MobileDayBlock({ appt }: { appt: DayBlock }) {
  const pos = slotStyle(appt.start, appt.end);
  const v = VARIANT_DESKTOP[appt.variant];

  return (
    <div
      className={cn(
        "pointer-events-auto absolute left-0 right-0 overflow-hidden rounded-r-lg border-l-[3px] px-2 py-1.5 shadow-sm",
        v.border,
        v.bg,
        appt.dimmed && "opacity-70",
      )}
      style={{
        top: pos.top,
        height: pos.height,
        minHeight: "2rem",
      }}
    >
      <p className={cn("text-[11px] font-medium tabular-nums", v.time)}>
        {formatRange24(appt.start, appt.end)}
      </p>
      <p className={cn("text-xs font-semibold leading-tight", v.title)}>
        {appt.service}
      </p>
      <p className={cn("text-[11px]", v.client)}>{appt.client}</p>
    </div>
  );
}
