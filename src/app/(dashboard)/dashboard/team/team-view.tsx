"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import {
  CalendarOff,
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import {
  addStaffTimeOff,
  deleteStaffTimeOff,
  saveStaffServices,
  saveStaffWeeklyHours,
  type StaffWeeklyHoursInput,
} from "./actions";

export type TeamServiceOption = {
  id: string;
  name: string;
  durationMinutes: number;
};

export type TeamMemberRecord = {
  id: string;
  name: string;
  role: string;
  workingHours: {
    id: string;
    weekday: number;
    opensAt: string;
    closesAt: string;
  }[];
  timeOff: {
    id: string;
    startsAt: string;
    endsAt: string;
    reason: string | null;
  }[];
  serviceIds: string[];
};

const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const SHORT_WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTimeOffRange(startIso: string, endIso: string): string {
  const s = new Date(startIso);
  const e = new Date(endIso);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "—";
  const sameDay =
    s.toDateString() === e.toDateString();
  const dateOpts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  };
  const timeOpts: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  };
  if (sameDay) {
    return `${s.toLocaleDateString("en-IE", dateOpts)} · ${s.toLocaleTimeString("en-IE", timeOpts)} – ${e.toLocaleTimeString("en-IE", timeOpts)}`;
  }
  return `${s.toLocaleDateString("en-IE", dateOpts)} – ${e.toLocaleDateString("en-IE", dateOpts)}`;
}

function nextHourIso(addHours = 1): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + addHours);
  return localIsoForInput(d);
}

function localIsoForInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function compareWindows(
  a: StaffWeeklyHoursInput,
  b: StaffWeeklyHoursInput,
): number {
  if (a.weekday !== b.weekday) return a.weekday - b.weekday;
  return a.opensAt.localeCompare(b.opensAt);
}

type TeamViewProps = {
  team: TeamMemberRecord[];
  services: TeamServiceOption[];
};

