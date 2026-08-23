"use client";

import { useCallback, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  STORE_CONTACT_ROLES,
  type StoreContactRole,
  type StoreContactRow,
} from "@/lib/retail-store-types";

export type ContactDraft = Omit<StoreContactRow, "organization_id"> & {
  organization_id?: string;
};

type Props = {
  contacts: ContactDraft[];
  onChange: (contacts: ContactDraft[]) => void;
  onSave: () => Promise<{ ok: true } | { ok: false; message: string }>;
  disabled?: boolean;
};

function emptyContact(): ContactDraft {
  return {
    id: "",
    organization_id: "",
    department_id: null,
    name: "",
    role: "store_manager",
    phone_e164: null,
    email: null,
    is_notification_target: true,
    can_receive_transfers: false,
    active: true,
  };
}

export function StoreContactsEditor({
  contacts,
  onChange,
  onSave,
  disabled = false,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const update = useCallback(
    (index: number, patch: Partial<ContactDraft>) => {
      onChange(contacts.map((c, i) => (i === index ? { ...c, ...patch } : c)));
      setSaved(false);
    },
    [contacts, onChange],
  );

  const remove = useCallback(
    (index: number) => {
      onChange(contacts.filter((_, i) => i !== index));
      setSaved(false);
    },
    [contacts, onChange],
  );

  const add = useCallback(() => {
    onChange([...contacts, emptyContact()]);
    setSaved(false);
  }, [contacts, onChange]);

  const save = useCallback(() => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await onSave();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSaved(true);
    });
  }, [onSave]);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs">
        Staff contact details are used for internal routing and notifications
        only — they are never spoken to callers in the compiled prompt.
      </p>

      {contacts.length === 0 ? (
        <p className="text-muted-foreground text-sm">No contacts configured.</p>
      ) : null}

      <div className="space-y-3">
        {contacts.map((contact, index) => (
          <div
            key={contact.id || `new-${index}`}
            className="rounded-lg border border-slate-200 bg-slate-50/50 p-3"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input
                  value={contact.name}
                  disabled={disabled}
                  onChange={(e) => update(index, { name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Role</Label>
                <select
                  className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
                  value={contact.role}
                  disabled={disabled}
                  onChange={(e) =>
                    update(index, { role: e.target.value as StoreContactRole })
                  }
                >
                  {STORE_CONTACT_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Phone (E.164, internal)</Label>
                <Input
                  value={contact.phone_e164 ?? ""}
                  disabled={disabled}
                  onChange={(e) =>
                    update(index, { phone_e164: e.target.value || null })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email (internal)</Label>
                <Input
                  value={contact.email ?? ""}
                  disabled={disabled}
                  onChange={(e) =>
                    update(index, { email: e.target.value || null })
                  }
                />
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={contact.is_notification_target}
                  disabled={disabled}
                  onChange={(e) =>
                    update(index, { is_notification_target: e.target.checked })
                  }
                />
                Notification target
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={contact.can_receive_transfers}
                  disabled={disabled}
                  onChange={(e) =>
                    update(index, { can_receive_transfers: e.target.checked })
                  }
                />
                Can receive transfers
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={contact.active}
                  disabled={disabled}
                  onChange={(e) => update(index, { active: e.target.checked })}
                />
                Active
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto text-destructive"
                disabled={disabled}
                onClick={() => remove(index)}
              >
                <Trash2 className="size-3.5" aria-hidden />
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={add}>
          <Plus className="size-3.5" aria-hidden />
          Add contact
        </Button>
        <Button type="button" size="sm" disabled={disabled || pending} onClick={save}>
          {pending ? "Saving…" : "Save contacts"}
        </Button>
        {saved ? <span className="text-sm text-emerald-700">Saved.</span> : null}
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
