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

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
  /** Bumps when org row reloads so team editor syncs from the server. */
  teamSyncKey: string;
};

export function ServicesView({
  extendedSchema = true,
  initialServices,
  initialTeamMembers,
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

  useEffect(() => {
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
          category: s.category,
          priceEur: s.priceEur,
          durationMin: s.durationMin,
          description: s.description,
          aiVoiceNotes: s.aiVoiceNotes,
          isPublished: s.isPublished,
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
  }, [router, services, teamRows]);

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
                      <Label
                        htmlFor={`${s.id}-cat`}
                        className="mb-1.5 block text-sm font-medium text-gray-700"
                      >
                        Category
                      </Label>
                      <Input
                        id={`${s.id}-cat`}
                        value={s.category}
                        onChange={(e) =>
                          updateService(s.id, { category: e.target.value })
                        }
                        placeholder="Colour, cuts…"
                        className={fieldClass}
                      />
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
