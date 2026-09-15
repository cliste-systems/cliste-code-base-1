"use client";

import { useEffect, useState } from "react";

import {
  callMediaRetentionRefreshMs,
  formatCallMediaRetentionFooter,
} from "@/lib/call-media-retention";
import { cn } from "@/lib/utils";

type CallMediaRetentionNoteProps = {
  createdAt: string;
  className?: string;
};

export function CallMediaRetentionNote({
  createdAt,
  className,
}: CallMediaRetentionNoteProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const refreshMs = callMediaRetentionRefreshMs(createdAt);
    if (refreshMs === null) return;

    const id = window.setInterval(() => setNow(new Date()), refreshMs);
    return () => window.clearInterval(id);
  }, [createdAt]);

  const text = formatCallMediaRetentionFooter(createdAt, now);
  if (!text) return null;

  return (
    <p
      className={cn(
        "whitespace-nowrap text-[11px] leading-none text-slate-500",
        className,
      )}
    >
      {text}
    </p>
  );
}
