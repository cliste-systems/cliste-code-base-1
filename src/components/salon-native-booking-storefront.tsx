"use client";

import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  CloudSun,
  Coffee,
  Heart,
  MapPin,
  Minus,
  Plus,
  Route,
  Scissors,
  Sparkles,
  Star,
  Sun,
  Users,
  Wifi,
} from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  useTransition,
} from "react";

import { Turnstile } from "@marsidev/react-turnstile";
import {
  getPublicBookingSlotsRange,
  requestPublicBookingOtp,
  submitPublicBooking,
} from "@/app/[salonSlug]/actions";
import type { SalonStorefrontService } from "@/components/salon-storefront-ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addDaysToYmd,
  getSalonTimeZone,
  todayYmdInTimeZone,
} from "@/lib/booking-available-slots";
import { StorefrontMapEmbed } from "@/components/storefront-map-embed";
import type {
  StorefrontReviewsBlock,
  StorefrontTeamMember,
} from "@/lib/storefront-blocks";
import { cn } from "@/lib/utils";

function formatEur(price: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: Number.isInteger(price) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(price);
}

function slotHour(iso: string, tz: string): number {
  return parseInt(formatInTimeZone(new Date(iso), tz, "H"), 10);
}

function slotTimeLabel(iso: string, tz: string): string {
  return formatInTimeZone(new Date(iso), tz, "HH:mm");
}

const FALLBACK_GALLERY = [
  "https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=1600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?q=80&w=800&auto=format&fit=crop",
] as const;

function gallerySrc(urls: string[], index: number): string {
  const u = urls[index]?.trim();
  if (u) return u;
  return FALLBACK_GALLERY[index] ?? FALLBACK_GALLERY[0];
}

/** Default seed copy; real salons should replace it in Storefront. */
function isLikelyDemoAddressLine(s: string | null | undefined): boolean {
  const t = (s ?? "").trim().toLowerCase();
  return t.includes("123 main street") && t.includes("dublin");
}

type SalonNativeBookingStorefrontProps = {
  salonName: string;
  addressLine: string | null;
  bio: string | null;
  organizationId: string;
  salonSlug: string;
  services: SalonStorefrontService[];
  /** Up to 3 public image URLs for the hero gallery. */
  galleryUrls: string[];
  /** Optional rating/reviews line (e.g. from Google). */
  ratingLine: string | null;
  eircode?: string | null;
  mapLat?: number | null;
  mapLng?: number | null;
  amenityLabels?: string[];
  teamMembers?: StorefrontTeamMember[];
  reviewsBlock?: StorefrontReviewsBlock | null;
  showTeamSection?: boolean;
  showMapSection?: boolean;
  showReviewsSection?: boolean;
};

