"use client";

import { useCallback, useState, useTransition } from "react";

import {
  CaraTrainingField,
  CaraTrainingInternalBanner,
} from "@/components/admin/cara-training-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      description="Provisioning notes for the store line. Transfer settings change department wording in Cara's prompt."
    >
      <CaraTrainingInternalBanner>
        System type, vendor, and notes are for your team only. Transfer method and
        hardware status decide whether Cara may offer to put callers through.
      </CaraTrainingInternalBanner>
      <div className="grid gap-4 sm:grid-cols-2">
        <CaraTrainingField label="System type" feed="internal">
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
        </CaraTrainingField>
        <CaraTrainingField label="Vendor" feed="internal">
          <Input
            value={ps.vendor ?? ""}
            onChange={(e) => patchPhone({ vendor: e.target.value || null })}
          />
        </CaraTrainingField>
        <CaraTrainingField
          label="Transfer method"
          feed="behaviour"
          hint="With hardware ready, this enables transfer language in the departments section."
        >
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
        </CaraTrainingField>
        <CaraTrainingField
          label="Warm transfer hardware"
          feed="behaviour"
          hint="Must be “go” before Cara can offer live transfers."
        >
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
        </CaraTrainingField>
        <CaraTrainingField label="Main line (E.164)" feed="internal">
          <Input
            value={ps.main_line_e164 ?? ""}
            onChange={(e) =>
              patchPhone({ main_line_e164: e.target.value || null })
            }
          />
        </CaraTrainingField>
        <CaraTrainingField label="Handset count" feed="internal">
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
        </CaraTrainingField>
      </div>
      <CaraTrainingField label="Notes" feed="internal">
        <Textarea
          value={ps.notes ?? ""}
          onChange={(e) => patchPhone({ notes: e.target.value || null })}
          rows={2}
        />
      </CaraTrainingField>
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
