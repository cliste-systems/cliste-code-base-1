/**
 * Probe SuperValu gateway promo categories via fpromotions=True.
 * Run: npx tsx scripts/discover-supervalu-promo-categories.ts
 */
import {
  discoverSupervaluPromoCategories,
  SUPERVALU_PROMO_CATEGORY_SEEDS,
} from "../src/lib/supervalu-promo-category-map";

async function main() {
  console.log("Seeded categories:", SUPERVALU_PROMO_CATEGORY_SEEDS.length);
  const result = await discoverSupervaluPromoCategories({
    harvestSubcategories: true,
    maxCategories: 120,
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