export function SalonNativeBookingStorefront({
  salonName,
  addressLine,
  bio,
  organizationId,
  salonSlug,
  services,
  galleryUrls,
  ratingLine,
  eircode = null,
  mapLat = null,
  mapLng = null,
  amenityLabels = [],
  teamMembers = [],
  reviewsBlock = null,
  showTeamSection = true,
  showMapSection = true,
  showReviewsSection = true,
}: SalonNativeBookingStorefrontProps) {
  const nameId = useId();
  const phoneId = useId();
  const emailId = useId();
  const otpId = useId();
  const honeypotId = useId();

  const turnstileSiteKey =
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
  const publicOtpDisabled =
    process.env.NEXT_PUBLIC_PUBLIC_BOOKING_OTP_DISABLED === "true";

  const visible = useMemo(
    () => services.filter((s) => s.name?.trim()),
    [services],
  );

  const categories = useMemo(() => {
    const order: string[] = [];
    const seen = new Set<string>();
    for (const s of visible) {
      const c = s.category?.trim() || "Services";
      if (!seen.has(c)) {
        seen.add(c);
        order.push(c);
      }
    }
    return order.length ? order : ["Services"];
  }, [visible]);

  const displayCategories = useMemo(() => {
    const three = categories.slice(0, 3);
    while (three.length < 3) {
      three.push("Services");
    }
    return three.slice(0, 3);
  }, [categories]);

  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    () => visible[0]?.id ?? null,
  );

  useEffect(() => {
    if (visible.length && !visible.some((s) => s.id === selectedServiceId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedServiceId(visible[0]?.id ?? null);
    }
  }, [visible, selectedServiceId]);

  const selectedService = useMemo(
    () => visible.find((s) => s.id === selectedServiceId) ?? null,
    [visible, selectedServiceId],
  );

  const [timeZone, setTimeZone] = useState(() => getSalonTimeZone());

  const [selectedDateYmd, setSelectedDateYmd] = useState(() =>
    todayYmdInTimeZone(getSalonTimeZone()),
  );
  /** `any` or index into `teamMembers` for a named stylist */
  const [staffChoice, setStaffChoice] = useState<"any" | number>("any");
  const [selectedSlotIso, setSelectedSlotIso] = useState<string | null>(null);
  const [slotsByDate, setSlotsByDate] = useState<
    Record<string, { startIso: string; label: string }[]>
  >({});
  const [slotsPending, startSlotsTransition] = useTransition();
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const dateStrip = useMemo(() => {
    const tz = timeZone;
    const out: { ymd: string; dow: string; day: string }[] = [];
    const anchor = todayYmdInTimeZone(tz);
    for (let i = 0; i < 28; i++) {
      const ymd = addDaysToYmd(anchor, i, tz);
      const noon = fromZonedTime(`${ymd}T12:00:00`, tz);
      const dow = formatInTimeZone(noon, tz, "EEE");
      const day = formatInTimeZone(noon, tz, "d");
      out.push({ ymd, dow, day });
    }
    return out;
  }, [timeZone]);

  const slots = slotsByDate[selectedDateYmd] ?? [];

  const selectedStaffIdForSlots = useMemo(() => {
    if (staffChoice === "any") return null;
    const m = teamMembers[staffChoice];
    const id = m?.staffProfileId?.trim();
    return id || null;
  }, [staffChoice, teamMembers]);

  const staffSummary = useMemo(() => {
    if (staffChoice === "any") {
      return {
        kind: "any" as const,
        label: "Any available professional",
        sub: "Staff selected automatically",
      };
    }
    const m = teamMembers[staffChoice];
    const name = m?.name?.trim() || "Team member";
    const hasProfile = Boolean(m?.staffProfileId?.trim());
    return {
      kind: "member" as const,
      label: name,
      sub: hasProfile
        ? "Booked with this professional"
        : "Preference only — assign at the salon if needed",
    };
  }, [staffChoice, teamMembers]);

  const selectedTeamMember = useMemo(() => {
    if (staffChoice === "any") return null;
    return teamMembers[staffChoice] ?? null;
  }, [staffChoice, teamMembers]);

  useEffect(() => {
    if (
      staffChoice !== "any" &&
      (staffChoice < 0 || staffChoice >= teamMembers.length)
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStaffChoice("any");
    }
  }, [staffChoice, teamMembers.length]);

  useEffect(() => {
    if (!selectedServiceId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSlotsByDate({});
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedSlotIso(null);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSlotsError(null);
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSlotsError(null);
    startSlotsTransition(() => {
      void (async () => {
        const tz = getSalonTimeZone();
        const startYmd = todayYmdInTimeZone(tz);
        const res = await getPublicBookingSlotsRange({
          organizationId,
          serviceId: selectedServiceId,
          startYmd,
          days: 28,
          staffId: selectedStaffIdForSlots,
        });
        if (!res.ok) {
          setSlotsByDate({});
          setSlotsError(res.message);
          setSelectedSlotIso(null);
          return;
        }
        setTimeZone(res.timeZone);
        setSlotsByDate(res.slotsByDate);
        const pick =
          res.firstAvailableYmd ??
          todayYmdInTimeZone(res.timeZone);
        setSelectedDateYmd(pick);
        const daySlots = res.slotsByDate[pick] ?? [];
        setSelectedSlotIso(daySlots[0]?.startIso ?? null);
      })();
    });
  }, [organizationId, selectedServiceId, selectedStaffIdForSlots]);

  useEffect(() => {
    const daySlots = slotsByDate[selectedDateYmd];
    if (!daySlots?.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedSlotIso(null);
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedSlotIso((prev) => {
      if (prev && daySlots.some((s) => s.startIso === prev)) return prev;
      return daySlots[0]?.startIso ?? null;
    });
  }, [selectedDateYmd, slotsByDate]);

  const morningSlots = useMemo(
    () => slots.filter((s) => slotHour(s.startIso, timeZone) < 12),
    [slots, timeZone],
  );
  const afternoonSlots = useMemo(
    () => slots.filter((s) => slotHour(s.startIso, timeZone) >= 12),
    [slots, timeZone],
  );

  const hasAnySlotsInRange = useMemo(
    () => Object.values(slotsByDate).some((d) => d.length > 0),
    [slotsByDate],
  );

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [bookingPending, startBookingTransition] = useTransition();
  const [otpSendPending, startOtpSendTransition] = useTransition();
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [toast, setToast] = useState(false);
  const [toastEmailLine, setToastEmailLine] = useState<string | null>(null);
  const [dialogName, setDialogName] = useState("");
  const [dialogPhone, setDialogPhone] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(publicOtpDisabled);
  /** Bump after each successful OTP send so the code input remounts empty. */
  const [otpInputMountKey, setOtpInputMountKey] = useState(0);

  useEffect(() => {
    if (!toast) return;
    const ms = toastEmailLine ? 12_000 : 5000;
    const t = window.setTimeout(() => {
      setToast(false);
      setToastEmailLine(null);
    }, ms);
    return () => window.clearTimeout(t);
  }, [toast, toastEmailLine]);

  const totalPrice = selectedService?.price ?? 0;

  const formattedDateTimeSummary = useMemo(() => {
    if (!selectedSlotIso) return null;
    const d = new Date(selectedSlotIso);
    const datePart = formatInTimeZone(d, timeZone, "d MMM");
    const timePart = formatInTimeZone(d, timeZone, "h:mm a");
    return { datePart, timePart, weekdayLong: formatInTimeZone(d, timeZone, "EEEE, d MMM") };
  }, [selectedSlotIso, timeZone]);

  const monthButtonLabel = useMemo(
    () =>
      formatInTimeZone(
        fromZonedTime(`${selectedDateYmd}T12:00:00`, timeZone),
        timeZone,
        "MMM yyyy",
      ),
    [selectedDateYmd, timeZone],
  );

  const handleSendVerificationCode = useCallback(() => {
    setBookingError(null);
    startOtpSendTransition(async () => {
      const res = await requestPublicBookingOtp({
        organizationId,
        customerPhone: dialogPhone,
        turnstileToken: turnstileToken ?? "",
      });
      if (!res.success) {
        setBookingError(res.message);
        return;
      }
      setOtpSent(true);
      setOtpInputMountKey((k) => k + 1);
    });
  }, [organizationId, dialogPhone, turnstileToken]);

  const handleConfirmBooking = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!selectedServiceId || !selectedSlotIso) return;
      if (!publicOtpDisabled && !otpSent) {
        setBookingError("Send a verification code to your phone first.");
        return;
      }
      const form = e.currentTarget;
      const customerName = String(
        (form.elements.namedItem("customer_name") as HTMLInputElement)?.value ??
          "",
      ).trim();
      const customerPhone = String(
        (form.elements.namedItem("customer_phone") as HTMLInputElement)
          ?.value ?? "",
      ).trim();
      const customerEmail = String(
        (form.elements.namedItem("customer_email") as HTMLInputElement)
          ?.value ?? "",
      ).trim();
      const bookingOtpCode = String(
        (form.elements.namedItem("booking_otp_code") as HTMLInputElement)
          ?.value ?? "",
      ).trim();
      setBookingError(null);
      startBookingTransition(() => {
        void (async () => {
          const fd = new FormData();
          fd.set("customer_name", customerName);
          fd.set("customer_phone", customerPhone);
          fd.set("customer_email", customerEmail);
          fd.set("start_time_iso", selectedSlotIso);
          fd.set("booking_otp_code", bookingOtpCode);
          if (selectedStaffIdForSlots) {
            fd.set("staff_id", selectedStaffIdForSlots);
          }
          const hp = (
            form.elements.namedItem("booking_website") as HTMLInputElement
          )?.value;
          if (hp) fd.set("booking_website", hp);
          const res = await submitPublicBooking(
            fd,
            organizationId,
            selectedServiceId,
            salonSlug,
          );
          if (!res.success) {
            setBookingError(res.message);
            return;
          }
          setToastEmailLine(res.emailNotice ?? null);
          setConfirmOpen(false);
          setDialogName("");
          setDialogPhone("");
          setOtpSent(publicOtpDisabled);
          setTurnstileToken(null);
          setToast(true);
        })();
      });
    },
    [
      organizationId,
      salonSlug,
      selectedServiceId,
      selectedSlotIso,
      selectedStaffIdForSlots,
      otpSent,
      publicOtpDisabled,
    ],
  );

  const eircodeTrim = eircode?.trim() ?? "";
  const addressTrim = addressLine?.trim() ?? "";
  const demoAddr = isLikelyDemoAddressLine(addressLine);
  /** Match map pin: prefer Eircode when the saved street line is still demo text. */
  const addressText = (() => {
    if (eircodeTrim && demoAddr) return eircodeTrim;
    if (demoAddr && mapLat != null && mapLng != null) {
      return eircodeTrim || "Location shown on map";
    }
    if (addressTrim && eircodeTrim) return `${addressTrim} · ${eircodeTrim}`;
    if (addressTrim) return addressTrim;
    if (eircodeTrim) return eircodeTrim;
    return "123 Main Street, Dublin";
  })();

  const bioText =
    bio ??
    "Award-winning contemporary hair salon specializing in bespoke cutting, coloring and premium extensions. Our expert team is dedicated to providing a luxurious, relaxing experience tailored entirely to you.";

  const directionsHref = (() => {
    if (mapLat != null && mapLng != null) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${mapLat},${mapLng}`)}`;
    }
    const q = eircodeTrim
      ? `${eircodeTrim}, Ireland`
      : addressTrim || addressText;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  })();

  const hasReviewCardContent = Boolean(
    reviewsBlock &&
      ((reviewsBlock.score && String(reviewsBlock.score).trim()) ||
        (reviewsBlock.entries && reviewsBlock.entries.length > 0)),
  );
  const showReviewsCard = showReviewsSection && hasReviewCardContent;
  const showMapCard = showMapSection;
  const bottomSectionVisible = showMapCard || showReviewsCard;
  const bottomTwoCols = showMapCard && showReviewsCard;

  if (!visible.length) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <p className="text-sm text-gray-500">
          No bookable services are listed yet. Please check back soon.
        </p>
      </div>
    );
  }

  return (
    <>
      {toast ? (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-[100] max-w-sm -translate-x-1/2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-900 shadow-lg lg:bottom-6"
        >
          <p>Booking confirmed!</p>
          {toastEmailLine ? (
            <p className="mt-2 text-xs font-normal leading-snug text-emerald-950/90">
              {toastEmailLine}
            </p>
          ) : null}
        </div>
      ) : null}

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) {
            setBookingError(null);
            setDialogName("");
            setDialogPhone("");
            setOtpSent(publicOtpDisabled);
            setTurnstileToken(null);
            setOtpInputMountKey(0);
          }
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Confirm booking</DialogTitle>
            <DialogDescription>
              {selectedService
                ? `${selectedService.name} · ${formatEur(selectedService.price)}`
                : null}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4 py-1" onSubmit={handleConfirmBooking}>
            <input
              type="text"
              name="booking_website"
              id={honeypotId}
              tabIndex={-1}
              autoComplete="off"
              className="absolute left-[-9999px] h-0 w-0 opacity-0"
              aria-hidden
            />
            <div className="space-y-2">
              <Label htmlFor={nameId}>Name</Label>
              <Input
                id={nameId}
                name="customer_name"
                autoComplete="name"
                required
                placeholder="Your name"
                value={dialogName}
                onChange={(e) => setDialogName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={phoneId}>Phone</Label>
              <Input
                id={phoneId}
                name="customer_phone"
                type="tel"
                autoComplete="tel"
                required
                placeholder="e.g. 087 123 4567"
                value={dialogPhone}
                onChange={(e) => setDialogPhone(e.target.value)}
              />
            </div>
            {!publicOtpDisabled ? (
              <div className="space-y-3 rounded-lg border border-gray-100 bg-gray-50/80 p-3">
                <p className="text-xs text-gray-600">
                  We&apos;ll text a one-time code to confirm your number.
                </p>
                {turnstileSiteKey ? (
                  <Turnstile
                    siteKey={turnstileSiteKey}
                    onSuccess={(t) => setTurnstileToken(t)}
                    onExpire={() => setTurnstileToken(null)}
                  />
                ) : null}
                {!otpSent ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    disabled={
                      otpSendPending ||
                      !dialogPhone.trim() ||
                      (!!turnstileSiteKey && !turnstileToken)
                    }
                    onClick={handleSendVerificationCode}
                  >
                    {otpSendPending ? "Sending…" : "Text me a code"}
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-center text-xs font-medium text-gray-700">
                      Code sent — check your phone
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={
                        otpSendPending ||
                        !dialogPhone.trim() ||
                        (!!turnstileSiteKey && !turnstileToken)
                      }
                      onClick={handleSendVerificationCode}
                    >
                      {otpSendPending ? "Sending…" : "Resend code"}
                    </Button>
                  </div>
                )}
              </div>
            ) : null}
            {!publicOtpDisabled ? (
              <div className="space-y-2">
                <Label htmlFor={otpId}>Verification code</Label>
                <Input
                  key={otpInputMountKey}
                  id={otpId}
                  name="booking_otp_code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6-digit code"
                  maxLength={6}
                  required={!publicOtpDisabled}
                  disabled={!otpSent}
                />
              </div>
            ) : (
              <input type="hidden" name="booking_otp_code" value="" />
            )}
            <div className="space-y-2">
              <Label htmlFor={emailId}>
                Email <span className="font-normal text-gray-400">(optional)</span>
              </Label>
              <Input
                id={emailId}
                name="customer_email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
              />
              <p className="text-[11px] leading-snug text-gray-500">
                Optional — we&apos;ll email you a booking summary if you add your address.
              </p>
            </div>
            {bookingError ? (
              <p className="text-sm text-red-600" role="alert">
                {bookingError}
              </p>
            ) : null}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  bookingPending ||
                  (!publicOtpDisabled && !otpSent)
                }
              >
                {bookingPending ? "Booking…" : "Confirm"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="antialiased text-gray-900 bg-gray-50 flex min-h-screen flex-col">
        <header className="sticky top-0 z-40 w-full border-b border-gray-200/80 bg-white shadow-sm">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-gray-900 text-white shadow-sm">
                  <Scissors className="h-[18px] w-[18px]" strokeWidth={1.5} />
                </div>
                <div>
                  <h1 className="mb-0.5 text-base font-medium leading-none">
                    {salonName}
                  </h1>
                  <p className="text-xs leading-none text-gray-500">
                    {addressText}
                  </p>
                </div>
            </div>
            <div className="hidden items-center gap-4 sm:flex">
              <Link
                href="/authenticate"
                className="text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
              >
                Log in
              </Link>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 transition-colors hover:bg-gray-50"
                aria-label="Favorites"
              >
                <Heart className="h-5 w-5" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </header>

        <main className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-4 py-6 pb-40 sm:px-6 lg:px-8 lg:py-8 lg:pb-10">
          <section className="flex flex-col gap-6">
            <div className="grid h-56 grid-cols-4 gap-2 overflow-hidden rounded-[24px] sm:h-72 lg:h-[360px]">
              <div className="relative col-span-4 cursor-pointer bg-gray-200 group sm:col-span-3">
                <img
                  src={gallerySrc(galleryUrls, 0)}
                  alt="Salon Interior"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/10" />
              </div>
              <div className="col-span-1 hidden flex-col gap-2 sm:flex">
                <div className="relative h-full flex-1 cursor-pointer overflow-hidden bg-gray-200 group">
                  <img
                    src={gallerySrc(galleryUrls, 1)}
                    alt="Salon Detail"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
                <div className="relative h-full flex-1 cursor-pointer overflow-hidden bg-gray-200 group">
                  <img
                    src={gallerySrc(galleryUrls, 2)}
                    alt="Products"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <span className="rounded-full border border-white/30 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
                      View gallery
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-between gap-6 border-b border-gray-200/80 pb-6 md:flex-row md:items-end">
              <div className="flex max-w-2xl flex-col gap-3">
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
                    {salonName}
                  </h1>
                  <span className="flex items-center gap-1 rounded-full border border-green-200/60 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Verified
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-gray-500">{bioText}</p>
                <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-gray-600">
                  {ratingLine ? (
                    <>
                      <span className="flex items-center gap-1.5">
                        <Star
                          className="h-4 w-4 shrink-0 text-gray-900"
                          strokeWidth={1.5}
                        />
                        <span className="font-medium text-gray-900">
                          {ratingLine}
                        </span>
                      </span>
                      {amenityLabels.length > 0 ? (
                        <span className="text-gray-300">•</span>
                      ) : null}
                    </>
                  ) : null}
                  {amenityLabels.map((label, i) => {
                    const AmIcon = [Wifi, Route, Coffee, Star][i % 4];
                    return (
                      <span
                        key={`${label}-${i}`}
                        className="flex items-center gap-1.5"
                      >
                        <AmIcon className="h-4 w-4" strokeWidth={1.5} />
                        {label}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <div className="flex w-full flex-col gap-8 lg:flex-row">
            <div className="flex w-full flex-col gap-10 lg:w-[65%]">
              {showTeamSection ? (
                <section>
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="flex items-center gap-2 text-xl font-medium tracking-tight text-gray-900">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        Our Team
                      </h2>
                    </div>
                  </div>
                  <div className="-mx-4 flex gap-4 overflow-x-auto px-4 py-2 pb-3 no-scrollbar sm:mx-0 sm:px-0">
                    <button
                      type="button"
                      onClick={() => setStaffChoice("any")}
                      className="group flex min-w-[72px] flex-col items-center gap-2 rounded-lg p-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
                    >
                      <div
                        className={cn(
                          "rounded-full p-0.5 shadow-sm transition-colors",
                          staffChoice === "any"
                            ? "border-2 border-gray-900 bg-gray-50"
                            : "border-2 border-transparent opacity-70 hover:opacity-100",
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-14 w-14 items-center justify-center rounded-full ring-2 ring-inset ring-white/20",
                            staffChoice === "any"
                              ? "bg-gray-900 text-white"
                              : "bg-gray-200 text-gray-600 group-hover:bg-gray-300",
                          )}
                        >
                          <Users className="h-6 w-6" />
                        </div>
                      </div>
                      <span
                        className={cn(
                          "text-sm font-medium",
                          staffChoice === "any"
                            ? "text-gray-900"
                            : "text-gray-600",
                        )}
                      >
                        Any
                      </span>
                    </button>
                    {teamMembers.map((m, i) => {
                      const selected = staffChoice === i;
                      return (
                        <button
                          key={`${m.name}-${i}`}
                          type="button"
                          onClick={() => setStaffChoice(i)}
                          className="group flex min-w-[72px] flex-col items-center gap-2 rounded-lg p-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
                        >
                          <div
                            className={cn(
                              "h-16 w-16 overflow-hidden rounded-full border-2 bg-gray-200 transition-colors",
                              selected
                                ? "border-gray-900 shadow-sm"
                                : "border-transparent opacity-90 hover:border-gray-200 hover:opacity-100",
                            )}
                          >
                            {m.imageUrl ? (
                              <img
                                src={m.imageUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-gray-300 text-sm font-semibold text-gray-700">
                                {m.name.slice(0, 1).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <span
                            className={cn(
                              "text-sm font-medium",
                              selected ? "text-gray-900" : "text-gray-600",
                            )}
                          >
                            {m.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              <section>
                <div className="mb-4">
                  <h2 className="flex items-center gap-2 text-2xl font-medium tracking-tight text-gray-900">
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                    Select services
                  </h2>
                </div>

                <div className="-mx-4 bg-gray-50 px-4 pb-4 pt-2 opacity-40 transition-opacity hover:opacity-100 sm:mx-0 sm:px-0">
                  <div className="pointer-events-none flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {displayCategories.map((cat, i) => (
                      <button
                        key={`${cat}-${i}`}
                        type="button"
                        tabIndex={-1}
                        className={cn(
                          "whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium shadow-sm transition-all",
                          i === 0
                            ? "bg-gray-900 text-white"
                            : "border border-gray-200 bg-white text-gray-700",
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-8">
                  <div>
                    <div className="flex flex-col gap-3">
                      {visible.map((svc, idx) => {
                        const isSelected = svc.id === selectedServiceId;
                        const isBestseller = idx === 0;
                        return (
                          <div
                            key={svc.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedServiceId(svc.id)}
                            onKeyDown={(ev) => {
                              if (ev.key === "Enter" || ev.key === " ") {
                                ev.preventDefault();
                                setSelectedServiceId(svc.id);
                              }
                            }}
                            className={cn(
                              "relative flex flex-col justify-between gap-4 overflow-hidden rounded-2xl border p-4 transition-all sm:flex-row sm:items-center sm:p-5",
                              isSelected
                                ? "border-2 border-gray-900 bg-white shadow-sm"
                                : "cursor-pointer border border-gray-200 bg-white opacity-40 hover:opacity-100",
                            )}
                          >
                            <div className="flex-1">
                              <div className="mb-1.5 flex flex-col gap-2 sm:flex-row sm:items-center">
                                <h4 className="text-base font-medium text-gray-900">
                                  {svc.name}
                                </h4>
                                {isBestseller ? (
                                  <span className="inline-flex w-fit items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-900">
                                    <Sparkles className="h-3 w-3" />
                                    Bestseller
                                  </span>
                                ) : null}
                              </div>
                              <div className="mb-2 flex items-center gap-2 text-sm font-normal text-gray-500">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
                                  {svc.durationMinutes} mins
                                </span>
                                <span>•</span>
                                <span className="font-medium text-gray-900">
                                  {formatEur(svc.price)}
                                </span>
                              </div>
                              {svc.description ? (
                                <p className="line-clamp-2 pr-8 text-sm text-gray-500">
                                  {svc.description}
                                </p>
                              ) : null}
                            </div>
                            <div
                              className="mt-2 flex shrink-0 items-center justify-end sm:mt-0 sm:justify-center"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {isSelected ? (
                                <>
                                  <button
                                    type="button"
                                    className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200"
                                    aria-label="Remove"
                                    onClick={() =>
                                      setSelectedServiceId(
                                        visible[0]?.id === svc.id
                                          ? visible[1]?.id ?? svc.id
                                          : visible[0]?.id ?? null,
                                      )
                                    }
                                  >
                                    <Minus className="h-5 w-5" strokeWidth={2} />
                                  </button>
                                  <span className="w-8 text-center text-sm font-medium text-gray-900">
                                    1
                                  </span>
                                  <button
                                    type="button"
                                    className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-900 text-white shadow-sm transition-colors hover:bg-gray-800"
                                    aria-label="Add"
                                  >
                                    <Plus className="h-5 w-5" strokeWidth={2} />
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-900 shadow-sm"
                                  onClick={() => setSelectedServiceId(svc.id)}
                                  aria-label={`Add ${svc.name}`}
                                >
                                  <Plus className="h-5 w-5" strokeWidth={2} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>

              <section className="-mt-2 border-t border-gray-200/80 pt-6">
                <div className="mb-6 flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl font-medium tracking-tight text-gray-900">
                      Select time
                    </h2>
                    <p className="mt-0.5 text-sm font-normal text-gray-500">
                      Choose a date and time for your appointment.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-colors hover:bg-gray-50"
                  >
                    <Calendar className="h-[18px] w-[18px]" />
                    {monthButtonLabel}
                  </button>
                </div>

                <div className="-mx-4 mb-8 flex gap-3 overflow-x-auto px-4 py-2 pb-3 no-scrollbar sm:mx-0 sm:px-0">
                  {dateStrip.map((d) => {
                    const active = d.ymd === selectedDateYmd;
                    const hasSelection =
                      active &&
                      selectedSlotIso &&
                      formatInTimeZone(
                        new Date(selectedSlotIso),
                        timeZone,
                        "yyyy-MM-dd",
                      ) === d.ymd;
                    return (
                      <button
                        key={d.ymd}
                        type="button"
                        onClick={() => {
                          setSelectedDateYmd(d.ymd);
                        }}
                        className={cn(
                          "relative flex min-w-[72px] flex-col items-center justify-center rounded-2xl p-3 transition-all",
                          active
                            ? "border-2 border-gray-900 bg-gray-900 text-white shadow-sm ring-2 ring-inset ring-white/15"
                            : "border border-gray-200 bg-white text-gray-500 hover:border-gray-300",
                        )}
                      >
                        <span
                          className={cn(
                            "mb-1 text-xs font-medium uppercase tracking-wider",
                            active ? "text-gray-300" : "",
                          )}
                        >
                          {d.dow}
                        </span>
                        <span
                          className={cn(
                            "text-lg font-semibold",
                            active ? "" : "text-gray-900",
                          )}
                        >
                          {d.day}
                        </span>
                        {hasSelection ? (
                          <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-500 shadow-sm" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                {slotsError ? (
                  <p className="mb-4 text-sm text-red-600">{slotsError}</p>
                ) : null}
                {slotsPending ? (
                  <p className="mb-4 text-sm text-gray-500">Loading times…</p>
                ) : null}

                <div>
                  {morningSlots.length > 0 ? (
                    <>
                      <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-900">
                        <Sun className="h-4 w-4 text-gray-400" />
                        Morning
                      </h3>
                      <div className="mb-6 grid grid-cols-3 gap-3 sm:grid-cols-4">
                        {morningSlots.map((s) => {
                          const active = selectedSlotIso === s.startIso;
                          return (
                            <button
                              key={s.startIso}
                              type="button"
                              onClick={() => setSelectedSlotIso(s.startIso)}
                              className={cn(
                                "rounded-xl border px-2 py-3 text-center text-sm font-medium transition-all",
                                active
                                  ? "z-10 scale-[1.03] border-2 border-gray-900 bg-gray-900 text-white shadow-lg shadow-gray-900/20 ring-4 ring-gray-900/10"
                                  : "border border-gray-200 bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:border-gray-900",
                              )}
                            >
                              {slotTimeLabel(s.startIso, timeZone)}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  ) : null}

                  {afternoonSlots.length > 0 ? (
                    <>
                      <h3 className="mt-2 mb-3 flex items-center gap-2 text-sm font-medium text-gray-900">
                        <CloudSun className="h-4 w-4 text-gray-400" />
                        Afternoon
                      </h3>
                      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                        {afternoonSlots.map((s) => {
                          const active = selectedSlotIso === s.startIso;
                          return (
                            <button
                              key={s.startIso}
                              type="button"
                              onClick={() => setSelectedSlotIso(s.startIso)}
                              className={cn(
                                "rounded-xl border px-2 py-3 text-center text-sm font-medium transition-all",
                                active
                                  ? "z-10 scale-[1.03] border-2 border-gray-900 bg-gray-900 text-white shadow-lg shadow-gray-900/20 ring-4 ring-gray-900/10"
                                  : "border border-gray-200 bg-white text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:border-gray-900",
                              )}
                            >
                              {slotTimeLabel(s.startIso, timeZone)}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  ) : null}

                  {!slotsPending &&
                  !morningSlots.length &&
                  !afternoonSlots.length ? (
                    <p className="text-sm text-gray-500">
                      {hasAnySlotsInRange
                        ? "No openings left on this day — choose another date above."
                        : "No online openings in the next few weeks. Please contact the salon directly."}
                    </p>
                  ) : null}
                </div>
              </section>

              {bottomSectionVisible ? (
                <section
                  className={cn(
                    "mt-2 grid grid-cols-1 gap-6 border-t border-gray-200/80 pt-8",
                    bottomTwoCols ? "md:grid-cols-2" : "",
                  )}
                >
                  {showMapCard ? (
                    <div
                      className={cn(
                        "group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]",
                        !bottomTwoCols ? "md:col-span-2" : "",
                      )}
                    >
                      <div className="relative flex h-32 w-full shrink-0 items-center justify-center overflow-hidden bg-gray-100 sm:h-40">
                        {mapLat != null && mapLng != null ? (
                          <StorefrontMapEmbed
                            lat={mapLat}
                            lng={mapLng}
                            title="Salon location map"
                          />
                        ) : (
                          <>
                            <img
                              src="https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=800&auto=format&fit=crop"
                              alt=""
                              className="absolute inset-0 h-full w-full object-cover opacity-50 mix-blend-multiply grayscale transition-transform duration-700 group-hover:scale-105"
                            />
                            <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-gray-900 text-white shadow-md transition-transform group-hover:-translate-y-1">
                              <MapPin className="h-5 w-5" />
                            </div>
                          </>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col justify-center p-5">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-gray-900">
                            {addressText}
                          </p>
                          <a
                            href={directionsHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 text-xs font-medium text-blue-600 transition-colors hover:text-blue-800"
                          >
                            Directions
                          </a>
                        </div>
                        {eircodeTrim && !demoAddr ? (
                          <p className="text-xs text-gray-500">
                            <span className="text-gray-400">Eircode: </span>
                            <span className="font-medium text-blue-600">
                              {eircodeTrim}
                            </span>
                          </p>
                        ) : mapLat == null || mapLng == null ? (
                          <p className="text-xs text-gray-400">
                            Save address and Eircode in your dashboard to place
                            the map.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {showReviewsCard && reviewsBlock ? (
                    <div
                      className={cn(
                        "flex h-full flex-col rounded-2xl border border-gray-200/80 bg-white p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]",
                        !bottomTwoCols ? "md:col-span-2" : "",
                      )}
                    >
                      <div className="mb-5 flex items-center justify-between">
                        <h3 className="text-sm font-medium tracking-tight text-gray-900">
                          Recent Reviews
                        </h3>
                        {reviewsBlock.score ? (
                          <span className="flex items-center gap-1 rounded-md bg-gray-50 px-2 py-1 text-sm font-medium text-gray-900">
                            <Star className="h-3.5 w-3.5 fill-current" />
                            {reviewsBlock.score}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-col gap-4">
                        {(reviewsBlock.entries ?? []).map((entry, idx, arr) => (
                          <div
                            key={`${entry.name}-${idx}`}
                            className={cn(
                              "flex flex-col gap-2",
                              idx < arr.length - 1
                                ? "border-b border-gray-100 pb-4"
                                : "",
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-gray-900">
                                {entry.name}
                              </span>
                              {entry.relativeTime ? (
                                <span className="text-[11px] shrink-0 text-gray-400">
                                  {entry.relativeTime}
                                </span>
                              ) : null}
                            </div>
                            <div className="flex gap-0.5 text-gray-900">
                              {Array.from({ length: 5 }).map((_, si) => (
                                <Star
                                  key={si}
                                  className="h-3 w-3 fill-current"
                                />
                              ))}
                            </div>
                            <p className="line-clamp-3 text-xs italic leading-relaxed text-gray-500">
                              &quot;{entry.body}&quot;
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </section>
              ) : null}
            </div>

            <div className="relative hidden w-[35%] lg:block">
              <div className="sticky top-24 pb-8">
                <div className="flex shrink-0 flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_8px_30px_-4px_rgba(0,0,0,0.06)]">
                  <div className="border-b border-gray-100 p-6">
                    <h3 className="text-lg font-medium tracking-tight text-gray-900">
                      Your Booking
                    </h3>
                  </div>
                  <div className="flex flex-1 flex-col gap-4 p-6">
                    {selectedService ? (
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-medium text-gray-900">
                            {selectedService.name}
                          </span>
                          <span className="flex items-center gap-1 text-xs font-normal text-gray-500">
                            <Clock className="h-3 w-3" strokeWidth={1.5} />
                            {selectedService.durationMinutes} mins
                          </span>
                          <button
                            type="button"
                            className="mt-1 text-left text-xs text-gray-400 underline underline-offset-2 transition-colors hover:text-gray-900"
                            onClick={() => {
                              const i = visible.findIndex(
                                (s) => s.id === selectedServiceId,
                              );
                              if (i < 0) return;
                              const next = visible[i + 1] ?? visible[i - 1];
                              if (next) setSelectedServiceId(next.id);
                            }}
                          >
                            Remove
                          </button>
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {formatEur(selectedService.price)}
                        </span>
                      </div>
                    ) : null}

                    <div className="mt-2 flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-200 text-gray-500">
                        {staffSummary.kind === "any" ? (
                          <Users className="h-4 w-4" />
                        ) : selectedTeamMember?.imageUrl ? (
                          <img
                            src={selectedTeamMember.imageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-[10px] font-semibold text-gray-600">
                            {(selectedTeamMember?.name ?? "?")
                              .slice(0, 2)
                              .toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex flex-col">
                        <span className="text-xs font-medium text-gray-900">
                          {staffSummary.label}
                        </span>
                        <span className="text-[11px] text-gray-500">
                          {staffSummary.sub}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-900 shadow-sm">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-gray-900">
                          {formattedDateTimeSummary
                            ? formattedDateTimeSummary.weekdayLong
                            : "Pick a time"}
                        </span>
                        <span className="text-[11px] text-gray-500">
                          {formattedDateTimeSummary
                            ? formattedDateTimeSummary.timePart
                            : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-4 border-t border-gray-100 bg-gray-50/50 p-6">
                    <div className="flex items-center justify-between text-base">
                      <span className="font-medium text-gray-900">Total</span>
                      <span className="font-medium text-gray-900">
                        {formatEur(totalPrice)}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={!selectedSlotIso || !selectedServiceId}
                      onClick={() => setConfirmOpen(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800 disabled:opacity-50"
                    >
                      Confirm booking
                      <ArrowRight className="h-[18px] w-[18px]" />
                    </button>
                    <p className="text-center text-[11px] font-normal text-gray-400">
                      You won&apos;t be charged yet. Prices may vary.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        <div className="fixed bottom-0 left-0 z-50 w-full border-t border-gray-200/80 bg-white/90 p-4 pb-8 shadow-[0_-8px_30px_-4px_rgba(0,0,0,0.08)] backdrop-blur-md sm:pb-6 lg:hidden">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div className="flex flex-col">
              <span className="flex items-center gap-1.5 text-[13px] font-medium text-gray-900">
                1 service
                <span className="h-1 w-1 rounded-full bg-gray-300" />
                {formattedDateTimeSummary
                  ? `${formattedDateTimeSummary.datePart}, ${formattedDateTimeSummary.timePart}`
                  : "Pick a time"}
              </span>
              <span className="mt-0.5 text-base font-semibold text-gray-900">
                {formatEur(totalPrice)}
              </span>
            </div>
            <button
              type="button"
              disabled={!selectedSlotIso || !selectedServiceId}
              onClick={() => setConfirmOpen(true)}
              className="flex max-w-[160px] flex-1 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800 disabled:opacity-50"
            >
              Confirm
              <ArrowRight className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
