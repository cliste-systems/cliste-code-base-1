"use client";

import { useRef, useState, useTransition } from "react";
import {
  Check,
  PhoneForwarded,
  Settings as SettingsIcon,
} from "lucide-react";

import { ClistePageHeader } from "@/components/dashboard/cliste-page-header";
import { DashboardAnimatedStack } from "@/components/dashboard/dashboard-animated-group";
import { DashboardFormScrollRegion } from "@/components/dashboard/dashboard-form-scroll-region";
import { DashboardProfileEditor, type DashboardProfileEditorHandle } from "@/components/dashboard/dashboard-profile-editor";
import {
  DASHBOARD_INPUT_CLASS,
  DASHBOARD_PRIMARY_BUTTON_CLASS,
} from "@/components/dashboard/dashboard-surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatE164ForDisplay } from "@/lib/call-history-types";
import {
  CALL_ROUTING_MODES,
  CALL_ROUTING_MODE_META,
  CANCEL_ALL_FORWARDING_CODE,
  forwardingCodesForMode,
  type CallRoutingMode,
} from "@/lib/call-routing";
import { cn } from "@/lib/utils";
import { DASHBOARD_ROUTES } from "@/lib/dashboard-routes";

import { AccountSecuritySection } from "./account-security-section";
import { saveOrganizationSettings } from "./actions";
import { BlockedNumbersSection } from "./blocked-numbers-section";
import type { BlockedNumbersInitial } from "./blocked-numbers-actions";
import type { SettingsInitial } from "./settings-helpers";
import { SettingsSection } from "./settings-section";
import { useDashboardVertical } from "../dashboard-vertical-context";

type SettingsViewProps = {
  initial: SettingsInitial;
  blockedNumbers: BlockedNumbersInitial;
  profileInitial: {
    name: string;
    initials: string;
    avatarUrl: string | null;
    subtitle: string;
  };
  signInEmail: string;
  canManageAccount: boolean;
  isLocalPreview?: boolean;
  className?: string;
};

function settingsPageDescription(
  verticalId: string,
  canManageAccount: boolean,
): string {
  if (verticalId === "retail") {
    return canManageAccount
      ? "Your profile, sign-in, store details, and notifications."
      : "Store details, your Cliste number, and notifications.";
  }
  return canManageAccount
    ? "Your profile, sign-in, business details, and notifications."
    : "Business details, phone line, and notifications.";
}

export function SettingsView({
  initial,
  blockedNumbers,
  profileInitial,
  signInEmail,
  canManageAccount,
  isLocalPreview = false,
  className,
}: SettingsViewProps) {
  const { copy, vertical } = useDashboardVertical();
  const isRetail = vertical.id === "retail";
  const businessNameLabel = isRetail ? "Store name" : "Business name";
  const showCallRoutingSettings = !(vertical.nav?.hiddenHrefs ?? []).includes(
    DASHBOARD_ROUTES.routing,
  );
  const [businessName, setBusinessName] = useState(initial.businessName);
  const [notificationEmail, setNotificationEmail] = useState(
    initial.notificationEmail,
  );
  const [notificationPhone, setNotificationPhone] = useState(
    initial.notificationPhone,
  );
  const [callRoutingMode, setCallRoutingMode] = useState<CallRoutingMode>(
    initial.callRoutingMode,
  );
  const [transferNumber, setTransferNumber] = useState(initial.transferNumber);
  const [pending, startTransition] = useTransition();
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const profileEditorRef = useRef<DashboardProfileEditorHandle>(null);

  const hasClisteNumber = Boolean(initial.phoneNumber.trim());
  const phoneDisplay = hasClisteNumber
    ? formatE164ForDisplay(initial.phoneNumber) || initial.phoneNumber.trim()
    : null;

  const fieldClass = cn(DASHBOARD_INPUT_CLASS, "text-[13px] text-[#0b1220]");

  function save() {
    setSaveMsg(null);
    startTransition(async () => {
      const profileResult =
        (await profileEditorRef.current?.saveIfDirty()) ?? { ok: true as const };
      if (!profileResult.ok) {
        setSaveMsg(profileResult.message);
        return;
      }

      const result = await saveOrganizationSettings({
        isActive: initial.isActive,
        businessName,
        notificationEmail,
        notificationPhone,
        callRoutingMode,
        transferNumber,
      });
      if (result.ok) setSaveMsg("Changes saved.");
      else setSaveMsg(result.message);
    });
  }

  const saveButton = (
    <Button
      type="button"
      disabled={pending}
      onClick={save}
      className={DASHBOARD_PRIMARY_BUTTON_CLASS}
    >
      {pending ? "Saving…" : "Save changes"}
    </Button>
  );

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-4 overflow-hidden",
        className,
      )}
    >
      <ClistePageHeader
        tone="account"
        icon={SettingsIcon}
        title="Settings"
        description={settingsPageDescription(vertical.id, canManageAccount)}
        actions={
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            {saveButton}
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

      <DashboardFormScrollRegion
        className="min-h-0 flex-1"
        scrollClassName="divide-y divide-[#dfe7e2] bg-[#fbfcfb]"
      >
        <DashboardAnimatedStack embedded>
          <SettingsSection title="Your profile">
            <DashboardProfileEditor
              ref={profileEditorRef}
              deferSaveToParent
              initialName={profileInitial.name}
              initials={profileInitial.initials}
              avatarUrl={profileInitial.avatarUrl}
              subtitle={profileInitial.subtitle}
            />
          </SettingsSection>

          {canManageAccount ? (
            <AccountSecuritySection
              signInEmail={signInEmail}
              fieldClass={fieldClass}
              isLocalPreview={isLocalPreview}
            />
          ) : null}

          <SettingsSection title={copy.settings.businessIdentityTitle}>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="business-name">{businessNameLabel}</Label>
                <Input
                  id="business-name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder={isRetail ? "Your store name" : "Your business name"}
                  className={fieldClass}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signup-segment">Business type</Label>
                <Input
                  id="signup-segment"
                  readOnly
                  tabIndex={-1}
                  value={initial.signupSegment}
                  className={cn(
                    fieldClass,
                    "cursor-default bg-slate-50/80 focus-visible:ring-0",
                  )}
                  aria-describedby="signup-segment-hint"
                />
                <p
                  id="signup-segment-hint"
                  className="text-[12px] leading-relaxed text-slate-500"
                >
                  Chosen at signup — Cara uses this to tailor your dashboard.
                  Contact support if it needs updating.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cliste-number">Cliste number</Label>
                <Input
                  id="cliste-number"
                  readOnly
                  tabIndex={-1}
                  value={phoneDisplay ?? "Not assigned yet"}
                  className={cn(
                    fieldClass,
                    "cursor-default bg-slate-50/80 tabular-nums focus-visible:ring-0",
                    phoneDisplay ? "text-[#0b1220]" : "text-slate-500",
                  )}
                  aria-describedby="cliste-number-hint"
                />
                <p
                  id="cliste-number-hint"
                  className="text-[12px] leading-relaxed text-slate-500"
                >
                  {hasClisteNumber
                    ? "Assigned to your account — it can't be changed here."
                    : "Assigned after onboarding — it can't be changed here."}{" "}
                  Contact support if you have any questions.
                </p>
              </div>
            </div>
          </SettingsSection>

          {showCallRoutingSettings ? (
            <SettingsSection title="Your number & forwarding">
              <CallRoutingControls
                mode={callRoutingMode}
                onModeChange={setCallRoutingMode}
                transferNumber={transferNumber}
                onTransferChange={setTransferNumber}
                clisteNumber={initial.phoneNumber}
                fieldClass={fieldClass}
              />
            </SettingsSection>
          ) : null}

          <SettingsSection title="Notifications">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="notification-email">Notification email</Label>
                <Input
                  id="notification-email"
                  type="email"
                  autoComplete="email"
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
                  autoComplete="tel"
                  value={notificationPhone}
                  onChange={(e) => setNotificationPhone(e.target.value)}
                  placeholder="+353…"
                  className={fieldClass}
                />
              </div>
            </div>
          </SettingsSection>

          <BlockedNumbersSection initial={blockedNumbers} />
        </DashboardAnimatedStack>
      </DashboardFormScrollRegion>
    </div>
  );
}

