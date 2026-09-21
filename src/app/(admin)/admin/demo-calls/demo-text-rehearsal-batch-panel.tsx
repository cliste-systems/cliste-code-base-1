"use client";

import { useMemo, useState } from "react";
import { Copy, Loader2, Play, Sparkles } from "lucide-react";

import { AdminSectionCard } from "@/components/admin/admin-section-card";
import {
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
} from "@/components/admin/admin-interactive";
import type { AdminDemoCallLine } from "@/lib/admin-demo-call-lines";
import { formatIrishE164Display } from "@/lib/admin-demo-call-lines";
import {
  formatTextRehearsalExport,
  type TextRehearsalExportBatchRow,
} from "@/lib/text-rehearsal-export";
import {
  runIsolatedTextRehearsalTurn,
  startTextRehearsalSession,
} from "@/lib/text-rehearsal-client";
import { cn } from "@/lib/utils";

import {
  TextRehearsalIssueLog,
  useDemoCallEngineeringLog,
} from "./demo-call-engineering-log";

type VariantCount = 5 | 10 | 20;

type BatchRow = TextRehearsalExportBatchRow & {
  status: "pending" | "running" | "done" | "error";
};

type DemoTextRehearsalBatchPanelProps = {
  line: AdminDemoCallLine;
};

function parseVariantLines(raw: string): string[] {
  return [...new Set(raw.split("\n").map((line) => line.trim()).filter(Boolean))];
}

