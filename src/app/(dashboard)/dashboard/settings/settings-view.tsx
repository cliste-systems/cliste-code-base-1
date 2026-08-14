"use client";

import { useState, useTransition } from "react";
import { Settings as SettingsIcon } from "lucide-react";

import { ClistePageHeader } from "@/components/dashboard/cliste-page-header";
import { DashboardAnimatedStack } from "@/components/dashboard/dashboard-animated-group";
import { DashboardFormScrollRegion } from "@/components/dashboard/dashboard-form-scroll-region";
import {
  DASHBOARD_INPUT_CLASS,
  DASHBOARD_PRIMARY_BUTTON_CLASS,
} from "@/components/dashboard/dashboard-surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { saveOrganizationSettings } from "./actions";
import type { SettingsInitial } from "./settings-helpers";
import { SettingsSection } from "./settings-section";

type SettingsViewProps = {
  initial: SettingsInitial;
  className?: string;
};

export function SettingsView({ initial, className }: SettingsViewProps) {
  const [notificationEmail, setNotificationEmail] = useState(
    initial.notificationEmail,
  );
  const [notificationPhone, setNotificationPhone] = useState(
    initial.notificationPhone,
  );
  const [pending, startTransition] = useTransition();
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const fieldClass = cn(DASHBOARD_INPUT_CLASS, "text-[13px] text-[#0b1220]");

  function save() {
    setSaveMsg(null);
    startTransition(async () => {
      const result = await saveOrganizationSettings({
        isActive: initial.isActive,
        businessName: initial.businessName,
        notificationEmail,
        notificationPhone,
        callRoutingMode: initial.callRoutingMode,
        transferNumber: initial.transferNumber,
      });
      if (result.ok) setSaveMsg("Changes saved.");
      else setSaveMsg(result.message);
    });
  }

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-2 overflow-hidden bg-white",
        className,
      )}
    >
      <ClistePageHeader
        tone="account"
        icon={SettingsIcon}
        title="Settings"
        description="Where Cara should send follow-up emails and texts."
        actions={
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            <Button
              type="button"
              disabled={pending}
              onClick={save}
              className={DASHBOARD_PRIMARY_BUTTON_CLASS}
            >
              {pending ? "Saving…" : "Save changes"}
            </Button>
            {saveMsg ? (
              <p
                className={cn(
                  "text-[13px]",
                  saveMsg === "Changes saved." ? "text-slate-600" : "text-red-600",
                )}
              >
                {saveMsg}
              </p>
            ) : null}
          </div>
        }
      />

      <DashboardFormScrollRegion scrollClassName="bg-[#fbfcfb] divide-y divide-[#dfe7e2]">
        <DashboardAnimatedStack embedded>
          <SettingsSection title="Notifications">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="notification-email">Notification email</Label>
                <Input
                  id="notification-email"
                  type="email"
                  value={notificationEmail}
                  onChange={(e) => setNotificationEmail(e.target.value)}
                  placeholder="you@business.com"
                  className={fieldClass}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notification-phone">Notification phone</Label>
                <Input
                  id="notification-phone"
                  inputMode="tel"
                  value={notificationPhone}
                  onChange={(e) => setNotificationPhone(e.target.value)}
                  placeholder="+353…"
                  className={fieldClass}
                />
              </div>
            </div>
          </SettingsSection>
        </DashboardAnimatedStack>
      </DashboardFormScrollRegion>
    </div>
  );
}
