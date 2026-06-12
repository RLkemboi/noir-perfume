/**
 * Bottle formats shared by the storefront UI and checkout pricing.
 * Order matters: Collector's renders first everywhere (price anchor),
 * Signature is the highlighted default. A missing/unknown size on an
 * order item prices as Signature (multiplier 1) — the pre-tier behavior.
 */
export interface SizeTier {
  key: "collectors" | "signature" | "discovery";
  label: string;
  size: string;
  multiplier: number;
  recommended: boolean;
  tagline: string;
}

export const SIZE_TIERS: SizeTier[] = [
  {
    key: "collectors",
    label: "Collector's",
    size: "100ml",
    multiplier: 1.8,
    recommended: false,
    tagline: "The full statement. For a scent you already trust.",
  },
  {
    key: "signature",
    label: "Signature",
    size: "50ml",
    multiplier: 1,
    recommended: true,
    tagline: "The house standard. Most chosen.",
  },
  {
    key: "discovery",
    label: "Discovery",
    size: "10ml",
    multiplier: 0.35,
    recommended: false,
    tagline: "A proper introduction before you commit.",
  },
];

export const DEFAULT_TIER = SIZE_TIERS.find((tier) => tier.recommended)!;

export function findTierBySize(size?: string): SizeTier {
  return SIZE_TIERS.find((tier) => tier.size === size) || DEFAULT_TIER;
}

export function tierPrice(basePrice: number, tier: SizeTier): number {
  return Math.round(basePrice * tier.multiplier * 100) / 100;
}
