"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

import { updateOrganizationAdminNotes } from "../../actions";

export function AdminNotesCard({
  organizationId,
  initialNotes,
}: {
  organizationId: string;
  initialNotes: string;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Client notes</CardTitle>
        <CardDescription>
          Internal Cliste notes about this store. The tenant never sees this.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setMsg(null);
            startTransition(async () => {
              const r = await updateOrganizationAdminNotes(organizationId, notes);
              setMsg(r.ok ? "Saved." : r.message);
            });
          }}
        >
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={5}
            placeholder="Site contact, hardware quirks, go-live notes…"
            className="min-h-[120px]"
          />
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save notes"}
            </Button>
            {msg ? (
              <p className="text-muted-foreground text-sm">{msg}</p>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
