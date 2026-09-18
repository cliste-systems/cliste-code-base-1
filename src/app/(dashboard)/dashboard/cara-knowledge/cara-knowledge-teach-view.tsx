"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import {
  CaraKnowledgeSectionHeader,
} from "@/app/(dashboard)/dashboard/cara-knowledge/cara-knowledge-hub-shell";
import { startOwnerInitiatedTraining } from "@/app/(dashboard)/dashboard/cara-training/actions";
import {
  DASHBOARD_CARD_SURFACE,
  DASHBOARD_INPUT_CLASS,
  DASHBOARD_PRIMARY_BUTTON_CLASS,
} from "@/components/dashboard/dashboard-surface";
import { Textarea } from "@/components/ui/textarea";
import { suggestKnowledgeAssignment } from "@/lib/cara-knowledge-classification";
import { UNSORTED_KNOWLEDGE_FOLDER_ID } from "@/lib/cara-knowledge-folders";
import type { CaraKnowledgeFolderPageData } from "@/lib/load-cara-knowledge-folders";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";
import { cn } from "@/lib/utils";

export function CaraKnowledgeTeachView({
  initialQuery = "",
  folders,
}: {
  initialQuery?: string;
  folders: CaraKnowledgeFolderPageData["folders"];
}) {
  const router = useRouter();
  const [text, setText] = useState(initialQuery);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const suggestion = useMemo(
    () => suggestKnowledgeAssignment(text, folders),
    [folders, text],
  );
  const classification = useMemo(
    () => ({
      folderId: suggestion.folderId,
      departmentIds: suggestion.departmentIds,
      topicLabels: suggestion.topicLabels,
    }),
    [suggestion],
  );

  return (
    <>
      <CaraKnowledgeSectionHeader
        title="Teach Cara"
        description="Add something Cara should know. Type naturally — Cara will organise it into the right place."
      />

      <div className={cn(DASHBOARD_CARD_SURFACE, "p-4")}>
        <label className="block text-[13px] font-medium text-[#0b1220]">
          What should Cara know?
        </label>
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Example: We do communion cakes — callers need to order at least 48 hours ahead."
          className={cn(DASHBOARD_INPUT_CLASS, "mt-2 min-h-[140px]")}
        />
        {text.trim() ? (
          <p className="mt-2 text-[12px] text-[#6b7c75]">
            {classification.folderId === UNSORTED_KNOWLEDGE_FOLDER_ID ? (
              <>Cara will choose the right section for you.</>
            ) : (
              <>
                Cara will save this to{" "}
                <strong className="text-[#35443f]">{suggestion.summary}</strong>
              </>
            )}
          </p>
        ) : null}
        {error ? (
          <p className="mt-2 text-[12px] text-red-700">{error}</p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending || !text.trim()}
            className={cn(DASHBOARD_PRIMARY_BUTTON_CLASS, "h-9 px-4 text-[12px]")}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await startOwnerInitiatedTraining(
                  text.trim(),
                  classification,
                );
                if (!result.ok) {
                  setError(result.message);
                  return;
                }
                router.push(
                  DASHBOARD_ROUTES.caraKnowledgeNeedsInputItem(result.itemId),
                );
                router.refresh();
              });
            }}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : "Teach Cara"}
          </button>
          <Link
            href={DASHBOARD_ROUTES.caraKnowledgeNeedsInput}
            className="inline-flex h-9 items-center px-3 text-[12px] font-medium text-slate-600 hover:text-slate-900"
          >
            Open needs your input
          </Link>
        </div>
      </div>
    </>
  );
}
