"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useRouter } from "next/navigation";

import {
  rescheduleAppointment,
  resizeAppointment,
} from "@/app/(dashboard)/dashboard/bookings/actions";
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

const DEFAULT_START_HOUR = 9;
const DEFAULT_END_HOUR = 18;
const HOUR_REM = 8;
/** Matches Aura mock: one hour = 8rem; appointments positioned by minute within the hour. */

const WEEKDAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

type BusinessHoursMap = Record<
  string,
  { open?: boolean; start?: string; end?: string }
> | null;

type StaffWorkingHoursRow = {
  staffId: string;
  weekday: number;
  startTime: string;
  endTime: string;
};

type StaffTimeOffRow = {
  staffId: string;
  startsAt: string;
  endsAt: string;
  note: string | null;
};

function parseHm(value: string | undefined | null): { h: number; m: number } | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (Number.isNaN(h) || Number.isNaN(min)) return null;
  if (h < 0 || h > 24 || min < 0 || min > 59) return null;
  return { h, m: min };
}

function segmentRem(
  startMinFromGrid: number,
  endMinFromGrid: number,
): { topRem: number; heightRem: number } {
  return {
    topRem: (startMinFromGrid / 60) * HOUR_REM,
    heightRem: Math.max(((endMinFromGrid - startMinFromGrid) / 60) * HOUR_REM, 0.5),
  };
}

function staffWorkingSegmentsForDay(
  staffId: string,
  date: Date,
  rows: StaffWorkingHoursRow[],
  startHour: number,
  endHour: number,
): Array<{ topRem: number; heightRem: number }> {
  const weekday = date.getDay();
  const matched = rows.filter(
    (r) => r.staffId === staffId && r.weekday === weekday,
  );
  if (matched.length === 0) return [];
  const segs: Array<{ topRem: number; heightRem: number }> = [];
  for (const r of matched) {
    const s = parseHm(r.startTime);
    const e = parseHm(r.endTime);
    if (!s || !e) continue;
    const startMin = (s.h - startHour) * 60 + s.m;
    const endMin = (e.h - startHour) * 60 + e.m;
    const clampedStart = Math.max(0, Math.min((endHour - startHour) * 60, startMin));
    const clampedEnd = Math.max(0, Math.min((endHour - startHour) * 60, endMin));
    if (clampedEnd <= clampedStart) continue;
    segs.push(segmentRem(clampedStart, clampedEnd));
  }
  return segs;
}

function staffTimeOffSegmentsForDay(
  staffId: string,
  date: Date,
  rows: StaffTimeOffRow[],
  startHour: number,
  endHour: number,
): Array<{ topRem: number; heightRem: number; note: string | null }> {
  const day0 = startOfDay(date);
  const next = addDays(day0, 1);
  const winStart = new Date(day0);
  winStart.setHours(startHour, 0, 0, 0);
  const winEnd = new Date(day0);
  winEnd.setHours(endHour, 0, 0, 0);

  const out: Array<{ topRem: number; heightRem: number; note: string | null }> = [];
  for (const r of rows) {
    if (r.staffId !== staffId) continue;
    const s = new Date(r.startsAt);
    const e = new Date(r.endsAt);
    if (
      Number.isNaN(s.getTime()) ||
      Number.isNaN(e.getTime()) ||
      e.getTime() <= day0.getTime() ||
      s.getTime() >= next.getTime()
    ) {
      continue;
    }
    const startClamped = Math.max(s.getTime(), winStart.getTime());
    const endClamped = Math.min(e.getTime(), winEnd.getTime());
    if (endClamped <= startClamped) continue;
    const startMin = (startClamped - winStart.getTime()) / 60000;
    const endMin = (endClamped - winStart.getTime()) / 60000;
    out.push({ ...segmentRem(startMin, endMin), note: r.note });
  }
  return out;
}

function dayHoursForOrg(
  businessHours: BusinessHoursMap,
  date: Date,
): { startHour: number; endHour: number; isOpen: boolean } {
  const key = WEEKDAY_NAMES[date.getDay()];
  const cfg = businessHours?.[key];
  const start = parseHm(cfg?.start);
  const end = parseHm(cfg?.end);
  const open = cfg?.open !== false;
  if (!start || !end) {
    return {
      startHour: DEFAULT_START_HOUR,
      endHour: DEFAULT_END_HOUR,
      isOpen: open,
    };
  }
  return {
    startHour: Math.max(0, Math.min(23, start.h)),
    endHour: Math.max(start.h + 1, Math.min(24, end.m === 0 ? end.h : end.h + 1)),
    isOpen: open,
  };
}

