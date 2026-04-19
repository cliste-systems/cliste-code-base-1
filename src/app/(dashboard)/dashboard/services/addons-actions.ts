"use server";

import { revalidatePath } from "next/cache";

import { requireDashboardSession } from "@/lib/dashboard-session";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ServiceAddon = {
  id: string;
  /** When set, the add-on is only offered alongside this service. */
  serviceId: string | null;
  name: string;
  priceCents: number;
  durationMinutes: number;
  displayOrder: number;
  isActive: boolean;
};

export type AddonsResult =
  | { ok: true; addons: ServiceAddon[] }
  | { ok: false; message: string };

export type SimpleResult = { ok: true } | { ok: false; message: string };

function normName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function cleanCents(v: unknown): number {
  const n = Math.round(Number(v ?? 0));
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function cleanMinutes(v: unknown): number {
  const n = Math.round(Number(v ?? 0));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(480, n);
}

function cleanServiceId(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return UUID_RE.test(t) ? t : null;
}

export async function listServiceAddons(): Promise<AddonsResult> {
  const { supabase, organizationId } = await requireDashboardSession();
  const { data, error } = await supabase
    .from("service_addons")
    .select(
      "id, service_id, name, price_cents, duration_minutes, display_order, is_active",
    )
    .eq("organization_id", organizationId)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) return { ok: false, message: error.message };

  return {
    ok: true,
    addons: (data ?? []).map((r) => ({
      id: r.id as string,
      serviceId: (r.service_id as string | null) ?? null,
      name: (r.name as string) ?? "",
      priceCents: Number(r.price_cents ?? 0),
      durationMinutes: Number(r.duration_minutes ?? 0),
      displayOrder: Number(r.display_order ?? 0),
      isActive: r.is_active !== false,
    })),
  };
}

export async function createServiceAddon(payload: {
  name: string;
  serviceId?: string | null;
  priceCents?: number;
  durationMinutes?: number;
}): Promise<{ ok: true; addon: ServiceAddon } | { ok: false; message: string }> {
  const { supabase, organizationId } = await requireDashboardSession();

  const name = normName(payload.name ?? "");
  if (!name) return { ok: false, message: "Name is required." };
  if (name.length > 80)
    return { ok: false, message: "Name must be 80 characters or fewer." };

  const { data, error } = await supabase
    .from("service_addons")
    .insert({
      organization_id: organizationId,
      service_id: cleanServiceId(payload.serviceId),
      name,
      price_cents: cleanCents(payload.priceCents),
      duration_minutes: cleanMinutes(payload.durationMinutes),
      display_order: 0,
      is_active: true,
    })
    .select(
      "id, service_id, name, price_cents, duration_minutes, display_order, is_active",
    )
    .single();

  if (error || !data) {
    return { ok: false, message: error?.message ?? "Could not create add-on." };
  }

  revalidatePath("/dashboard/services");
  return {
    ok: true,
    addon: {
      id: data.id as string,
      serviceId: (data.service_id as string | null) ?? null,
      name: (data.name as string) ?? name,
      priceCents: Number(data.price_cents ?? 0),
      durationMinutes: Number(data.duration_minutes ?? 0),
      displayOrder: Number(data.display_order ?? 0),
      isActive: data.is_active !== false,
    },
  };
}

export async function updateServiceAddon(payload: {
  id: string;
  name?: string;
  serviceId?: string | null;
  priceCents?: number;
  durationMinutes?: number;
  isActive?: boolean;
}): Promise<SimpleResult> {
  const { supabase, organizationId } = await requireDashboardSession();
  const id = (payload.id ?? "").trim();
  if (!UUID_RE.test(id)) return { ok: false, message: "Invalid add-on id." };

  const patch: Record<string, unknown> = {};
  if (typeof payload.name === "string") {
    const name = normName(payload.name);
    if (!name) return { ok: false, message: "Name is required." };
    if (name.length > 80)
      return { ok: false, message: "Name must be 80 characters or fewer." };
    patch.name = name;
  }
  if ("serviceId" in payload) {
    patch.service_id = cleanServiceId(payload.serviceId);
  }
  if (typeof payload.priceCents === "number") {
    patch.price_cents = cleanCents(payload.priceCents);
  }
  if (typeof payload.durationMinutes === "number") {
    patch.duration_minutes = cleanMinutes(payload.durationMinutes);
  }
  if (typeof payload.isActive === "boolean") {
    patch.is_active = payload.isActive;
  }
  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await supabase
    .from("service_addons")
    .update(patch)
    .eq("id", id)
    .eq("organization_id", organizationId);

  if (error) return { ok: false, message: error.message };
  revalidatePath("/dashboard/services");
  return { ok: true };
}

export async function deleteServiceAddon(id: string): Promise<SimpleResult> {
  const { supabase, organizationId } = await requireDashboardSession();
  const trimmed = (id ?? "").trim();
  if (!UUID_RE.test(trimmed))
    return { ok: false, message: "Invalid add-on id." };

  const { error } = await supabase
    .from("service_addons")
    .delete()
    .eq("id", trimmed)
    .eq("organization_id", organizationId);

  if (error) return { ok: false, message: error.message };
  revalidatePath("/dashboard/services");
  return { ok: true };
}
