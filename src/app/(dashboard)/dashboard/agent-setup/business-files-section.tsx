"use client";

import Link from "next/link";
import { FileText, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DASHBOARD_ICON_CHIP_MD,
  DASHBOARD_ICON_GLYPH_MD,
  DASHBOARD_PRIMARY_BUTTON_CLASS,
} from "@/components/dashboard/dashboard-surface";
import {
  OnboardingFieldBox,
} from "@/components/onboarding/onboarding-form-card";
import { OnboardingSelect } from "@/components/onboarding/onboarding-select";
import { StatusPill } from "@/components/dashboard/status-pill";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  BUSINESS_FILE_KINDS,
  BUSINESS_FILE_KIND_LABELS,
  formatBusinessFileDate,
  formatBusinessFileSize,
  businessFileKindLabel,
  fileSupportsAnswerToggle,
  isSpreadsheetFileType,
  type BusinessFileKind,
  type BusinessFileListItem,
} from "@/lib/business-files";
import {
  buildFileExtractionPreview,
  extractedContentLooksLikePii,
  sliceFileTextForPrompt,
} from "@/lib/business-file-prompt";
import {
  fileCouldNotReadMessage,
  fileReadinessLabel,
} from "@/lib/answers-boundary";
import { cn } from "@/lib/utils";

type UploadResult =
  | { ok: true; file?: BusinessFileListItem }
  | { ok: false; message: string };

type ActionResult = { ok: true } | { ok: false; message: string };

type BusinessFilesSectionProps = {
  initialFiles: BusinessFileListItem[];
  variant?: "dashboard" | "onboarding";
  /** Call flow has send-link or send-file — required to enable "send to callers". */
  sendConfigured?: boolean;
  onUpload: (formData: FormData) => Promise<UploadResult>;
  onToggle: (
    id: string,
    patch: { answerEnabled?: boolean; sendEnabled?: boolean },
  ) => Promise<ActionResult>;
  onDelete: (id: string) => Promise<ActionResult>;
  /** Notified whenever the file list changes (upload, toggle, delete). */
  onFilesChange?: (files: BusinessFileListItem[]) => void;
};

