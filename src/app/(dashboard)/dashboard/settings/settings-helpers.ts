import type { CallRoutingMode } from "@/lib/call-routing";

export type SettingsInitial = {
  isActive: boolean;
  businessName: string;
  phoneNumber: string;
  notificationEmail: string;
  notificationPhone: string;
  callRoutingMode: CallRoutingMode;
  transferNumber: string;
  accountStatus: string | null;
};

export type SettingsMetrics = {
  cara: string;
  phoneLine: string;
  notifications: string;
  account: string;
};

export function buildSettingsMetrics(state: SettingsInitial): SettingsMetrics {
  const hasPhone = Boolean(state.phoneNumber.trim());
  const hasNotifications = Boolean(
    state.notificationEmail.trim() || state.notificationPhone.trim(),
  );
  const hasBusinessName = Boolean(state.businessName.trim());

  return {
    cara: state.isActive ? "Live" : "Off",
    phoneLine: hasPhone ? "Connected" : "Not connected",
    notifications: hasNotifications ? "Ready" : "Not set",
    account: state.accountStatus ?? (hasBusinessName ? "Active" : "—"),
  };
}
