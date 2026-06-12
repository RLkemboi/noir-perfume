import type { UserTier } from "../../server/types";
import {
  getTierPolicy,
  calculateLoyaltyPoints,
  calculateAvailableCredit as calculateAvailableCreditFromPolicy,
} from "../../server/lib/membership.ts";

// Single source of truth for tier policy lives in server/lib/membership.ts —
// the checkout projection must match what the server actually awards.
export {
  TIER_POLICIES,
  LOYALTY_BASE_RATE,
  getTierPolicy,
  resolveTier,
  calculateOutstandingBalance,
  type TierPolicy,
} from "../../server/lib/membership.ts";

export function calculateProjectedLoyaltyPoints(amount: number, tier: UserTier): number {
  return calculateLoyaltyPoints(amount, tier);
}

export function calculateAvailableCredit(tier: UserTier, accountBalance: number): number | null {
  return calculateAvailableCreditFromPolicy(getTierPolicy(tier), accountBalance);
}
