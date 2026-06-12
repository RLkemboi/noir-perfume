import type { StorefrontProduct } from "@/utils/storefrontProductAdapter";

/**
 * Editable merchandising copy and knobs. Marketing changes happen here,
 * not inside components.
 */

/** Exchange-only policy — NOIR does not offer refunds. Keep all copy consistent with this. */
export const EXCHANGE_WINDOW_DAYS = 7;

export const EXCHANGE_NOTICE_TEXT = `Not the right scent? Free exchange within ${EXCHANGE_WINDOW_DAYS} days — no refunds, but we'll help you find your match.`;

/** Limited-batch framing — update per batch. Honest scarcity only; no countdowns. */
export const BATCH_NOTE = "This batch: limited quantities, hand-poured.";

export const CRAFTSMANSHIP_LINE = "Hand-poured in small batches, Nairobi.";

/** Days of daily wear assumed for a Signature bottle when framing price per day. */
export const DAYS_OF_WEAR = 90;

/** Product id pinned as Scent of the Week (also the hero feature). */
export const SCENT_OF_THE_WEEK_ID = "90"; // YSL Tuxedo — matches the hero photography

/** How many scents the landing page is allowed to show. */
export const EDITORS_PICKS_LIMIT = 6;

/** How many scents the catalogue shows before the visitor opts into the full list. */
export const SIGNATURE_VIEW_LIMIT = 12;

/** Connoisseur framing per scent family; technical family name stays visible for clarity. */
export const SCENT_FAMILIES: Array<{
  key: StorefrontProduct["tags"]["element"];
  title: string;
  technical: string;
}> = [
  { key: "oud", title: "For the Bold", technical: "Oud & Smoke" },
  { key: "amber", title: "For Quiet Confidence", technical: "Amber & Spice" },
  { key: "fresh", title: "For the Effortless", technical: "Fresh & Aquatic" },
  { key: "floral", title: "For the Magnetic", technical: "Floral & Night Bloom" },
];

/** Scarcity tag shown on a small subset only — currently the Archive collection. */
export function scarcityLabel(product: StorefrontProduct): string | null {
  if (product.collection === "Archive") return "Final bottles";
  return null;
}