export function BusinessFilesSection({
  initialFiles,
  variant = "dashboard",
  sendConfigured = false,
  onUpload,
  onToggle,
  onDelete,
  onFilesChange,
}: BusinessFilesSectionProps) {
  const [files, setFiles] = useState(initialFiles);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [uploadPreview, setUploadPreview] = useState<{
    fileName: string;
    preview: ReturnType<typeof buildFileExtractionPreview>;
    unreadable: boolean;
    piiWarning: boolean;
    truncated: boolean;
  } | null>(null);
  const [replacePrompt, setReplacePrompt] = useState<{
    file: File;
    existing: BusinessFileListItem;
  } | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [documentKind, setDocumentKind] = useState<BusinessFileKind>("price_list");
  const [piiDismissed, setPiiDismissed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const onboarding = variant === "onboarding";

  useEffect(() => {
    setFiles(initialFiles);
  }, [initialFiles]);

  function runUpload(file: File, options?: { skipReplaceCheck?: boolean }) {
    setMessage(null);
    setUploadPreview(null);

    const existing = files.find((f) => f.documentKind === documentKind);
    if (existing && !options?.skipReplaceCheck) {
      setReplacePrompt({ file, existing });
      return;
    }

    const formData = new FormData();
    formData.set("file", file);
    formData.set("documentKind", documentKind);
    startTransition(async () => {
      const res = await onUpload(formData);
      if (res.ok && res.file) {
        const uploaded = res.file;
        setFiles((prev) => {
          const next = [uploaded, ...prev];
          onFilesChange?.(next);
          return next;
        });

        const hasText = Boolean(uploaded.extractedText?.trim());
        const preview = buildFileExtractionPreview(uploaded.extractedText);
        const slice = sliceFileTextForPrompt(uploaded.extractedText);
        setUploadPreview({
          fileName: uploaded.fileName,
          preview,
          unreadable: !hasText,
          piiWarning:
            !piiDismissed &&
            hasText &&
            extractedContentLooksLikePii(uploaded.extractedText ?? ""),
          truncated: slice?.wasTruncated ?? false,
        });
        setMessage(null);
      } else if (!res.ok) {
        setMessage(res.message);
      }
    });
  }

  function toggle(
    id: string,
    patch: { answerEnabled?: boolean; sendEnabled?: boolean },
  ) {
    setMessage(null);
    startTransition(async () => {
      const res = await onToggle(id, patch);
      if (res.ok) {
        setFiles((prev) => {
          const next = prev.map((f) =>
            f.id === id
              ? {
                  ...f,
                  answerEnabled: patch.answerEnabled ?? f.answerEnabled,
                  sendEnabled: patch.sendEnabled ?? f.sendEnabled,
                }
              : f,
          );
          onFilesChange?.(next);
          return next;
        });
      } else {
        setMessage(res.message);
      }
    });
  }

  function confirmRemove() {
    if (!removeId) return;
    const id = removeId;
    setMessage(null);
    startTransition(async () => {
      const res = await onDelete(id);
      if (res.ok) {
        setFiles((prev) => {
          const next = prev.filter((f) => f.id !== id);
          onFilesChange?.(next);
          return next;
        });
        setRemoveId(null);
      } else {
        setMessage(res.message);
      }
    });
  }

  const uploadControls = (
    <div className="space-y-2.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div
          className={cn(
            "w-full shrink-0",
            onboarding ? "min-w-0 sm:max-w-xs" : "sm:w-44",
          )}
        >
          {onboarding ? (
            <OnboardingFieldBox label="Document type" htmlFor="documentKind">
              <OnboardingSelect
                id="documentKind"
                value={documentKind}
                options={BUSINESS_FILE_KINDS.map((kind) => ({
                  value: kind,
                  label: BUSINESS_FILE_KIND_LABELS[kind],
                }))}
                onValueChange={setDocumentKind}
              />
            </OnboardingFieldBox>
          ) : (
            <label className="block space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                Document type
              </span>
              <select
                id="documentKind"
                value={documentKind}
                onChange={(event) =>
                  setDocumentKind(event.target.value as BusinessFileKind)
                }
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-[13px] text-[#0b1220]"
              >
                {BUSINESS_FILE_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {BUSINESS_FILE_KIND_LABELS[kind]}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            accept=".pdf,.csv,.xlsx,.xls,.txt,application/pdf,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) runUpload(file);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
            className="h-9 w-fit shrink-0 rounded-xl bg-[#0b1220] px-3 text-[12px] font-medium text-white hover:bg-[#0b1220]/90"
          >
            <Upload className="size-3.5" aria-hidden />
            Upload file
          </Button>
          <p className="text-[12px] text-slate-500">
            PDF, CSV, XLSX, or TXT · max 10 MB
          </p>
        </div>
      </div>
      <p className="text-[12px] leading-relaxed text-slate-500">
        Don&apos;t upload documents containing customer or staff personal details
        — Cara may read from this on calls.
      </p>
    </div>
  );

  return (
    <div className={cn("space-y-3", onboarding && "space-y-4")}>
      {onboarding ? (
        <div className="rounded-xl border border-slate-200/75 bg-white px-4 py-3 shadow-[0_4px_20px_rgba(15,23,42,0.06)]">
          <p className="text-[13px] font-semibold text-[#0b1220]">How files are used</p>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-600">
            Upload price lists, menus, brochures, stock sheets, service sheets, or FAQ
            documents. Each file can help Cara answer questions, be sent to callers, or
            both.
          </p>
        </div>
      ) : null}

      {uploadControls}

      {message ? (
        <p className="text-[12px] text-red-600" role="alert">
          {message}
        </p>
      ) : null}

      {uploadPreview ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-[13px] font-semibold text-[#0b1220]">
            Here&apos;s what Cara read from {uploadPreview.fileName}
          </p>
          {uploadPreview.unreadable ? (
            <p className="mt-2 text-[12.5px] leading-relaxed text-amber-900">
              {fileCouldNotReadMessage()} The file is saved but won&apos;t be
              active on calls until it has readable content.
            </p>
          ) : uploadPreview.preview ? (
            <>
              <ul className="mt-2 space-y-1 text-[12.5px] text-slate-700">
                {uploadPreview.preview.items.map((item) => (
                  <li key={item} className="truncate">
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[12px] text-slate-500">
                {uploadPreview.preview.summary}
              </p>
            </>
          ) : null}
          {uploadPreview.truncated ? (
            <p className="mt-2 text-[12px] text-amber-900">
              This file is large — Cara has the first portion. Long documents are
              better split or trimmed.
            </p>
          ) : null}
          {uploadPreview.piiWarning ? (
            <p className="mt-2 text-[12px] text-amber-900">
              This file may contain personal contact details — only upload what
              Cara genuinely needs on calls.{" "}
              <button
                type="button"
                className="font-medium underline underline-offset-2"
                onClick={() => setPiiDismissed(true)}
              >
                Dismiss
              </button>
            </p>
          ) : null}
        </div>
      ) : null}

      {files.length === 0 ? (
        <div
          className={cn(
            "rounded-xl border border-dashed px-4",
            onboarding
              ? "border-slate-300/90 bg-white/80 py-6 text-center"
              : "border-slate-300 bg-slate-50/40 py-4",
          )}
        >
          <p className="text-[13px] font-medium text-[#0b1220]">No files uploaded yet</p>
          <p
            className={cn(
              "mt-1 text-[12px] leading-relaxed text-slate-500",
              !onboarding && "max-w-xl",
            )}
          >
            Add a price list, menu, brochure, stock sheet, service sheet, or FAQ
            document.
          </p>
        </div>
      ) : (
        <ul
          className={cn(
            "divide-y rounded-xl border bg-white",
            onboarding ? "divide-slate-100 border-slate-200/75" : "divide-slate-100 border-slate-200",
          )}
        >
          {files.map((file) => (
            <BusinessFileRow
              key={file.id}
              file={file}
              pending={pending}
              sendConfigured={sendConfigured}
              onToggle={toggle}
              onRemove={setRemoveId}
            />
          ))}
        </ul>
      )}

      <Dialog
        open={replacePrompt !== null}
        onOpenChange={(open) => !open && setReplacePrompt(null)}
      >
        <DialogContent className="gap-0 overflow-hidden border border-slate-200 bg-white p-0 sm:max-w-md">
          <DialogHeader className="space-y-0 px-5 pt-5 text-left">
            <DialogTitle className="text-[17px] font-semibold text-[#0b1220]">
              {replacePrompt?.existing.documentKind
                ? `Replace your existing ${businessFileKindLabel(replacePrompt.existing.documentKind as BusinessFileKind)?.toLowerCase() ?? "file"}?`
                : "Replace existing file?"}
            </DialogTitle>
            <DialogDescription className="mt-2 text-[13px] leading-relaxed text-slate-600">
              Replace removes the older file from Cara&apos;s knowledge, or keep
              both if you need overlapping documents.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row justify-end gap-2 border-t border-slate-100 px-5 py-4">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                if (!replacePrompt) return;
                const { file } = replacePrompt;
                setReplacePrompt(null);
                runUpload(file, { skipReplaceCheck: true });
              }}
              className="h-10 rounded-xl border-slate-300 bg-white px-4 text-[13px]"
            >
              Keep both
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!replacePrompt) return;
                const { file, existing } = replacePrompt;
                setReplacePrompt(null);
                startTransition(async () => {
                  const del = await onDelete(existing.id);
                  if (!del.ok) {
                    setMessage(del.message);
                    return;
                  }
                  setFiles((prev) => prev.filter((f) => f.id !== existing.id));
                  runUpload(file, { skipReplaceCheck: true });
                });
              }}
              className={DASHBOARD_PRIMARY_BUTTON_CLASS}
            >
              Replace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removeId !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveId(null);
        }}
        title="Remove this file?"
        description="Routes using it will need a new file."
        confirmLabel="Remove"
        onConfirm={confirmRemove}
        pending={pending}
        destructive
      />
    </div>
  );
}

function BusinessFileRow({
  file,
  pending,
  sendConfigured,
  onToggle,
  onRemove,
}: {
  file: BusinessFileListItem;
  pending: boolean;
  sendConfigured: boolean;
  onToggle: (
    id: string,
    patch: { answerEnabled?: boolean; sendEnabled?: boolean },
  ) => void;
  onRemove: (id: string) => void;
}) {
  const canAnswer = fileSupportsAnswerToggle(file);
  const status = fileReadinessLabel(file);
  const truncated = sliceFileTextForPrompt(file.extractedText)?.wasTruncated;
  const kindLabel = businessFileKindLabel(file.documentKind);

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-4">
      <span className={DASHBOARD_ICON_CHIP_MD}>
        <FileText className={DASHBOARD_ICON_GLYPH_MD} aria-hidden />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-[14px] font-semibold text-[#0b1220]">
            {file.fileName}
          </p>
          {kindLabel ? (
            <StatusPill className="border-slate-300/70 bg-white text-[10px]">
              {kindLabel}
            </StatusPill>
          ) : null}
          <StatusPill className="border-slate-300/70 bg-white text-[10px]">
            {file.fileType.toUpperCase()}
          </StatusPill>
          <StatusPill className="border-slate-300/70 bg-white text-[10px]">
            {status}
          </StatusPill>
        </div>
        <p className="text-[12px] text-slate-500">
          {formatBusinessFileDate(file.createdAt)} · {formatBusinessFileSize(file.sizeBytes)}
        </p>
        {isSpreadsheetFileType(file.fileType) ? (
          <p className="text-[11px] leading-relaxed text-slate-500">
            Uploaded spreadsheets are static until replaced. Re-upload when stock or
            prices change often.
          </p>
        ) : null}
        {!canAnswer ? (
          <p className="text-[11px] leading-relaxed text-amber-900/80">
            {fileCouldNotReadMessage()}
          </p>
        ) : null}
        {truncated ? (
          <p className="text-[11px] leading-relaxed text-amber-900/80">
            This file is large — Cara has the first portion on calls.
          </p>
        ) : null}
        <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:gap-6">
          <label
            className={cn(
              "flex items-start gap-2",
              !canAnswer && "opacity-60",
            )}
          >
            <Switch
              checked={file.answerEnabled}
              disabled={pending || !canAnswer}
              onCheckedChange={(checked) =>
                onToggle(file.id, { answerEnabled: checked })
              }
              aria-label="Cara can answer from this"
              className="mt-0.5 data-checked:bg-[#0b1220]"
            />
            <span className="text-[12px] leading-snug text-slate-700">
              <span className="font-medium text-[#0b1220]">Cara can answer from this</span>
              <span className="mt-0.5 block text-slate-500">
                Cara can use this file to answer caller questions.
              </span>
            </span>
          </label>
          <label
            className={cn(
              "flex items-start gap-2",
              !sendConfigured && "opacity-60",
            )}
          >
            <Switch
              checked={file.sendEnabled}
              disabled={pending || !sendConfigured || !canAnswer}
              onCheckedChange={(checked) =>
                onToggle(file.id, { sendEnabled: checked })
              }
              aria-label="Cara can send this to callers"
              className="mt-0.5 data-checked:bg-[#0b1220]"
            />
            <span className="text-[12px] leading-snug text-slate-700">
              <span className="font-medium text-[#0b1220]">Cara can send this to callers</span>
              <span className="mt-0.5 block text-slate-500">
                {sendConfigured
                  ? "Cara can text this file when callers ask."
                  : "Set up text links in Call flow first."}{" "}
                {!sendConfigured ? (
                  <Link
                    href="/dashboard/routing"
                    className="font-medium text-[#0b1220] underline underline-offset-2"
                  >
                    Call flow
                  </Link>
                ) : null}
              </span>
              {file.sendEnabled ? (
                <span className="mt-1 block text-amber-900/90">
                  Anyone who receives the link can open this file.
                </span>
              ) : null}
            </span>
          </label>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => onRemove(file.id)}
        aria-label={`Remove ${file.fileName}`}
        className="shrink-0 self-start text-slate-500 hover:text-slate-800"
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>
    </li>
  );
}
