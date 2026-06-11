"use client";

import {
  CaraSetupChipEditor,
  type ChipBeforeAddResult,
} from "@/components/agent-knowledge/cara-setup-chip-editor";
import {
  dedupeCaraSetupChips,
  findExactChipInList,
  normalizeCaraSetupChip,
} from "@/lib/cara-setup-chips";
import {
  IRISH_COUNTIES,
  resolveCountyName,
} from "@/lib/irish-counties";
import {
  findNearDuplicateServiceArea,
  serviceAreaChipTooLong,
  stripIncludingClause,
} from "@/lib/service-area-boundary";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  inputId: string;
};

export function CountyChipEditor({ value, onChange, inputId }: Props) {
  const availableCounties = IRISH_COUNTIES.filter(
    (county) =>
      !value.some((item) => item.toLowerCase() === county.toLowerCase()),
  );

  function beforeAdd(item: string): ChipBeforeAddResult {
    const stripped = stripIncludingClause(item);
    if (/\s+including\b/i.test(normalizeCaraSetupChip(item))) {
      const county = resolveCountyName(stripped);
      if (county) {
        if (findExactChipInList(county, value)) {
          return {
            outcome: "block",
            message: `"${county}" is already listed — add town exclusions below instead.`,
          };
        }
        return {
          outcome: "allow",
          warn: `Use the county only (${county}) — add specific towns under Town exclusions.`,
        };
      }
    }

    const county = resolveCountyName(stripped);
    if (!county) {
      return {
        outcome: "block",
        message: "Enter one of the 26 counties (e.g. Donegal, Cork).",
      };
    }

    if (serviceAreaChipTooLong(county)) {
      return { outcome: "block", message: "County name is too long." };
    }

    if (findExactChipInList(county, value)) {
      return { outcome: "block", message: "That county is already listed." };
    }

    const nearDup = findNearDuplicateServiceArea(county, value);
    if (nearDup) {
      return {
        outcome: "allow",
        warn: `Looks similar to "${nearDup}" — check you need both.`,
      };
    }

    return { outcome: "allow" };
  }

  function addCounty(county: string) {
    if (findExactChipInList(county, value)) return;
    onChange(dedupeCaraSetupChips([...value, county]));
  }

  return (
    <CaraSetupChipEditor
      inputId={inputId}
      placeholder="Add a county"
      value={value}
      onChange={(next) =>
        onChange(
          dedupeCaraSetupChips(
            next
              .map((item) => {
                const stripped = stripIncludingClause(item);
                return resolveCountyName(stripped) ?? stripped;
              })
              .filter(Boolean),
          ),
        )
      }
      beforeAdd={beforeAdd}
      listBanner={
        availableCounties.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {availableCounties.map((county) => (
              <button
                key={county}
                type="button"
                onClick={() => addCounty(county)}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[12px] text-slate-700 hover:border-slate-300"
              >
                {county}
              </button>
            ))}
          </div>
        ) : null
      }
    />
  );
}
