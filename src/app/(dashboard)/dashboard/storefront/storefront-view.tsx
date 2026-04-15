"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Award,
  ListChecks,
  ChevronRight,
  Coffee,
  ExternalLink,
  GalleryHorizontal,
  Image as ImageIcon,
  ListOrdered,
  PenLine,
  Plus,
  Route,
  Star,
  Store,
  Upload,
  Wifi,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { saveStorefront } from "./actions";
import {
  StorefrontEditorPhonePreview,
  type PreviewAmenity,
} from "./storefront-editor-phone-preview";

export type StorefrontPreviewService = {
  id: string;
  name: string;
  category: string;
  priceEur: string;
  durationMin: string;
  description: string;
};

export type StorefrontInitial = {
  name: string;
  publicSlug: string;
  address: string;
  bio: string;
  freshaUrl: string;
  logoUrl: string | null;
  previewServices: StorefrontPreviewService[];
  showServicesLink: boolean;
  /** Saved public URLs for the booking page gallery (max 3). */
  galleryUrls: string[];
  /** Optional rating / reviews line for the booking page. */
  ratingText: string;
  /** Server `updated_at` — when this changes, form state syncs from the server. */
  storefrontRevision: string;
  eircode: string;
  amenityLabels: string[];
  reviewsScore: string;
  reviewEntries: Array<{ name: string; body: string; relativeTime?: string }>;
  showTeamSection: boolean;
  showMapSection: boolean;
  showReviewsSection: boolean;
};

type StorefrontViewProps = {
  initial: StorefrontInitial;
  showFreshaFields: boolean;
};

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-base font-normal text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-colors placeholder:text-gray-400 focus:border-gray-400 focus:outline-none focus:ring-0";

const cardClass =
  "rounded-[20px] border border-gray-200/80 bg-white p-6 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.02)] sm:p-8";

function amenityIcon(index: number) {
  const Icon = [Wifi, Route, Coffee, Star][index % 4];
  return Icon;
}

function labelsToAmenities(labels: string[]): PreviewAmenity[] {
  return labels.map((label, i) => ({
    id: `a-${i}-${label.slice(0, 24)}`,
    label,
  }));
}

type ReviewEditorRow = {
  id: string;
  name: string;
  body: string;
  relativeTime: string;
};

function reviewsToEditorRows(
  entries: StorefrontInitial["reviewEntries"],
): ReviewEditorRow[] {
  return entries.map((e, i) => ({
    id: `rev-${i}`,
    name: e.name,
    body: e.body,
    relativeTime: e.relativeTime ?? "",
  }));
}

function tripleGallery(urls: string[]): [string | null, string | null, string | null] {
  const u = urls.slice(0, 3);
  return [u[0] ?? null, u[1] ?? null, u[2] ?? null];
}

