"use client";

import { useCallback, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  StoreTransferMethod,
  WarmTransferHardwareStatus,
} from "@/lib/store-transfer-capability";

import {
  saveCaraTrainingPhoneSystem,
  type CaraTrainingData,
} from "@/app/(admin)/admin/organizations/[id]/cara-training/cara-training-actions";

import { SectionCard } from "./section-card";

type Props = {
  data: CaraTrainingData;
  onChange: (patch: Partial<CaraTrainingData>) => void;
  onSaved: () => Promise<void>;
};

const SYSTEM_TYPES = ["pbx", "sip_trunk", "single_line", "mobile_only", "unknown"] as const;
const TRANSFER_METHODS: StoreTransferMethod[] = ["sip_refer", "dial_out", "none"];
const HARDWARE_STATUSES: WarmTransferHardwareStatus[] = [
  "unknown",
  "pending",
  "go",
  "blocked",
];

export function PhoneSystemSection({ data, onChange, onSaved }: Props) {
  const ps = data.phoneSystem ?? {
    organization_id: data.organizationId,
    system_type: "unknown",
    vendor: null,
    handset_count: null,
    transfer_method: "none" as StoreTransferMethod,
    warm_transfer_hardware_status: "unknown" as WarmTransferHardwareStatus,
    transfer_verified_at: null,
    main_line_e164: null,
    notes: null,
  };

  const patchPhone = useCallback(
    (partial: Partial<typeof ps>) => {
      onChange({ phoneSystem: { ...ps, ...partial } });
    },
    [onChange, ps],
  );

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const save = useCallback(() => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveCaraTrainingPhoneSystem(data.organizationId, {
        systemType: ps.system_type,
        vendor: ps.vendor ?? "",
        handsetCount: ps.handset_count,
        transferMethod: ps.transfer_method,
        warmTransferHardwareStatus: ps.warm_transfer_hardware_status,
        mainLineE164: ps.main_line_e164 ?? "",
        notes: ps.notes ?? "",
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSaved(true);
      await onSaved();
    });
  }, [data.organizationId, onSaved, ps]);

  return (
    <SectionCard
      title="5. Phone system & transfer"
      description="PBX setup and warm-transfer hardware status. transfer_verified_at is set only by verified worker events."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>System type</Label>
          <select
            className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
            value={ps.system_type}
            onChange={(e) => patchPhone({ system_type: e.target.value })}
          >
            {SYSTEM_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Vendor</Label>
          <Input
            value={ps.vendor ?? ""}
            onChange={(e) => patchPhone({ vendor: e.target.value || null })}
          />
        </div>
        <div className="space-y-2">
          <Label>Transfer method</Label>
          <select
            className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
            value={ps.transfer_method}
            onChange={(e) =>
              patchPhone({ transfer_method: e.target.value as StoreTransferMethod })
            }
          >
            {TRANSFER_METHODS.map((m) => (
              <option key={m} value={m}>
                {m.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Warm transfer hardware</Label>
          <select
            className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
            value={ps.warm_transfer_hardware_status}
            onChange={(e) =>
              patchPhone({
                warm_transfer_hardware_status: e.target
                  .value as WarmTransferHardwareStatus,
              })
            }
          >
            {HARDWARE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Main line (E.164)</Label>
          <Input
            value={ps.main_line_e164 ?? ""}
            onChange={(e) =>
              patchPhone({ main_line_e164: e.target.value || null })
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Handset count</Label>
          <Input
            type="number"
            min={0}
            value={ps.handset_count ?? ""}
            onChange={(e) =>
              patchPhone({
                handset_count: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea
          value={ps.notes ?? ""}
          onChange={(e) => patchPhone({ notes: e.target.value || null })}
          rows={2}
        />
      </div>
      {ps.transfer_verified_at ? (
        <p className="text-muted-foreground text-xs">
          Transfer verified at {new Date(ps.transfer_verified_at).toLocaleString()}{" "}
          (read-only)
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">
          Transfer not yet verified by a live worker event.
        </p>
      )}
      <p className="text-muted-foreground text-xs">
        Call routing mode: <strong>{data.callRoutingMode}</strong> — change on the
        customer detail page if needed.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save phone system"}
        </Button>
        {saved ? <span className="text-sm text-emerald-700">Saved.</span> : null}
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </SectionCard>
  );
}
