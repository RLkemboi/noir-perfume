import type { PaymentMethod, UserTier } from "../../server/types";

export interface TierPolicy {
  tier: UserTier;
  rank: number;
  pointsMultiplier: number;
  canUseLedger: boolean;
  minLedgerUpfrontRatio: number;
  allowPrepay: boolean;
  allowCashOnDelivery: boolean;
  allowFullCredit: boolean;
  allowOverdraft: boolean;
  maxOutstandingBalance: number | null;
  promotionMinCompletedOrders: number;
  promotionMinLifetimeSpend: number;
  allowedPaymentMethods: PaymentMethod[];
  benefits: string[];
}

export const TIER_POLICIES: Record<UserTier, TierPolicy> = {
  Junior: {
    tier: "Junior",
    rank: 1,
    pointsMultiplier: 1,
    canUseLedger: false,
    minLedgerUpfrontRatio: 1,
    allowPrepay: true,
    allowCashOnDelivery: false,
    allowFullCredit: false,
    allowOverdraft: false,
    maxOutstandingBalance: 0,
    promotionMinCompletedOrders: 0,
    promotionMinLifetimeSpend: 0,
    allowedPaymentMethods: ["Card", "Mpesa"],
    benefits: ["Prepay-only checkout", "Auto-promote to Bronze after first completed order"],
  },
  Bronze: {
    tier: "Bronze",
    rank: 2,
    pointsMultiplier: 1.05,
    canUseLedger: false,
    minLedgerUpfrontRatio: 1,
    allowPrepay: true,
    allowCashOnDelivery: true,
    allowFullCredit: false,
    allowOverdraft: false,
    maxOutstandingBalance: 0,
    promotionMinCompletedOrders: 1,
    promotionMinLifetimeSpend: 100,
    allowedPaymentMethods: ["Card", "Mpesa", "PayOnDelivery"],
    benefits: ["COD enabled", "No ledger debt access"],
  },
  Silver: {
    tier: "Silver",
    rank: 3,
    pointsMultiplier: 1.15,
    canUseLedger: true,
    minLedgerUpfrontRatio: 0.5,
    allowPrepay: true,
    allowCashOnDelivery: true,
    allowFullCredit: false,
    allowOverdraft: false,
    maxOutstandingBalance: 1500,
    promotionMinCompletedOrders: 5,
    promotionMinLifetimeSpend: 750,
    allowedPaymentMethods: ["Card", "Mpesa", "PayOnDelivery"],
    benefits: ["Ledger access with 50% minimum upfront", "Running outstanding balance"],
  },
  Gold: {
    tier: "Gold",
    rank: 4,
    pointsMultiplier: 1.3,
    canUseLedger: true,
    minLedgerUpfrontRatio: 0,
    allowPrepay: true,
    allowCashOnDelivery: true,
    allowFullCredit: true,
    allowOverdraft: true,
    maxOutstandingBalance: 3000,
    promotionMinCompletedOrders: 12,
    promotionMinLifetimeSpend: 2500,
    allowedPaymentMethods: ["Card", "Mpesa", "PayOnDelivery"],
    benefits: ["Full credit purchases", "Deposits and overdraft enabled"],
  },
  Platinum: {
    tier: "Platinum",
    rank: 5,
    pointsMultiplier: 1.45,
    canUseLedger: true,
    minLedgerUpfrontRatio: 0,
    allowPrepay: true,
    allowCashOnDelivery: true,
    allowFullCredit: true,
    allowOverdraft: true,
    maxOutstandingBalance: 5000,
    promotionMinCompletedOrders: 25,
    promotionMinLifetimeSpend: 8000,
    allowedPaymentMethods: ["Card", "Mpesa", "PayOnDelivery"],
    benefits: ["Higher spending cap", "Priority financial handling"],
  },
  Black: {
    tier: "Black",
    rank: 6,
    pointsMultiplier: 1.65,
    canUseLedger: true,
    minLedgerUpfrontRatio: 0,
    allowPrepay: true,
    allowCashOnDelivery: true,
    allowFullCredit: true,
    allowOverdraft: true,
    maxOutstandingBalance: null,
    promotionMinCompletedOrders: 50,
    promotionMinLifetimeSpend: 20000,
    allowedPaymentMethods: ["Card", "Mpesa", "PayOnDelivery"],
    benefits: ["Unlimited open ledger", "Highest trust privileges"],
  },
};

const TIER_SEQUENCE: UserTier[] = ["Junior", "Bronze", "Silver", "Gold", "Platinum", "Black"];

export function getTierPolicy(tier: UserTier): TierPolicy {
  return TIER_POLICIES[tier];
}

export function calculateProjectedLoyaltyPoints(amount: number, tier: UserTier) {
  return Number((amount * getTierPolicy(tier).pointsMultiplier).toFixed(2));
}

export function calculateOutstandingBalance(accountBalance: number): number {
  return Math.max(0, Number((-accountBalance).toFixed(2)));
}

export function calculateAvailableCredit(tier: UserTier, accountBalance: number): number | null {
  const policy = getTierPolicy(tier);
  if (policy.maxOutstandingBalance == null) return null;
  return Number(Math.max(0, policy.maxOutstandingBalance - calculateOutstandingBalance(accountBalance)).toFixed(2));
}

export function resolveTier(totalSpent: number, completedOrderCount: number): UserTier {
  for (const tier of [...TIER_SEQUENCE].reverse()) {
    const policy = getTierPolicy(tier);
    if (completedOrderCount >= policy.promotionMinCompletedOrders || totalSpent >= policy.promotionMinLifetimeSpend) {
      return tier;
    }
  }
  return "Junior";
}