export function StorefrontView({
  initial,
  showFreshaFields,
}: StorefrontViewProps) {
  const router = useRouter();
  const logoInputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const galleryPickSlotRef = useRef<number | null>(null);

  const [salonName, setSalonName] = useState(initial.name);
  const [address, setAddress] = useState(initial.address);
  const [bio, setBio] = useState(initial.bio);
  const [freshaUrl, setFreshaUrl] = useState(initial.freshaUrl);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoCleared, setLogoCleared] = useState(false);
  const [remoteLogoFailed, setRemoteLogoFailed] = useState(false);
  const [eircode, setEircode] = useState(initial.eircode);
  const [amenities, setAmenities] = useState<PreviewAmenity[]>(() =>
    initial.amenityLabels.length ? labelsToAmenities(initial.amenityLabels) : [],
  );
  const [reviewsScore, setReviewsScore] = useState(initial.reviewsScore);
  const [reviewRows, setReviewRows] = useState<ReviewEditorRow[]>(() =>
    reviewsToEditorRows(initial.reviewEntries),
  );
  const [showTeamSection, setShowTeamSection] = useState(
    initial.showTeamSection,
  );
  const [showMapSection, setShowMapSection] = useState(initial.showMapSection);
  const [showReviewsSection, setShowReviewsSection] = useState(
    initial.showReviewsSection,
  );
  const [gallerySlots, setGallerySlots] = useState<
    [string | null, string | null, string | null]
  >(() => tripleGallery(initial.galleryUrls));
  const [ratingText, setRatingText] = useState(initial.ratingText);
  const [pending, startTransition] = useTransition();
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const liveSlug = (initial.publicSlug || "").trim();
  const liveHref = liveSlug ? `/${liveSlug}` : null;

  const remoteLogo =
    initial.logoUrl &&
    (/^https?:\/\//i.test(initial.logoUrl) ||
      /^data:image\//i.test(initial.logoUrl)) &&
    !remoteLogoFailed
      ? initial.logoUrl
      : null;

  const previewLogoSrc = logoDataUrl ?? (!logoCleared ? remoteLogo : null);

  useEffect(() => {
    setRemoteLogoFailed(false);
  }, [initial.logoUrl]);

  useEffect(() => {
    setGallerySlots(tripleGallery(initial.galleryUrls));
  }, [initial.galleryUrls]);

  useEffect(() => {
    setRatingText(initial.ratingText);
    setEircode(initial.eircode);
    setAmenities(
      initial.amenityLabels.length
        ? labelsToAmenities(initial.amenityLabels)
        : [],
    );
    setReviewsScore(initial.reviewsScore);
    setReviewRows(reviewsToEditorRows(initial.reviewEntries));
    setShowTeamSection(initial.showTeamSection);
    setShowMapSection(initial.showMapSection);
    setShowReviewsSection(initial.showReviewsSection);
  }, [initial.storefrontRevision]);

  const handleSave = useCallback(() => {
    setSaveMsg(null);
    const storefrontGallery = gallerySlots.filter(
      (x): x is string => Boolean(x),
    );
    startTransition(async () => {
      const result = await saveStorefront({
        name: salonName,
        address,
        bioText: bio,
        freshaUrl,
        logoDataUrl: logoDataUrl ?? undefined,
        clearLogo: logoCleared && !logoDataUrl,
        storefrontGallery,
        storefrontRatingText: ratingText,
        storefrontEircode: eircode,
        storefrontAmenities: amenities.map((a) => a.label),
        storefrontReviewsBlock: {
          score: reviewsScore.trim() || undefined,
          entries: reviewRows
            .filter((r) => r.name.trim() && r.body.trim())
            .map((r) => ({
              name: r.name.trim(),
              body: r.body.trim(),
              ...(r.relativeTime.trim()
                ? { relativeTime: r.relativeTime.trim() }
                : {}),
            })),
        },
        storefrontShowTeam: showTeamSection,
        storefrontShowMap: showMapSection,
        storefrontShowReviews: showReviewsSection,
      });
      if (result.ok) {
        setSaveMsg("Saved.");
        setLogoDataUrl(null);
        setLogoCleared(false);
        router.refresh();
      } else setSaveMsg(result.message);
    });
  }, [
    salonName,
    address,
    bio,
    freshaUrl,
    logoDataUrl,
    logoCleared,
    gallerySlots,
    ratingText,
    eircode,
    amenities,
    reviewsScore,
    reviewRows,
    showTeamSection,
    showMapSection,
    showReviewsSection,
    router,
  ]);

  const onLogoChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setLogoCleared(false);
          setLogoDataUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    [],
  );

  const onGalleryFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const slot = galleryPickSlotRef.current;
      galleryPickSlotRef.current = null;
      const file = e.target.files?.[0];
      e.target.value = "";
      if (slot === null || slot < 0 || slot > 2) return;
      if (!file || !file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setGallerySlots((prev) => {
            const next: [string | null, string | null, string | null] = [
              ...prev,
            ];
            next[slot] = reader.result as string;
            return next;
          });
        }
      };
      reader.readAsDataURL(file);
    },
    [],
  );

  const openGalleryPick = useCallback((slot: number) => {
    galleryPickSlotRef.current = slot;
    galleryInputRef.current?.click();
  }, []);

  const clearGallerySlot = useCallback((slot: number) => {
    setGallerySlots((prev) => {
      const next: [string | null, string | null, string | null] = [...prev];
      next[slot] = null;
      return next;
    });
  }, []);

  const compactGallery = gallerySlots.filter(
    (x): x is string => Boolean(x),
  );

  const visiblePreviewServices = initial.previewServices.filter(
    (s) => s.name.trim() || s.priceEur.trim(),
  );

  const previewPhoneServices = visiblePreviewServices.map((s) => {
    const raw = s.priceEur.replace(",", ".").trim();
    const price = raw ? Number.parseFloat(raw) : 0;
    const dur = Number.parseInt(s.durationMin, 10);
    return {
      id: s.id,
      name: s.name.trim() || "Service",
      price: Number.isFinite(price) ? price : 0,
      durationMinutes: Number.isFinite(dur) ? dur : 45,
    };
  });

  const addAmenity = useCallback(() => {
    const label = window.prompt("Amenity label (e.g. Wheelchair accessible)");
    if (!label?.trim()) return;
    setAmenities((prev) => [
      ...prev,
      { id: `a-${Date.now()}`, label: label.trim() },
    ]);
  }, []);

  return (
    <div className="flex flex-col">
      <header className="sticky top-0 z-10 -mx-5 border-b border-gray-200/50 bg-[#FAFAFA]/90 px-5 py-6 backdrop-blur-md sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10 xl:-mx-12 xl:px-12">
        <div className="mx-auto w-full max-w-[1200px]">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-500">
            <Store className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
            Storefront Editor
          </div>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <h1 className="text-2xl font-medium tracking-tight text-gray-900">
                Public booking page
              </h1>
              <p className="mt-1.5 max-w-xl text-base font-normal leading-relaxed text-gray-500">
                Edit how clients see your salon online. The preview updates as
                you type — save when you are happy with it.
              </p>
            </div>
            <div className="mt-2 flex shrink-0 flex-col items-start gap-2 sm:mt-0 sm:items-end">
              <div className="flex flex-wrap items-center gap-3">
                {liveHref ? (
                  <Link
                    href={liveHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "default" }),
                      "inline-flex h-auto items-center gap-2 rounded-xl border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:border-gray-300 hover:bg-gray-50",
                    )}
                  >
                    <ArrowUpRight className="h-4 w-4 text-gray-400" />
                    View live
                  </Link>
                ) : (
                  <span
                    className={cn(
                      buttonVariants({ variant: "outline", size: "default" }),
                      "pointer-events-none inline-flex h-auto cursor-not-allowed items-center gap-2 rounded-xl border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-500 opacity-50 shadow-[0_1px_2px_rgba(0,0,0,0.02)]",
                    )}
                    aria-disabled="true"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View live
                  </span>
                )}
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={pending}
                  className="rounded-xl bg-gray-900 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800"
                >
                  {pending ? "Saving…" : "Save changes"}
                </Button>
              </div>
              {saveMsg ? (
                <p
                  className={cn(
                    "text-sm font-normal",
                    saveMsg === "Saved." ? "text-emerald-600" : "text-red-600",
                  )}
                >
                  {saveMsg}
                </p>
              ) : (
                <span className="text-sm font-normal text-gray-400">
                  Nothing is public until you save.
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1200px] flex-1 pb-20 pt-6 sm:pt-8">
        <div className="flex flex-col gap-12 lg:flex-row xl:gap-20">
          <div className="max-w-[640px] flex-1 space-y-6">
            <section className={cardClass}>
              <div className="mb-8 flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-gray-100 bg-gray-50">
                  <PenLine className="h-5 w-5 text-gray-700" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-900">
                    Brand &amp; details
                  </h3>
                  <p className="mt-1 text-base font-normal text-gray-500">
                    Name, location, and the bio shown at the top of your page.
                  </p>
                </div>
              </div>
              <div className="space-y-5">
                <div>
                  <Label
                    htmlFor="sf-name"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Salon name
                  </Label>
                  <Input
                    id="sf-name"
                    value={salonName}
                    onChange={(e) => setSalonName(e.target.value)}
                    placeholder="Your salon name"
                    className={inputClass}
                  />
                </div>
                <div>
                  <Label
                    htmlFor="sf-address"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Address
                  </Label>
                  <Input
                    id="sf-address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street, city"
                    className={inputClass}
                  />
                </div>
                <div>
                  <Label
                    htmlFor="sf-eircode"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Eircode
                  </Label>
                  <Input
                    id="sf-eircode"
                    value={eircode}
                    onChange={(e) => setEircode(e.target.value)}
                    placeholder="e.g. D01 X4Y2"
                    className={inputClass}
                    autoComplete="postal-code"
                  />
                  <p className="mt-2 text-xs leading-relaxed text-gray-400">
                    Saved with your address to geocode the map. For a satellite
                    aerial view, add{" "}
                    <span className="font-medium text-gray-500">
                      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
                    </span>{" "}
                    (Maps Embed API) to your environment.
                  </p>
                </div>
                <div>
                  <Label
                    htmlFor="sf-bio"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Bio
                  </Label>
                  <Textarea
                    id="sf-bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell clients what makes your salon special…"
                    rows={3}
                    className={cn(inputClass, "resize-none py-3")}
                  />
                </div>

                {showFreshaFields ? (
                  <div>
                    <Label
                      htmlFor="sf-booking-url"
                      className="mb-2 block text-sm font-medium text-gray-700"
                    >
                      Booking system URL
                    </Label>
                    <Input
                      id="sf-booking-url"
                      type="url"
                      value={freshaUrl}
                      onChange={(e) => setFreshaUrl(e.target.value)}
                      placeholder="https://…"
                      className={inputClass}
                    />
                    <p className="mt-2 text-xs leading-relaxed text-gray-500">
                      Powers the &quot;Book now&quot; button on your public page when
                      set.
                    </p>
                  </div>
                ) : null}

                <div className="border-t border-gray-100 pt-5">
                  <div className="mb-3 flex items-center gap-2">
                    <ImageIcon className="h-[18px] text-gray-400" />
                    <Label
                      htmlFor={logoInputId}
                      className="text-sm font-medium text-gray-700"
                    >
                      Logo
                    </Label>
                  </div>
                  <input
                    ref={fileRef}
                    id={logoInputId}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={onLogoChange}
                  />
                  <div className="mb-3 flex flex-wrap items-center gap-4">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-colors hover:bg-gray-50"
                      onClick={() => fileRef.current?.click()}
                    >
                      <Upload className="h-[18px] text-gray-500" />
                      Upload logo
                    </button>
                    {logoDataUrl || (remoteLogo && !logoCleared) ? (
                      <button
                        type="button"
                        className="text-sm font-medium text-gray-500 transition-colors hover:text-red-600"
                        onClick={() => {
                          if (logoDataUrl) setLogoDataUrl(null);
                          else setLogoCleared(true);
                        }}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <p className="text-xs text-gray-400">
                    PNG or JPG, shown on your page. Save to upload to storage.
                  </p>
                </div>
              </div>
            </section>

            <section className={cardClass}>
              <div className="mb-6 flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-gray-100 bg-gray-50">
                  <GalleryHorizontal
                    className="h-5 w-5 text-gray-700"
                    strokeWidth={1.5}
                  />
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-900">
                    Cover gallery
                  </h3>
                  <p className="mt-1 text-base font-normal text-gray-500">
                    Upload up to 3 images to showcase your space.
                  </p>
                </div>
              </div>
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                aria-hidden
                onChange={onGalleryFileChange}
              />
              <div className="mb-4 grid h-[180px] grid-cols-3 gap-3">
                <div
                  className={cn(
                    "group relative col-span-2 overflow-hidden rounded-xl border border-dashed border-gray-200 bg-gray-100 transition-colors",
                    gallerySlots[0]
                      ? "cursor-pointer border-gray-200"
                      : "cursor-pointer hover:bg-gray-50",
                  )}
                >
                  {gallerySlots[0] ? (
                    <>
                      <img
                        src={gallerySlots[0]}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center gap-3 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          className="text-sm font-medium text-white"
                          onClick={() => openGalleryPick(0)}
                        >
                          Replace
                        </button>
                        <button
                          type="button"
                          className="text-sm font-medium text-white/90 underline"
                          onClick={() => clearGallerySlot(0)}
                        >
                          Remove
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="flex h-full w-full flex-col items-center justify-center gap-1 text-gray-400 transition-colors hover:text-gray-900"
                      onClick={() => openGalleryPick(0)}
                    >
                      <Upload className="h-6 w-6" />
                      <span className="text-xs font-medium">Add hero image</span>
                    </button>
                  )}
                </div>
                <div className="col-span-1 flex flex-col gap-3">
                  {[1, 2].map((slot) => (
                    <div
                      key={slot}
                      className={cn(
                        "group relative min-h-0 flex-1 overflow-hidden rounded-xl border border-dashed border-gray-200 bg-gray-100",
                        gallerySlots[slot] ? "border-gray-200" : "",
                      )}
                    >
                      {gallerySlots[slot] ? (
                        <>
                          <img
                            src={gallerySlots[slot]!}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              type="button"
                              className="rounded p-1 text-white"
                              onClick={() => openGalleryPick(slot)}
                              aria-label="Replace"
                            >
                              <Upload className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="text-xs font-medium text-white"
                              onClick={() => clearGallerySlot(slot)}
                            >
                              Remove
                            </button>
                          </div>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="flex h-full min-h-[52px] w-full flex-col items-center justify-center text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-900"
                          onClick={() => openGalleryPick(slot)}
                        >
                          <Plus className="h-5 w-5" />
                          <span className="mt-1 text-xs font-medium">Add</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-400">
                JPEG, PNG, WebP, or GIF — max 2MB each (same storage as your
                logo). Save to publish.
              </p>
            </section>

            <section className={cardClass}>
              <div className="mb-6 flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-gray-100 bg-gray-50">
                  <Star className="h-5 w-5 text-gray-700" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-900">
                    Amenities &amp; badges
                  </h3>
                  <p className="mt-1 text-base font-normal text-gray-500">
                    Features displayed just under your bio description.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {amenities.map((a, i) => {
                  const Icon = amenityIcon(i);
                  return (
                    <span
                      key={a.id}
                      className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white py-1.5 pl-3 pr-2 text-sm font-medium text-gray-700 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                    >
                      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                      {a.label}
                      <button
                        type="button"
                        className="ml-1 text-gray-400 transition-colors hover:text-gray-900"
                        aria-label={`Remove ${a.label}`}
                        onClick={() =>
                          setAmenities((prev) =>
                            prev.filter((x) => x.id !== a.id),
                          )
                        }
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </span>
                  );
                })}
                <button
                  type="button"
                  onClick={addAmenity}
                  className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                >
                  <Plus className="h-4 w-4" strokeWidth={1.5} />
                  Add amenity
                </button>
              </div>
            </section>

            <section className={cardClass}>
              <div className="mb-6 flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-gray-100 bg-gray-50">
                  <Award className="h-5 w-5 text-gray-700" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-900">
                    Reviews &amp; rating
                  </h3>
                  <p className="mt-1 text-base font-normal text-gray-500">
                    A short rating line plus optional quotes for the reviews
                    card on your page.
                  </p>
                </div>
              </div>
              <div className="space-y-5">
                <div>
                  <Label
                    htmlFor="sf-rating"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Rating line
                  </Label>
                  <Textarea
                    id="sf-rating"
                    value={ratingText}
                    onChange={(e) => setRatingText(e.target.value)}
                    placeholder='e.g. 4.9 ★ average from 120+ Google reviews'
                    rows={2}
                    maxLength={280}
                    className={cn(inputClass, "resize-none py-3")}
                  />
                  <p className="mt-2 text-xs text-gray-400">
                    Leave blank to hide the rating chip under your bio.
                  </p>
                </div>
                <div>
                  <Label
                    htmlFor="sf-rev-score"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Reviews card score
                  </Label>
                  <Input
                    id="sf-rev-score"
                    value={reviewsScore}
                    onChange={(e) => setReviewsScore(e.target.value)}
                    placeholder="4.9"
                    className={inputClass}
                  />
                  <p className="mt-2 text-xs text-gray-400">
                    Shown next to &quot;Recent reviews&quot; when that section
                    is enabled.
                  </p>
                </div>
                <div className="space-y-3">
                  <span className="text-sm font-medium text-gray-700">
                    Review quotes
                  </span>
                  {reviewRows.map((row) => (
                    <div
                      key={row.id}
                      className="space-y-2 rounded-xl border border-gray-100 bg-gray-50/80 p-3"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                          value={row.name}
                          onChange={(e) =>
                            setReviewRows((prev) =>
                              prev.map((r) =>
                                r.id === row.id
                                  ? { ...r, name: e.target.value }
                                  : r,
                              ),
                            )
                          }
                          placeholder="Client name"
                          className={inputClass}
                        />
                        <Input
                          value={row.relativeTime}
                          onChange={(e) =>
                            setReviewRows((prev) =>
                              prev.map((r) =>
                                r.id === row.id
                                  ? { ...r, relativeTime: e.target.value }
                                  : r,
                              ),
                            )
                          }
                          placeholder="e.g. 2 days ago"
                          className={inputClass}
                        />
                      </div>
                      <Textarea
                        value={row.body}
                        onChange={(e) =>
                          setReviewRows((prev) =>
                            prev.map((r) =>
                              r.id === row.id
                                ? { ...r, body: e.target.value }
                                : r,
                            ),
                          )
                        }
                        placeholder="Review text"
                        rows={2}
                        className={cn(inputClass, "resize-none py-3")}
                      />
                      <button
                        type="button"
                        className="text-sm font-medium text-gray-500 hover:text-red-600"
                        onClick={() =>
                          setReviewRows((prev) =>
                            prev.filter((r) => r.id !== row.id),
                          )
                        }
                      >
                        Remove quote
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setReviewRows((prev) => [
                        ...prev,
                        {
                          id: `rev-${Date.now()}`,
                          name: "",
                          body: "",
                          relativeTime: "",
                        },
                      ])
                    }
                    className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900"
                  >
                    <Plus className="h-4 w-4" strokeWidth={1.5} />
                    Add review quote
                  </button>
                </div>
              </div>
            </section>

            <section className={cardClass}>
              <div className="mb-4 flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-gray-100 bg-gray-50">
                  <ListChecks
                    className="h-5 w-5 text-gray-700"
                    strokeWidth={1.5}
                  />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-medium text-gray-900">
                    Page sections
                  </h3>
                  <p className="mt-1 text-base font-normal text-gray-500">
                    Control which optional modules appear on your page.
                  </p>
                </div>
              </div>
              <div className="ml-0 flex flex-col sm:ml-16">
                <div className="flex items-center justify-between border-b border-gray-100 py-4">
                  <div className="flex flex-col gap-0.5 pr-4">
                    <span className="text-sm font-medium text-gray-900">
                      Team selection
                    </span>
                    <span className="text-sm font-normal text-gray-500">
                      Show the team row when you have members set under Services
                      &amp; team
                    </span>
                  </div>
                  <Switch
                    checked={showTeamSection}
                    onCheckedChange={setShowTeamSection}
                    className="h-5 w-9 shrink-0 data-[size=default]:h-5 data-[size=default]:w-9"
                  />
                </div>
                <div className="flex items-center justify-between border-b border-gray-100 py-4">
                  <div className="flex flex-col gap-0.5 pr-4">
                    <span className="text-sm font-medium text-gray-900">
                      Map &amp; Location
                    </span>
                    <span className="text-sm font-normal text-gray-500">
                      Show a visual map pointing to your address
                    </span>
                  </div>
                  <Switch
                    checked={showMapSection}
                    onCheckedChange={setShowMapSection}
                    className="h-5 w-9 shrink-0 data-[size=default]:h-5 data-[size=default]:w-9"
                  />
                </div>
                <div className="flex items-center justify-between py-4">
                  <div className="flex flex-col gap-0.5 pr-4">
                    <span className="text-sm font-medium text-gray-900">
                      Recent reviews
                    </span>
                    <span className="text-sm font-normal text-gray-500">
                      Showcase top feedback from verified bookings
                    </span>
                  </div>
                  <Switch
                    checked={showReviewsSection}
                    onCheckedChange={setShowReviewsSection}
                    className="h-5 w-9 shrink-0 data-[size=default]:h-5 data-[size=default]:w-9"
                  />
                </div>
              </div>
            </section>

            {initial.showServicesLink ? (
              <section className={cardClass}>
                <div className="mb-8 flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-gray-100 bg-gray-50">
                    <ListOrdered className="h-5 w-5 text-gray-500" aria-hidden />
                  </div>
                  <div>
                    <h3 className="text-base font-medium text-gray-900">
                      Services &amp; team
                    </h3>
                    <p className="mt-1 text-base font-normal text-gray-500">
                      Services, pricing, and team members your AI and clients use
                      for booking are edited in one place.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-6 border-t border-gray-100 pt-8 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-gray-500">
                    Update your menu, AI notes, and who appears as bookable staff.
                  </p>
                  <Link
                    href="/dashboard/services"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "default" }),
                      "inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 sm:w-auto",
                    )}
                  >
                    Manage services &amp; team
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </Link>
                </div>
              </section>
            ) : null}
          </div>

          <div className="relative hidden w-full max-w-[380px] shrink-0 lg:block">
            <div className="sticky top-6 pb-10">
              <StorefrontEditorPhonePreview
                salonName={salonName.trim() || "Your salon"}
                bio={bio}
                amenities={amenities}
                services={previewPhoneServices}
                showTeamSection={showTeamSection}
                showMapSection={showMapSection}
                showReviewsSection={showReviewsSection}
                isNative={initial.showServicesLink}
                galleryUrls={compactGallery}
                ratingLine={ratingText}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
