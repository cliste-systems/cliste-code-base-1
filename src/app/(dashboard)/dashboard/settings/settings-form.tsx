"use client";

import { useCallback, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Clock, Info, Link as LinkIcon, Mic, Settings2 } from "lucide-react";

import { type DayKey, type WeekSchedule } from "./business-hours";
import { saveOrganizationSettings } from "./actions";

type DayBlock = {
  key: DayKey;
  label: string;
};

const WEEK: DayBlock[] = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];

export type OrganizationSettingsInitial = {
  isActive: boolean;
  freshaUrl: string;
  week: WeekSchedule;
};

type SettingsFormProps = {
  showFreshaSettings: boolean;
  initial: OrganizationSettingsInitial;
};

function TimeField({
  id,
  label,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div
      className={cn(
        "relative mt-2 sm:mt-0",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <Label
        htmlFor={id}
        className={cn(
          "absolute -top-2 left-2.5 bg-white px-1 text-xs",
          disabled ? "text-gray-300" : "text-gray-400",
        )}
      >
        {label}
      </Label>
      <div
        className={cn(
          "flex items-center rounded-lg border px-3 py-2.5 shadow-sm transition-all",
          disabled
            ? "border-gray-100 bg-gray-50"
            : "border-gray-200 bg-white focus-within:border-gray-900 focus-within:ring-1 focus-within:ring-gray-900",
        )}
      >
        <Input
          id={id}
          type="time"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-auto border-0 bg-transparent p-0 text-base font-normal text-gray-900 shadow-none focus-visible:ring-0 disabled:text-gray-400 dark:bg-transparent"
        />
        <Clock
          className={cn(
            "ml-2 size-4 shrink-0",
            disabled ? "text-gray-300" : "text-gray-400",
          )}
          aria-hidden
        />
      </div>
    </div>
  );
}

function DayScheduleRow({
  day,
  row,
  updateDay,
}: {
  day: DayBlock;
  row: WeekSchedule[DayKey];
  updateDay: (key: DayKey, patch: Partial<WeekSchedule[DayKey]>) => void;
}) {
  const open = row.open;

  return (
    <div className="flex flex-col gap-3 sm:grid sm:grid-cols-[100px_140px_1fr_1fr] sm:items-center sm:gap-4">
      <div className="pl-2 text-base font-medium text-gray-900">{day.label}</div>
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "text-base",
            open ? "text-gray-400" : "font-medium text-gray-900",
          )}
        >
          Closed
        </span>
        <Switch
          size="sm"
          checked={open}
          onCheckedChange={(v) => updateDay(day.key, { open: v })}
          aria-label={`${day.label} open`}
          className="h-5 w-9 shrink-0 data-checked:bg-gray-900 data-unchecked:bg-gray-200 dark:data-unchecked:bg-gray-200"
        />
        <span
          className={cn(
            "text-base",
            open ? "font-medium text-gray-900" : "text-gray-400",
          )}
        >
          Open
        </span>
      </div>
      <TimeField
        id={`${day.key}-start`}
        label="Start"
        value={row.start}
        disabled={!open}
        onChange={(v) => updateDay(day.key, { start: v })}
      />
      <TimeField
        id={`${day.key}-end`}
        label="End"
        value={row.end}
        disabled={!open}
        onChange={(v) => updateDay(day.key, { end: v })}
      />
    </div>
  );
}

