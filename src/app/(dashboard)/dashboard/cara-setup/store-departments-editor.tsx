"use client";

import { Plus, Trash2 } from "lucide-react";

import { OpeningHoursEditor } from "@/components/agent-knowledge/opening-hours-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  emptyDepartmentDraft,
  MAX_STORE_DEPARTMENTS,
  type StoreDepartmentDraft,
} from "@/lib/store-departments";
import { cn } from "@/lib/utils";

type Props = {
  value: StoreDepartmentDraft[];
  onChange: (next: StoreDepartmentDraft[]) => void;
};

function newClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `dept-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function StoreDepartmentsEditor({ value, onChange }: Props) {
  function patch(clientId: string, next: Partial<StoreDepartmentDraft>) {
    onChange(
      value.map((row) => (row.clientId === clientId ? { ...row, ...next } : row)),
    );
  }

  function remove(clientId: string) {
    onChange(value.filter((row) => row.clientId !== clientId));
  }

  function add() {
    if (value.length >= MAX_STORE_DEPARTMENTS) return;
    onChange([...value, emptyDepartmentDraft(newClientId())]);
  }

  return (
    <div className="space-y-3">
      {value.length === 0 ? (
        <p className="text-[13px] leading-relaxed text-slate-600">
          Add counters callers ask for — Deli, Butcher, Bakery, Customer Service,
          Off-licence, An Post.
        </p>
      ) : null}

      {value.map((row, index) => (
        <div
          key={row.clientId}
          className="rounded-xl border border-[#dfe7e2] bg-white p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-[11px] font-medium tracking-wider text-slate-500 uppercase">
              Department {index + 1}
            </p>
            <Button
              type="button"
              variant="ghost"
              className="h-8 px-2 text-slate-500 hover:text-red-700"
              onClick={() => remove(row.clientId)}
            >
              <Trash2 className="size-3.5" aria-hidden />
              <span className="sr-only">Remove {row.name || "department"}</span>
            </Button>
          </div>

          <div className="mt-2 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor={`dept-name-${row.clientId}`}>Name</Label>
              <Input
                id={`dept-name-${row.clientId}`}
                value={row.name}
                onChange={(e) => patch(row.clientId, { name: e.target.value })}
                placeholder="e.g. Deli"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`dept-transfer-${row.clientId}`}>
                Transfer number (optional)
              </Label>
              <Input
                id={`dept-transfer-${row.clientId}`}
                value={row.transferNumber}
                onChange={(e) =>
                  patch(row.clientId, { transferNumber: e.target.value })
                }
                placeholder="+353 …"
                inputMode="tel"
                autoComplete="tel"
              />
              <p className="text-[12px] text-slate-500">
                Direct line Cara can put callers through to for this desk.
              </p>
            </div>

            <label className="flex items-start gap-2 text-[13px] text-slate-700">
              <input
                type="checkbox"
                className="mt-0.5 size-4 rounded border-slate-300"
                checked={row.isOffLicence}
                onChange={(e) =>
                  patch(row.clientId, { isOffLicence: e.target.checked })
                }
              />
              Off-licence — Cara never sells alcohol or takes ID on the phone
            </label>

            <label className="flex items-start gap-2 text-[13px] text-slate-700">
              <input
                type="checkbox"
                className="mt-0.5 size-4 rounded border-slate-300"
                checked={row.isAnPost}
                onChange={(e) =>
                  patch(row.clientId, { isAnPost: e.target.checked })
                }
              />
              An Post — Cara never guesses tracking or parcel status
            </label>

            <label className="flex items-start gap-2 text-[13px] text-slate-700">
              <input
                type="checkbox"
                className="mt-0.5 size-4 rounded border-slate-300"
                checked={!row.usesStoreHours}
                onChange={(e) =>
                  patch(row.clientId, { usesStoreHours: !e.target.checked })
                }
              />
              Different hours from the store
            </label>

            {!row.usesStoreHours ? (
              <OpeningHoursEditor
                value={row.hours}
                onChange={(hours) => patch(row.clientId, { hours })}
                variant="dashboard"
                compact
                embedded
              />
            ) : null}
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        className={cn("h-9 gap-1.5", value.length >= MAX_STORE_DEPARTMENTS && "hidden")}
        onClick={add}
      >
        <Plus className="size-3.5" aria-hidden />
        Add department
      </Button>
    </div>
  );
}
