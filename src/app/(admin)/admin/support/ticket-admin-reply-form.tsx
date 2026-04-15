"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { adminReplyToSupportTicket } from "../actions";

type TicketAdminReplyFormProps = {
  ticketId: string;
};

export function TicketAdminReplyForm({ ticketId }: TicketAdminReplyFormProps) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = useCallback(() => {
    setMsg(null);
    startTransition(async () => {
      const result = await adminReplyToSupportTicket(ticketId, body);
      if (result.ok) {
        setBody("");
        router.refresh();
      } else {
        setMsg(result.message);
      }
    });
  }, [ticketId, body, router]);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="admin-support-reply">Reply to salon</Label>
        <Textarea
          id="admin-support-reply"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Your message appears on their Support page in this thread."
          className="min-h-28 resize-y"
          maxLength={8000}
        />
      </div>
      {msg ? <p className="text-destructive text-sm">{msg}</p> : null}
      <Button type="button" size="sm" disabled={pending} onClick={submit}>
        {pending ? "Sending…" : "Send reply"}
      </Button>
    </div>
  );
}
