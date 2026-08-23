"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { Mail } from "lucide-react";

import {
  CaraTrainingField,
  CaraTrainingInternalBanner,
} from "@/components/admin/cara-training-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { resolveTransferCapability } from "@/lib/transfer-capability";
import { buildTransferVerdict, buildInstallerEmailBody } from "@/lib/transfer-capability-messages";
import type {
  StorePhoneSystemRow,
  StoreTransferMethod,
  WarmTransferHardwareStatus,
} from "@/lib/store-transfer-capability";

import {
  runTransferVerification,
  saveCaraTrainingPhoneSystem,
  type CaraTrainingData,
} from "@/app/(admin)/admin/organizations/[id]/cara-training/cara-training-actions";

import { SectionCard } from "./section-card";
import {
  DdiRangeQuestion,
  DepartmentDdiTable,
} from "./phone-system/department-ddi-table";
import { TransferVerdictBanner } from "./phone-system/transfer-verdict-banner";

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

const DEFAULT_PHONE_SYSTEM = (
  organizationId: string,
): StorePhoneSystemRow => ({
  organization_id: organizationId,
  system_type: "pbx",
  vendor: "Grandstream",
  model: null,
  handset_count: null,
  installer_name: null,
  installer_contact: null,
  trunk_provider: null,
  has_ddi_range: null,
  ddi_pattern: null,
  transfer_method: "sip_refer",
  warm_transfer_hardware_status: "unknown",
  transfer_verified_at: null,
  transfer_verified_by: null,
  transfer_last_test_result: null,
  transfer_verification_pending: false,
  main_line_e164: null,
  notes: null,
});

function ddiChoiceFromPhoneSystem(
  ps: StorePhoneSystemRow,
): "yes" | "no" | "unknown" | null {
  if (ps.has_ddi_range === true) return "yes";
  if (ps.has_ddi_range === false) return "no";
  if (ps.has_ddi_range === null && ps.organization_id) {
    return null;
  }
  return null;
}