type Clock = { h: number; m: number };

type Variant = "indigo" | "amber" | "slate" | "red" | "emerald" | "purple";

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

function minutesFromGridStart(h: number, m: number, startHour: number): number {
  return (h - startHour) * 60 + m;
}

// Visual minimum: 1.75rem (~28px) is the smallest height that still fits
// a single line of "service · HH:MM-HH:MM · client" without clipping.
// Short bookings get bumped to this height even if their real duration
// would be smaller (so a 5-min booking still reads cleanly).
const MIN_BLOCK_HEIGHT_REM = 1.75;

function slotStyle(start: Clock, end: Clock, startHour: number) {
  const startMin = minutesFromGridStart(start.h, start.m, startHour);
  const endMin = minutesFromGridStart(end.h, end.m, startHour);
  const topRem = (startMin / 60) * HOUR_REM;
  const heightRem = ((endMin - startMin) / 60) * HOUR_REM;
  return {
    top: `${topRem}rem`,
    height: `${Math.max(heightRem, MIN_BLOCK_HEIGHT_REM)}rem`,
  };
}

function formatRange24(start: Clock, end: Clock): string {
  return `${formatTimeLabel24(start.h, start.m)} - ${formatTimeLabel24(end.h, end.m)}`;
}

function formatDurationShort(start: Clock, end: Clock, startHour: number): string {
  const a = minutesFromGridStart(start.h, start.m, startHour);
  const b = minutesFromGridStart(end.h, end.m, startHour);
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
  startHour: number,
  endHour: number,
): { start: Clock; end: Clock } | null {
  const day0 = startOfDay(day);
  const next = addDays(day0, 1);
  if (end.getTime() <= day0.getTime() || start.getTime() >= next.getTime()) {
    return null;
  }

  const winStart = new Date(day0);
  winStart.setHours(startHour, 0, 0, 0);
  const winEnd = new Date(day0);
  winEnd.setHours(endHour, 0, 0, 0);

  const clippedStart = new Date(Math.max(start.getTime(), winStart.getTime()));
  const clippedEnd = new Date(Math.min(end.getTime(), winEnd.getTime()));
  if (clippedEnd.getTime() <= clippedStart.getTime()) return null;

  return { start: toClock(clippedStart), end: toClock(clippedEnd) };
}

function variantForAppointment(
  source: CalendarAppointment["source"],
  status: string,
): Variant {
  const s = (status ?? "").toLowerCase();
  if (s === "cancelled") return "red";
  if (s === "no_show") return "purple";
  if (s === "completed") return "emerald";
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
  emerald: {
    border: "border-emerald-500",
    bg: "bg-emerald-50",
    title: "text-emerald-950",
    time: "text-emerald-700",
    client: "text-emerald-900",
    badge: "border-emerald-200 text-emerald-800",
    avatar: "bg-emerald-200 text-emerald-900",
  },
  purple: {
    border: "border-purple-500",
    bg: "bg-purple-50",
    title: "text-purple-950",
    time: "text-purple-700",
    client: "text-purple-900",
    badge: "border-purple-200 text-purple-800",
    avatar: "bg-purple-200 text-purple-900",
  },
};

type CalendarViewProps = {
  appointments: CalendarAppointment[];
  staffMembers: CalendarStaffMember[];
  businessHours?: BusinessHoursMap;
  staffWorkingHours?: StaffWorkingHoursRow[];
  staffTimeOff?: StaffTimeOffRow[];
};