export function SettingsForm({
  showFreshaSettings,
  initial,
}: SettingsFormProps) {
  const [aiActive, setAiActive] = useState(initial.isActive);
  const [freshaBookingUrl, setFreshaBookingUrl] = useState(initial.freshaUrl);
  const [week, setWeek] = useState<WeekSchedule>(initial.week);
  const [pending, startTransition] = useTransition();
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const updateDay = useCallback(
    (key: DayKey, patch: Partial<WeekSchedule[DayKey]>) => {
      setWeek((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
    },
    [],
  );

  const fieldClass =
    "h-auto min-h-11 w-full rounded-xl border border-gray-200/80 bg-gray-50/50 px-4 py-3 text-sm text-gray-900 shadow-sm transition-all placeholder:text-gray-400 focus:border-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus-visible:ring-gray-900/10";

  return (
    <div className="mx-auto w-full max-w-[840px] px-4 py-8 sm:px-8 lg:px-14 lg:pt-16 lg:pb-10">
      <header className="mb-10">
        <div className="mb-3 flex items-center gap-2 text-gray-400">
          <Settings2 className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
          <span className="text-xs font-medium uppercase tracking-widest">
            Configuration
          </span>
        </div>
        <h1 className="mb-2 text-3xl font-medium tracking-tight text-gray-900">
          Settings
        </h1>
        <p className="text-base text-gray-500">
          Manage your AI receptionist&apos;s status and your salon&apos;s
          operating hours.
        </p>
      </header>

      <div className="flex flex-col gap-6">
        {/* AI Receptionist */}
        <section className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm">
          <div
            className={cn(
              "absolute top-0 bottom-0 left-0 w-1",
              aiActive ? "bg-emerald-500" : "bg-gray-300",
            )}
            aria-hidden
          />
          <div className="flex flex-col justify-between gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-600">
                <Mic className="size-5" strokeWidth={1.5} aria-hidden />
              </div>
              <div>
                <h2 className="flex flex-wrap items-center gap-2.5 text-base font-medium text-gray-900">
                  AI Receptionist
                  {aiActive ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/60 bg-emerald-50 py-0.5 pr-2 pl-2 text-xs font-medium text-emerald-700">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200/80 bg-gray-50 py-0.5 pr-2 pl-2 text-xs font-medium text-gray-600">
                      <span className="size-1.5 rounded-full bg-gray-400" />
                      Paused
                    </span>
                  )}
                </h2>
                <p className="mt-0.5 text-base text-gray-500">
                  {aiActive
                    ? "Cliste is currently answering and routing calls."
                    : "The AI is paused — incoming calls use your carrier routing."}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center sm:pl-4">
              <Switch
                checked={aiActive}
                onCheckedChange={setAiActive}
                aria-label="AI receptionist active"
                className="h-6 w-11 shrink-0 rounded-full data-checked:bg-emerald-500 data-unchecked:bg-gray-200 dark:data-unchecked:bg-gray-200"
              />
            </div>
          </div>
          <div className="border-t border-gray-100 bg-gray-50/50 px-6 py-3.5 sm:px-8">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Info className="size-3.5 shrink-0 text-gray-400" aria-hidden />
              Changes to the master control take effect immediately across all
              numbers.
            </div>
          </div>
        </section>

        {showFreshaSettings ? (
          <section className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm">
            <div className="p-6 sm:p-8">
              <div className="mb-6 flex items-start gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-gray-100 bg-gray-50">
                  <LinkIcon
                    className="size-5 text-gray-600"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                </div>
                <div>
                  <h2 className="text-base font-medium text-gray-900">
                    External booking link
                  </h2>
                  <p className="mt-0.5 text-base text-gray-500">
                    The URL the AI can share when someone asks to book online
                    (Connect tier). Use whatever booking system or site you use.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="booking-platform-url"
                  className="text-sm font-medium text-gray-700"
                >
                  Booking system URL
                </Label>
                <Input
                  id="booking-platform-url"
                  type="url"
                  placeholder="https://…"
                  value={freshaBookingUrl}
                  onChange={(e) => setFreshaBookingUrl(e.target.value)}
                  className={fieldClass}
                />
                <p className="text-xs text-gray-500">
                  Paste your public booking page from your provider. You can also
                  manage branding in Storefront.
                </p>
              </div>
            </div>
          </section>
        ) : null}

        {/* Business hours */}
        <section className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm">
          <div className="p-6 sm:p-8">
            <div className="mb-8 flex items-start gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-gray-100 bg-gray-50">
                <Clock
                  className="size-5 text-gray-600"
                  strokeWidth={1.5}
                  aria-hidden
                />
              </div>
              <div>
                <h2 className="text-base font-medium text-gray-900">
                  Business hours
                </h2>
                <p className="mt-0.5 text-base text-gray-500">
                  When you&apos;re open — the AI uses this when callers ask about
                  hours.
                </p>
              </div>
            </div>

            <div className="mb-3 hidden text-xs font-medium tracking-wider text-gray-400 uppercase sm:grid sm:grid-cols-[100px_140px_1fr_1fr] sm:gap-4">
              <div className="pl-2">Day</div>
              <div>Open</div>
              <div>Start</div>
              <div>End</div>
            </div>

            <div className="flex flex-col gap-6 sm:gap-4">
              {WEEK.map((day) => (
                <DayScheduleRow
                  key={day.key}
                  day={day}
                  row={week[day.key]}
                  updateDay={updateDay}
                />
              ))}
            </div>
          </div>
        </section>

        <div className="mb-20 mt-2 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-5 flex-1 text-sm">
            {saveMsg ? (
              <p
                className={cn(
                  saveMsg === "Saved."
                    ? "font-medium text-emerald-600"
                    : "text-destructive",
                )}
              >
                {saveMsg}
              </p>
            ) : null}
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              disabled={pending}
              onClick={() => {
                setSaveMsg(null);
                startTransition(async () => {
                  const result = await saveOrganizationSettings({
                    isActive: aiActive,
                    freshaUrl: freshaBookingUrl,
                    businessHours: week,
                  });
                  if (result.ok) setSaveMsg("Saved.");
                  else setSaveMsg(result.message);
                });
              }}
              className="rounded-xl border border-transparent bg-gray-900 px-6 py-2.5 text-base font-medium text-white shadow-sm hover:bg-gray-800"
            >
              {pending ? "Saving…" : "Save settings"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