export function PhoneSystemSection({ data, onChange, onSaved }: Props) {
  const ps = data.phoneSystem ?? DEFAULT_PHONE_SYSTEM(data.organizationId);
  const [ddiChoice, setDdiChoice] = useState<"yes" | "no" | "unknown" | null>(
    () => ddiChoiceFromPhoneSystem(ps),
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [verifyPending, startVerify] = useTransition();

  const capability = useMemo(
    () =>
      resolveTransferCapability({
        callRoutingMode: data.callRoutingMode,
        phoneSystem: {
          ...ps,
          has_ddi_range:
            ddiChoice === "yes"
              ? true
              : ddiChoice === "no"
                ? false
                : ddiChoice === "unknown"
                  ? null
                  : ps.has_ddi_range,
        },
        departments: data.departments,
      }),
    [data.callRoutingMode, data.departments, ddiChoice, ps],
  );

  const verdict = buildTransferVerdict({
    canTransfer: capability.canTransfer,
    blockers: capability.blockers,
    transferVerifiedAt: ps.transfer_verified_at,
    transferVerificationPending: ps.transfer_verification_pending,
  });

  const patchPhone = useCallback(
    (partial: Partial<StorePhoneSystemRow>) => {
      onChange({ phoneSystem: { ...ps, ...partial } });
    },
    [onChange, ps],
  );

  const patchDepartment = useCallback(
    (id: string, patch: Partial<(typeof data.departments)[0]>) => {
      onChange({
        departments: data.departments.map((d) =>
          d.id === id ? { ...d, ...patch } : d,
        ),
      });
    },
    [data.departments, onChange],
  );

  const save = useCallback(() => {
    setError(null);
    setSaved(false);
    if (ddiChoice === null) {
      setError(
        "Answer whether departments have direct-dial numbers (Yes, No, or Don't know).",
      );
      return;
    }
    startTransition(async () => {
      const result = await saveCaraTrainingPhoneSystem(data.organizationId, {
        systemType: ps.system_type,
        vendor: ps.vendor ?? "Grandstream",
        model: ps.model ?? "",
        handsetCount: ps.handset_count,
        installerName: ps.installer_name ?? "",
        installerContact: ps.installer_contact ?? "",
        trunkProvider: ps.trunk_provider ?? "",
        ddiRangeChoice: ddiChoice,
        ddiPattern: ps.ddi_pattern ?? "",
        transferMethod: ps.transfer_method,
        warmTransferHardwareStatus: ps.warm_transfer_hardware_status,
        mainLineE164: ps.main_line_e164 ?? "",
        notes: ps.notes ?? "",
        departmentDdis: data.departments.map((d) => ({
          id: d.id,
          extension: d.extension,
          direct_dial_e164: d.direct_dial_e164,
        })),
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSaved(true);
      await onSaved();
    });
  }, [data.departments, data.organizationId, ddiChoice, onSaved, ps]);

  const runTest = useCallback(() => {
    setVerifyMessage(null);
    setError(null);
    startVerify(async () => {
      const result = await runTransferVerification(data.organizationId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setVerifyMessage(result.instruction);
      patchPhone({ transfer_verification_pending: true });
      await onSaved();
    });
  }, [data.organizationId, onSaved, patchPhone]);

  const emailInstaller = useCallback(() => {
    const body = buildInstallerEmailBody({
      storeName: data.name,
      installerName: ps.installer_name,
      departments: data.departments
        .filter((d) => d.active)
        .map((d) => ({ name: d.name, extension: d.extension })),
    });
    const mailto = `mailto:${encodeURIComponent(ps.installer_contact?.trim() || "")}?subject=${encodeURIComponent(`DDI request — ${data.name}`)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  }, [data.departments, data.name, ps.installer_contact, ps.installer_name]);

  const showTransferPath = ddiChoice === "yes";
  const showMessageTakingOnly = ddiChoice === "no";

  return (
    <SectionCard
      title="5. Phone system & transfer"
      description="Configure how Cara handles department transfers. She only offers live transfers when this setup is verified."
    >
      <TransferVerdictBanner verdict={verdict}>
        {verdict.showRunTest ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={verifyPending}
            onClick={runTest}
          >
            {verifyPending ? "Starting…" : "Run test transfer"}
          </Button>
        ) : null}
        {verifyMessage ? (
          <p className="text-muted-foreground mt-2 text-xs">{verifyMessage}</p>
        ) : null}
      </TransferVerdictBanner>

      <CaraTrainingInternalBanner>
        System type, vendor, installer contact, and notes are internal. Transfer
        method and hardware status control whether Cara may offer live transfers.
      </CaraTrainingInternalBanner>

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          The system
        </h3>
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
              value={ps.vendor ?? "Grandstream"}
              onChange={(e) => patchPhone({ vendor: e.target.value || null })}
            />
          </CaraTrainingField>
          <CaraTrainingField label="Model" feed="internal">
            <Input
              value={ps.model ?? ""}
              onChange={(e) => patchPhone({ model: e.target.value || null })}
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
          <CaraTrainingField label="Installer name" feed="internal">
            <Input
              value={ps.installer_name ?? ""}
              onChange={(e) =>
                patchPhone({ installer_name: e.target.value || null })
              }
            />
          </CaraTrainingField>
          <CaraTrainingField label="Installer contact" feed="internal">
            <Input
              value={ps.installer_contact ?? ""}
              placeholder="email or phone"
              onChange={(e) =>
                patchPhone({ installer_contact: e.target.value || null })
              }
            />
          </CaraTrainingField>
          <CaraTrainingField label="Trunk provider" feed="internal">
            <Input
              value={ps.trunk_provider ?? ""}
              onChange={(e) =>
                patchPhone({ trunk_provider: e.target.value || null })
              }
            />
          </CaraTrainingField>
          <CaraTrainingField label="Main line (E.164)" feed="internal">
            <Input
              value={ps.main_line_e164 ?? ""}
              onChange={(e) =>
                patchPhone({ main_line_e164: e.target.value || null })
              }
            />
          </CaraTrainingField>
        </div>
      </div>

      <DdiRangeQuestion
        value={ddiChoice}
        onChange={(choice) => {
          setDdiChoice(choice);
          patchPhone({
            has_ddi_range:
              choice === "yes" ? true : choice === "no" ? false : null,
          });
        }}
      />

      {showMessageTakingOnly ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm text-slate-700">
          <p>
            This site has extensions only — Cara takes messages for every
            department. Ask the installer about adding DDIs if live transfers are
            needed later.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={emailInstaller}
          >
            <Mail className="size-3.5" aria-hidden />
            Email installer
          </Button>
        </div>
      ) : null}

      {showTransferPath ? (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Department mapping
          </h3>
          <DepartmentDdiTable
            storeName={data.name}
            installerName={ps.installer_name}
            departments={data.departments}
            perDepartment={capability.perDepartment}
            onChange={patchDepartment}
          />
        </div>
      ) : null}

      <div className="space-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Transfer mechanics
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <CaraTrainingField
            label="Transfer method"
            feed="behaviour"
            hint="SIP REFER is recommended when the Cliste trunk supports it."
          >
            <select
              className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
              value={ps.transfer_method}
              onChange={(e) =>
                patchPhone({
                  transfer_method: e.target.value as StoreTransferMethod,
                })
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
            hint="Must be go before Cara can offer live transfers."
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
        </div>
        {showTransferPath ? (
          <CaraTrainingField label="DDI pattern (optional)" feed="internal">
            <Input
              value={ps.ddi_pattern ?? ""}
              placeholder="e.g. +35374938xxx"
              onChange={(e) =>
                patchPhone({ ddi_pattern: e.target.value || null })
              }
            />
          </CaraTrainingField>
        ) : null}
        <CaraTrainingField label="Notes" feed="internal">
          <Textarea
            value={ps.notes ?? ""}
            onChange={(e) => patchPhone({ notes: e.target.value || null })}
            rows={2}
          />
        </CaraTrainingField>
        <p className="text-muted-foreground text-xs">
          <span className="font-medium text-slate-700">Cliste readiness: </span>
          {data.clisteTransferReadiness?.detail ??
            "Load the page again to check Cliste number and trunk status."}
          {data.clisteTransferReadiness?.clisteNumber ? (
            <span className="mt-0.5 block">
              Assigned number: {data.clisteTransferReadiness.clisteNumber}
            </span>
          ) : null}
        </p>
      </div>

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