function CallRoutingControls({
  mode,
  onModeChange,
  transferNumber,
  onTransferChange,
  clisteNumber,
  fieldClass,
}: {
  mode: CallRoutingMode;
  onModeChange: (mode: CallRoutingMode) => void;
  transferNumber: string;
  onTransferChange: (value: string) => void;
  clisteNumber: string;
  fieldClass: string;
}) {
  const codes = forwardingCodesForMode(mode, clisteNumber);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        {CALL_ROUTING_MODES.map((id) => {
          const meta = CALL_ROUTING_MODE_META[id];
          const active = mode === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onModeChange(id)}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-left transition-colors",
                active
                  ? "border-[#0b1220] bg-[#0b1220]/[0.04] ring-1 ring-[#0b1220]/10"
                  : "border-slate-200 bg-white hover:border-slate-300",
              )}
              aria-pressed={active}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-[#0b1220]">
                  {meta.title}
                </span>
                {active ? (
                  <Check className="size-4 shrink-0 text-[#0b1220]" aria-hidden />
                ) : null}
              </div>
              <span className="mt-1 block text-[12px] leading-snug text-slate-500">
                {meta.tagline}
              </span>
            </button>
          );
        })}
      </div>

      {mode === "cliste_number" ? (
        <div className="space-y-1.5">
          <Label htmlFor="transfer-number">Transfer to a person</Label>
          <Input
            id="transfer-number"
            inputMode="tel"
            value={transferNumber}
            onChange={(e) => onTransferChange(e.target.value)}
            placeholder="+353…"
            className={fieldClass}
          />
          <p className="text-[12px] text-slate-500">
            Leave blank and Cara takes a message instead.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50/60">
          <div className="flex items-center gap-2 px-4 py-3">
            <PhoneForwarded className="size-4 text-[#0b1220]" aria-hidden />
            <p className="text-[13px] font-semibold text-[#0b1220]">
              Forward your number to Cara
            </p>
          </div>
          <div className="max-h-[min(200px,32vh)] overflow-y-auto overscroll-y-contain border-t border-slate-200/80 px-4 py-2.5">
            <ul className="space-y-2">
              {codes.map((code) => (
                <li
                  key={code.kind}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-medium text-[#0b1220]">
                      {code.label}
                    </p>
                    <p className="mt-0.5 text-[11.5px] leading-snug text-slate-500">
                      {code.hint}
                    </p>
                  </div>
                  <code className="shrink-0 rounded-md bg-slate-100 px-2 py-1 font-mono text-[12px] tabular-nums text-[#0b1220]">
                    {code.activate}
                  </code>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11.5px] leading-relaxed text-slate-400">
              Turn forwarding off with{" "}
              <span className="font-mono text-slate-500">
                {CANCEL_ALL_FORWARDING_CODE}
              </span>
              . Cara transfers aren&apos;t offered in this mode (it would loop
              back to your forwarded line).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
