import type { PaymentMethod, UserProfile, UserTier } from "../types.js";

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

const TIER_SEQUENCE: UserTier[] = ["Junior", "Bronze", "Silver", "Gold", "Platinum", "Black"];

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

const RESOLUTION_ORDER: UserTier[] = [...TIER_SEQUENCE].reverse();

export interface TierProgress {
  currentTier: UserTier;
  nextTier: UserTier | null;
  completedOrderCount: number;
  lifetimeSpend: number;
  remainingOrders: number;
  remainingSpend: number;
}

export interface PaymentPolicyEvaluationInput {
  isGuest: boolean;
  tier: UserTier;
  paymentMethod: PaymentMethod;
  orderTotal: number;
  accountBalance: number;
  upfrontAmount?: number;
}

export interface PaymentPolicyEvaluation {
  allowed: boolean;
  reason?: string;
  policy: TierPolicy;
  upfrontAmount: number;
  ledgerCharge: number;
  projectedAccountBalance: number;
  projectedOutstandingBalance: number;
  availableCredit: number | null;
}

export function getTierPolicy(tier: UserTier): TierPolicy {
  return TIER_POLICIES[tier];
}

export function resolveTier(totalSpent: number, completedOrderCount: number): UserTier {
  for (const tier of RESOLUTION_ORDER) {
    const policy = getTierPolicy(tier);
    if (completedOrderCount >= policy.promotionMinCompletedOrders || totalSpent >= policy.promotionMinLifetimeSpend) {
      return tier;
    }
  }
  return "Junior";
}

export function getTierProgress(totalSpent: number, completedOrderCount: number): TierProgress {
  const currentTier = resolveTier(totalSpent, completedOrderCount);
  const currentIndex = TIER_SEQUENCE.indexOf(currentTier);
  const nextTier = currentIndex >= 0 && currentIndex < TIER_SEQUENCE.length - 1 ? TIER_SEQUENCE[currentIndex + 1] : null;
  if (!nextTier) {
    return {
      currentTier,
      nextTier: null,
      completedOrderCount,
      lifetimeSpend: totalSpent,
      remainingOrders: 0,
      remainingSpend: 0,
    };
  }

  const nextPolicy = getTierPolicy(nextTier);
  return {
    currentTier,
    nextTier,
    completedOrderCount,
    lifetimeSpend: totalSpent,
    remainingOrders: Math.max(0, nextPolicy.promotionMinCompletedOrders - completedOrderCount),
    remainingSpend: Number(Math.max(0, nextPolicy.promotionMinLifetimeSpend - totalSpent).toFixed(2)),
  };
}

/**
 * Customers earn 5% of every shilling spent as Noir Points. The tier
 * multiplier boosts that base rate slightly (Junior 1x = exactly 5%,
 * Black 1.65x = 8.25%) — it does not replace it.
 */
export const LOYALTY_BASE_RATE = 0.05;

export function calculateLoyaltyPoints(amount: number, tier: UserTier): number {
  const policy = getTierPolicy(tier);
  return Number((amount * LOYALTY_BASE_RATE * policy.pointsMultiplier).toFixed(2));
}

export function canUseLedger(profile: Pick<UserProfile, "tier">): boolean {
  return getTierPolicy(profile.tier).canUseLedger;
}

export function canUsePaymentMethod(profile: Pick<UserProfile, "tier">, method: PaymentMethod): boolean {
  return getTierPolicy(profile.tier).allowedPaymentMethods.includes(method);
}

export function calculateOutstandingBalance(accountBalance: number): number {
  return Math.max(0, Number((-accountBalance).toFixed(2)));
}

export function calculateAvailableCredit(policy: TierPolicy, accountBalance: number): number | null {
  if (policy.maxOutstandingBalance == null) return null;
  return Number(Math.max(0, policy.maxOutstandingBalance - calculateOutstandingBalance(accountBalance)).toFixed(2));
}

