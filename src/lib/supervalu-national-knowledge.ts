/**
 * National SuperValu facts — same for every SuperValu store on Cliste.
 * Sources: supervalu.ie/rewards/help, supervalu.ie/about/contact-us/real-rewards-enquiries,
 * shop.supervalu.ie terms (online shopping helpdesk).
 */

export const REAL_REWARDS_HELPDESK_PHONE = "0818 220 088";
export const REAL_REWARDS_HELPDESK_LANDLINE = "01 906 8881";
export const REAL_REWARDS_HELP_EMAIL = "realrewardshelp@supervalu.ie";
export const REAL_REWARDS_WEB_URL = "https://supervalu.ie/rewards";

export const SUPERVALU_ONLINE_SHOPPING_PHONE = "0818 456 828";
export const SUPERVALU_ONLINE_SHOPPING_LANDLINE = "01 906 8880";
export const SUPERVALU_ONLINE_SHOP_URL = "https://shop.supervalu.ie";

export type RetailStoreFactsInput = {
  loyaltyProgram?: string | null;
  facilities?: string | null;
  delivery?: string | null;
  clickCollectUrl?: string | null;
  storePublicNumber?: string | null;
};

/** Escalation and programme facts Cara can use on any SuperValu call. */
export function buildSupervaluNationalKnowledgeSection(): string {
  return [
    "## SuperValu national reference (Ireland)",
    "",
    "### Real Rewards loyalty",
    "Real Rewards is SuperValu's free loyalty programme in Ireland. Shoppers can register in store (pick up a card) or via the Real Rewards app / supervalu.ie/rewards.",
    "",
    "**What I can help with in the shop:**",
    "• Explain that Real Rewards exists and how to sign up in store or on the app.",
    "• Direct callers to the Customer Service desk for a replacement card pick-up.",
    "• Answer general questions when I know the answer from this section.",
    "",
    "**What I must not do:**",
    "• Never quote a caller's points balance, voucher value, or account details from memory.",
    "• Never ask for full card numbers or passwords on the phone.",
    "• Never promise to fix account issues myself — I help in speech, then escalate.",
    "",
    "**Real Rewards Helpdesk** (account, app, points, vouchers, lost card registration):",
    `• Phone: ${REAL_REWARDS_HELPDESK_PHONE} or ${REAL_REWARDS_HELPDESK_LANDLINE}`,
    "• Hours: 9am–6pm Mon–Fri, 9am–6pm Sat, 11am–5pm Sun",
    `• Email: ${REAL_REWARDS_HELP_EMAIL}`,
    "• Webchat: supervalu.ie/rewards (Chat with us)",
    "",
    "**Lost or stolen Real Rewards card:** pick up a replacement card in store, then call the Helpdesk so vouchers and points can be moved to the new card.",
    "",
    "**Partner offers (e.g. fuel partners):** programme rules vary by partner. If I am not sure, I give the Helpdesk number — I do not guess redemption rules.",
    "",
    "If the caller still needs local help after that, I take their name and what they need for Customer Service callback.",
    "",
    "### SuperValu online shopping (shop.supervalu.ie)",
    "For website orders, delivery slots, or online account issues — not the same as Real Rewards:",
    `• Helpdesk: ${SUPERVALU_ONLINE_SHOPPING_PHONE} or ${SUPERVALU_ONLINE_SHOPPING_LANDLINE}`,
    `• Website: ${SUPERVALU_ONLINE_SHOP_URL}`,
    "",
    "### Weekly offers and product prices in store",
    "Use **searchSuperValuProducts** with the caller's product words — never quote offers or shelf prices from this section or from memory.",
  ].join("\n");
}

/** Store-specific facts from org setup — complements national SuperValu reference. */
export function buildRetailStoreFactsSection(
  input: RetailStoreFactsInput,
): string | null {
  const lines: string[] = [];

  const loyalty = String(input.loyaltyProgram ?? "").trim();
  if (loyalty) {
    lines.push(
      `Loyalty programme at this store: ${loyalty}. Use the Real Rewards Helpdesk above for account-specific queries.`,
    );
  }

  const facilities = String(input.facilities ?? "").trim();
  if (facilities) {
    lines.push(`Store facilities: ${facilities}`);
  }

  const delivery = String(input.delivery ?? "").trim();
  if (delivery) {
    lines.push(`Delivery: ${delivery}`);
  }

  const clickCollect = String(input.clickCollectUrl ?? "").trim();
  if (clickCollect) {
    lines.push(
      `Click & collect: ${clickCollect} — for slot or order issues on this store's online shop, use the online shopping helpdesk above unless store facts say otherwise.`,
    );
  }

  const storePhone = String(input.storePublicNumber ?? "").trim();
  if (storePhone) {
    lines.push(
      `This store's main phone (for callers who ask how to reach the shop directly): ${storePhone}`,
    );
  }

  if (lines.length === 0) return null;

  return ["## This store", ...lines.map((line) => `• ${line}`)].join("\n");
}
