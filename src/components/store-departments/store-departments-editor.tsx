"use client";

import { useCallback, useState, useTransition } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SUPERVALU_DEPARTMENT_PRESETS } from "@/lib/retail-store-types";
import type { StoreDepartmentRow } from "@/lib/retail-store-types";
import { validateDepartmentExtension } from "@/lib/store-departments";

export type DepartmentDraft = Omit<
  StoreDepartmentRow,
  "organization_id"
> & { organization_id?: string };

type Props = {
  departments: DepartmentDraft[];
  canTransfer: boolean;
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
    extension: null,
    hours: null,
    transfer_enabled: false,
    cara_note: null,
    handles_text: null,
    is_off_licence: false,
    is_an_post: false,
    sort_order: sortOrder,
    active: true,
  };
}

export function StoreDepartmentsEditor({
  departments,
  canTransfer,
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

  const seedPresets = useCallback(() => {
    const existing = new Set(departments.map((d) => d.name.toLowerCase()));
    const toAdd = SUPERVALU_DEPARTMENT_PRESETS.filter(
      (name) => !existing.has(name.toLowerCase()),
    ).map((name, offset) => ({
      ...emptyDepartment(departments.length + offset),
      name,
      transfer_enabled: canTransfer,
    }));
    if (toAdd.length > 0) onChange([...departments, ...toAdd]);
    setSaved(false);
  }, [canTransfer, departments, onChange]);

  const save = useCallback(() => {
    setError(null);
    setSaved(false);
    for (const dept of departments) {
      const extErr = validateDepartmentExtension(dept.extension);
      if (extErr) {
        setError(`${dept.name || "Department"}: ${extErr}`);
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
          No departments yet. Add one or seed common SuperValu departments.
        </p>
      ) : null}

      {!canTransfer ? (
        <p className="text-muted-foreground text-xs">
          Extension and external numbers can be saved now. Cara will only dial
          them once transfer hardware is verified and routing allows handoff.
        </p>
      ) : null}

      <div className="space-y-3">
        {departments.map((dept, index) => (
          <div
            key={dept.id || `new-${index}`}
            className="rounded-lg border border-slate-200 bg-slate-50/50 p-3"
          >
            <div className="mb-2 flex items-center gap-2">
              <GripVertical className="size-4 text-slate-400" aria-hidden />
              <span className="text-xs font-medium text-slate-500">
                #{index + 1}
              </span>
              <label className="ml-auto flex items-center gap-1.5 text-xs">
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
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input
                  value={dept.name}
                  disabled={disabled}
                  onChange={(e) => update(index, { name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Handles</Label>
                <Input
                  value={dept.handles_text ?? ""}
                  disabled={disabled}
                  placeholder="e.g. returns, complaints"
                  onChange={(e) =>
                    update(index, { handles_text: e.target.value || null })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Extension</Label>
                <Input
                  value={dept.extension ?? ""}
                  disabled={disabled}
                  placeholder="e.g. 101"
                  onChange={(e) =>
                    update(index, { extension: e.target.value || null })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">External number (E.164)</Label>
                <Input
                  value={dept.phone_e164 ?? ""}
                  disabled={disabled}
                  placeholder="+353..."
                  onChange={(e) =>
                    update(index, { phone_e164: e.target.value || null })
                  }
                />
              </div>
            </div>
            <div className="mt-2 space-y-1">
              <Label className="text-xs">Cara note</Label>
              <Textarea
                value={dept.cara_note ?? ""}
                disabled={disabled}
                rows={2}
                onChange={(e) =>
                  update(index, { cara_note: e.target.value || null })
                }
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={dept.transfer_enabled}
                  disabled={disabled || !canTransfer}
                  onChange={(e) =>
                    update(index, { transfer_enabled: e.target.checked })
                  }
                />
                Transfer enabled
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={dept.is_off_licence}
                  disabled={disabled}
                  onChange={(e) =>
                    update(index, { is_off_licence: e.target.checked })
                  }
                />
                Off-licence
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={dept.is_an_post}
                  disabled={disabled}
                  onChange={(e) =>
                    update(index, { is_an_post: e.target.checked })
                  }
                />
                An Post
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
          Add department
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={seedPresets}
        >
          Seed SuperValu presets
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
