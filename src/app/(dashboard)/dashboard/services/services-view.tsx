"use client";

import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { saveDashboardServices } from "./actions";
import {
  createServiceCategory,
  deleteServiceCategory,
  renameServiceCategory,
  type ServiceCategory,
} from "./categories-actions";
import {
  createServiceAddon,
  deleteServiceAddon,
  listServiceAddons,
  updateServiceAddon,
  type ServiceAddon,
} from "./addons-actions";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { StorefrontTeamMember } from "@/lib/storefront-blocks";
import { cn } from "@/lib/utils";

export type DashboardServiceRow = {
  id: string;
  name: string;
  category: string;
  priceEur: string;
  durationMin: string;
  description: string;
  aiVoiceNotes: string;
  isPublished: boolean;
  categoryId: string | null;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  depositRequired: boolean;
  depositAmountCents: number | null;
  depositPercent: number | null;
  /** Active stylist time before processing (e.g. apply colour). */
  processingBeforeMin: number;
  /** Hands-off processing window (e.g. colour develops). */
  processingMin: number;
  /** Active stylist time after processing (e.g. wash + style). */
  processingAfterMin: number;
};

function newRow(): DashboardServiceRow {
  return {
    id: crypto.randomUUID(),
    name: "",
    category: "",
    priceEur: "",
    durationMin: "45",
    description: "",
    aiVoiceNotes: "",
    isPublished: true,
    categoryId: null,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    depositRequired: false,
    depositAmountCents: null,
    depositPercent: null,
    processingBeforeMin: 0,
    processingMin: 0,
    processingAfterMin: 0,
  };
}

function serviceSummaryLine(s: DashboardServiceRow): string {
  const dur = s.durationMin.trim() ? `${s.durationMin} min` : "";
  const price = s.priceEur.trim() ? `€${s.priceEur}` : "";
  const parts = [dur, price].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  if (s.category.trim()) return s.category.trim();
  return "Add name, price, and details";
}

const fieldClass =
  "block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-none placeholder:text-gray-400 transition-colors focus-visible:border-gray-900 focus-visible:ring-1 focus-visible:ring-gray-900 focus-visible:outline-none";

type TeamEditorRow = { id: string; name: string; imageUrl: string };

function teamToEditorRows(members: StorefrontTeamMember[]): TeamEditorRow[] {
  return members.map((m, i) => ({
    id: `tm-${i}-${m.name.slice(0, 12)}`,
    name: m.name,
    imageUrl: typeof m.imageUrl === "string" ? m.imageUrl : "",
  }));
}

type ServicesViewProps = {
  extendedSchema?: boolean;
  initialServices: DashboardServiceRow[];
  initialTeamMembers: StorefrontTeamMember[];
  initialCategories?: ServiceCategory[];
  /** Bumps when org row reloads so team editor syncs from the server. */
  teamSyncKey: string;
};