export function TeamView({ team, services }: TeamViewProps) {
  const [activeStaffId, setActiveStaffId] = useState(team[0]?.id ?? null);

  const activeStaff = useMemo(
    () => team.find((t) => t.id === activeStaffId) ?? null,
    [team, activeStaffId],
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col px-6 py-8 lg:px-12 lg:py-12">
      <header className="mb-8 flex flex-col gap-2">
        <h1 className="text-2xl font-medium tracking-tight text-gray-900">
          Team
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-gray-500">
          Set each stylist&rsquo;s weekly schedule, plan time off, and choose
          which services they perform. The booking pages and AI receptionist
          will only offer slots that fit.
        </p>
      </header>

      {team.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500 shadow-sm">
          No team members yet. Invite a stylist from{" "}
          <span className="font-medium text-gray-900">Settings → Identity</span>
          .
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
            <p className="px-3 pt-2 pb-1 text-xs font-medium tracking-wider text-gray-500 uppercase">
              <Users className="mr-1.5 inline size-3.5 align-middle" />
              Stylists
            </p>
            <ul className="space-y-1">
              {team.map((s) => {
                const isActive = activeStaffId === s.id;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setActiveStaffId(s.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                        isActive
                          ? "bg-gray-900 text-white"
                          : "text-gray-700 hover:bg-gray-50",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                          isActive
                            ? "bg-white/15 text-white"
                            : "bg-gray-100 text-gray-700",
                        )}
                      >
                        <UserRound className="size-3.5" aria-hidden />
                      </span>
                      <span className="flex-1 truncate font-medium">
                        {s.name}
                      </span>
                      <span
                        className={cn(
                          "text-xs",
                          isActive ? "text-white/70" : "text-gray-400",
                        )}
                      >
                        {s.role}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          {activeStaff ? (
            <StaffDetailPanel
              key={activeStaff.id}
              staff={activeStaff}
              services={services}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

function StaffDetailPanel({
  staff,
  services,
}: {
  staff: TeamMemberRecord;
  services: TeamServiceOption[];
}) {
  return (
    <section className="space-y-6">
      <WeeklyHoursEditor staff={staff} />
      <TimeOffEditor staff={staff} />
      <ServicesEligibilityEditor staff={staff} services={services} />
    </section>
  );
}

function WeeklyHoursEditor({ staff }: { staff: TeamMemberRecord }) {
  const [windows, setWindows] = useState<StaffWeeklyHoursInput[]>(() =>
    [...staff.workingHours]
      .map((w) => ({
        weekday: w.weekday,
        opensAt: w.opensAt,
        closesAt: w.closesAt,
      }))
      .sort(compareWindows),
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const addWindow = (weekday: number) => {
    setWindows((prev) =>
      [...prev, { weekday, opensAt: "09:00", closesAt: "17:00" }].sort(
        compareWindows,
      ),
    );
    setSaved(false);
  };

  const removeWindowAt = (index: number) => {
    setWindows((prev) => prev.filter((_, i) => i !== index));
    setSaved(false);
  };

  const updateWindowAt = (
    index: number,
    field: "opensAt" | "closesAt",
    value: string,
  ) => {
    setWindows((prev) =>
      prev.map((w, i) => (i === index ? { ...w, [field]: value } : w)),
    );
    setSaved(false);
  };

  const onSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await saveStaffWeeklyHours({
        staffId: staff.id,
        windows,
      });
      if (result.ok) {
        setSaved(true);
      } else {
        setError(result.message);
      }
    });
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <Clock className="size-4 text-gray-500" aria-hidden />
            Weekly hours
          </h2>
          <p className="mt-1 max-w-xl text-sm text-gray-500">
            Add a row for each window the stylist is available. For a lunch
            break, add two rows on the same day (e.g. 10:00–13:00 +
            14:00–18:00).
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={onSave}
          className="shrink-0"
        >
          {pending ? (
            <>
              <Loader2 className="mr-1.5 size-3.5 animate-spin" /> Saving…
            </>
          ) : (
            "Save schedule"
          )}
        </Button>
      </header>

      {error ? (
        <p className="mb-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {saved && !error ? (
        <p className="mb-3 inline-flex items-center gap-1.5 text-sm text-emerald-700">
          <CheckCircle2 className="size-3.5" aria-hidden /> Saved.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {WEEKDAY_LABELS.map((label, weekday) => {
          const dayWindows = windows
            .map((w, i) => ({ ...w, _idx: i }))
            .filter((w) => w.weekday === weekday);
          return (
            <div
              key={weekday}
              className="rounded-xl border border-gray-100 bg-gray-50/50 p-4"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900">{label}</p>
                <button
                  type="button"
                  className="text-xs font-medium text-gray-500 hover:text-gray-900"
                  onClick={() => addWindow(weekday)}
                >
                  <Plus className="-mt-0.5 mr-0.5 inline size-3" />
                  Add window
                </button>
              </div>
              {dayWindows.length === 0 ? (
                <p className="text-xs italic text-gray-400">Off all day</p>
              ) : (
                <ul className="space-y-2">
                  {dayWindows.map((w) => (
                    <li
                      key={`${weekday}-${w._idx}`}
                      className="flex items-center gap-2"
                    >
                      <Input
                        type="time"
                        value={w.opensAt}
                        onChange={(e) =>
                          updateWindowAt(w._idx, "opensAt", e.target.value)
                        }
                        className="h-9 w-28"
                      />
                      <span className="text-xs text-gray-400">to</span>
                      <Input
                        type="time"
                        value={w.closesAt}
                        onChange={(e) =>
                          updateWindowAt(w._idx, "closesAt", e.target.value)
                        }
                        className="h-9 w-28"
                      />
                      <button
                        type="button"
                        onClick={() => removeWindowAt(w._idx)}
                        aria-label="Remove window"
                        className="ml-auto rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimeOffEditor({ staff }: { staff: TeamMemberRecord }) {
  const [open, setOpen] = useState(false);
  const [startsAt, setStartsAt] = useState(() => nextHourIso(1));
  const [endsAt, setEndsAt] = useState(() => nextHourIso(2));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const onSubmit = () => {
    setError(null);
    startTransition(async () => {
      const result = await addStaffTimeOff({
        staffId: staff.id,
        startsAtIso: new Date(startsAt).toISOString(),
        endsAtIso: new Date(endsAt).toISOString(),
        reason: reason || null,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setOpen(false);
      setReason("");
    });
  };

  const onDelete = (id: string) => {
    setPendingDeleteId(id);
    void deleteStaffTimeOff(id).finally(() => setPendingDeleteId(null));
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <CalendarOff className="size-4 text-gray-500" aria-hidden />
            Upcoming time off
          </h2>
          <p className="mt-1 max-w-xl text-sm text-gray-500">
            Holidays, sick days, or short blocks. Booking will skip these
            windows automatically.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setOpen(true)}
          className="shrink-0"
        >
          <Plus className="mr-1 size-3.5" /> Add time off
        </Button>
      </header>

      {staff.timeOff.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 px-4 py-6 text-center text-sm text-gray-500">
          No time off scheduled.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {staff.timeOff.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {formatTimeOffRange(t.startsAt, t.endsAt)}
                </p>
                {t.reason ? (
                  <p className="mt-0.5 truncate text-xs text-gray-500">
                    {t.reason}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                disabled={pendingDeleteId === t.id}
                onClick={() => onDelete(t.id)}
                aria-label="Delete time off"
                className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                {pendingDeleteId === t.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add time off for {staff.name}</DialogTitle>
            <DialogDescription>
              Pick the start and end. Customers won&rsquo;t be offered slots
              that fall inside this window.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ts-start">Starts</Label>
              <Input
                id="ts-start"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ts-end">Ends</Label>
              <Input
                id="ts-end"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ts-reason">Reason (optional)</Label>
              <Input
                id="ts-reason"
                placeholder="Holiday, training, sick…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={200}
              />
            </div>
            {error ? (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="button" onClick={onSubmit} disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" /> Adding…
                </>
              ) : (
                "Add time off"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ServicesEligibilityEditor({
  staff,
  services,
}: {
  staff: TeamMemberRecord;
  services: TeamServiceOption[];
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(staff.serviceIds),
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSaved(false);
  };

  const onSave = () => {
    setError(null);
    startTransition(async () => {
      const result = await saveStaffServices({
        staffId: staff.id,
        serviceIds: Array.from(selected),
      });
      if (result.ok) {
        setSaved(true);
      } else {
        setError(result.message);
      }
    });
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            Services performed
          </h2>
          <p className="mt-1 max-w-xl text-sm text-gray-500">
            Tick every service this stylist offers. If <span className="font-medium">no</span>{" "}
            stylists in the salon have any boxes ticked, the system assumes
            everyone does everything.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={onSave}
          className="shrink-0"
        >
          {pending ? (
            <>
              <Loader2 className="mr-1.5 size-3.5 animate-spin" /> Saving…
            </>
          ) : (
            "Save services"
          )}
        </Button>
      </header>

      {error ? (
        <p className="mb-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {saved && !error ? (
        <p className="mb-3 inline-flex items-center gap-1.5 text-sm text-emerald-700">
          <CheckCircle2 className="size-3.5" aria-hidden /> Saved.
        </p>
      ) : null}

      {services.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 px-4 py-6 text-center text-sm text-gray-500">
          Add services on{" "}
          <span className="font-medium text-gray-900">Services</span> first.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {services.map((svc) => {
            const checked = selected.has(svc.id);
            return (
              <li key={svc.id}>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                    checked
                      ? "border-gray-900 bg-gray-900/5"
                      : "border-gray-200 bg-white hover:border-gray-300",
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                    checked={checked}
                    onChange={() => toggle(svc.id)}
                  />
                  <span className="min-w-0">
                    <span className="block font-medium text-gray-900">
                      {svc.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {svc.durationMinutes} min
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
