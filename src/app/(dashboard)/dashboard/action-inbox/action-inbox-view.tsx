"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  CheckCircle,
  Inbox,
  PhoneForwarded,
} from "lucide-react";

import { markTicketResolved } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type ActionInboxTicket = {
  id: string;
  callerNumber: string;
  summary: string;
  createdAt: string;
};

type ActionInboxViewProps = {
  openTickets: ActionInboxTicket[];
  resolvedTickets: ActionInboxTicket[];
};

function telHref(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) return "#";
  const normalized = trimmed.replace(/[^\d+]/g, "");
  return normalized ? `tel:${normalized}` : "#";
}

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 45) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-IE", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function TicketCard({
  ticket,
  variant,
}: {
  ticket: ActionInboxTicket;
  variant: "open" | "resolved";
}) {
  const isOpen = variant === "open";
  const Icon = isOpen ? AlertCircle : PhoneForwarded;

  return (
    <Card
      className={cn(
        "w-full border-gray-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-shadow ring-0",
        isOpen && "hover:border-gray-300 hover:shadow-md",
        !isOpen && "bg-gray-50/40 opacity-[0.98]",
      )}
    >
      <CardHeader className="space-y-3 px-4 pt-4 pb-2 md:px-6 md:pt-6">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg ring-1",
              isOpen
                ? "bg-amber-500/10 text-amber-800 ring-amber-500/15"
                : "bg-gray-100 text-gray-600 ring-gray-200/80",
            )}
          >
            <Icon className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-base font-semibold text-gray-900">
                {ticket.callerNumber || "Unknown caller"}
              </p>
            </div>
            <p className="text-xs font-normal text-gray-500">
              {formatRelativeTime(ticket.createdAt)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-2 md:px-6">
        <p
          className={cn(
            "text-sm leading-relaxed text-gray-800",
            !isOpen && "text-gray-600",
          )}
        >
          {ticket.summary}
        </p>
      </CardContent>
      <CardFooter className="flex flex-col gap-3 px-4 pt-2 pb-4 sm:flex-row sm:items-center sm:justify-between md:px-6 md:pb-6">
        <a
          href={telHref(ticket.callerNumber)}
          className={cn(
            "inline-flex min-h-10 w-full items-center justify-center rounded-lg text-sm font-medium text-gray-900 underline-offset-4 hover:underline sm:min-h-0 sm:w-auto sm:justify-start",
            ticket.callerNumber.trim() ? "" : "pointer-events-none opacity-40",
          )}
        >
          Call {ticket.callerNumber || "—"}
        </a>
        {isOpen ? (
          <form action={markTicketResolved} className="w-full sm:w-auto sm:shrink-0">
            <input type="hidden" name="ticketId" value={ticket.id} />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="h-10 w-full min-w-[10rem] border-gray-200/80 bg-white sm:h-9"
            >
              Mark as Resolved
            </Button>
          </form>
        ) : null}
      </CardFooter>
    </Card>
  );
}

/**
 * Fixed viewport for both tabs so switching Open ↔ Resolved doesn’t jump the layout.
 * Inner content scrolls; empty states are centered inside the same frame.
 */
const TAB_PANEL_CLASS =
  "flex h-[min(32rem,calc(100vh-14rem))] min-h-[22rem] w-full min-w-0 flex-col gap-3 overflow-y-auto overscroll-contain rounded-xl border border-gray-200/80 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] [scrollbar-gutter:stable]";

function EmptyPanel({
  title,
  description,
  icon: Icon,
  className,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex w-full max-w-md flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-gray-200/70 bg-gray-50/30 p-8 text-center",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-50/40 via-white to-white"
        aria-hidden
      />
      <div className="relative z-10 flex flex-col items-center gap-2">
        <Icon className="size-10 text-gray-300" aria-hidden />
        <p className="font-semibold text-gray-900">{title}</p>
        <p className="max-w-sm text-sm font-medium text-gray-500">{description}</p>
      </div>
    </div>
  );
}

export function ActionInboxView({
  openTickets,
  resolvedTickets,
}: ActionInboxViewProps) {
  const [tab, setTab] = useState<"open" | "resolved">(() =>
    openTickets.length > 0 ? "open" : "resolved",
  );

  return (
    <div className="w-full space-y-6">
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "open" | "resolved")}
        className="w-full gap-0"
      >
        <TabsList className="h-auto min-h-11 w-full gap-1 rounded-xl border border-gray-200/80 bg-gray-50/80 p-1 shadow-sm sm:min-h-11">
          <TabsTrigger
            value="open"
            className="min-h-10 flex-1 rounded-lg px-3 text-sm data-[state=active]:bg-gray-900 data-[state=active]:text-white sm:min-h-9"
          >
            Open ({openTickets.length})
          </TabsTrigger>
          <TabsTrigger
            value="resolved"
            className="min-h-10 flex-1 rounded-lg px-3 text-sm data-[state=active]:bg-gray-900 data-[state=active]:text-white sm:min-h-9"
          >
            Resolved ({resolvedTickets.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="mt-4 outline-none sm:mt-5">
          <div className={TAB_PANEL_CLASS}>
            {openTickets.length === 0 ? (
              <div className="flex min-h-[min(16rem,40vh)] flex-1 flex-col items-center justify-center">
                <EmptyPanel
                  icon={CheckCircle}
                  title="Inbox zero"
                  description="No open tickets. New items from your AI receptionist will appear here."
                  className="max-w-md border-0 bg-transparent shadow-none"
                />
              </div>
            ) : (
              openTickets.map((t) => (
                <TicketCard key={t.id} ticket={t} variant="open" />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="resolved" className="mt-4 outline-none sm:mt-5">
          <div className={TAB_PANEL_CLASS}>
            {resolvedTickets.length === 0 ? (
              <div className="flex min-h-[min(16rem,40vh)] flex-1 flex-col items-center justify-center">
                <EmptyPanel
                  icon={Inbox}
                  title="Nothing in history yet"
                  description='Resolve an open ticket with "Mark as Resolved" and it will show up here.'
                  className="max-w-md border-0 bg-transparent shadow-none"
                />
              </div>
            ) : (
              resolvedTickets.map((t) => (
                <TicketCard key={t.id} ticket={t} variant="resolved" />
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