export function CalendarView({
  appointments,
  staffMembers,
  businessHours = null,
  staffWorkingHours = [],
  staffTimeOff = [],
}: CalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [mobileStaffFilter, setMobileStaffFilter] = useState<string>("all");
  const [activeAppointmentId, setActiveAppointmentId] = useState<string | null>(
    null,
  );
  const router = useRouter();
  const [dragMessage, setDragMessage] = useState<string | null>(null);
  const [, startDragSaveTransition] = useTransition();

  // Mouse-tracking drag state. Replaces HTML5 drag-and-drop for instant
  // response (HTML5 DnD has a built-in start delay) and to support a live
  // snap-target preview + cursor tooltip.
  //
  // The "live" mutable copy lives in a ref so mousemove updates 60×/sec
  // don't tear down + re-attach window listeners; the snapshot in state is
  // only used to drive UI rendering (ghost + tooltip).
  type DragState = {
    id: string;
    durationMin: number;
    originStaffId: string | null;
    originStartIso: string;
    cursorX: number;
    cursorY: number;
    targetColumnId: string | null;
    snappedMinutesFromGridStart: number | null;
    blockWidthPx: number;
  };
  const dragRef = useRef<DragState | null>(null);
  const [dragSnapshot, setDragSnapshot] = useState<DragState | null>(null);
  const gridBodyRef = useRef<HTMLDivElement | null>(null);
  const columnRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const setColumnRef = useCallback(
    (id: string) => (node: HTMLDivElement | null) => {
      if (node) columnRefs.current.set(id, node);
      else columnRefs.current.delete(id);
    },
    [],
  );

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

  const dayHours = useMemo(
    () => dayHoursForOrg(businessHours, selectedDate),
    [businessHours, selectedDate],
  );
  const startHour = dayHours.startHour;
  const endHour = dayHours.endHour;
  const hourCount = endHour - startHour;
  const gridBodyHeight = `${hourCount * HOUR_REM}rem`;

  const hours = useMemo(() => {
    const list: number[] = [];
    for (let h = startHour; h < endHour; h++) list.push(h);
    return list;
  }, [startHour, endHour]);

  const apptById = useMemo(() => {
    const m = new Map<string, CalendarAppointment>();
    for (const a of appointments) m.set(a.id, a);
    return m;
  }, [appointments]);

  const activeAppointment = useMemo(
    () => (activeAppointmentId ? apptById.get(activeAppointmentId) ?? null : null),
    [activeAppointmentId, apptById],
  );

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

      const clip = clipToDayGrid(start, end, selectedDate, startHour, endHour);
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
        variant: variantForAppointment(appt.source, appt.status),
        showAiBadge: appt.source === "ai_call" && !cancelled,
        dimmed: appt.status === "completed" || cancelled,
        cancelled,
      });
    }

    out.sort(
      (a, b) =>
        minutesFromGridStart(a.start.h, a.start.m, startHour) -
        minutesFromGridStart(b.start.h, b.start.m, startHour),
    );
    return out;
  }, [appointments, selectedDate, staffIdSet, startHour, endHour]);

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

  const appointmentsById = useMemo(() => {
    const m = new Map<string, CalendarAppointment>();
    for (const a of appointments) m.set(a.id, a);
    return m;
  }, [appointments]);

  // Pre-flight overlap check against in-memory appointments. Mirrors the DB
  // exclusion constraint (per-staff bucket; null staff_id share the
  // unassigned pool) so we can show a precise message about WHICH booking
  // would clash before round-tripping to the server.
  const findOverlapBlocker = useCallback(
    (
      apptId: string,
      newStartMs: number,
      newEndMs: number,
      newStaffId: string | null,
    ): CalendarAppointment | null => {
      for (const other of appointments) {
        if (other.id === apptId) continue;
        if (other.status !== "confirmed") continue;
        const otherStaff = other.staff_id ?? null;
        if (otherStaff !== newStaffId) continue;
        const otherStart = new Date(other.start_time).getTime();
        const otherEnd = new Date(other.end_time).getTime();
        if (Number.isNaN(otherStart) || Number.isNaN(otherEnd)) continue;
        if (otherStart < newEndMs && otherEnd > newStartMs) {
          return other;
        }
      }
      return null;
    },
    [appointments],
  );

  const onMouseDownBlock = useCallback(
    (e: ReactMouseEvent<HTMLElement>, apptId: string) => {
      // Ignore non-primary clicks and modifier-clicks; let the click handler
      // open the quick-look popover for plain clicks (the global mouseup
      // handler decides whether the gesture became a drag).
      if (e.button !== 0) return;
      const appt = appointmentsById.get(apptId);
      if (!appt || appt.status !== "confirmed") return;
      const start = new Date(appt.start_time);
      const end = new Date(appt.end_time);
      const durationMin = Math.max(
        5,
        Math.round((end.getTime() - start.getTime()) / 60_000),
      );
      const target = e.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      e.preventDefault();
      setDragMessage(null);
      const initial: DragState = {
        id: apptId,
        durationMin,
        originStaffId: appt.staff_id ?? null,
        originStartIso: appt.start_time,
        cursorX: e.clientX,
        cursorY: e.clientY,
        targetColumnId: null,
        snappedMinutesFromGridStart: null,
        blockWidthPx: rect.width,
      };
      dragRef.current = initial;
      setDragSnapshot(initial);
    },
    [appointmentsById],
  );

  // Global mouse listeners while dragging. The effect only re-runs when a
  // drag starts or ends (not on every cursor move), so listeners stay
  // attached for the full gesture.
  const dragActiveId = dragSnapshot?.id ?? null;
  useEffect(() => {
    if (!dragActiveId) return;
    const SNAP_MIN = 15;
    const remPx =
      Number.parseFloat(getComputedStyle(document.documentElement).fontSize) ||
      16;
    const minutesPerPx = 60 / (HOUR_REM * remPx);

    const computeFromCursor = (
      clientX: number,
      clientY: number,
    ): { columnId: string | null; snappedMin: number | null } => {
      let columnId: string | null = null;
      for (const [id, node] of columnRefs.current) {
        const r = node.getBoundingClientRect();
        if (
          clientX >= r.left &&
          clientX <= r.right &&
          clientY >= r.top &&
          clientY <= r.bottom
        ) {
          columnId = id;
          break;
        }
      }
      const grid = gridBodyRef.current;
      if (!grid) return { columnId, snappedMin: null };
      const gridRect = grid.getBoundingClientRect();
      const offsetY = clientY - gridRect.top;
      const minsRaw = offsetY * minutesPerPx;
      const snapped = Math.max(0, Math.round(minsRaw / SNAP_MIN) * SNAP_MIN);
      return { columnId, snappedMin: snapped };
    };

    const onMove = (ev: MouseEvent) => {
      const live = dragRef.current;
      if (!live) return;
      const { columnId, snappedMin } = computeFromCursor(ev.clientX, ev.clientY);
      const next: DragState = {
        ...live,
        cursorX: ev.clientX,
        cursorY: ev.clientY,
        targetColumnId: columnId,
        snappedMinutesFromGridStart: snappedMin,
      };
      dragRef.current = next;
      setDragSnapshot(next);
    };

    const onUp = (ev: MouseEvent) => {
      const live = dragRef.current;
      dragRef.current = null;
      setDragSnapshot(null);
      if (!live) return;
      const { columnId, snappedMin } = computeFromCursor(ev.clientX, ev.clientY);
      if (columnId === null || snappedMin === null) return; // drop outside
      const newLocalMinutes = startHour * 60 + snappedMin;
      const dayEndMinutes = endHour * 60;
      if (
        newLocalMinutes < startHour * 60 ||
        newLocalMinutes + live.durationMin > dayEndMinutes
      ) {
        setDragMessage("That time is outside today's open hours.");
        return;
      }
      const newStaffId = columnId === UNASSIGNED_STAFF_ID ? null : columnId;
      const newStart = new Date(selectedDate);
      newStart.setHours(
        Math.floor(newLocalMinutes / 60),
        newLocalMinutes % 60,
        0,
        0,
      );
      const newEnd = new Date(newStart.getTime() + live.durationMin * 60_000);
      const oldStartMs = new Date(live.originStartIso).getTime();
      if (
        newStart.getTime() === oldStartMs &&
        live.originStaffId === newStaffId
      ) {
        return; // no-op
      }
      // Pre-flight overlap check (mirrors the per-staff exclusion constraint;
      // unassigned bookings share a single pool).
      const blocker = findOverlapBlocker(
        live.id,
        newStart.getTime(),
        newEnd.getTime(),
        newStaffId,
      );
      if (blocker) {
        const bs = new Date(blocker.start_time);
        const be = new Date(blocker.end_time);
        const stylistLabel =
          newStaffId === null
            ? "the unassigned column (it's a shared pool)"
            : staffMembers.find((s) => s.id === newStaffId)?.name ?? "this stylist";
        setDragMessage(
          `That overlaps ${blocker.service_name} (${formatTimeLabel24(bs.getHours(), bs.getMinutes())}–${formatTimeLabel24(be.getHours(), be.getMinutes())}, ${blocker.customer_name}) on ${stylistLabel}.`,
        );
        return;
      }
      startDragSaveTransition(async () => {
        const result = await rescheduleAppointment({
          appointmentId: live.id,
          newStartIso: newStart.toISOString(),
          staffId: newStaffId,
        });
        if (!result.ok) {
          setDragMessage(result.message);
          return;
        }
        setDragMessage(null);
        router.refresh();
      });
    };

    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        dragRef.current = null;
        setDragSnapshot(null);
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("keydown", onKey);
    };
  }, [
    dragActiveId,
    endHour,
    findOverlapBlocker,
    router,
    selectedDate,
    staffMembers,
    startHour,
  ]);

  // Resize: bottom-edge handle on a confirmed appointment block. We track the
  // mouse globally during the gesture, snap to 5-minute steps, and call the
  // resize action on mouseup.
  const onResizeStart = useCallback(
    (apptId: string, e: ReactMouseEvent<HTMLElement>) => {
      const appt = appointmentsById.get(apptId);
      if (!appt || appt.status !== "confirmed") return;
      e.preventDefault();
      e.stopPropagation();

      const remPx =
        Number.parseFloat(
          getComputedStyle(document.documentElement).fontSize,
        ) || 16;
      const minutesPerPx = 60 / (HOUR_REM * remPx);
      const initialEnd = new Date(appt.end_time);
      const initialStart = new Date(appt.start_time);
      const startY = e.clientY;
      let lastNewEnd = initialEnd;

      const onMove = (ev: MouseEvent) => {
        const dyPx = ev.clientY - startY;
        const dyMin = dyPx * minutesPerPx;
        const SNAP = 5;
        const snapped = Math.round(dyMin / SNAP) * SNAP;
        const candidate = new Date(initialEnd.getTime() + snapped * 60_000);
        const minEnd = new Date(initialStart.getTime() + 5 * 60_000);
        const maxEnd = new Date(initialStart.getTime() + 8 * 60 * 60_000);
        if (candidate.getTime() < minEnd.getTime()) {
          lastNewEnd = minEnd;
        } else if (candidate.getTime() > maxEnd.getTime()) {
          lastNewEnd = maxEnd;
        } else {
          lastNewEnd = candidate;
        }
        setDragMessage(
          `Resize: ${formatTimeLabel24(initialStart.getHours(), initialStart.getMinutes())}–${formatTimeLabel24(lastNewEnd.getHours(), lastNewEnd.getMinutes())}`,
        );
      };

      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        if (lastNewEnd.getTime() === initialEnd.getTime()) {
          setDragMessage(null);
          return;
        }
        startDragSaveTransition(async () => {
          const result = await resizeAppointment({
            appointmentId: apptId,
            newEndIso: lastNewEnd.toISOString(),
          });
          if (!result.ok) {
            setDragMessage(result.message);
            return;
          }
          setDragMessage(null);
          router.refresh();
        });
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [appointmentsById, router],
  );

  const mobileFilteredBlocks = useMemo(() => {
    if (mobileStaffFilter === "all") return dayBlocks;
    return dayBlocks.filter((b) => b.columnId === mobileStaffFilter);
  }, [dayBlocks, mobileStaffFilter]);

  const mobileListBlocks = useMemo(() => {
    return [...dayBlocks].sort(
      (a, b) =>
        minutesFromGridStart(a.start.h, a.start.m, startHour) -
        minutesFromGridStart(b.start.h, b.start.m, startHour),
    );
  }, [dayBlocks, startHour]);

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
                    {/*
                      First label sits inside the row (top-1) so it isn't
                      clipped by the sticky column header. Subsequent labels
                      straddle the gridline (-top-2.5) for the canonical
                      Fresha/Treatwell look.
                    */}
                    <span
                      className={cn(
                        "absolute right-3 z-10 bg-white px-1",
                        i === 0 ? "top-1" : "-top-2.5",
                      )}
                    >
                      {formatTimeLabel24(h, 0)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Staff columns */}
              <div
                ref={gridBodyRef}
                className="relative flex min-w-0 flex-1 bg-white"
              >
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

                {columnIds.map((cid) => {
                  const isStaffCol = cid !== UNASSIGNED_STAFF_ID;
                  const workSegs = isStaffCol
                    ? staffWorkingSegmentsForDay(
                        cid,
                        selectedDate,
                        staffWorkingHours,
                        startHour,
                        endHour,
                      )
                    : [];
                  const offSegs = isStaffCol
                    ? staffTimeOffSegmentsForDay(
                        cid,
                        selectedDate,
                        staffTimeOff,
                        startHour,
                        endHour,
                      )
                    : [];
                  const isDragHover =
                    dragSnapshot?.targetColumnId === cid;
                  return (
                    <div
                      key={cid}
                      ref={setColumnRef(cid)}
                      data-column-id={cid}
                      className={cn(
                        "group/col relative z-10 w-[240px] shrink-0 cursor-crosshair border-r border-gray-200",
                        isDragHover && "ring-2 ring-inset ring-blue-300/70",
                      )}
                    >
                      <div className="pointer-events-none absolute inset-y-0 left-0 right-0 hidden bg-gray-50/30 group-hover/col:block" />
                      {isStaffCol && workSegs.length > 0 ? (
                        <div
                          className="pointer-events-none absolute top-0 right-0 left-0 bg-gray-100/70"
                          style={{ height: gridBodyHeight }}
                          aria-hidden
                        >
                          {workSegs.map((seg, i) => (
                            <div
                              key={`work-${i}`}
                              className="absolute right-0 left-0 bg-white"
                              style={{
                                top: `${seg.topRem}rem`,
                                height: `${seg.heightRem}rem`,
                              }}
                            />
                          ))}
                        </div>
                      ) : null}
                      {isStaffCol && offSegs.length > 0 ? (
                        <div
                          className="pointer-events-none absolute top-0 right-0 left-0"
                          style={{ height: gridBodyHeight }}
                          aria-hidden
                        >
                          {offSegs.map((seg, i) => (
                            <div
                              key={`off-${i}`}
                              className="absolute right-0 left-0 border-y border-amber-200/70 bg-[repeating-linear-gradient(45deg,rgba(251,191,36,0.18)_0,rgba(251,191,36,0.18)_8px,transparent_8px,transparent_16px)]"
                              style={{
                                top: `${seg.topRem}rem`,
                                height: `${seg.heightRem}rem`,
                              }}
                              title={seg.note ?? "Time off"}
                            />
                          ))}
                        </div>
                      ) : null}
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
                              startHour={startHour}
                              onSelect={setActiveAppointmentId}
                              draggable={!appt.cancelled}
                              dragging={dragSnapshot?.id === appt.id}
                              onMouseDownBlock={onMouseDownBlock}
                              resizable={!appt.cancelled}
                              onResizeStart={onResizeStart}
                            />
                          ))}
                        {isDragHover &&
                        dragSnapshot &&
                        dragSnapshot.snappedMinutesFromGridStart !== null ? (
                          <DragSnapTarget
                            snappedMin={dragSnapshot.snappedMinutesFromGridStart}
                            durationMin={dragSnapshot.durationMin}
                          />
                        ) : null}
                      </div>
                    </div>
                  );
                })}
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
                      startHour={startHour}
                      onSelect={setActiveAppointmentId}
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
                      startHour={startHour}
                      onSelect={setActiveAppointmentId}
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
                  startHour={startHour}
                  onSelect={setActiveAppointmentId}
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

      <CalendarApptQuickLook
        appointment={activeAppointment}
        staffMembers={staffMembers}
        onClose={() => setActiveAppointmentId(null)}
      />

      {dragSnapshot &&
      dragSnapshot.snappedMinutesFromGridStart !== null ? (
        <DragCursorBadge
          x={dragSnapshot.cursorX}
          y={dragSnapshot.cursorY}
          startHour={startHour}
          snappedMin={dragSnapshot.snappedMinutesFromGridStart}
          durationMin={dragSnapshot.durationMin}
          targetColumnId={dragSnapshot.targetColumnId}
          staffMembers={staffMembers}
        />
      ) : null}

      {dragMessage ? (
        <div
          className="pointer-events-auto fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm text-red-700 shadow-lg"
          role="alert"
        >
          <div className="flex items-center gap-3">
            <span>{dragMessage}</span>
            <button
              type="button"
              onClick={() => setDragMessage(null)}
              className="text-xs font-medium text-gray-500 underline-offset-2 hover:text-gray-900 hover:underline"
            >
              dismiss
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CalendarApptQuickLook({
  appointment,
  staffMembers,
  onClose,
}: {
  appointment: CalendarAppointment | null;
  staffMembers: CalendarStaffMember[];
  onClose: () => void;
}) {
  if (!appointment) return null;
  const start = new Date(appointment.start_time);
  const end = new Date(appointment.end_time);
  const staff =
    appointment.staff_id
      ? staffMembers.find((s) => s.id === appointment.staff_id)?.name ?? "Unassigned"
      : "Unassigned";
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
              {appointment.status === "cancelled"
                ? "Cancelled"
                : appointment.status === "no_show"
                  ? "No-show"
                  : appointment.status === "completed"
                    ? "Completed"
                    : "Confirmed"}
            </p>
            <h3 className="text-lg font-semibold text-gray-900">
              {appointment.service_name}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <dl className="space-y-1.5 text-sm text-gray-700">
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500">Client</dt>
            <dd className="font-medium text-gray-900">
              {appointment.customer_name}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500">When</dt>
            <dd className="tabular-nums">
              {start.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
              })}{" "}
              · {formatTimeLabel24(start.getHours(), start.getMinutes())}–
              {formatTimeLabel24(end.getHours(), end.getMinutes())}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500">Stylist</dt>
            <dd>{staff}</dd>
          </div>
          {appointment.booking_reference ? (
            <div className="flex justify-between gap-3">
              <dt className="text-gray-500">Ref</dt>
              <dd className="font-mono text-xs">
                {appointment.booking_reference}
              </dd>
            </div>
          ) : null}
        </dl>
        <div className="mt-4 flex justify-end gap-2">
          <Link
            href="/dashboard/bookings"
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Open in bookings
          </Link>
        </div>
      </div>
    </div>
  );
}