export function DemoTextRehearsalBatchPanel({ line }: DemoTextRehearsalBatchPanelProps) {
  const log = useDemoCallEngineeringLog({
    roomName: null,
    sessionStartedAt: null,
    enabled: true,
    pollSessionLog: false,
  });

  const [seed, setSeed] = useState("");
  const [variantDraft, setVariantDraft] = useState("");
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [generating, setGenerating] = useState<VariantCount | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const storeLabel = line.orgName;

  const exportText = useMemo(
    () =>
      formatTextRehearsalExport({
        mode: "batch",
        storeLabel,
        calledNumber: line.e164,
        seed,
        batchRows: rows.filter((row) => row.status === "done" || row.status === "error"),
        issues: log.entries,
      }),
    [line.e164, log.entries, rows, seed, storeLabel],
  );

  const generateVariants = async (count: VariantCount) => {
    const seedText = seed.trim();
    if (!seedText) return;

    setGenerating(count);
    setCopied(false);
    try {
      const res = await fetch("/api/admin/demo-call/text-rehearsal/variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed: seedText, count }),
      });
      const data = (await res.json()) as { variants?: string[]; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to generate variants.");
      }
      const variants = data.variants ?? [];
      setVariantDraft(variants.join("\n"));
      setRows(
        variants.map((variant, index) => ({
          index: index + 1,
          variant,
          caller: variant,
          status: "pending",
        })),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Variant generation failed.";
      log.append("error", "dashboard", message);
    } finally {
      setGenerating(null);
    }
  };

  const runBatch = async () => {
    const variants = parseVariantLines(variantDraft);
    if (!variants.length || running) return;

    setRunning(true);
    setCopied(false);
    log.reset();

    const nextRows: BatchRow[] = variants.map((variant, index) => ({
      index: index + 1,
      variant,
      caller: variant,
      status: "pending",
    }));
    setRows(nextRows);

    for (let i = 0; i < variants.length; i += 1) {
      const variant = variants[i]!;
      setProgress(`Running ${i + 1}/${variants.length}…`);
      setRows((prev) =>
        prev.map((row, rowIndex) =>
          rowIndex === i ? { ...row, status: "running" } : row,
        ),
      );

      try {
        const session = await startTextRehearsalSession(line.e164);
        const result = await runIsolatedTextRehearsalTurn({
          session,
          callerText: variant,
        });

        setRows((prev) =>
          prev.map((row, rowIndex) =>
            rowIndex === i
              ? {
                  ...row,
                  status: result.error ? "error" : "done",
                  roomName: session.roomName,
                  assistant: result.assistant,
                  tools: result.tools,
                  error: result.error ?? null,
                }
              : row,
          ),
        );

        if (result.error) {
          log.append("error", "worker", `${variant}: ${result.error}`);
        }
        for (const issue of result.toolIssues ?? []) {
          log.append("warn", "tool", `${variant}: ${issue}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Batch turn failed.";
        setRows((prev) =>
          prev.map((row, rowIndex) =>
            rowIndex === i
              ? { ...row, status: "error", error: message }
              : row,
          ),
        );
        log.append("error", "client", `${variant}: ${message}`);
      }
    }

    setProgress(null);
    setRunning(false);
  };

  const copyExport = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      log.append("error", "client", "Clipboard copy failed.");
    }
  };

  return (
    <AdminSectionCard
      title="Variant batch"
      description={`${storeLabel} · ${formatIrishE164Display(line.e164)} · isolated session per variant`}
      className="flex min-h-0 flex-1 flex-col"
      contentClassName="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
        <div className="grid shrink-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-gray-900">What a caller might say</span>
            <input
              value={seed}
              onChange={(event) => setSeed(event.target.value)}
              disabled={running || generating != null}
              placeholder="what steaks are on offer this week?"
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none placeholder:text-gray-400 focus:border-gray-300 focus:ring-2 focus:ring-gray-200/80 disabled:opacity-60"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {([5, 10, 20] as const).map((count) => (
              <button
                key={count}
                type="button"
                disabled={!seed.trim() || running || generating != null}
                onClick={() => void generateVariants(count)}
                className={`${adminSecondaryButtonClass} py-2`}
              >
                {generating === count ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Sparkles className="size-3.5" aria-hidden />
                )}
                {count} variants
              </button>
            ))}
          </div>
        </div>

        <label className="flex min-h-0 shrink-0 flex-col gap-1.5 lg:max-h-36">
          <span className="text-sm font-medium text-gray-900">
            Variants to run (one per line, editable)
          </span>
          <textarea
            value={variantDraft}
            onChange={(event) => setVariantDraft(event.target.value)}
            disabled={running}
            rows={4}
            className="min-h-24 w-full resize-none rounded-md border border-gray-200 bg-white px-3 py-2 font-mono text-xs text-gray-900 shadow-sm outline-none placeholder:text-gray-400 focus:border-gray-300 focus:ring-2 focus:ring-gray-200/80 disabled:opacity-60"
            placeholder="Generate variants above, or paste your own list…"
          />
        </label>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={running || !parseVariantLines(variantDraft).length}
            onClick={() => void runBatch()}
            className={`${adminPrimaryButtonClass} py-2`}
          >
            {running ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Play className="size-3.5" aria-hidden />
            )}
            Run all (fresh session each)
          </button>
          {progress ? <span className="text-sm text-gray-600">{progress}</span> : null}
          <button
            type="button"
            onClick={() => void copyExport()}
            className={`${adminSecondaryButtonClass} ml-auto py-2`}
          >
            <Copy className="size-3.5" aria-hidden />
            {copied ? "Copied" : "Copy all for Cursor"}
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-3 overflow-hidden lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
            <div className="shrink-0 border-b border-gray-200 px-3 py-2 text-xs font-medium uppercase tracking-wide text-gray-500">
              Results
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {rows.length === 0 ? (
                <p className="p-3 text-sm text-gray-500">
                  Generate variants, then run the batch to compare Cara replies side by side.
                </p>
              ) : (
                <div className="divide-y divide-gray-200">
                  {rows.map((row) => (
                    <div key={row.index} className="space-y-1 p-3 font-mono text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-blue-900">
                          {row.index}. Caller: {row.variant}
                        </p>
                        <span
                          className={cn(
                            "shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide",
                            row.status === "done" && "bg-emerald-100 text-emerald-800",
                            row.status === "error" && "bg-red-100 text-red-800",
                            row.status === "running" && "bg-amber-100 text-amber-800",
                            row.status === "pending" && "bg-gray-100 text-gray-600",
                          )}
                        >
                          {row.status}
                        </span>
                      </div>
                      {row.assistant ? (
                        <p className="whitespace-pre-wrap text-gray-900">{row.assistant}</p>
                      ) : null}
                      {row.tools?.map((tool) => (
                        <p key={`${row.index}-${tool.name}`} className="text-violet-800">
                          [Tool] {tool.name} {JSON.stringify(tool.args)}
                        </p>
                      ))}
                      {row.error ? (
                        <p className="whitespace-pre-wrap text-red-700">{row.error}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden">
            <TextRehearsalIssueLog entries={log.entries} className="min-h-0 flex-1" />
          </div>
        </div>
      </div>
    </AdminSectionCard>
  );
}
