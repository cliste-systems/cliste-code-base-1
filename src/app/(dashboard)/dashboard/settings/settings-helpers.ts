import type { CallRoutingMode } from "@/lib/call-routing";

export type SettingsInitial = {
  isActive: boolean;
  businessName: string;
  phoneNumber: string;
  signupSegment: string;
  notificationEmail: string;
  notificationPhone: string;
  callRoutingMode: CallRoutingMode;
  transferNumber: string;
  accountStatus: string | null;
};
