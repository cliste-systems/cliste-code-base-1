import {
  Apple,
  Briefcase,
  Building2,
  Croissant,
  Drumstick,
  Fish,
  ShoppingBag,
  Sandwich,
  Store,
  Wine,
  type LucideIcon,
} from "lucide-react";

import {
  retailDepartmentBySlug,
  type RetailDepartmentSlug,
} from "@/lib/retail-department-pack";

export const RETAIL_DEPARTMENT_HOME_ICON_CHIP =
  "flex size-8 shrink-0 items-center justify-center rounded-full border border-[#d6dfda] bg-[#f3f6f4] text-[#64748b]";

const DEPARTMENT_HOME_ICONS: Record<RetailDepartmentSlug, LucideIcon> = {
  management: Building2,
  "meat-counter": Drumstick,
  "fish-counter": Fish,
  deli: Sandwich,
  bakery: Croissant,
  "fruit-veg": Apple,
  "off-licence": Wine,
  "click-collect": ShoppingBag,
  "back-office": Briefcase,
  general: Store,
};

export function retailDepartmentHomeIcon(
  slug: string | null | undefined,
): LucideIcon {
  const resolved = retailDepartmentBySlug(slug).slug;
  return DEPARTMENT_HOME_ICONS[resolved];
}
