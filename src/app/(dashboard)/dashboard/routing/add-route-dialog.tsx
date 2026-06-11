"use client";

import Link from "next/link";
import { Bot } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { DashboardSelect } from "@/components/dashboard/dashboard-select";
import {
  DASHBOARD_INPUT_CLASS,
  DASHBOARD_PRIMARY_BUTTON_CLASS,
} from "@/components/dashboard/dashboard-surface";
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
import { Textarea } from "@/components/ui/textarea";
import type { BusinessFileListItem } from "@/lib/business-files";
import { onboardingPageVariants } from "@/components/onboarding/onboarding-motion";
import { dashboardVerticalCopy } from "@/lib/dashboard-vertical-copy";
import { cn } from "@/lib/utils";

import {
  switchRouteActionType,
  type RoutingCaraContext,
} from "./routing-cara-context";
import {
  formatRouteKeywordList,
  parseRouteKeywordList,
  routeActionType,
  routeNeedsSetup,
  type SavedRoute,
} from "./route-models";
import {
  mergeRouteKeywordsFromServices,
  RouteKeywordsChipEditor,
} from "./routing-route-keywords-editor";
import { RoutingRouteEditor } from "./routing-route-editor";
import type { RoutingSetupContext } from "./routing-setup-context";
import {
  ROUTE_ACTION_TYPE_BY_ID,
  type RouteActionType,
} from "./route-templates";
import { buildRouteCaraPov } from "./routing-route-cara-pov";
import {
  CARA_ALREADY_ON_CALL_COPY,
  findRedundantRouteFieldHints,
} from "./routing-route-field-hints";
import type { RouteLintWarning } from "./routing-validation";

const HINT_STORAGE_KEY = "cliste.routing.routeAiHintDismissed";

function triggerPresetsForNiche(niche: string): {
  id: string;
  label: string;
  name: string;
  actionType: RouteActionType;
}[] {
  const copy = dashboardVerticalCopy(niche);
  return [
    {
      id: "book",
      label: copy.routing.bookPresetLabel,
      name: copy.routing.bookPresetName,
      actionType: "send_link",
    },
    { id: "menu", label: "View menu", name: "View the menu", actionType: "send_file" },
    { id: "quote", label: "Get a quote", name: "Get a quote", actionType: "take_message" },
    {
      id: "directions",
      label: "Get directions",
      name: "Where are you based",
      actionType: "directions",
    },
    {
      id: "speak",
      label: "Speak to someone",
      name: "Speak to someone",
      actionType: "transfer",
    },
  ];
}

const ACTION_OPTIONS: RouteActionType[] = [
  "send_link",
  "send_file",
  "take_message",
  "transfer",
];

type Stage = "flow" | "intro" | "details" | "pov";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  route: SavedRoute | null;
  isNew: boolean;
  sendableFiles: BusinessFileListItem[];
  caraContext: RoutingCaraContext;
  setupContext: RoutingSetupContext;
  otherNames: string[];
  lintWarnings: RouteLintWarning[];
  onChange: (route: SavedRoute) => void;
  onSave: () => void;
};

function hintDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(HINT_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function dismissHintForever() {
  try {
    window.localStorage.setItem(HINT_STORAGE_KEY, "1");
  } catch {
    /* private mode */
  }
}

/** Hide the built-in inbox default so Rules shows placeholder-only for new routes. */
function rulesFieldValue(note: string): string {
  const t = note.trim();
  if (!t) return "";
  const lower = t.toLowerCase();
  if (
    lower.includes("capture their name") &&
    lower.includes("phone number") &&
    lower.includes("what they need")
  ) {
    return "";
  }
  return t;
}

export function AddRouteDialog({
  open,
  onOpenChange,
  route,
  isNew,
  sendableFiles,
  caraContext,
  setupContext,
  otherNames,
  lintWarnings,
  onChange,
  onSave,
}: Props) {
  const nameId = useId();
  const keywordsId = useId();
  const descId = useId();
  const rulesId = useId();
  const reduceMotion = useReducedMotion();
  const verticalCopy = useMemo(
    () => dashboardVerticalCopy(setupContext.niche),
    [setupContext.niche],
  );
  const triggerPresets = useMemo(
    () => triggerPresetsForNiche(setupContext.niche),
    [setupContext.niche],
  );

  const [stage, setStage] = useState<Stage>("flow");
  const [triggerId, setTriggerId] = useState("");

  useEffect(() => {
    if (!open) {
      setStage("flow");
      setTriggerId("");
      return;
    }
    if (isNew) {
      setStage("flow");
      setTriggerId("");
      return;
    }
    setStage("details");
    const match = triggerPresets.find((p) => p.name === route?.name.trim());
    setTriggerId(match?.id ?? "");
    // Only reset when the dialog opens — not when route fields update mid-flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- route?.name intentionally omitted
  }, [open, isNew, route?.id, triggerPresets]);

  const caraPov = useMemo(
    () =>
      route
        ? buildRouteCaraPov(route, sendableFiles)
        : { will: [] as string[], wont: [] as string[] },
    [route, sendableFiles],
  );

  const fieldHints = useMemo(
    () =>
      route
        ? findRedundantRouteFieldHints(
            route.description ?? "",
            rulesFieldValue(route.note),
            verticalCopy.routing.fieldHintExample,
          )
        : [],
    [route, verticalCopy.routing.fieldHintExample],
  );

  if (!route) return null;

  const descHints = fieldHints.filter((h) => h.field === "description");
  const rulesHints = fieldHints.filter((h) => h.field === "rules");

  const activeType = routeActionType(route);
  const patch = (partial: Partial<SavedRoute>) => onChange({ ...route, ...partial });

  const applyTrigger = (id: string) => {
    setTriggerId(id);
    const preset = triggerPresets.find((p) => p.id === id);
    if (!preset) return;
    const next = switchRouteActionType(route, preset.actionType, caraContext);
    onChange({
      ...next,
      name: "",
      keywords: "",
      description: "",
      note: "",
    });
  };

  const applyAction = (actionType: RouteActionType) => {
    const next = switchRouteActionType(route, actionType, caraContext);
    onChange({ ...next, note: "" });
  };

  const needsDestination =
    activeType === "send_link" ||
    activeType === "send_file" ||
    activeType === "directions" ||
    activeType === "transfer";

  const flowReady =
    triggerId.length > 0 &&
    (!needsDestination || !routeNeedsSetup(route)) &&
    (activeType !== "transfer" || setupContext.transferAllowed);

  const keywordList = parseRouteKeywordList(route.keywords);

  const detailsReady =
    route.name.trim().length > 0 &&
    keywordList.length > 0 &&
    fieldHints.length === 0;

  const goToDetailsStage = () => {
    if (hintDismissed()) {
      setStage("details");
    } else {
      setStage("intro");
    }
  };

  const motionProps = reduceMotion
    ? {}
    : {
        variants: onboardingPageVariants,
        initial: "initial" as const,
        animate: "animate" as const,
        exit: "exit" as const,
      };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        overlayClassName="bg-black/30 backdrop-blur-sm"
        className="gap-0 overflow-hidden border border-slate-200 bg-white p-0 sm:max-w-lg"
      >
        <DialogHeader className="space-y-0 border-b border-slate-100 px-5 pt-5 pb-4 text-left">
          <DialogTitle className="text-[17px] font-semibold text-[#0b1220]">
            {isNew ? "Create a route" : "Edit route"}
          </DialogTitle>
          <DialogDescription className="mt-2 text-[13px] leading-relaxed text-slate-600">
            {stage === "flow"
              ? "Pick what the caller wants and what Cara should do."
              : stage === "pov"
                ? "Check this matches what you want — Cara will follow it on live calls."
                : "Name, keywords, description, and rules — each tells Cara something different."}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[min(60vh,520px)] overflow-y-auto overscroll-y-contain">
          <AnimatePresence mode="wait">
            {stage === "flow" ? (
              <motion.div key="flow" {...motionProps} className="space-y-4 px-5 py-4">
                <FlowLine n={1} label="Call comes in" muted />

                <div>
                  <FlowLine n={2} label="If customer wants to…" />
                  <DashboardSelect
                    className="mt-2"
                    value={triggerId}
                    placeholder="Choose an option…"
                    aria-label="If customer wants to"
                    options={triggerPresets.map((p) => ({
                      value: p.id,
                      label: p.label,
                    }))}
                    onValueChange={applyTrigger}
                  />
                </div>

                <div>
                  <FlowLine n={3} label="Then" />
                  <DashboardSelect
                    className="mt-2"
                    value={activeType}
                    aria-label="Then"
                    options={ACTION_OPTIONS.map((id) => {
                      const meta = ROUTE_ACTION_TYPE_BY_ID.get(id)!;
                      return { value: id, label: meta.label };
                    })}
                    onValueChange={(value) => applyAction(value as RouteActionType)}
                  />
                </div>

                {needsDestination ? (
                  <div>
                    <FlowLine n={4} label="Choose destination" />
                    <div className="mt-2">
                      <RoutingRouteEditor
                        route={route}
                        sendableFiles={sendableFiles}
                        caraContext={caraContext}
                        setupContext={setupContext}
                        otherNames={otherNames}
                        onChange={onChange}
                        onSave={() => {}}
                        onCancel={() => {}}
                        destinationOnly
                      />
                    </div>
                  </div>
                ) : null}
              </motion.div>
            ) : null}

            {stage === "intro" ? (
              <motion.div
                key="intro"
                {...motionProps}
                className="space-y-4 px-5 py-5"
              >
                <div className="rounded-xl border border-[#0b1220]/10 bg-slate-50/90 px-4 py-4">
                  <p className="text-[13px] font-semibold text-[#0b1220]">
                    Four fields — each does a different job
                  </p>
                  <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
                    Name is only for you. Cara listens to keywords, reads your
                    description and rules on live calls.
                  </p>
                  {verticalCopy.routing.exampleBlock ? (
                    <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[12px] leading-relaxed text-slate-700">
                      <p>
                        <span className="font-semibold text-[#0b1220]">Name:</span>{" "}
                        {verticalCopy.routing.exampleBlock.name}
                      </p>
                      <p>
                        <span className="font-semibold text-[#0b1220]">Keywords:</span>{" "}
                        {verticalCopy.routing.exampleBlock.keywords}
                      </p>
                      <p>
                        <span className="font-semibold text-[#0b1220]">Description:</span>{" "}
                        {verticalCopy.routing.exampleBlock.description}
                      </p>
                      <p>
                        <span className="font-semibold text-[#0b1220]">Rules:</span>{" "}
                        {verticalCopy.routing.exampleBlock.rules}
                      </p>
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      dismissHintForever();
                      setStage("details");
                    }}
                    className="h-9 justify-start px-0 text-[12px] text-slate-500 hover:bg-transparent hover:text-[#0b1220]"
                  >
                    Never show again
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setStage("details")}
                    className={cn(DASHBOARD_PRIMARY_BUTTON_CLASS, "w-full sm:w-auto")}
                  >
                    Continue
                  </Button>
                </div>
              </motion.div>
            ) : null}

            {stage === "details" ? (
              <motion.div key="details" {...motionProps} className="space-y-4 px-5 py-4">
                <div>
                  <label
                    htmlFor={nameId}
                    className="mb-1.5 block text-[12px] font-medium text-[#0b1220]"
                  >
                    Name
                  </label>
                  <Input
                    id={nameId}
                    value={route.name}
                    onChange={(e) => patch({ name: e.target.value })}
                    placeholder={verticalCopy.routing.namePlaceholder}
                    className={DASHBOARD_INPUT_CLASS}
                    autoFocus
                    maxLength={48}
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Your label in the list — Cara doesn&apos;t read this.
                  </p>
                </div>

                <div>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2">
                    <label
                      htmlFor={keywordsId}
                      className="text-[12px] font-medium text-[#0b1220]"
                    >
                      Keywords
                    </label>
                    {setupContext.servicesOffered.length > 0 ? (
                      <button
                        type="button"
                        onClick={() =>
                          patch({
                            keywords: formatRouteKeywordList(
                              mergeRouteKeywordsFromServices(
                                keywordList,
                                setupContext.servicesOffered,
                              ),
                            ),
                          })
                        }
                        className="shrink-0 text-[11px] font-medium text-slate-600 underline-offset-2 hover:text-[#0b1220] hover:underline"
                      >
                        Import from Services
                      </button>
                    ) : (
                      <Link
                        href="/dashboard/cara-setup/services"
                        className="shrink-0 text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-[#0b1220] hover:underline"
                      >
                        Add services in Setup
                      </Link>
                    )}
                  </div>
                  <RouteKeywordsChipEditor
                    inputId={keywordsId}
                    value={keywordList}
                    onChange={(items) =>
                      patch({ keywords: formatRouteKeywordList(items) })
                    }
                    placeholder={verticalCopy.routing.keywordPlaceholder}
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Type a phrase, then comma — or press Enter or Add. Import
                    from Services and remove any you don&apos;t need.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor={descId}
                    className="mb-1.5 block text-[12px] font-medium text-[#0b1220]"
                  >
                    Description
                  </label>
                  <Textarea
                    id={descId}
                    value={route.description ?? ""}
                    onChange={(e) => patch({ description: e.target.value })}
                    placeholder={verticalCopy.routing.descriptionPlaceholder}
                    rows={3}
                    className={cn(
                      DASHBOARD_INPUT_CLASS,
                      "min-h-[4.5rem] resize-none",
                      descHints.length > 0 && "border-amber-400 ring-1 ring-amber-200",
                    )}
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    When this route applies — not the send or confirm steps Cara
                    already does.
                  </p>
                  {descHints.map((h) => (
                    <p
                      key={h.id}
                      className="mt-1.5 text-[11px] leading-relaxed text-amber-900"
                    >
                      {h.message}
                    </p>
                  ))}
                </div>

                <div>
                  <label
                    htmlFor={rulesId}
                    className="mb-1.5 block text-[12px] font-medium text-[#0b1220]"
                  >
                    Rules
                  </label>
                  <Textarea
                    id={rulesId}
                    value={rulesFieldValue(route.note)}
                    onChange={(e) => patch({ note: e.target.value })}
                    placeholder={verticalCopy.routing.rulesPlaceholder}
                    rows={2}
                    className={cn(
                      DASHBOARD_INPUT_CLASS,
                      "min-h-[3.25rem] resize-none",
                      rulesHints.length > 0 && "border-amber-400 ring-1 ring-amber-200",
                    )}
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Only what&apos;s different for this route — optional.{" "}
                    {CARA_ALREADY_ON_CALL_COPY}
                  </p>
                  {rulesHints.map((h) => (
                    <p
                      key={h.id}
                      className="mt-1.5 text-[11px] leading-relaxed text-amber-900"
                    >
                      {h.message}
                    </p>
                  ))}
                </div>

                {lintWarnings.length > 0 ? (
                  <div className="space-y-1.5 rounded-lg border border-amber-200/80 bg-amber-50/70 px-3 py-2.5">
                    {lintWarnings.map((w) => (
                      <p
                        key={w.id}
                        className="text-[12px] leading-relaxed text-amber-950"
                      >
                        {w.message}{" "}
                        {w.href ? (
                          <Link href={w.href} className="font-medium underline">
                            {w.linkLabel ?? "Review"}
                          </Link>
                        ) : null}
                      </p>
                    ))}
                  </div>
                ) : null}
              </motion.div>
            ) : null}

            {stage === "pov" ? (
              <motion.div key="pov" {...motionProps} className="space-y-4 px-5 py-4">
                <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#0b1220] text-white">
                    <Bot className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#0b1220]">Cara&apos;s POV</p>
                    <p className="mt-0.5 text-[12px] text-slate-500">
                      How I&apos;ll handle &ldquo;
                      {keywordList[0] || "this request"}
                      &rdquo; on a call.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      I will
                    </p>
                    <ul className="mt-2 space-y-2">
                      {caraPov.will.map((line) => (
                        <li
                          key={line}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] leading-relaxed text-slate-700"
                        >
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      I will not
                    </p>
                    <ul className="mt-2 space-y-2">
                      {caraPov.wont.map((line) => (
                        <li
                          key={line}
                          className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5 text-[13px] leading-relaxed text-slate-600"
                        >
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {stage !== "intro" ? (
        <DialogFooter className="mb-0 flex-row justify-end gap-2 rounded-b-xl border-t border-slate-100 bg-white px-5 pt-4 pb-5">
          {stage === "flow" ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="h-10 rounded-xl border-slate-300 bg-white px-4 text-[13px]"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!flowReady}
                onClick={goToDetailsStage}
                className={DASHBOARD_PRIMARY_BUTTON_CLASS}
              >
                Continue
              </Button>
            </>
          ) : stage === "details" ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStage("flow")}
                className="h-10 rounded-xl border-slate-300 bg-white px-4 text-[13px]"
              >
                Back
              </Button>
              <Button
                type="button"
                disabled={!detailsReady}
                onClick={() => setStage("pov")}
                className={DASHBOARD_PRIMARY_BUTTON_CLASS}
              >
                Continue
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStage("details")}
                className="h-10 rounded-xl border-slate-300 bg-white px-4 text-[13px]"
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={() => {
                  onSave();
                  onOpenChange(false);
                }}
                className={DASHBOARD_PRIMARY_BUTTON_CLASS}
              >
                {isNew ? "Add route" : "Save route"}
              </Button>
            </>
          )}
        </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function FlowLine({
  n,
  label,
  muted,
}: {
  n: number;
  label: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
          muted ? "bg-slate-100 text-slate-400" : "bg-[#0b1220] text-white",
        )}
      >
        {n}
      </span>
      <span
        className={cn(
          "text-[13px] font-medium",
          muted ? "text-slate-400" : "text-[#0b1220]",
        )}
      >
        {label}
      </span>
    </div>
  );
}
