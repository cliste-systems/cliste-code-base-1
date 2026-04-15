import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { parseOrganizationNiche } from "@/lib/organization-niche";
import { createAdminClient } from "@/utils/supabase/admin";

import { AIBrainConfigForm } from "./ai-brain-config-form";
import { LiveKitPhoneCard } from "./livekit-phone-card";
import { OrganizationNicheForm } from "./organization-niche-form";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminOrganizationDetailPage({ params }: PageProps) {
  const { id } = await params;

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return (
      <div className="mx-auto max-w-3xl p-6 md:p-8">
        <p className="text-destructive text-sm">
          {e instanceof Error ? e.message : "Admin client unavailable."}
        </p>
      </div>
    );
  }

  const { data: org, error } = await admin
    .from("organizations")
    .select(
      "id, name, slug, niche, greeting, custom_prompt, updated_at, phone_number",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !org) {
    notFound();
  }

  return (
    <div className="mx-auto min-h-dvh max-w-3xl space-y-8 p-6 md:p-8">
      <div>
        <Link
          href="/admin"
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm font-medium"
        >
          <ChevronLeft className="size-4" aria-hidden />
          All organizations
        </Link>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          {org.name}
        </h1>
        <p className="text-muted-foreground mt-1 font-mono text-sm">{org.slug}</p>
      </div>

      <LiveKitPhoneCard
        organizationId={org.id}
        phoneNumber={org.phone_number}
      />

      <OrganizationNicheForm
        organizationId={org.id}
        initialNiche={parseOrganizationNiche(
          (org as { niche?: string | null }).niche,
        )}
      />

      <p className="text-muted-foreground text-sm leading-relaxed">
        Service menu, pricing, and public visibility are edited by the salon in
        their dashboard under <span className="text-foreground font-medium">Services</span>{" "}
        (not here).
      </p>

      <AIBrainConfigForm
        organizationId={org.id}
        greeting={org.greeting}
        customPrompt={org.custom_prompt}
      />
    </div>
  );
}
