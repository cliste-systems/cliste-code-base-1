"use client";

import { Check } from "lucide-react";

import { Field } from "@/components/dashboard/field";
import { cn } from "@/lib/utils";
import {
  PATCH_TEST_HOURS_DEFAULT,
  PATCH_TEST_HOURS_MAX,
  PATCH_TEST_HOURS_MIN,
  SALON_SERVICE_POLICY_PRESETS,
  isServicePolicyFlagSelected,
  toggleServicePolicyFlag,
  updatePatchTestHours,
  type ServicePolicyFlag,
  type ServicePolicyFlagType,
} from "@/lib/service-policy-presets";

type ServicePolicyPresetsEditorProps = {
  flags: ServicePolicyFlag[];
  onChange: (flags: ServicePolicyFlag[]) => void;
  disabled?: boolean;
  className?: string;
};

function PolicyRow({
  label,
  selected,
  onToggle,
  disabled,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors",
        selected ? "bg-white" : "hover:bg-white/70",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border",
          selected
            ? "border-[#0b1220] bg-[#0b1220] text-white"
            : "border-slate-300 bg-white",
        )}
        aria-hidden
      >
        {selected ? <Check className="size-2.5 stroke-[3]" /> : null}
      </span>
      <span className="min-w-0 text-[13px] leading-snug text-slate-800">
        {label}
      </span>
    </button>
  );
}

export function ServicePolicyPresetsEditor({
  flags,
  onChange,
  disabled = false,
  className,
}: ServicePolicyPresetsEditorProps) {
  const patchTestFlag = flags.find(
    (f): f is Extract<ServicePolicyFlag, { type: "patch_test" }> =>
      f.type === "patch_test",
  );
  const patchTestSelected = Boolean(patchTestFlag);
  const patchTestHours = patchTestFlag?.hours ?? PATCH_TEST_HOURS_DEFAULT;

  const handleToggle = (type: ServicePolicyFlagType) => {
    onChange(toggleServicePolicyFlag(flags, type));
  };

  return (
    <Field
      label="Service policies"
      hint="Cara will mention these when callers ask about this service."
      className={className}
    >
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50/60">
        <ul className="divide-y divide-slate-200/80">
          {SALON_SERVICE_POLICY_PRESETS.map((preset) => {
            if (preset.type === "patch_test") {
              return (
                <li key={preset.type}>
                  <PolicyRow
                    label={preset.label}
                    selected={patchTestSelected}
                    onToggle={() => handleToggle("patch_test")}
                    disabled={disabled}
                  />
                  {patchTestSelected ? (
                    <div className="flex items-center gap-2 border-t border-slate-200/80 bg-white px-3 py-2.5 pl-10">
                      <label
                        htmlFor="svc-policy-patch-hours"
                        className="text-[12.5px] text-slate-600"
                      >
                        Required
                      </label>
                      <input
                        id="svc-policy-patch-hours"
                        type="number"
                        min={PATCH_TEST_HOURS_MIN}
                        max={PATCH_TEST_HOURS_MAX}
                        step={1}
                        value={patchTestHours}
                        disabled={disabled}
                        onChange={(e) =>
                          onChange(
                            updatePatchTestHours(
                              flags,
                              Number(e.target.value) || PATCH_TEST_HOURS_DEFAULT,
                            ),
                          )
                        }
                        className="h-8 w-16 rounded-lg border border-slate-200 bg-white px-2 text-[13px] text-slate-900 outline-none focus:border-slate-400"
                      />
                      <span className="text-[12.5px] text-slate-600">
                        hours before first colour
                      </span>
                    </div>
                  ) : null}
                </li>
              );
            }

            return (
              <li key={preset.type}>
                <PolicyRow
                  label={preset.label}
                  selected={isServicePolicyFlagSelected(flags, preset.type)}
                  onToggle={() => handleToggle(preset.type)}
                  disabled={disabled}
                />
              </li>
            );
          })}
        </ul>
      </div>
    </Field>
  );
}
