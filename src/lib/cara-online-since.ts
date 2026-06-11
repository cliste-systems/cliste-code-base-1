/** Same predicate as dashboard “Online” (see buildCaraStatus). */
export function isCaraOnline(input: {
  lifecycleStatus: string;
  isActive: boolean;
  phoneNumber: string | null;
}): boolean {
  const phoneRaw = input.phoneNumber?.trim() || null;
  const status = input.lifecycleStatus.trim() || "active";
  return status === "active" && input.isActive && phoneRaw !== null;
}