export function ServicesView({
  extendedSchema = true,
  initialServices,
  initialTeamMembers,
  initialCategories = [],
  teamSyncKey,
}: ServicesViewProps) {
  const router = useRouter();
  const [services, setServices] = useState<DashboardServiceRow[]>(
    initialServices.length ? initialServices : [],
  );
  const [openValues, setOpenValues] = useState<string[]>(() =>
    initialServices[0]?.id ? [initialServices[0].id] : [],
  );
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [teamRows, setTeamRows] = useState<TeamEditorRow[]>(() =>
    teamToEditorRows(initialTeamMembers),
  );
  const [categories, setCategories] =
    useState<ServiceCategory[]>(initialCategories);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [addonsOpen, setAddonsOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTeamRows(teamToEditorRows(initialTeamMembers));
  }, [teamSyncKey]);

  const handleSave = useCallback(() => {
    setSaveMsg(null);
    setSaveWarning(null);
    startTransition(async () => {
      const result = await saveDashboardServices(
        services.map((s) => ({
          id: s.id,
          name: s.name,
          category:
            categories.find((c) => c.id === s.categoryId)?.name ?? s.category,
          priceEur: s.priceEur,
          durationMin: s.durationMin,
          description: s.description,
          aiVoiceNotes: s.aiVoiceNotes,
          isPublished: s.isPublished,
          categoryId: s.categoryId,
          bufferBeforeMin: s.bufferBeforeMin,
          bufferAfterMin: s.bufferAfterMin,
          depositRequired: s.depositRequired,
          depositAmountCents: s.depositAmountCents,
          depositPercent: s.depositPercent,
          processingBeforeMin: s.processingBeforeMin,
          processingMin: s.processingMin,
          processingAfterMin: s.processingAfterMin,
        })),
        {
          teamMembers: teamRows
            .filter((r) => r.name.trim())
            .map((r) => ({
              name: r.name.trim(),
              imageUrl: r.imageUrl.trim() || null,
            })),
        },
      );
      if (result.ok) {
        setSaveMsg("Saved.");
        setSaveWarning(result.warning ?? null);
        router.refresh();
      } else {
        setSaveMsg(result.message);
        setSaveWarning(null);
      }
    });
  }, [router, services, teamRows, categories]);

  const updateService = useCallback(
    (id: string, patch: Partial<Omit<DashboardServiceRow, "id">>) => {
      setServices((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      );
    },
    [],
  );

  const removeService = useCallback((id: string) => {
    setServices((prev) => {
      const next = prev.filter((s) => s.id !== id);
      setOpenValues((ov) => {
        if (!ov.includes(id)) return ov;
        return next[0] ? [next[0].id] : [];
      });
      return next;
    });
  }, []);

  const addService = useCallback(() => {
    const row = newRow();
    setServices((prev) => [...prev, row]);
    setOpenValues([row.id]);
  }, []);

  const onTeamPhotoFile = useCallback(
    (rowId: string, e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== "string") return;
        setTeamRows((prev) =>
          prev.map((r) =>
            r.id === rowId ? { ...r, imageUrl: reader.result as string } : r,
          ),
        );
      };
      reader.readAsDataURL(file);
    },
    [],
  );

  const clearTeamPhoto = useCallback((rowId: string) => {
    setTeamRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, imageUrl: "" } : r)),
    );
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col px-6 py-8 lg:px-12 lg:py-12">
      <header className="mb-8">
        <div className="mb-4 inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-500">
          Booking
        </div>
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div className="max-w-3xl">
            <h1 className="mb-3 text-3xl font-medium tracking-tight text-gray-900">
              Services &amp; team
            </h1>
            <p className="mb-1.5 text-base text-gray-500">
              Your service menu, pricing, and the professionals clients can book
              with. The AI receptionist and manual bookings use this list to
              match services and team members.
            </p>
            <p className="text-sm text-gray-400">
              Expand a service to edit details. Team names appear on your public
              page when the team section is enabled on Storefront.
            </p>
          </div>
          <div className="flex w-full shrink-0 flex-col items-stretch gap-2 sm:w-auto sm:min-w-[12rem] sm:items-end">
            <Link
              href="/dashboard/storefront"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
            >
              Storefront appearance
              <ChevronRight className="size-4 text-gray-400" aria-hidden />
            </Link>
            <button
              type="button"
              onClick={() => setAddonsOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
            >
              Manage add-ons
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={pending}
              className="inline-flex items-center justify-center rounded-lg border border-transparent bg-gray-900 px-4 py-2 text-sm font-medium whitespace-nowrap text-white shadow-sm transition-colors hover:bg-gray-800 focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save services & team"}
            </button>
            {saveMsg ? (
              <p
                className={cn(
                  "text-xs sm:text-right",
                  saveMsg === "Saved."
                    ? "font-medium text-emerald-600"
                    : "text-red-600",
                )}
              >
                {saveMsg}
              </p>
            ) : null}
            {saveWarning ? (
              <p className="text-xs leading-snug text-amber-900 sm:max-w-xs sm:text-right">
                {saveWarning}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <section className="mb-8 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-100 bg-gray-50">
            <Users className="size-5 text-gray-700" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Team showcase
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Optional names and photos for the &quot;Our team&quot; row on your
              public booking page. Clients can still choose &quot;Any&quot;
              available professional. The AI uses these names when asking who
              they&apos;d like to book with.
            </p>
          </div>
        </div>
        <div className="space-y-3">
          {teamRows.map((row) => (
            <div
              key={row.id}
              className="flex flex-col gap-3 rounded-lg border border-gray-100 bg-gray-50/80 p-3 sm:flex-row sm:items-center sm:gap-4"
            >
              <Input
                value={row.name}
                onChange={(e) =>
                  setTeamRows((prev) =>
                    prev.map((r) =>
                      r.id === row.id ? { ...r, name: e.target.value } : r,
                    ),
                  )
                }
                placeholder="Name"
                className={cn(fieldClass, "sm:min-w-0 sm:flex-1")}
              />
              <div className="flex flex-wrap items-center gap-3 sm:shrink-0">
                <input
                  id={`team-photo-${row.id}`}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                  className="sr-only"
                  onChange={(e) => onTeamPhotoFile(row.id, e)}
                />
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-gray-200 bg-white">
                  {row.imageUrl ? (
                    <img
                      src={row.imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center text-gray-300"
                      aria-hidden
                    >
                      <UserRound className="size-7" strokeWidth={1.25} />
                    </div>
                  )}
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <label
                    htmlFor={`team-photo-${row.id}`}
                    className="cursor-pointer text-sm font-medium text-gray-700 underline-offset-2 hover:underline"
                  >
                    {row.imageUrl ? "Change photo" : "Upload photo"}
                  </label>
                  {row.imageUrl ? (
                    <button
                      type="button"
                      className="text-left text-sm font-medium text-gray-500 hover:text-red-600"
                      onClick={() => clearTeamPhoto(row.id)}
                    >
                      Remove photo
                    </button>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                className="shrink-0 self-start text-sm font-medium text-gray-500 hover:text-red-600 sm:ml-auto sm:self-center"
                onClick={() =>
                  setTeamRows((prev) => prev.filter((r) => r.id !== row.id))
                }
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setTeamRows((prev) => [
                ...prev,
                { id: `tm-${Date.now()}`, name: "", imageUrl: "" },
              ])
            }
            className="flex items-center gap-2 rounded-lg border border-dashed border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            <Plus className="size-4 shrink-0" aria-hidden />
            Add team member
          </button>
        </div>
      </section>

      <div className="flex min-h-0 flex-1 flex-col gap-6">
        {services.length === 0 ? (
          <p className="text-sm text-gray-500">
            No services yet. Add your first service below.
          </p>
        ) : null}

        <AccordionPrimitive.Root
          multiple={false}
          value={openValues}
          onValueChange={(next) => setOpenValues(next)}
          className="flex flex-col gap-6"
        >
          {services.map((s, index) => (
            <AccordionPrimitive.Item
              key={s.id}
              value={s.id}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-gray-100 p-4 sm:px-6">
                <AccordionPrimitive.Header className="flex min-w-0 flex-1">
                  <AccordionPrimitive.Trigger
                    className={cn(
                      "group/trigger flex w-full min-w-0 flex-1 items-center gap-3 text-left text-sm outline-none transition-colors hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-gray-900/20",
                    )}
                  >
                    <span className="shrink-0 text-sm font-medium text-gray-400 tabular-nums">
                      {index + 1}.
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-gray-900">
                          {s.name.trim() || "Untitled service"}
                        </h3>
                        {extendedSchema && !s.isPublished ? (
                          <span className="hidden shrink-0 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-600 sm:inline">
                            Hidden
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-gray-500">
                        {serviceSummaryLine(s)}
                      </p>
                    </div>
                    <ChevronDown
                      className="size-5 shrink-0 text-gray-400 transition-transform duration-200 group-data-[panel-open]/trigger:rotate-180"
                      aria-hidden
                    />
                  </AccordionPrimitive.Trigger>
                </AccordionPrimitive.Header>
                <div
                  className="flex shrink-0 items-center gap-4 sm:gap-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  {extendedSchema ? (
                    <div className="flex items-center gap-3 border-l border-gray-200 pl-4 sm:pl-6">
                      <Label
                        htmlFor={`pub-${s.id}`}
                        className="hidden cursor-pointer text-sm font-medium text-gray-500 sm:inline-block"
                      >
                        Public
                      </Label>
                      <Switch
                        id={`pub-${s.id}`}
                        checked={s.isPublished}
                        onCheckedChange={(v) =>
                          updateService(s.id, { isPublished: Boolean(v) })
                        }
                        aria-label={`Show service ${index + 1} on public menu`}
                        className="h-5 w-9 data-checked:bg-gray-900 dark:data-checked:bg-gray-900"
                      />
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="p-1 text-gray-400 transition-colors hover:text-red-500 focus-visible:ring-2 focus-visible:ring-gray-900/20 focus-visible:outline-none"
                    aria-label={`Remove service ${index + 1}`}
                    onClick={() => removeService(s.id)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </div>

              <AccordionPrimitive.Panel
                className="data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-top-1 text-sm data-closed:hidden"
              >
                <div className="space-y-6 p-4 sm:p-6">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                    <div>
                      <Label
                        htmlFor={`${s.id}-name`}
                        className="mb-1.5 block text-sm font-medium text-gray-700"
                      >
                        Name
                      </Label>
                      <Input
                        id={`${s.id}-name`}
                        value={s.name}
                        onChange={(e) =>
                          updateService(s.id, { name: e.target.value })
                        }
                        placeholder="e.g. Balayage"
                        className={fieldClass}
                      />
                    </div>
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <Label
                          htmlFor={`${s.id}-cat`}
                          className="block text-sm font-medium text-gray-700"
                        >
                          Category
                        </Label>
                        <button
                          type="button"
                          className="text-xs font-medium text-gray-500 underline-offset-2 hover:text-gray-900 hover:underline"
                          onClick={() => setCategoriesOpen(true)}
                        >
                          Manage categories
                        </button>
                      </div>
                      <select
                        id={`${s.id}-cat`}
                        value={s.categoryId ?? ""}
                        onChange={(e) =>
                          updateService(s.id, {
                            categoryId: e.target.value || null,
                          })
                        }
                        className={fieldClass}
                      >
                        <option value="">Uncategorised</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                    <div>
                      <Label
                        htmlFor={`${s.id}-dur`}
                        className="mb-1.5 block text-sm font-medium text-gray-700"
                      >
                        Duration (min)
                      </Label>
                      <Input
                        id={`${s.id}-dur`}
                        type="number"
                        min={5}
                        step={5}
                        value={s.durationMin}
                        onChange={(e) =>
                          updateService(s.id, { durationMin: e.target.value })
                        }
                        className={fieldClass}
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor={`${s.id}-price`}
                        className="mb-1.5 block text-sm font-medium text-gray-700"
                      >
                        Price (€)
                      </Label>
                      <Input
                        id={`${s.id}-price`}
                        inputMode="decimal"
                        value={s.priceEur}
                        onChange={(e) =>
                          updateService(s.id, { priceEur: e.target.value })
                        }
                        placeholder="45"
                        className={fieldClass}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                    <div>
                      <Label className="mb-1.5 block text-sm font-medium text-gray-700">
                        Buffer before (min)
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        max={240}
                        step={5}
                        value={s.bufferBeforeMin}
                        onChange={(e) =>
                          updateService(s.id, {
                            bufferBeforeMin: Math.max(
                              0,
                              Math.min(240, Number(e.target.value) || 0),
                            ),
                          })
                        }
                        className={fieldClass}
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Time blocked before this service starts (e.g. setup).
                      </p>
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-sm font-medium text-gray-700">
                        Buffer after (min)
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        max={240}
                        step={5}
                        value={s.bufferAfterMin}
                        onChange={(e) =>
                          updateService(s.id, {
                            bufferAfterMin: Math.max(
                              0,
                              Math.min(240, Number(e.target.value) || 0),
                            ),
                          })
                        }
                        className={fieldClass}
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Cleanup / turnover time blocked after this service.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-4">
                    <div className="flex items-baseline justify-between">
                      <Label className="text-sm font-medium text-gray-700">
                        Processing time (optional)
                      </Label>
                      <span className="text-[11px] text-gray-500">
                        For colour, perms, etc — chair freed during processing
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div>
                        <Label className="mb-1.5 block text-xs font-medium text-gray-600">
                          Active before (min)
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          max={480}
                          step={5}
                          value={s.processingBeforeMin}
                          onChange={(e) =>
                            updateService(s.id, {
                              processingBeforeMin: Math.max(
                                0,
                                Math.min(480, Number(e.target.value) || 0),
                              ),
                            })
                          }
                          className={fieldClass}
                        />
                      </div>
                      <div>
                        <Label className="mb-1.5 block text-xs font-medium text-gray-600">
                          Processing (min)
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          max={480}
                          step={5}
                          value={s.processingMin}
                          onChange={(e) =>
                            updateService(s.id, {
                              processingMin: Math.max(
                                0,
                                Math.min(480, Number(e.target.value) || 0),
                              ),
                            })
                          }
                          className={fieldClass}
                        />
                      </div>
                      <div>
                        <Label className="mb-1.5 block text-xs font-medium text-gray-600">
                          Active after (min)
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          max={480}
                          step={5}
                          value={s.processingAfterMin}
                          onChange={(e) =>
                            updateService(s.id, {
                              processingAfterMin: Math.max(
                                0,
                                Math.min(480, Number(e.target.value) || 0),
                              ),
                            })
                          }
                          className={fieldClass}
                        />
                      </div>
                    </div>
                    {s.processingMin > 0 ? (
                      <p className="mt-2 text-xs text-gray-500">
                        Total stylist time:{" "}
                        {s.processingBeforeMin + s.processingAfterMin} min ·
                        Hands-off: {s.processingMin} min
                      </p>
                    ) : null}
                  </div>

                  <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium text-gray-700">
                          Require deposit to book online
                        </Label>
                        <p className="mt-0.5 text-xs text-gray-500">
                          When on, the public booking page charges a deposit
                          before confirming the appointment.
                        </p>
                      </div>
                      <Switch
                        checked={s.depositRequired}
                        onCheckedChange={(v) =>
                          updateService(s.id, { depositRequired: Boolean(v) })
                        }
                        className="h-5 w-9 data-checked:bg-gray-900 dark:data-checked:bg-gray-900"
                      />
                    </div>
                    {s.depositRequired ? (
                      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <Label className="mb-1.5 block text-sm font-medium text-gray-700">
                            Deposit amount (€)
                          </Label>
                          <Input
                            inputMode="decimal"
                            value={
                              s.depositAmountCents == null
                                ? ""
                                : (s.depositAmountCents / 100).toFixed(2)
                            }
                            onChange={(e) => {
                              const raw = e.target.value.trim();
                              if (!raw) {
                                updateService(s.id, {
                                  depositAmountCents: null,
                                });
                                return;
                              }
                              const eur = Number(raw);
                              if (!Number.isFinite(eur) || eur < 0) return;
                              updateService(s.id, {
                                depositAmountCents: Math.round(eur * 100),
                                depositPercent: null,
                              });
                            }}
                            placeholder="20.00"
                            className={fieldClass}
                          />
                        </div>
                        <div>
                          <Label className="mb-1.5 block text-sm font-medium text-gray-700">
                            …or % of price
                          </Label>
                          <Input
                            type="number"
                            min={1}
                            max={100}
                            value={s.depositPercent ?? ""}
                            onChange={(e) => {
                              const raw = e.target.value.trim();
                              if (!raw) {
                                updateService(s.id, { depositPercent: null });
                                return;
                              }
                              const n = Math.round(Number(raw));
                              if (!Number.isFinite(n) || n < 1 || n > 100)
                                return;
                              updateService(s.id, {
                                depositPercent: n,
                                depositAmountCents: null,
                              });
                            }}
                            placeholder="20"
                            className={fieldClass}
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            Use either a fixed amount or a percentage — not both.
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {extendedSchema ? (
                    <>
                      <div>
                        <Label
                          htmlFor={`${s.id}-desc`}
                          className="mb-1.5 block text-sm font-medium text-gray-700"
                        >
                          Public description
                        </Label>
                        <Textarea
                          id={`${s.id}-desc`}
                          value={s.description}
                          onChange={(e) =>
                            updateService(s.id, {
                              description: e.target.value,
                            })
                          }
                          placeholder="What's included — shown to clients on your booking page"
                          rows={3}
                          className={cn(fieldClass, "min-h-[5rem] resize-y")}
                        />
                      </div>
                      <div>
                        <div className="mb-1.5">
                          <Label
                            htmlFor={`${s.id}-ai`}
                            className="block text-sm font-medium text-gray-700"
                          >
                            AI secret instructions (optional)
                          </Label>
                          <p className="mt-0.5 text-xs text-gray-500">
                            Hidden from the public. Tell the AI things like
                            &ldquo;Remind them this takes 3 hours&rdquo; or
                            &ldquo;Ask if they have box dye in their hair.&rdquo;
                          </p>
                        </div>
                        <Textarea
                          id={`${s.id}-ai`}
                          value={s.aiVoiceNotes}
                          onChange={(e) =>
                            updateService(s.id, {
                              aiVoiceNotes: e.target.value,
                            })
                          }
                          placeholder="Remind them this takes 3 hours. Ask if they have box dye in their hair."
                          rows={3}
                          className={cn(fieldClass, "min-h-[5rem] resize-y")}
                        />
                      </div>
                    </>
                  ) : null}
                </div>
              </AccordionPrimitive.Panel>
            </AccordionPrimitive.Item>
          ))}
        </AccordionPrimitive.Root>

        <button
          type="button"
          onClick={addService}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-white py-4 text-sm font-medium text-gray-600 transition-all hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-gray-900/20 focus-visible:outline-none"
        >
          <Plus className="size-4 shrink-0" aria-hidden />
          Add service
        </button>
      </div>

      <ManageCategoriesDialog
        open={categoriesOpen}
        onOpenChange={setCategoriesOpen}
        categories={categories}
        onChange={setCategories}
      />

      <ManageAddonsDialog
        open={addonsOpen}
        onOpenChange={setAddonsOpen}
        services={services.map((s) => ({
          id: s.id,
          name: s.name.trim() || "(unnamed)",
        }))}
      />

      <div className="sticky bottom-0 z-10 -mx-6 border-t border-gray-100 bg-white/95 px-6 pt-4 pb-2 backdrop-blur-sm md:hidden">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="flex h-11 w-full items-center justify-center rounded-lg bg-gray-900 text-sm font-semibold text-white shadow-md transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save services & team"}
        </button>
      </div>
    </div>
  );
}

function ManageCategoriesDialog({
  open,
  onOpenChange,
  categories,
  onChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categories: ServiceCategory[];
  onChange: (next: ServiceCategory[]) => void;
}) {
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<Record<string, string>>({});

  const submitNew = useCallback(() => {
    const name = newName.trim();
    if (!name) return;
    setError(null);
    startTransition(async () => {
      const res = await createServiceCategory({ name });
      if (res.ok) {
        onChange(res.categories);
        setNewName("");
      } else {
        setError(res.message);
      }
    });
  }, [newName, onChange]);

  const submitRename = useCallback(
    (id: string) => {
      const name = (editing[id] ?? "").trim();
      if (!name) return;
      setError(null);
      startTransition(async () => {
        const res = await renameServiceCategory({ id, name });
        if (res.ok) {
          onChange(res.categories);
          setEditing((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        } else {
          setError(res.message);
        }
      });
    },
    [editing, onChange],
  );

  const submitDelete = useCallback(
    (id: string) => {
      if (
        !window.confirm(
          "Delete this category? Services in it become Uncategorised.",
        )
      ) {
        return;
      }
      setError(null);
      startTransition(async () => {
        const res = await deleteServiceCategory({ id });
        if (res.ok) {
          onChange(res.categories);
        } else {
          setError(res.message);
        }
      });
    },
    [onChange],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage categories</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitNew();
                }
              }}
              placeholder="e.g. Colour"
              className={fieldClass}
            />
            <Button
              type="button"
              onClick={submitNew}
              disabled={pending || !newName.trim()}
            >
              Add
            </Button>
          </div>
          {error ? (
            <p className="text-xs text-red-600">{error}</p>
          ) : null}
          {categories.length === 0 ? (
            <p className="text-sm text-gray-500">
              No categories yet. Add one above to group your services.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
              {categories.map((c) => {
                const editVal = editing[c.id];
                const isEditing = editVal !== undefined;
                return (
                  <li
                    key={c.id}
                    className="flex items-center gap-2 px-3 py-2"
                  >
                    {isEditing ? (
                      <Input
                        autoFocus
                        value={editVal}
                        onChange={(e) =>
                          setEditing((prev) => ({
                            ...prev,
                            [c.id]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            submitRename(c.id);
                          }
                          if (e.key === "Escape") {
                            setEditing((prev) => {
                              const next = { ...prev };
                              delete next[c.id];
                              return next;
                            });
                          }
                        }}
                        className={fieldClass}
                      />
                    ) : (
                      <span className="flex-1 text-sm text-gray-900">
                        {c.name}
                      </span>
                    )}
                    {isEditing ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setEditing((prev) => {
                              const next = { ...prev };
                              delete next[c.id];
                              return next;
                            })
                          }
                          disabled={pending}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => submitRename(c.id)}
                          disabled={pending}
                        >
                          Save
                        </Button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="text-xs font-medium text-gray-500 hover:text-gray-900"
                          onClick={() =>
                            setEditing((prev) => ({ ...prev, [c.id]: c.name }))
                          }
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          className="text-xs font-medium text-gray-500 hover:text-red-600"
                          onClick={() => submitDelete(c.id)}
                          disabled={pending}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatEur(cents: number): string {
  if (!Number.isFinite(cents) || cents === 0) return "Free";
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function ManageAddonsDialog({
  open,
  onOpenChange,
  services,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  services: { id: string; name: string }[];
}) {
  const [addons, setAddons] = useState<ServiceAddon[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [draftName, setDraftName] = useState("");
  const [draftPriceEur, setDraftPriceEur] = useState("");
  const [draftDuration, setDraftDuration] = useState("");
  const [draftServiceId, setDraftServiceId] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const res = await listServiceAddons();
      if (cancelled) return;
      if (res.ok) {
        setAddons(res.addons);
      } else {
        setError(res.message);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const submitNew = useCallback(() => {
    const name = draftName.trim();
    if (!name) return;
    setError(null);
    const priceCents = Math.max(
      0,
      Math.round(Number.parseFloat(draftPriceEur || "0") * 100) || 0,
    );
    const durationMinutes = Math.max(
      0,
      Math.round(Number.parseInt(draftDuration || "0", 10) || 0),
    );
    const serviceId = draftServiceId || null;
    startTransition(async () => {
      const res = await createServiceAddon({
        name,
        priceCents,
        durationMinutes,
        serviceId,
      });
      if (res.ok) {
        setAddons((prev) =>
          [...prev, res.addon].sort((a, b) => a.name.localeCompare(b.name)),
        );
        setDraftName("");
        setDraftPriceEur("");
        setDraftDuration("");
        setDraftServiceId("");
      } else {
        setError(res.message);
      }
    });
  }, [draftName, draftPriceEur, draftDuration, draftServiceId]);

  const handleUpdate = useCallback(
    (id: string, patch: Partial<ServiceAddon>) => {
      setAddons((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      );
      startTransition(async () => {
        const res = await updateServiceAddon({
          id,
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.priceCents !== undefined
            ? { priceCents: patch.priceCents }
            : {}),
          ...(patch.durationMinutes !== undefined
            ? { durationMinutes: patch.durationMinutes }
            : {}),
          ...("serviceId" in patch
            ? { serviceId: patch.serviceId ?? null }
            : {}),
          ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
        });
        if (!res.ok) setError(res.message);
      });
    },
    [],
  );

  const handleDelete = useCallback((id: string) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm("Delete this add-on?")
    ) {
      return;
    }
    setAddons((prev) => prev.filter((a) => a.id !== id));
    startTransition(async () => {
      const res = await deleteServiceAddon(id);
      if (!res.ok) setError(res.message);
    });
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage add-ons</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <p className="text-xs text-gray-500">
            Add-ons appear next to a service in the booking flow. Customers can
            pick any number of them; each add-on adds its own price and
            duration. Leave the service blank to offer the add-on with every
            service.
          </p>

          <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3">
            <Label className="text-xs font-medium text-gray-700">
              New add-on
            </Label>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
              <Input
                placeholder="e.g. Toner"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
              />
              <Input
                placeholder="€"
                inputMode="decimal"
                value={draftPriceEur}
                onChange={(e) => setDraftPriceEur(e.target.value)}
              />
              <Input
                placeholder="min"
                inputMode="numeric"
                value={draftDuration}
                onChange={(e) => setDraftDuration(e.target.value)}
              />
              <Button
                type="button"
                onClick={submitNew}
                disabled={pending || !draftName.trim()}
              >
                Add
              </Button>
            </div>
            <select
              value={draftServiceId}
              onChange={(e) => setDraftServiceId(e.target.value)}
              className="mt-2 block w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700"
            >
              <option value="">All services</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  Only with: {s.name}
                </option>
              ))}
            </select>
          </div>

          {error ? (
            <p className="text-xs text-red-600">{error}</p>
          ) : null}

          {loading ? (
            <p className="text-sm text-gray-500">Loading add-ons…</p>
          ) : addons.length === 0 ? (
            <p className="text-sm text-gray-500">
              No add-ons yet. Create one above to get started.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
              {addons.map((a) => (
                <li
                  key={a.id}
                  className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-[2fr_1fr_1fr_2fr_auto] sm:items-center"
                >
                  <Input
                    value={a.name}
                    onChange={(e) =>
                      setAddons((prev) =>
                        prev.map((x) =>
                          x.id === a.id ? { ...x, name: e.target.value } : x,
                        ),
                      )
                    }
                    onBlur={(e) => handleUpdate(a.id, { name: e.target.value })}
                  />
                  <Input
                    placeholder="€"
                    inputMode="decimal"
                    value={(a.priceCents / 100).toFixed(2)}
                    onChange={(e) => {
                      const eur = Number(e.target.value);
                      if (!Number.isFinite(eur) || eur < 0) return;
                      setAddons((prev) =>
                        prev.map((x) =>
                          x.id === a.id
                            ? { ...x, priceCents: Math.round(eur * 100) }
                            : x,
                        ),
                      );
                    }}
                    onBlur={() =>
                      handleUpdate(a.id, { priceCents: a.priceCents })
                    }
                  />
                  <Input
                    placeholder="min"
                    inputMode="numeric"
                    value={String(a.durationMinutes)}
                    onChange={(e) => {
                      const v = Math.max(
                        0,
                        Number.parseInt(e.target.value || "0", 10) || 0,
                      );
                      setAddons((prev) =>
                        prev.map((x) =>
                          x.id === a.id ? { ...x, durationMinutes: v } : x,
                        ),
                      );
                    }}
                    onBlur={() =>
                      handleUpdate(a.id, { durationMinutes: a.durationMinutes })
                    }
                  />
                  <select
                    value={a.serviceId ?? ""}
                    onChange={(e) =>
                      handleUpdate(a.id, {
                        serviceId: e.target.value || null,
                      })
                    }
                    className="block w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700"
                  >
                    <option value="">All services</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-[11px] text-gray-500">
                      {formatEur(a.priceCents)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDelete(a.id)}
                      className="rounded-md border border-transparent p-1 text-gray-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                      aria-label="Delete add-on"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
