import { Info } from "lucide-react";

import {
  businessFileKindLabel,
  type BusinessFileKind,
} from "@/lib/business-files";
import { BUSINESS_FILE_PROMPT_CHAR_BUDGET } from "@/lib/business-file-prompt";
import { cn } from "@/lib/utils";

type Props = {
  totalChars: number;
  documentKind?: string | null;
  className?: string;
  compact?: boolean;
};

function formatCharCount(chars: number): string {
  return chars.toLocaleString("en-IE");
}

function isMenuLikeKind(documentKind?: string | null): boolean {
  return documentKind === "price_list" || documentKind === "menu";
}

function menuLabel(documentKind?: string | null): string {
  if (documentKind === "price_list") return "price list";
  if (documentKind === "menu") return "menu";
  return "document";
}

export function FileTruncationNotice({
  totalChars,
  documentKind,
  className,
  compact = false,
}: Props) {
  const menuLike = isMenuLikeKind(documentKind);
  const kindLabel = businessFileKindLabel(documentKind as BusinessFileKind);
  const menuWord = menuLabel(documentKind);

  if (compact) {
    return (
      <p className={cn("text-[12px] leading-relaxed text-slate-600", className)}>
        {menuLike
          ? `We saved the whole ${menuWord} (${formatCharCount(totalChars)} characters). If someone asks about a specific item or price, Cara finds it — she won't read the whole thing aloud.`
          : `We saved the whole file (${formatCharCount(totalChars)} characters). If someone asks about something specific, Cara finds it — she won't read the whole thing aloud.`}
      </p>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200/90 bg-slate-50/90 px-3 py-2.5",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <Info
          className="mt-0.5 size-3.5 shrink-0 text-slate-500"
          aria-hidden
        />
        <div className="min-w-0 space-y-1">
          <p className="text-[12.5px] font-medium text-slate-900">
            {menuLike
              ? `Whole ${menuWord} saved — Cara looks things up on calls`
              : "Whole file saved — Cara looks things up on calls"}
          </p>
          <p className="text-[12px] leading-relaxed text-slate-600">
            {menuLike
              ? `We read all ${formatCharCount(totalChars)} characters from this ${menuWord}. When someone asks about a particular item or price, Cara finds the answer in the file. She won't read the whole ${menuWord} out loud.`
              : `We read all ${formatCharCount(totalChars)} characters from this ${kindLabel?.toLowerCase() ?? "file"}. When someone asks about a particular detail, Cara finds the answer in the file. She won't read the whole document out loud.`}
          </p>
          <p className="text-[11.5px] leading-relaxed text-slate-500">
            She only keeps a short preview in mind at the start of each call
            (about {Math.round(BUSINESS_FILE_PROMPT_CHAR_BUDGET / 1000)}k
            characters). The full file is always there when she needs to search
            it.
          </p>
        </div>
      </div>
    </div>
  );
}