function DesktopAppointmentBlock({
  appt,
  startHour,
  onSelect,
  draggable = false,
  dragging = false,
  onMouseDownBlock,
  resizable = false,
  onResizeStart,
}: {
  appt: DayBlock;
  startHour: number;
  onSelect?: (id: string) => void;
  draggable?: boolean;
  dragging?: boolean;
  onMouseDownBlock?: (
    e: ReactMouseEvent<HTMLElement>,
    apptId: string,
  ) => void;
  resizable?: boolean;
  onResizeStart?: (apptId: string, e: ReactMouseEvent<HTMLElement>) => void;
}) {
  const pos = slotStyle(appt.start, appt.end, startHour);
  const v = VARIANT_DESKTOP[appt.variant];
  const durationMin =
    minutesFromGridStart(appt.end.h, appt.end.m, startHour) -
    minutesFromGridStart(appt.start.h, appt.start.m, startHour);
  // Anything under ~35 mins can't fit our 3-row stacked layout (title +
  // time row + client row) without clipping the bottom row, so collapse to
  // a single inline line. The block visual height is also clamped to
  // MIN_BLOCK_HEIGHT_REM (~28px) so even a 5-min booking is readable.
  const isCompact = durationMin > 0 && durationMin < 35;
  const tooltip = `${appt.service} · ${formatRange24(appt.start, appt.end)} · ${appt.client}${appt.cancelled ? " (cancelled)" : ""}`;

  if (isCompact) {
    return (
      <button
        type="button"
        title={tooltip}
        onMouseDown={
          draggable && onMouseDownBlock
            ? (e) => onMouseDownBlock(e, appt.id)
            : undefined
        }
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(appt.id);
        }}
        className={cn(
          "pointer-events-auto absolute left-1 right-1.5 flex cursor-grab items-center gap-1.5 overflow-hidden rounded-r-md border-l-[3px] px-2 text-left leading-none shadow-[0_2px_4px_rgba(0,0,0,0.02)] transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 active:cursor-grabbing",
          v.border,
          v.bg,
          appt.dimmed && "opacity-70",
          appt.cancelled && "opacity-80",
          dragging && "opacity-30 ring-2 ring-blue-400",
        )}
        style={{ top: pos.top, height: pos.height }}
      >
        <span
          className={cn(
            "shrink-0 text-[11px] font-semibold tracking-tight",
            v.time,
          )}
        >
          {formatTimeLabel24(appt.start.h, appt.start.m)}
        </span>
        <span
          className={cn(
            "shrink truncate text-[11px] font-semibold tracking-tight",
            v.title,
            appt.cancelled && "line-through decoration-red-800/50",
          )}
        >
          {appt.service}
        </span>
        <span
          className={cn(
            "min-w-0 shrink truncate text-[10px] font-medium",
            v.client,
          )}
        >
          · {appt.client}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      title={tooltip}
      onMouseDown={
        draggable && onMouseDownBlock
          ? (e) => onMouseDownBlock(e, appt.id)
          : undefined
      }
      onClick={(e) => {
        e.stopPropagation();
        // If this came from a drag gesture the snapshot was already
        // cleared, so a plain click still opens the quick-look.
        onSelect?.(appt.id);
      }}
      className={cn(
        "pointer-events-auto absolute left-1 right-1.5 cursor-grab overflow-hidden rounded-r-lg border-l-[3px] p-2.5 text-left shadow-[0_2px_4px_rgba(0,0,0,0.02)] transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 active:cursor-grabbing",
        v.border,
        v.bg,
        appt.dimmed && "opacity-70",
        appt.cancelled && "opacity-80",
        dragging && "opacity-30 ring-2 ring-blue-400",
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
      {resizable && onResizeStart ? (
        <span
          role="separator"
          aria-label="Drag to resize"
          onMouseDown={(e) => onResizeStart(appt.id, e)}
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-x-0 bottom-0 z-10 flex h-2 cursor-ns-resize items-center justify-center"
        >
          <span className="h-0.5 w-6 rounded-full bg-gray-400/40 transition group-hover:bg-gray-500/60" />
        </span>
      ) : null}
    </button>
  );
}

function MobileAppointmentRow({
  block,
  staffLabel,
  startHour,
  onSelect,
}: {
  block: DayBlock;
  staffLabel: string;
  startHour: number;
  onSelect?: (id: string) => void;
}) {
  const v = VARIANT_DESKTOP[block.variant];
  const dur = formatDurationShort(block.start, block.end, startHour);

  return (
    <div className="relative flex gap-3">
      <div className="mt-0.5 w-14 shrink-0 text-right text-sm font-medium text-gray-900 tabular-nums">
        {formatTimeLabel24(block.start.h, block.start.m)}
      </div>
      <button
        type="button"
        onClick={() => onSelect?.(block.id)}
        className={cn(
          "flex-1 cursor-pointer rounded-r-lg border border-l-[3px] p-3 text-left shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900",
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
      </button>
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

/**
 * Translucent rectangle that shows where a dragged appointment will land
 * inside its target column. Sized by the original duration; positioned by
 * the snapped grid-relative minute offset.
 */
function DragSnapTarget({
  snappedMin,
  durationMin,
}: {
  snappedMin: number;
  durationMin: number;
}) {
  const topRem = (snappedMin / 60) * HOUR_REM;
  const heightRem = Math.max((durationMin / 60) * HOUR_REM, 1.25);
  return (
    <div
      className="pointer-events-none absolute left-1 right-1.5 rounded-r-lg border-2 border-dashed border-blue-400 bg-blue-100/40"
      style={{ top: `${topRem}rem`, height: `${heightRem}rem` }}
      aria-hidden
    />
  );
}

/**
 * Floating badge near the cursor showing the proposed start–end time and
 * stylist for the drag in progress.
 */
function DragCursorBadge({
  x,
  y,
  startHour,
  snappedMin,
  durationMin,
  targetColumnId,
  staffMembers,
}: {
  x: number;
  y: number;
  startHour: number;
  snappedMin: number;
  durationMin: number;
  targetColumnId: string | null;
  staffMembers: CalendarStaffMember[];
}) {
  const startTotal = startHour * 60 + snappedMin;
  const startH = Math.floor(startTotal / 60);
  const startM = startTotal % 60;
  const endTotal = startTotal + durationMin;
  const endH = Math.floor(endTotal / 60);
  const endM = endTotal % 60;
  const stylistLabel =
    targetColumnId === null
      ? "Drop on a column"
      : targetColumnId === UNASSIGNED_STAFF_ID
        ? "Unassigned"
        : staffMembers.find((s) => s.id === targetColumnId)?.name ?? "Stylist";
  return (
    <div
      className="pointer-events-none fixed z-[60] rounded-md border border-gray-900/10 bg-gray-900 px-2.5 py-1.5 text-[12px] font-medium text-white shadow-lg"
      style={{ left: x + 14, top: y + 14 }}
    >
      <div className="tabular-nums">
        {formatTimeLabel24(startH, startM)}–{formatTimeLabel24(endH, endM)}
      </div>
      <div className="text-[11px] font-normal text-white/70">{stylistLabel}</div>
    </div>
  );
}

function SingleDayColumn({
  blocks,
  hours,
  gridBodyHeight,
  startHour,
  onSelect,
}: {
  blocks: DayBlock[];
  hours: number[];
  gridBodyHeight: string;
  startHour: number;
  onSelect?: (id: string) => void;
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
          <MobileDayBlock
            key={appt.id}
            appt={appt}
            startHour={startHour}
            onSelect={onSelect}
          />
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

function MobileDayBlock({
  appt,
  startHour,
  onSelect,
}: {
  appt: DayBlock;
  startHour: number;
  onSelect?: (id: string) => void;
}) {
  const pos = slotStyle(appt.start, appt.end, startHour);
  const v = VARIANT_DESKTOP[appt.variant];

  return (
    <button
      type="button"
      onClick={() => onSelect?.(appt.id)}
      className={cn(
        "pointer-events-auto absolute left-0 right-0 cursor-pointer overflow-hidden rounded-r-lg border-l-[3px] px-2 py-1.5 text-left shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900",
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
    </button>
  );
}
