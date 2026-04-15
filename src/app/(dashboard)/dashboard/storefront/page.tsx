import { requireDashboardSession } from "@/lib/dashboard-session";
import { fetchDashboardStorefrontOrg } from "@/lib/organization-storefront-query";
import { resolveOrganizationDisplayName } from "@/lib/organization-display-name";
import {
  parseStorefrontAmenityLabels,
  parseStorefrontReviewsBlock,
} from "@/lib/storefront-blocks";
import {
  queryServicesForPublicMenu,
  servicesTableHasExtendedColumns,
} from "@/lib/services-schema";
import { StorefrontView } from "./storefront-view";

export default async function StorefrontPage() {
  const { supabase, organizationId } = await requireDashboardSession();

  const { data: org, error: orgError } = await fetchDashboardStorefrontOrg(
    supabase,
    organizationId,
  );

  const extended = await servicesTableHasExtendedColumns(supabase);
  const { data: svcRows, error: svcError } = await queryServicesForPublicMenu(
    supabase,
    organizationId,
    extended
  );

  const previewServices =
    !svcError && svcRows
      ? svcRows.map((s) => ({
          id: s.id,
          name: s.name ?? "",
          category: s.category ?? "",
          priceEur: String(s.price),
          durationMin: String(s.duration_minutes),
          description: (s as { description?: string }).description ?? "",
        }))
      : [];

  const rawGallery = org?.storefront_gallery_urls;
  const galleryUrls = Array.isArray(rawGallery)
    ? rawGallery
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .slice(0, 3)
    : [];

  const amenityLabels = parseStorefrontAmenityLabels(org?.storefront_amenities);
  const reviewsBlock = parseStorefrontReviewsBlock(org?.storefront_reviews_block);

  return (
    <>
      {orgError ? (
        <p className="text-destructive p-4 text-sm">{orgError.message}</p>
      ) : null}
      {svcError ? (
        <p className="text-destructive p-4 text-sm">{svcError.message}</p>
      ) : null}
      {!orgError && !org ? (
        <p className="text-muted-foreground p-4 text-sm">
          No organization found for this workspace. Sign in with an account
          whose profile is linked to a salon.
        </p>
      ) : null}
      {org ? (
        <StorefrontView
          key={org.updated_at ?? "0"}
          showFreshaFields={org.tier === "connect"}
          initial={{
            name: resolveOrganizationDisplayName(org.name, org.slug),
            publicSlug: org.slug ?? "",
            address: org.address ?? "",
            bio: org.bio_text ?? "",
            freshaUrl: org.fresha_url ?? "",
            logoUrl: org.logo_url ?? null,
            previewServices,
            showServicesLink: org.tier === "native",
            galleryUrls,
            ratingText:
              typeof org.storefront_rating_text === "string"
                ? org.storefront_rating_text
                : "",
            storefrontRevision: org.updated_at ?? "",
            eircode: org.storefront_eircode?.trim() ?? "",
            amenityLabels,
            reviewsScore: reviewsBlock?.score?.trim() ?? "",
            reviewEntries: reviewsBlock?.entries ?? [],
            showTeamSection: org.storefront_show_team !== false,
            showMapSection: org.storefront_show_map !== false,
            showReviewsSection: org.storefront_show_reviews !== false,
          }}
        />
      ) : null}
    </>
  );
}
