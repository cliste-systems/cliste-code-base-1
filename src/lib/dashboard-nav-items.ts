import type { VerticalPack } from "@/lib/verticals";

export function navItemsForVertical<
  T extends { href: string; label: string; section: "core" | "account" },
>(baseNavItems: T[], pack: VerticalPack): T[] {
  const nav = pack.nav;
  if (!nav) return baseNavItems;

  const hidden = new Set(nav.hiddenHrefs ?? []);
  let items = baseNavItems
    .filter((item) => !hidden.has(item.href))
    .map((item) => {
      const override = nav.labelOverrides?.[item.href];
      return override ? { ...item, label: override } : item;
    });

  for (const extra of nav.extraItems ?? []) {
    const insert: T = {
      href: extra.href,
      label: extra.label,
      section: extra.section,
    } as T;

    if (extra.afterHref) {
      const idx = items.findIndex((item) => item.href === extra.afterHref);
      if (idx >= 0) {
        items = [...items.slice(0, idx + 1), insert, ...items.slice(idx + 1)];
        continue;
      }
    }

    items = [...items, insert];
  }

  return items;
}
