"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import { SupportThreadMessages } from "@/components/support/support-thread-messages";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { LifeBuoy, Plus } from "lucide-react";

import { createSupportTicket } from "./actions";
import { TicketReplyForm } from "./ticket-reply-form";

export type SupportMessageRow = {
  id: string;
  author_kind: string;
  body: string;
  created_at: string;
};

export type SupportTicketListRow = {
  id: string;
  subject: string;
  body: string;
  status: string;
  created_at: string;
  support_ticket_messages?: SupportMessageRow[] | null;
};

function formatListDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusPillClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "open") {
    return "inline-flex items-center rounded-full border border-emerald-200/80 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 capitalize";
  }
  return "inline-flex items-center rounded-full border border-gray-200/60 bg-gray-50 px-3 py-1 text-xs font-medium capitalize text-gray-500";
}

type SupportViewProps = {
  initialTickets: SupportTicketListRow[];
};

export function SupportView({ initialTickets }: SupportViewProps) {
  const router = useRouter();
  const [newOpen, setNewOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setMsg(null);
      startTransition(async () => {
        const result = await createSupportTicket({ subject, body });
        if (result.ok) {
          setSubject("");
          setBody("");
          setMsg(null);
          setNewOpen(false);
          router.refresh();
        } else {
          setMsg(result.message);
        }
      });
    },
    [subject, body, router],
  );

  const onNewOpenChange = useCallback((open: boolean) => {
    setNewOpen(open);
    if (!open) {
      setMsg(null);
      setSubject("");
      setBody("");
    }
  }, []);

  const fieldClass =
    "w-full rounded-xl border border-gray-200/80 bg-gray-50/50 px-4 py-3 text-sm text-gray-900 shadow-sm transition-all placeholder:text-gray-400 focus:border-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus-visible:ring-gray-900/10";

  return (
    <div className="mx-auto w-full max-w-[1000px]">
      <header className="mb-12 flex flex-col justify-between gap-6 sm:mb-16 sm:flex-row sm:items-start">
        <div>
          <div className="mb-4 flex items-center gap-2 text-gray-500">
            <LifeBuoy className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
            <span className="text-xs font-medium uppercase tracking-widest">
              Help
            </span>
          </div>
          <h1 className="mb-3 text-3xl font-medium tracking-tight text-gray-900">
            Support
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-gray-500">
            Open a ticket for the Cliste team. Available on every plan.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setNewOpen(true)}
          className="mt-2 h-auto shrink-0 gap-2 rounded-xl border border-transparent bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-gray-800 sm:mt-0"
        >
          <Plus className="size-4" strokeWidth={2} aria-hidden />
          New Ticket
        </Button>
      </header>

      <div className="mb-12 h-px w-full bg-gray-100" />

      <Dialog open={newOpen} onOpenChange={onNewOpenChange}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>New ticket</DialogTitle>
            <DialogDescription>
              Describe your question or issue. Your whole team shares this inbox
              for your salon.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="support-subject" className="text-gray-700">
                Subject
              </Label>
              <Input
                id="support-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Can't hear the AI on inbound calls"
                maxLength={200}
                autoComplete="off"
                className={cn(fieldClass, "h-auto min-h-11")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="support-body" className="text-gray-700">
                Message
              </Label>
              <Textarea
                id="support-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Include steps to reproduce, times, and anything that helps us help you."
                className={cn(fieldClass, "min-h-32 resize-y")}
                maxLength={8000}
              />
            </div>
            {msg ? (
              <p className="text-destructive text-sm" role="alert">
                {msg}
              </p>
            ) : null}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl border-gray-200/80"
                onClick={() => onNewOpenChange(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-xl bg-gray-900 hover:bg-gray-800"
                disabled={pending}
              >
                {pending ? "Sending…" : "Submit ticket"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <section aria-labelledby="support-history-heading">
        <h2
          id="support-history-heading"
          className="mb-6 text-sm font-medium text-gray-900"
        >
          Your tickets
        </h2>
        {initialTickets.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-200/80 bg-white px-4 py-12 text-center text-sm text-gray-500 shadow-sm">
            No tickets yet. Use{" "}
            <span className="font-medium text-gray-900">New Ticket</span> when you
            need help.
          </p>
        ) : (
          <Accordion multiple className="flex flex-col gap-3">
            {initialTickets.map((t) => (
              <AccordionItem
                key={t.id}
                value={t.id}
                className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm transition-colors hover:border-gray-300"
              >
                <AccordionTrigger className="items-center justify-between gap-4 px-5 py-5 hover:bg-transparent hover:no-underline [&>svg]:text-gray-400">
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block text-base font-medium text-gray-900">
                      {t.subject}
                    </span>
                    <span className="mt-1.5 block text-sm font-normal tabular-nums text-gray-500">
                      {formatListDate(t.created_at)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-4">
                    <span className={statusPillClass(t.status)}>{t.status}</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="border-t border-gray-100 bg-gray-50/40 px-5 py-4 sm:px-6">
                  <SupportThreadMessages
                    openedAt={t.created_at}
                    initialBody={t.body}
                    messages={t.support_ticket_messages ?? []}
                    perspective="salon"
                  />
                  <TicketReplyForm
                    ticketId={t.id}
                    ticketStatus={t.status}
                  />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </section>
    </div>
  );
}
