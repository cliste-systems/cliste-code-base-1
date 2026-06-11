"use client";

import { FileText, Loader2, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import { listOnboardingBusinessFiles } from "@/app/(onboarding)/onboarding/knowledge/knowledge-files-actions";
import { OnboardingPrimaryButton } from "@/components/onboarding/onboarding-primary-button";
import { OnboardingSelect } from "@/components/onboarding/onboarding-select";
import { Switch } from "@/components/ui/switch";
import {
  BUSINESS_FILE_KINDS,
  BUSINESS_FILE_KIND_LABELS,
  businessFileKindLabel,
  fileSupportsAnswerToggle,
  formatBusinessFileDate,
  formatBusinessFileSize,
  type BusinessFileKind,
  type BusinessFileListItem,
} from "@/lib/business-files";
import {
  ONBOARDING_FIELD_BOX,
  ONBOARDING_FIELD_LABEL,
} from "@/components/onboarding/onboarding-ui";
import { cn } from "@/lib/utils";

type UploadResult =
  | { ok: true; file?: BusinessFileListItem }
  | { ok: false; message: string };

type ActionResult = { ok: true } | { ok: false; message: string };

type Props = {
  active: boolean;
  onUpload: (formData: FormData) => Promise<UploadResult>;
  onToggle: (
    id: string,
    patch: { answerEnabled?: boolean; sendEnabled?: boolean },
  ) => Promise<ActionResult>;
  onDelete: (id: string) => Promise<ActionResult>;
};

export function OnboardingKnowledgeFiles({
  active,
  onUpload,
  onToggle,
  onDelete,
}: Props) {
  const [files, setFiles] = useState<BusinessFileListItem[] | null>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [documentKind, setDocumentKind] = useState<BusinessFileKind>("price_list");
  const inputRef = useRef<HTMLInputElement>(null);
  const loadStartedRef = useRef(false);

  useEffect(() => {
    if (!active || loadStartedRef.current) return;
    loadStartedRef.current = true;
    void listOnboardingBusinessFiles().then(setFiles);
  }, [active]);

  function runUpload(file: File) {
    setMessage(null);
    const formData = new FormData();
    formData.set("file", file);
    formData.set("documentKind", documentKind);
    startTransition(async () => {
      const res = await onUpload(formData);
      if (res.ok && res.file) {
        setFiles((prev) => [res.file!, ...(prev ?? [])]);
      } else if (!res.ok) {
        setMessage(res.message);
      }
    });
  }

  function handleToggle(
    id: string,
    patch: { answerEnabled?: boolean; sendEnabled?: boolean },
  ) {
    setMessage(null);
    startTransition(async () => {
      const res = await onToggle(id, patch);
      if (res.ok) {
        setFiles((prev) =>
          (prev ?? []).map((file) =>
            file.id === id
              ? {
                  ...file,
                  answerEnabled: patch.answerEnabled ?? file.answerEnabled,
                  sendEnabled: patch.sendEnabled ?? file.sendEnabled,
                }
              : file,
          ),
        );
      } else {
        setMessage(res.message);
      }
    });
  }

  function handleDelete(id: string) {
    setMessage(null);
    startTransition(async () => {
      const res = await onDelete(id);
      if (res.ok) {
        setFiles((prev) => (prev ?? []).filter((file) => file.id !== id));
      } else {
        setMessage(res.message);
      }
    });
  }

  const loading = files === null;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={ONBOARDING_FIELD_LABEL}>Document type</p>
          <OnboardingSelect
            id="documentKind"
            value={documentKind}
            options={BUSINESS_FILE_KINDS.map((kind) => ({
              value: kind,
              label: BUSINESS_FILE_KIND_LABELS[kind],
            }))}
            onValueChange={setDocumentKind}
          />
        </div>
        <OnboardingPrimaryButton
          type="button"
          pending={pending}
          disabled={loading}
          onClick={() => inputRef.current?.click()}
          className="h-10 shrink-0 px-4 text-[13px] shadow-[0_4px_16px_rgba(11,18,32,0.2)]"
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Upload className="size-3.5" aria-hidden />
          )}
          Upload
        </OnboardingPrimaryButton>
      </div>

      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept=".pdf,.csv,.xlsx,.xls,.txt,application/pdf,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) runUpload(file);
          event.target.value = "";
        }}
      />

      <p className="text-[11px] text-slate-400">PDF, CSV, XLSX, or TXT · max 10 MB</p>

      {message ? (
        <p className="text-[12px] font-medium text-red-600" role="alert">
          {message}
        </p>
      ) : null}

      {loading ? (
        <div className="flex min-h-[7.5rem] items-center justify-center rounded-2xl border border-dashed border-slate-300/90">
          <Loader2 className="size-5 animate-spin text-slate-400" aria-hidden />
        </div>
      ) : files.length === 0 ? (
        <div className="flex min-h-[7.5rem] items-center justify-center rounded-2xl border border-dashed border-slate-300/90 px-4 text-center">
          <p className="text-[14px] text-slate-500">
            No files yet. You can add files now or upload them later in Cara Setup.
          </p>
        </div>
      ) : (
        <ul className="max-h-[12rem] space-y-2 overflow-y-auto overscroll-y-contain">
          {files.map((file) => (
            <OnboardingFileRow
              key={file.id}
              file={file}
              pending={pending}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function OnboardingFileRow({
  file,
  pending,
  onToggle,
  onDelete,
}: {
  file: BusinessFileListItem;
  pending: boolean;
  onToggle: (
    id: string,
    patch: { answerEnabled?: boolean; sendEnabled?: boolean },
  ) => void;
  onDelete: (id: string) => void;
}) {
  const canAnswer = fileSupportsAnswerToggle(file);
  const kindLabel = businessFileKindLabel(file.documentKind);

  return (
    <li className={cn(ONBOARDING_FIELD_BOX, "space-y-3")}>
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
          <FileText className="size-3.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-[#0b1220]">
            {file.fileName}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {[kindLabel, formatBusinessFileSize(file.sizeBytes), formatBusinessFileDate(file.createdAt)]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => onDelete(file.id)}
          aria-label={`Remove ${file.fileName}`}
          className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      </div>

      <div className="space-y-2.5 border-t border-slate-100 pt-3">
        <ToggleRow
          label="Cara can answer from this"
          checked={file.answerEnabled}
          disabled={pending || !canAnswer}
          onCheckedChange={(checked) =>
            onToggle(file.id, { answerEnabled: checked })
          }
        />
        <ToggleRow
          label="Cara can send this to callers"
          checked={file.sendEnabled}
          disabled={pending}
          onCheckedChange={(checked) =>
            onToggle(file.id, { sendEnabled: checked })
          }
        />
      </div>
    </li>
  );
}

function ToggleRow({
  label,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex items-center justify-between gap-3",
        disabled && "opacity-50",
      )}
    >
      <span className="text-[13px] text-[#0b1220]">{label}</span>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        aria-label={label}
        className="data-checked:bg-[#0b1220]"
      />
    </label>
  );
}
