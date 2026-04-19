"use server";

import { revalidatePath } from "next/cache";

import { requireDashboardSession } from "@/lib/dashboard-session";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ServiceCategory = {
  id: string;
  name: string;
  displayOrder: number;
};

export type CategoriesResult =
  | { ok: true; categories: ServiceCategory[] }
  | { ok: false; message: string };

export type SimpleResult =
  | { ok: true }
  | { ok: false; message: string };

function normName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export async function listServiceCategories(): Promise<CategoriesResult> {
  const { supabase, organizationId } = await requireDashboardSession();
  const { data, error } = await supabase
    .from("service_categories")
    .select("id, name, display_order")
    .eq("organization_id", organizationId)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) return { ok: false, message: error.message };
  return {
    ok: true,
    categories: (data ?? []).map((r) => ({
      id: r.id as string,
      name: (r.name as string) ?? "",
      displayOrder: (r.display_order as number) ?? 0,
    })),
  };
}

export async function createServiceCategory(input: {
  name: string;
}): Promise<CategoriesResult> {
  const { supabase, organizationId } = await requireDashboardSession();
  const name = normName(input.name);
  if (!name) return { ok: false, message: "Category name is required." };
  if (name.length > 80) return { ok: false, message: "Name is too long (max 80)." };

  const { data: existingMax } = await supabase
    .from("service_categories")
    .select("display_order")
    .eq("organization_id", organizationId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = ((existingMax?.display_order as number) ?? 0) + 10;

  const { error } = await supabase.from("service_categories").insert({
    organization_id: organizationId,
    name,
    display_order: nextOrder,
  });

  if (error) {
    if (error.message.toLowerCase().includes("duplicate")) {
      return { ok: false, message: "A category with that name already exists." };
    }
    return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard/services");
  return listServiceCategories();
}

export async function renameServiceCategory(input: {
  id: string;
  name: string;
}): Promise<CategoriesResult> {
  const { supabase, organizationId } = await requireDashboardSession();
  if (!UUID_RE.test(input.id)) {
    return { ok: false, message: "Invalid category id." };
  }
  const name = normName(input.name);
  if (!name) return { ok: false, message: "Category name is required." };
  if (name.length > 80) return { ok: false, message: "Name is too long (max 80)." };

  const { error } = await supabase
    .from("service_categories")
    .update({ name })
    .eq("id", input.id)
    .eq("organization_id", organizationId);

  if (error) {
    if (error.message.toLowerCase().includes("duplicate")) {
      return { ok: false, message: "A category with that name already exists." };
    }
    return { ok: false, message: error.message };
  }
  revalidatePath("/dashboard/services");
  return listServiceCategories();
}

export async function deleteServiceCategory(input: {
  id: string;
}): Promise<CategoriesResult> {
  const { supabase, organizationId } = await requireDashboardSession();
  if (!UUID_RE.test(input.id)) {
    return { ok: false, message: "Invalid category id." };
  }
  const { error } = await supabase
    .from("service_categories")
    .delete()
    .eq("id", input.id)
    .eq("organization_id", organizationId);

  if (error) return { ok: false, message: error.message };
  revalidatePath("/dashboard/services");
  return listServiceCategories();
}