export function evaluatePaymentPolicy(input: PaymentPolicyEvaluationInput): PaymentPolicyEvaluation {
  const { isGuest, tier, paymentMethod, orderTotal, accountBalance } = input;
  const policy = getTierPolicy(tier);
  const normalizedTotal = Number(orderTotal.toFixed(2));
  const rawUpfront = Number((input.upfrontAmount ?? 0).toFixed(2));
  const upfrontAmount = Number(Math.max(0, Math.min(normalizedTotal, rawUpfront)).toFixed(2));

  if (isGuest) {
    if (paymentMethod === "PayOnDelivery") {
      return {
        allowed: false,
        reason: "Guests must prepay. Cash-on-delivery is unavailable.",
        policy,
        upfrontAmount: normalizedTotal,
        ledgerCharge: 0,
        projectedAccountBalance: accountBalance,
        projectedOutstandingBalance: calculateOutstandingBalance(accountBalance),
        availableCredit: 0,
      };
    }
    return {
      allowed: true,
      policy,
      upfrontAmount: normalizedTotal,
      ledgerCharge: 0,
      projectedAccountBalance: accountBalance,
      projectedOutstandingBalance: calculateOutstandingBalance(accountBalance),
      availableCredit: 0,
    };
  }

  if (paymentMethod !== "PayOnDelivery") {
    if (!policy.allowPrepay) {
      return {
        allowed: false,
        reason: `${tier} cannot use prepayment methods.`,
        policy,
        upfrontAmount: 0,
        ledgerCharge: 0,
        projectedAccountBalance: accountBalance,
        projectedOutstandingBalance: calculateOutstandingBalance(accountBalance),
        availableCredit: calculateAvailableCredit(policy, accountBalance),
      };
    }
    return {
      allowed: true,
      policy,
      upfrontAmount: normalizedTotal,
      ledgerCharge: 0,
      projectedAccountBalance: accountBalance,
      projectedOutstandingBalance: calculateOutstandingBalance(accountBalance),
      availableCredit: calculateAvailableCredit(policy, accountBalance),
    };
  }

  if (!policy.allowCashOnDelivery) {
    return {
      allowed: false,
      reason: `${tier} members cannot use cash-on-delivery.`,
      policy,
      upfrontAmount: 0,
      ledgerCharge: 0,
      projectedAccountBalance: accountBalance,
      projectedOutstandingBalance: calculateOutstandingBalance(accountBalance),
      availableCredit: calculateAvailableCredit(policy, accountBalance),
    };
  }

  if (!policy.canUseLedger) {
    return {
      allowed: true,
      policy,
      upfrontAmount: 0,
      ledgerCharge: 0,
      projectedAccountBalance: accountBalance,
      projectedOutstandingBalance: calculateOutstandingBalance(accountBalance),
      availableCredit: 0,
    };
  }

  const minimumUpfront = Number((normalizedTotal * policy.minLedgerUpfrontRatio).toFixed(2));
  if (upfrontAmount < minimumUpfront) {
    return {
      allowed: false,
      reason: `${tier} requires at least ${Math.round(policy.minLedgerUpfrontRatio * 100)}% upfront payment for delivery credit.`,
      policy,
      upfrontAmount,
      ledgerCharge: 0,
      projectedAccountBalance: accountBalance,
      projectedOutstandingBalance: calculateOutstandingBalance(accountBalance),
      availableCredit: calculateAvailableCredit(policy, accountBalance),
    };
  }

  const ledgerCharge = Number((normalizedTotal - upfrontAmount).toFixed(2));
  const projectedAccountBalance = Number((accountBalance - ledgerCharge).toFixed(2));
  const projectedOutstandingBalance = calculateOutstandingBalance(projectedAccountBalance);
  const availableCredit = calculateAvailableCredit(policy, accountBalance);

  if (policy.maxOutstandingBalance != null && projectedOutstandingBalance > policy.maxOutstandingBalance) {
    return {
      allowed: false,
      reason: `${tier} maximum outstanding balance is $${policy.maxOutstandingBalance.toFixed(2)}.`,
      policy,
      upfrontAmount,
      ledgerCharge,
      projectedAccountBalance,
      projectedOutstandingBalance,
      availableCredit,
    };
  }

  return {
    allowed: true,
    policy,
    upfrontAmount,
    ledgerCharge,
    projectedAccountBalance,
    projectedOutstandingBalance,
    availableCredit,
  };
}
