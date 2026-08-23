"use client";

import { useCallback, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CaraTrainingFieldLabel } from "@/components/admin/cara-training-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { StoreDepartmentRow } from "@/lib/retail-store-types";

export type DepartmentDraft = Omit<
  StoreDepartmentRow,
  "organization_id"
> & { organization_id?: string };

type Props = {
  departments: DepartmentDraft[];
  onChange: (departments: DepartmentDraft[]) => void;
  onSave: () => Promise<{ ok: true } | { ok: false; message: string }>;
  disabled?: boolean;
};

function emptyDepartment(sortOrder: number): DepartmentDraft {
  return {
    id: "",
    organization_id: "",
    name: "",
    phone_e164: null,
    direct_dial_e164: null,
    extension: null,
    hours: null,
    transfer_enabled: false,
    cara_note: null,
    handles_text: null,
    contact_email: null,
    manager_name: null,
    is_off_licence: false,
    is_an_post: false,
    sort_order: sortOrder,
    active: true,
  };
}

export function StoreDepartmentsEditor({
  departments,
  onChange,
  onSave,
  disabled = false,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const update = useCallback(
    (index: number, patch: Partial<DepartmentDraft>) => {
      onChange(
        departments.map((d, i) => (i === index ? { ...d, ...patch } : d)),
      );
      setSaved(false);
    },
    [departments, onChange],
  );

  const remove = useCallback(
    (index: number) => {
      onChange(departments.filter((_, i) => i !== index));
      setSaved(false);
    },
    [departments, onChange],
  );

  const add = useCallback(() => {
    onChange([...departments, emptyDepartment(departments.length)]);
    setSaved(false);
  }, [departments, onChange]);

  const save = useCallback(() => {
    setError(null);
    setSaved(false);
    for (const dept of departments) {
      const email = dept.contact_email?.trim() ?? "";
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError(`${dept.name || "Department"}: Enter a valid email address.`);
        return;
      }
    }
    startTransition(async () => {
      const result = await onSave();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSaved(true);
    });
  }, [departments, onSave]);

  return (
    <div className="space-y-4">
      {departments.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No departments yet. Add one for each staffed counter or team.
        </p>
      ) : null}

      <div className="space-y-3">
        {departments.map((dept, index) => (
          <div
            key={dept.id || `new-${index}`}
            className="rounded-lg border border-slate-200 bg-slate-50/50 p-3"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-500">
                Department {index + 1}
              </span>
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={dept.active}
                  disabled={disabled}
                  onChange={(e) => update(index, { active: e.target.checked })}
                />
                Active
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 rounded-md border border-violet-200/60 bg-violet-50/40 px-2.5 py-2 sm:col-span-2">
                <CaraTrainingFieldLabel label="Name" feed="prompt" />
                <Input
                  value={dept.name}
                  disabled={disabled}
                  placeholder="Deli counter"
                  onChange={(e) => update(index, { name: e.target.value })}
                />
              </div>
              <div className="space-y-1 rounded-md border border-slate-200 bg-slate-50/50 px-2.5 py-2 sm:col-span-2">
                <CaraTrainingFieldLabel label="Manager name" feed="internal" />
                <Input
                  value={dept.manager_name ?? ""}
                  disabled={disabled}
                  placeholder="e.g. Sarah O'Brien"
                  onChange={(e) =>
                    update(index, { manager_name: e.target.value || null })
                  }
                />
              </div>
              <div className="space-y-1 rounded-md border border-slate-200 bg-slate-50/50 px-2.5 py-2 sm:col-span-2">
                <CaraTrainingFieldLabel label="Email" feed="internal" />
                <Input
                  type="email"
                  value={dept.contact_email ?? ""}
                  disabled={disabled}
                  placeholder="deli@store.example"
                  onChange={(e) =>
                    update(index, { contact_email: e.target.value || null })
                  }
                />
              </div>
            </div>
            <div className="mt-2 space-y-1 rounded-md border border-violet-200/60 bg-violet-50/40 px-2.5 py-2">
              <CaraTrainingFieldLabel label="Cara note (optional)" feed="prompt" />
              <Textarea
                value={dept.cara_note ?? ""}
                disabled={disabled}
                rows={2}
                placeholder="What this department handles on calls"
                onChange={(e) =>
                  update(index, { cara_note: e.target.value || null })
                }
              />
            </div>
            <div className="mt-2 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive"
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
          Add department
        </Button>
        <Button type="button" size="sm" disabled={disabled || pending} onClick={save}>
          {pending ? "Saving…" : "Save departments"}
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
