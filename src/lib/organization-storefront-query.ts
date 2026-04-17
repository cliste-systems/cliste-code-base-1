import type { SupabaseClient } from "@supabase/supabase-js";

/** PostgREST / Postgres when migration 016/017 is not applied yet. */
export function isMissingStorefrontSchemaError(
  message: string | undefined,
): boolean {
  const m = (message ?? "").toLowerCase();
  return (
    m.includes("storefront_gallery_urls") ||
    m.includes("storefront_rating_text") ||
    m.includes("storefront_eircode") ||
    m.includes("storefront_amenities") ||
    m.includes("storefront_team_members") ||
    (m.includes("column") && m.includes("does not exist"))
  );
}

function isMissingStorefrontColumnsError(message: string | undefined): boolean {
  return isMissingStorefrontSchemaError(message);
}

type DashboardStorefrontOrgRow = {
  name: string | null;
  address: string | null;
  bio_text: string | null;
  fresha_url: string | null;
  logo_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  slug: string | null;
  tier: string | null;
  updated_at: string | null;
  storefront_gallery_urls: unknown;
  storefront_rating_text: string | null;
  storefront_eircode: string | null;
  storefront_map_lat: number | null;
  storefront_map_lng: number | null;
  storefront_amenities: unknown;
  storefront_team_members: unknown;
  storefront_reviews_block: unknown;
  storefront_show_team: boolean | null;
  storefront_show_map: boolean | null;
  storefront_show_reviews: boolean | null;
};

const DASHBOARD_STOREFRONT_SELECT_BASE =
  "name, address, bio_text, fresha_url, logo_url, instagram_url, facebook_url, slug, tier, updated_at";

const DASHBOARD_STOREFRONT_SELECT_FULL = `${DASHBOARD_STOREFRONT_SELECT_BASE}, storefront_gallery_urls, storefront_rating_text, storefront_eircode, storefront_map_lat, storefront_map_lng, storefront_amenities, storefront_team_members, storefront_reviews_block, storefront_show_team, storefront_show_map, storefront_show_reviews`;

export async function fetchDashboardStorefrontOrg(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{
  data: DashboardStorefrontOrgRow | null;
  error: { message: string } | null;
}> {
  const first = await supabase
    .from("organizations")
    .select(DASHBOARD_STOREFRONT_SELECT_FULL)
    .eq("id", organizationId)
    .maybeSingle();

  if (
    first.error &&
    isMissingStorefrontColumnsError(first.error.message)
  ) {
    const second = await supabase
      .from("organizations")
      .select(DASHBOARD_STOREFRONT_SELECT_BASE)
      .eq("id", organizationId)
      .maybeSingle();
    if (second.error) {
      return { data: null, error: second.error };
    }
    if (!second.data) {
      return { data: null, error: null };
    }
    const row = second.data as Omit<
      DashboardStorefrontOrgRow,
      | "storefront_gallery_urls"
      | "storefront_rating_text"
      | "storefront_eircode"
      | "storefront_map_lat"
      | "storefront_map_lng"
      | "storefront_amenities"
      | "storefront_team_members"
      | "storefront_reviews_block"
      | "storefront_show_team"
      | "storefront_show_map"
      | "storefront_show_reviews"
    >;
    return {
      data: {
        ...row,
        storefront_gallery_urls: [],
        storefront_rating_text: null,
        storefront_eircode: null,
        storefront_map_lat: null,
        storefront_map_lng: null,
        storefront_amenities: [],
        storefront_team_members: [],
        storefront_reviews_block: null,
        storefront_show_team: true,
        storefront_show_map: true,
        storefront_show_reviews: true,
      },
      error: null,
    };
  }

  return {
    data: first.data as DashboardStorefrontOrgRow | null,
    error: first.error,
  };
}

type PublicStorefrontOrgRow = {
  id: string;
  name: string | null;
  slug: string | null;
  address: string | null;
  bio_text: string | null;
  logo_url: string | null;
  fresha_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  tier: string | null;
  stripe_account_id: string | null;
  stripe_charges_enabled: boolean | null;
  storefront_gallery_urls: unknown;
  storefront_rating_text: string | null;
  storefront_eircode: string | null;
  storefront_map_lat: number | null;
  storefront_map_lng: number | null;
  storefront_amenities: unknown;
  storefront_team_members: unknown;
  storefront_reviews_block: unknown;
  storefront_show_team: boolean | null;
  storefront_show_map: boolean | null;
  storefront_show_reviews: boolean | null;
};

const PUBLIC_STOREFRONT_SELECT_BASE =
  "id, name, slug, address, bio_text, logo_url, fresha_url, instagram_url, facebook_url, tier, stripe_account_id, stripe_charges_enabled";

const PUBLIC_STOREFRONT_SELECT_FULL = `${PUBLIC_STOREFRONT_SELECT_BASE}, storefront_gallery_urls, storefront_rating_text, storefront_eircode, storefront_map_lat, storefront_map_lng, storefront_amenities, storefront_team_members, storefront_reviews_block, storefront_show_team, storefront_show_map, storefront_show_reviews`;

export async function fetchPublicStorefrontOrgBySlug(
  supabase: SupabaseClient,
  salonSlug: string,
): Promise<{
  data: PublicStorefrontOrgRow | null;
  error: { message: string } | null;
}> {
  const first = await supabase
    .from("organizations")
    .select(PUBLIC_STOREFRONT_SELECT_FULL)
    .eq("slug", salonSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (
    first.error &&
    isMissingStorefrontColumnsError(first.error.message)
  ) {
    const second = await supabase
      .from("organizations")
      .select(PUBLIC_STOREFRONT_SELECT_BASE)
      .eq("slug", salonSlug)
      .eq("is_active", true)
      .maybeSingle();
    if (second.error) {
      return { data: null, error: second.error };
    }
    if (!second.data) {
      return { data: null, error: null };
    }
    const row = second.data as Omit<
      PublicStorefrontOrgRow,
      | "storefront_gallery_urls"
      | "storefront_rating_text"
      | "storefront_eircode"
      | "storefront_map_lat"
      | "storefront_map_lng"
      | "storefront_amenities"
      | "storefront_team_members"
      | "storefront_reviews_block"
      | "storefront_show_team"
      | "storefront_show_map"
      | "storefront_show_reviews"
    >;
    return {
      data: {
        ...row,
        storefront_gallery_urls: [],
        storefront_rating_text: null,
        storefront_eircode: null,
        storefront_map_lat: null,
        storefront_map_lng: null,
        storefront_amenities: [],
        storefront_team_members: [],
        storefront_reviews_block: null,
        storefront_show_team: true,
        storefront_show_map: true,
        storefront_show_reviews: true,
      },
      error: null,
    };
  }

  return {
    data: first.data as PublicStorefrontOrgRow | null,
    error: first.error,
  };
}
