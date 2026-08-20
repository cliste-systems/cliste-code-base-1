export const RETAIL_BANNERS = [
  "supervalu",
  "centra",
  "daybreak",
  "eurospar",
  "other",
] as const;

export type RetailBanner = (typeof RETAIL_BANNERS)[number];

export const DIVERT_CARRIERS = [
  "eir",
  "vodafone",
  "three",
  "virgin",
  "other",
] as const;

export type DivertCarrier = (typeof DIVERT_CARRIERS)[number];

export const STORE_CONTACT_ROLES = [
  "store_manager",
  "duty_manager",
  "department_head",
  "back_office",
  "owner",
] as const;

export type StoreContactRole = (typeof STORE_CONTACT_ROLES)[number];

export const RETAIL_FACILITIES = [
  { id: "parking", label: "Parking" },
  { id: "wheelchair_access", label: "Wheelchair access" },
  { id: "atm", label: "ATM" },
  { id: "post_office", label: "Post Office" },
  { id: "pharmacy", label: "Pharmacy" },
  { id: "coffee_dock", label: "Coffee dock" },
  { id: "gas_coal", label: "Gas / coal" },
  { id: "dry_cleaning", label: "Dry cleaning" },
] as const;

export type RetailDeliveryFacts = {
  enabled?: boolean;
  area?: string;
  cut_off?: string;
  min_spend?: string;
};

export type StoreDepartmentRow = {
  id: string;
  organization_id: string;
  name: string;
  phone_e164: string | null;
  hours: Record<string, unknown> | null;
  transfer_enabled: boolean;
  cara_note: string | null;
  sort_order: number;
  active: boolean;
};

export type StoreContactRow = {
  id: string;
  organization_id: string;
  department_id: string | null;
  name: string;
  role: StoreContactRole;
  phone_e164: string | null;
  email: string | null;
  is_notification_target: boolean;
  can_receive_transfers: boolean;
  active: boolean;
};

export const SUPERVALU_DEPARTMENT_PRESETS = [
  "Customer service",
  "Deli / hot food",
  "Butcher",
  "Fish counter",
  "Bakery",
  "Off-licence",
  "Click & Collect",
  "Post Office",
  "Pharmacy",
  "Back office",
] as const;

export type AdminStoreSetupData = {
  organizationId: string;
  name: string;
  slug: string;
  niche: string;
  accountId: string | null;
  storeCode: string;
  retailBanner: RetailBanner | "";
  agentLocationAddress: string;
  agentLocationEircode: string;
  agentLocationCounty: string;
  timezone: string;
  phoneNumber: string;
  storePublicNumber: string;
  callRoutingMode: string;
  fallbackNumber: string;
  divertCarrier: DivertCarrier | "";
  divertVerifiedAt: string | null;
  retailFacilities: string[];
  retailDelivery: RetailDeliveryFacts;
  retailClickCollectUrl: string;
  retailLoyaltyProgram: string;
  quotePricesOnCalls: boolean;
  greeting: string;
  customPrompt: string;
  promptCompileWarnings: string[];
  assistantDisplayName: string;
  agentVoiceId: string;
  isActive: boolean;
  caraOnlineSince: string | null;
  businessHours: Record<string, unknown> | null;
  agentOpeningHours: string;
  routingLinks: unknown;
  departments: StoreDepartmentRow[];
  contacts: StoreContactRow[];
};
