import type { BookingMenuImportService } from "@/lib/booking-menu-import-shared";

export function assessBookingImportQuality(
  services: BookingMenuImportService[],
  businessName?: string,
  businessType?: string,
): { quality: "high" | "low"; qualityMessage?: string } {
  if (services.length < 2) {
    return {
      quality: "low",
      qualityMessage:
        "We only found one service — double-check this is your salon's menu before applying.",
    };
  }

  const genericNames = services.filter((s) =>
    /^service\s*\d*$/i.test(s.name.trim()),
  );
  if (genericNames.length >= Math.ceil(services.length / 2)) {
    return {
      quality: "low",
      qualityMessage:
        "These service names look generic — they may not match your salon.",
    };
  }

  const haystack = `${businessName ?? ""} ${businessType ?? ""}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3);
  if (haystack.length > 0) {
    const blob = services
      .map((s) => `${s.name} ${s.category}`)
      .join(" ")
      .toLowerCase();
    const overlap = haystack.some((word) => blob.includes(word));
    if (!overlap) {
      return {
        quality: "low",
        qualityMessage:
          "This menu doesn't look related to your business name — review carefully before applying.",
      };
    }
  }

  return { quality: "high" };
}
