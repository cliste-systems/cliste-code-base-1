"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { replyToSupportTicket } from "./actions";

type TicketReplyFormProps = {
  ticketId: string;
  ticketStatus: string;
};

export function TicketReplyForm({ ticketId, ticketStatus }: TicketReplyFormProps) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isClosed = ticketStatus.toLowerCase() === "closed";

  const submit = useCallback(() => {
    setMsg(null);
    startTransition(async () => {
      const result = await replyToSupportTicket({ ticketId, body });
      if (result.ok) {
        setBody("");
        router.refresh();
      } else {
        setMsg(result.message);
      }
    });
  }, [ticketId, body, router]);

  if (isClosed) {
    return (
      <p className="text-muted-foreground mt-4 border-border/60 border-t pt-4 text-sm leading-relaxed">
        This ticket is closed. Please open a new ticket if you need further
        assistance.
      </p>
    );
  }

  return (
    <div className="border-border/60 mt-4 space-y-2 border-t pt-4">
      <Label htmlFor={`reply-${ticketId}`} className="text-foreground text-sm">
        Reply
      </Label>
      <Textarea
        id={`reply-${ticketId}`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Send a follow-up to Cliste…"
        className="border-border/80 min-h-20 resize-y bg-background shadow-sm"
        maxLength={8000}
      />
      {msg ? <p className="text-destructive text-sm">{msg}</p> : null}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={submit}
      >
        {pending ? "Sending…" : "Send reply"}
      </Button>
    </div>
  );
}
