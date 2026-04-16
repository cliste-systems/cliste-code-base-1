import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SalonNativeBookingStorefront } from "@/components/salon-native-booking-storefront";
import { SalonStorefrontUI } from "@/components/salon-storefront-ui";
import {
  facebookStoredToHref,
  instagramStoredToHref,
} from "@/lib/social-handles";
import { resolveOrganizationDisplayName } from "@/lib/organization-display-name";
import { fetchPublicStorefrontOrgBySlug } from "@/lib/organization-storefront-query";
import {
  parseStorefrontAmenityLabels,
  parseStorefrontReviewsBlock,
  parseStorefrontTeamMembers,
} from "@/lib/storefront-blocks";
import { matchStorefrontNameToProfileId } from "@/lib/team-profile-match";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  queryServicesForPublicMenu,
  servicesTableHasExtendedColumns,
} from "@/lib/services-schema";
import { createClient } from "@/utils/supabase/server";

type PublicSalonPageProps = {
  params: Promise<{ salonSlug: string }>;
};

export async function generateMetadata({
  params,
}: PublicSalonPageProps): Promise<Metadata> {
  const { salonSlug } = await params;
  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("name, slug")
    .eq("slug", salonSlug)
    .eq("is_active", true)
    .maybeSingle();

  const displayName = resolveOrganizationDisplayName(org?.name, org?.slug);
  const title = displayName
    ? `Book Appointment - ${displayName}`
    : "Book Appointment - Salon";
  return {
    title,
    description: `Book services at ${displayName || "this salon"}.`,
  };
}

export default async function PublicSalonPage({ params }: PublicSalonPageProps) {
  const { salonSlug } = await params;
  const supabase = await createClient();

  const { data: org, error: orgError } = await fetchPublicStorefrontOrgBySlug(
    supabase,
    salonSlug,
  );

  if (orgError || !org) {
    notFound();
  }

  const extended = await servicesTableHasExtendedColumns(supabase);
  const { data: serviceRows } = await queryServicesForPublicMenu(
    supabase,
    org.id,
    extended
  );

  const services = serviceRows ?? [];
  const visibleServices = services.filter((s) => s.name?.trim());

  const rawLogo = org.logo_url?.trim() ?? "";
  const logoUrl =
    rawLogo &&
    (/^https?:\/\//i.test(rawLogo) || /^data:image\//i.test(rawLogo))
      ? rawLogo
      : null;
  const instagramHref = instagramStoredToHref(org.instagram_url);
  const facebookHref = facebookStoredToHref(org.facebook_url);
  const showBookNow =
    org.tier === "connect" && Boolean(org.fresha_url?.trim());
  const freshaUrl = org.fresha_url?.trim() || null;
  const isNativeSalon = org.tier === "native";

  const salonDisplayName =
    resolveOrganizationDisplayName(org.name, org.slug) || "Salon";

  const rawGallery = org.storefront_gallery_urls;
  const storefrontGalleryUrls = Array.isArray(rawGallery)
    ? rawGallery
        .filter(
          (x): x is string => typeof x === "string" && x.trim().length > 0,
        )
        .slice(0, 3)
    : [];
  const storefrontRatingLine =
    typeof org.storefront_rating_text === "string" &&
    org.storefront_rating_text.trim()
      ? org.storefront_rating_text.trim()
      : null;

  const storefrontAmenityLabels = parseStorefrontAmenityLabels(
    org.storefront_amenities,
  );
  const parsedTeam = parseStorefrontTeamMembers(
    org.storefront_team_members,
  );
  let storefrontTeamMembers = parsedTeam;
  if (parsedTeam.length > 0) {
    try {
      const admin = createAdminClient();
      const { data: orgProfiles } = await admin
        .from("profiles")
        .select("id, name")
        .eq("organization_id", org.id)
        .in("role", ["staff", "admin"]);
      storefrontTeamMembers = parsedTeam.map((m) => ({
        ...m,
        staffProfileId: matchStorefrontNameToProfileId(m.name, orgProfiles ?? []),
      }));
    } catch {
      storefrontTeamMembers = parsedTeam.map((m) => ({ ...m, staffProfileId: null }));
    }
  }
  const storefrontReviewsBlock = parseStorefrontReviewsBlock(
    org.storefront_reviews_block,
  );
  const mapLat =
    typeof org.storefront_map_lat === "number" &&
    Number.isFinite(org.storefront_map_lat)
      ? org.storefront_map_lat
      : null;
  const mapLng =
    typeof org.storefront_map_lng === "number" &&
    Number.isFinite(org.storefront_map_lng)
      ? org.storefront_map_lng
      : null;
  const storefrontEircode =
    typeof org.storefront_eircode === "string" && org.storefront_eircode.trim()
      ? org.storefront_eircode.trim()
      : null;
  const showStorefrontTeam = org.storefront_show_team !== false;
  const showStorefrontMap = org.storefront_show_map !== false;
  const showStorefrontReviews = org.storefront_show_reviews !== false;

  const storefrontServices = visibleServices.map((row) => {
    const s = row as typeof row & { description?: string | null };
    return {
      id: s.id,
      name: s.name?.trim() ?? "",
      price: Number(s.price),
      durationMinutes: s.duration_minutes,
      category: s.category?.trim() ? s.category.trim() : null,
      description: s.description?.trim() ? s.description.trim() : null,
    };
  });

  if (isNativeSalon) {
    return (
      <SalonNativeBookingStorefront
        salonName={salonDisplayName}
        addressLine={org.address?.trim() ? org.address.trim() : null}
        bio={org.bio_text?.trim() ? org.bio_text.trim() : null}
        organizationId={org.id}
        salonSlug={salonSlug}
        services={storefrontServices}
        galleryUrls={storefrontGalleryUrls}
        logoUrl={logoUrl}
        ratingLine={storefrontRatingLine}
        eircode={storefrontEircode}
        mapLat={mapLat}
        mapLng={mapLng}
        amenityLabels={storefrontAmenityLabels}
        teamMembers={storefrontTeamMembers}
        reviewsBlock={storefrontReviewsBlock}
        showTeamSection={showStorefrontTeam}
        showMapSection={showStorefrontMap}
        showReviewsSection={showStorefrontReviews}
      />
    );
  }

  return (
    <div className="bg-gradient-to-b from-stone-100 via-white to-stone-100 pb-[max(1.5rem,env(safe-area-inset-bottom))] dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      <div className="mx-auto min-h-screen w-full max-w-lg px-3 pb-10 pt-4 sm:max-w-xl sm:px-5 sm:pb-14 sm:pt-8 md:max-w-2xl md:px-6">
        <SalonStorefrontUI
          salonName={salonDisplayName}
          address={org.address?.trim() ? org.address.trim() : null}
          bio={org.bio_text?.trim() ? org.bio_text.trim() : null}
          logoUrl={logoUrl}
          instagramHref={instagramHref}
          facebookHref={facebookHref}
          showBookNow={showBookNow}
          freshaUrl={freshaUrl}
          isNativeSalon={isNativeSalon}
          organizationId={org.id}
          salonSlug={salonSlug}
          services={storefrontServices}
          variant="public"
          density="default"
        />
      </div>
    </div>
  );
}
