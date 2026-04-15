"use client";

import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Heart,
  Plus,
  Smartphone,
  Star,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type PreviewAmenity = { id: string; label: string };

export type PreviewService = {
  id: string;
  name: string;
  price: number;
  durationMinutes: number;
};

type StorefrontEditorPhonePreviewProps = {
  salonName: string;
  bio: string;
  amenities: PreviewAmenity[];
  services: PreviewService[];
  showTeamSection: boolean;
  showMapSection: boolean;
  showReviewsSection: boolean;
  isNative: boolean;
  /** Up to 3 gallery image URLs; first used as hero. */
  galleryUrls: string[];
  /** Optional rating / reviews line (e.g. from Google). */
  ratingLine: string;
};

function formatEur(n: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);
}

const DEFAULT_HERO =
  "https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=800&auto=format&fit=crop";

export function StorefrontEditorPhonePreview({
  salonName,
  bio,
  amenities,
  services,
  showTeamSection,
  showMapSection: _showMapSection,
  showReviewsSection: _showReviewsSection,
  isNative,
  galleryUrls,
  ratingLine,
}: StorefrontEditorPhonePreviewProps) {
  const primary = services[0];
  const secondary = services[1];
  const footerPrice = primary?.price ?? 0;
  const heroSrc = galleryUrls[0]?.trim() || DEFAULT_HERO;

  return (
    <div className="flex w-full flex-col items-center">
      <div className="mb-6 flex items-center justify-center gap-2 text-xs font-medium tracking-widest text-gray-400 uppercase">
        <Smartphone className="h-4 w-4" strokeWidth={1.5} aria-hidden />
        Mobile Preview
      </div>

      <div
        className={cn(
          "relative flex h-[min(760px,70vh)] w-full max-w-[380px] flex-col overflow-hidden rounded-[3rem] border-[12px] border-[#F3F4F6] bg-white shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] ring-1 ring-gray-200/50",
        )}
      >
        <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex h-6 w-full justify-center">
          <div className="h-5 w-24 rounded-b-xl bg-[#F3F4F6]" />
        </div>

        <div className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-gray-100 bg-white px-5 pb-2 pt-4">
          <ChevronLeft className="h-5 w-5 text-gray-900" strokeWidth={1.5} aria-hidden />
          <span className="text-sm font-medium text-gray-900">
            {salonName.trim() || "Your salon"}
          </span>
          <Heart className="h-[18px] w-[18px] text-gray-900" strokeWidth={1.5} />
        </div>

        <div className="relative min-h-0 flex-1 overflow-y-auto bg-gray-50 no-scrollbar">
          <div className="relative h-56 w-full overflow-hidden bg-gray-200">
            <img
              src={heroSrc}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-black/10" />
          </div>

          <div className="mb-2 border-b border-gray-200/80 bg-white p-5 pt-4">
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-[20px] font-medium leading-none tracking-tight text-gray-900">
                {salonName.trim() || "Salon"}
              </h2>
              <span className="flex items-center gap-0.5 rounded-full border border-green-200/60 bg-green-50 px-1.5 py-0.5 text-[10px] font-medium leading-none text-green-700">
                <CheckCircle2 className="h-2.5 w-2.5" />
                Verified
              </span>
            </div>
            <p className="mb-3 line-clamp-3 text-[13px] font-normal leading-relaxed text-gray-500">
              {bio.trim() ||
                "Add a short bio so clients know what to expect."}
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {ratingLine.trim() ? (
                <span className="flex items-center gap-1 whitespace-nowrap rounded-md border border-gray-100 bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-600">
                  <Star className="h-3 w-3 shrink-0 text-gray-900" strokeWidth={1.5} />
                  {ratingLine.trim()}
                </span>
              ) : null}
              {amenities.slice(0, 6).map((a) => (
                <span
                  key={a.id}
                  className="flex items-center gap-1 whitespace-nowrap rounded-md border border-gray-100 bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-600"
                >
                  {a.label}
                </span>
              ))}
            </div>
          </div>

          {showTeamSection && isNative ? (
            <div className="mb-2 border-y border-gray-200/80 bg-white p-5">
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-medium text-gray-900">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Our Team
              </h3>
              <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
                <div className="flex min-w-[56px] flex-col items-center gap-1.5">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-gray-900 bg-gray-50 p-0.5 shadow-sm">
                    <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-gray-900 text-white ring-2 ring-inset ring-white/20">
                      <Users className="h-5 w-5" />
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-gray-900">
                    Any
                  </span>
                </div>
                <div className="flex min-w-[56px] flex-col items-center gap-1.5 opacity-50">
                  <div className="h-14 w-14 overflow-hidden rounded-full bg-gray-200">
                    <img
                      src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150&auto=format&fit=crop"
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <span className="text-[11px] font-medium text-gray-600">
                    Sarah
                  </span>
                </div>
                <div className="flex min-w-[56px] flex-col items-center gap-1.5 opacity-50">
                  <div className="h-14 w-14 overflow-hidden rounded-full bg-gray-200">
                    <img
                      src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&auto=format&fit=crop"
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <span className="text-[11px] font-medium text-gray-600">
                    Emma
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {isNative ? (
            <div className="border-t border-gray-200/80 bg-white p-5">
              <h3 className="mb-4 flex items-center gap-1.5 text-sm font-medium text-gray-900">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Select services
              </h3>
              {primary ? (
                <div className="flex flex-col gap-3">
                  <div className="relative flex flex-col overflow-hidden rounded-xl border-2 border-gray-900 p-3 shadow-sm">
                    <div className="mb-1.5 flex items-start justify-between gap-2">
                      <h4 className="text-[13px] font-medium leading-tight text-gray-900">
                        {primary.name}
                      </h4>
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-900 text-white">
                        <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-normal text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {primary.durationMinutes} mins
                      </span>
                      <span>•</span>
                      <span className="font-medium text-gray-900">
                        {formatEur(primary.price)}
                      </span>
                    </div>
                  </div>
                  {secondary ? (
                    <div className="flex flex-col rounded-xl border border-gray-200 p-3 opacity-50">
                      <div className="mb-1.5 flex items-start justify-between gap-2">
                        <h4 className="text-[13px] font-medium leading-tight text-gray-900">
                          {secondary.name}
                        </h4>
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-200 text-gray-400">
                          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] font-normal text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {secondary.durationMinutes} mins
                        </span>
                        <span>•</span>
                        <span className="font-medium text-gray-900">
                          {formatEur(secondary.price)}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-[13px] text-gray-500">
                  No published services yet.
                </p>
              )}
              <div className="h-20 shrink-0" />
            </div>
          ) : (
            <div className="border-t border-gray-200/80 bg-white p-5">
              <p className="text-[13px] text-gray-500">
                Connect plan: clients book via your linked booking URL.
              </p>
              <div className="h-20 shrink-0" />
            </div>
          )}
        </div>

        {isNative ? (
          <div className="absolute bottom-0 z-20 w-full border-t border-gray-200/80 bg-white p-3 pb-5 shadow-[0_-8px_20px_-4px_rgba(0,0,0,0.05)]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-[11px] font-medium text-gray-900">
                  {primary ? "1 service" : "0 services"}
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  {primary ? formatEur(footerPrice) : "—"}
                </span>
              </div>
              <div className="flex max-w-[120px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-gray-900 px-3 py-2.5 text-[13px] font-medium text-white">
                Confirm
                <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
