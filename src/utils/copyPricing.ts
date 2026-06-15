/**
 * Compute the copy price from the original's retail price.
 * Tiers (linear interpolation within each band), then +10% margin, round to 100, clamp 1900–8000.
 * Cost basis: 1500 KES. Floor: 1900 KES. Ceiling: 8000 KES.
 */
export function computeCopyPrice(originalRetailKes: number): number {
  let base: number;
  if (originalRetailKes < 8_000) {
    base = 1_900 + (originalRetailKes / 8_000) * 600;
  } else if (originalRetailKes < 20_000) {
    base = 2_500 + ((originalRetailKes - 8_000) / 12_000) * 1_500;
  } else if (originalRetailKes < 40_000) {
    base = 4_000 + ((originalRetailKes - 20_000) / 20_000) * 2_000;
  } else {
    base = Math.min(8_000, 6_000 + ((originalRetailKes - 40_000) / 40_000) * 2_000);
  }
  // Apply 10% margin uplift, round to nearest 100, clamp to [1900, 8000]
  const withMargin = base * 1.1;
  return Math.min(8_000, Math.max(1_900, Math.round(withMargin / 100) * 100));
}

export function longevityHours(score: number): { min: number; max: number } {
  if (score < 70) return { min: 2, max: 4 };
  if (score < 80) return { min: 4, max: 6 };
  if (score < 90) return { min: 6, max: 8 };
  return { min: 8, max: 12 };
}

export function sillageLabel(score: number): "soft" | "moderate" | "strong" | "huge" {
  if (score < 65) return "soft";
  if (score < 80) return "moderate";
  if (score < 90) return "strong";
  return "huge";
}
