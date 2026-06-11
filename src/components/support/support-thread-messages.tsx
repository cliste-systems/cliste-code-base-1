"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { dashboardQuickEnterVariants } from "@/components/dashboard/dashboard-motion";
import { cn } from "@/lib/utils";

type ThreadMessage = {
  id: string;
  author_kind: string;
  body: string;
  created_at: string;
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function rowMeta(
  authorKind: string,
  perspective: "salon" | "admin",
): { isYou: boolean; label: string } {
  if (perspective === "salon") {
    return authorKind === "salon"
      ? { isYou: true, label: "You" }
      : { isYou: false, label: "Cliste" };
  }
  return authorKind === "admin"
    ? { isYou: true, label: "You" }
    : { isYou: false, label: "Salon" };
}

type SupportThreadMessagesProps = {
  openedAt: string;
  initialBody: string;
  messages: ThreadMessage[];
  perspective: "salon" | "admin";
};

export function SupportThreadMessages({
  openedAt,
  initialBody,
  messages,
  perspective,
}: SupportThreadMessagesProps) {
  const reduceMotion = useReducedMotion();
  const endRef = useRef<HTMLDivElement>(null);

  const thread: {
    key: string;
    author_kind: string;
    body: string;
    created_at: string;
  }[] = [
    {
      key: "initial",
      author_kind: "salon",
      body: initialBody,
      created_at: openedAt,
    },
    ...messages.map((m) => ({
      key: m.id,
      author_kind: m.author_kind,
      body: m.body,
      created_at: m.created_at,
    })),
  ];

  useEffect(() => {
    const end = endRef.current;
    if (!end) return;

    const scrollRegion = end.closest<HTMLElement>("[data-support-thread-scroll]");
    if (!scrollRegion) return;

    scrollRegion.scrollTo({
      top: scrollRegion.scrollHeight,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [thread.length, reduceMotion]);

  return (
    <div
      className="flex flex-col gap-1.5"
      role="log"
      aria-label="Ticket conversation"
    >
      <AnimatePresence initial={false}>
        {thread.map((m) => {
          const { isYou, label } = rowMeta(m.author_kind, perspective);

          const bubble = (
            <div
              className={cn(
                "flex w-full",
                isYou ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "flex max-w-[min(100%,24rem)] flex-col gap-0.5",
                  isYou ? "items-end" : "items-start",
                )}
              >
                <div
                  className={cn(
                    "inline-block max-w-full rounded-xl px-2.5 py-1.5 text-[13px] leading-snug whitespace-pre-wrap break-words",
                    isYou
                      ? "bg-[#0b1220] text-white"
                      : "border border-slate-200 bg-white text-[#0b1220] shadow-sm",
                  )}
                >
                  {m.body}
                </div>
                <span
                  className={cn(
                    "px-0.5 text-[10px] leading-none text-slate-500",
                    isYou ? "text-right" : "text-left",
                  )}
                >
                  <span className="font-medium text-slate-600">{label}</span>
                  <span aria-hidden> · </span>
                  <time dateTime={m.created_at} className="tabular-nums">
                    {formatTimestamp(m.created_at)}
                  </time>
                </span>
              </div>
            </div>
          );

          if (reduceMotion) {
            return <div key={m.key}>{bubble}</div>;
          }

          return (
            <motion.div
              key={m.key}
              variants={dashboardQuickEnterVariants}
              initial="hidden"
              animate="show"
            >
              {bubble}
            </motion.div>
          );
        })}
      </AnimatePresence>
      <div ref={endRef} className="h-px shrink-0" aria-hidden />
    </div>
  );
}
