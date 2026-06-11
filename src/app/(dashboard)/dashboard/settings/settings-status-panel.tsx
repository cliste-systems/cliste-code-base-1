import { Bell, Bot, Phone, ShieldCheck } from "lucide-react";
import type { ComponentType } from "react";

import { cn } from "@/lib/utils";

import type { SettingsMetrics } from "./settings-helpers";

type StatusItem = {
  key: keyof SettingsMetrics;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const STATUS_ITEMS: StatusItem[] = [
  { key: "cara", label: "Cara", icon: Bot },
  { key: "phoneLine", label: "Phone line", icon: Phone },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "account", label: "Account", icon: ShieldCheck },
];

export function SettingsStatusPanel({ metrics }: { metrics: SettingsMetrics }) {
  return (
    <section className="px-5 py-3">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {STATUS_ITEMS.map((item) => {
          const value = metrics[item.key];
          const Icon = item.icon;

          return (
            <div
              key={item.key}
              className={cn(
                "flex min-w-0 items-center gap-2 rounded-lg border border-slate-200/90",
                "px-2.5 py-2",
              )}
            >
              <Icon className="size-3.5 shrink-0 text-slate-500" aria-hidden />
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-slate-500">
                  {item.label}
                </p>
                <p className="truncate text-[12px] font-semibold text-[#0b1220]">
                  {value}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
