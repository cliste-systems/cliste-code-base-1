/** Canonical admin console URLs — use these instead of legacy /admin/organizations paths. */

export function adminOverviewPath(): string {
  return "/admin";
}

export function adminCustomersPath(type?: "managed" | "self_serve"): string {
  if (!type) return "/admin/customers";
  return `/admin/customers?type=${type}`;
}

export function adminCustomerPath(orgId: string): string {
  return `/admin/customers/${orgId.trim()}`;
}

export function adminCustomerCaraTrainingPath(orgId: string): string {
  return `${adminCustomerPath(orgId)}/cara-training`;
}

export function adminPhonePoolPath(): string {
  return "/admin/phone-pool";
}

export function adminDemoCallsPath(): string {
  return "/admin/demo-calls";
}

export function adminTextRehearsalPath(): string {
  return "/admin/demo-calls/text-rehearsal";
}

export function adminSupportPath(): string {
  return "/admin/support";
}

export function adminSupportTicketPath(ticketId: string): string {
  return `/admin/support/${ticketId.trim()}`;
}
