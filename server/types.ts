export type ProductStatus = "published" | "draft" | "archived";
export type ProductVisibility = "public" | "hidden";
export type ProductGender = "masculine" | "feminine" | "unisex";
export type ProductCollection = "Core" | "Limited" | "Archive" | "Seasonal";

export interface ProductImage {
  id: string;
  url: string;
  alt: string;
  isPrimary: boolean;
}

export interface ProductNotes {
  top: string[];
  middle: string[];
  base: string[];
}

export interface ProductSeo {
  title?: string;
  description?: string;
  keywords?: string[];
}

export interface InventoryAdjustment {
  id: string;
  productId: string;
  delta: number;
  previousStock: number;
  nextStock: number;
  reason:
    | "order_placed"
    | "order_cancelled"
    | "admin_adjustment"
    | "restock"
    | "bulk_edit"
    | "duplicate_seed";
  actorId?: string;
  actorEmail?: string;
  orderId?: number;
  note?: string;
  createdAt: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  subtitle?: string;
  description: string;
  luxuryDescription: string;
  price: number;
  discountPrice?: number;
  stockQuantity: number;
  lowStockThreshold: number;
  sku: string;
  category: string;
  collection: ProductCollection;
  gender: ProductGender;
  notes: ProductNotes;
  tags: string[];
  sizes: string[];
  images: ProductImage[];
  status: ProductStatus;
  visibility: ProductVisibility;
  isFeatured: boolean;
  isNewArrival: boolean;
  isBestSeller: boolean;
  displayOrder: number;
  seo?: ProductSeo;
  inventoryHistory: InventoryAdjustment[];
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export type UserRole =
  | "Customer"
  | "Admin"
  | "Manager"
  | "Operator"
  | "DeliveryAgent"
  | "Marketing";

export type UserTier = "Junior" | "Bronze" | "Silver" | "Gold" | "Platinum" | "Black";
export type EmploymentStatus = "Active" | "PendingApproval" | "Suspended";

export interface UserProfile {
  id?: string;
  userId: string;
  email: string;
  name?: string;
  role: UserRole;
  tier: UserTier;
  isApproved: boolean;
  employmentStatus: EmploymentStatus;
  department?: string;
  hrNotes?: string;
  createdAt?: string;
  joinedAt: string;
  lastRoleUpdatedAt?: string;
  points: number;
  totalSpent: number;
  completedOrderCount: number;
  referralCount?: number;
  accountBalance: number;
  tierManualOverride?: boolean;
  lastTierEvaluatedAt?: string;
}

export interface CartItem {
  productId: string;
  name: string;
  brand: string;
  price: string;
  image: string;
  quantity: number;
  /** Bottle format (e.g. "50ml"). Missing means Signature — the pre-tier default. */
  size?: string;
}

export interface ShippingDetails {
  fullName: string;
  email: string;
  address: string;
  city: string;
  country: string;
  postalCode: string;
  phone?: string;
  source?: "manual" | "saved" | "map";
  label?: string;
  latitude?: number;
  longitude?: number;
}

export type PaymentMethod = "Card" | "Mpesa" | "PayOnDelivery";
export type PaymentProvider = "Card" | "Mpesa" | "PayOnDelivery" | "Stripe" | "PayPal";
export type PaymentStatus = "Unpaid" | "Partial" | "Paid" | "Refunded" | "PartiallyRefunded";
export type RefundStatus = "None" | "Pending" | "Reversed" | "PartiallyReversed";
export type OrderStatus = "Pending" | "Processing" | "Shipped" | "Out for Delivery" | "Delivered" | "Cancelled";

export interface PaymentHistoryEntry {
  paymentId: string;
  amount: number;
  timestamp: number;
  method: string;
  status: "success" | "failed" | "reversed";
  reference?: string;
  note?: string;
}

export interface RefundEntry {
  refundId: string;
  amount: number;
  channel: "ledger_reversal" | "gateway_refund" | "cod_void" | "manual_adjustment";
  status: "succeeded" | "pending" | "failed";
  reason: string;
  createdAt: string;
  createdBy?: string;
  note?: string;
}

export interface OrderStatusHistoryEntry {
  status: OrderStatus;
  date: string;
  note?: string;
}

export interface OrderAuditEntry {
  id: string;
  type:
    | "created"
    | "payment_recorded"
    | "payment_prompt_requested"
    | "inventory_reserved"
    | "inventory_restored"
    | "cancelled"
    | "refund_recorded"
    | "loyalty_awarded"
    | "loyalty_reversed"
    | "status_updated"
    | "delivery_assigned"
    | "delivery_confirmed"
    | "admin_finalized";
  message: string;
  createdAt: string;
  actorId?: string;
  actorEmail?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

export interface Order {
  id?: string;
  orderId: number;
  sessionId?: string;
  customerId: string;
  userId?: string;
  userEmail?: string;
  total: number;
  createdAt: string;
  updatedAt?: string;
  items: CartItem[];
  shipping?: ShippingDetails;
  status: OrderStatus;
  statusHistory: OrderStatusHistoryEntry[];
  auditTrail?: OrderAuditEntry[];
  paymentMethod: PaymentMethod;
  paymentProvider?: PaymentProvider;
  paymentReference?: string;
  amountPaid: number;
  amountDue: number;
  paymentPhone?: string;
  paymentLastError?: string;
  paymentStatus: PaymentStatus;
  paymentPromptCount?: number;
  paymentPromptRequestedAt?: string;
  paymentRequestedAt?: string;
  payOnDeliveryLimit?: number;
  cancellationMessage?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  mpesaMerchantRequestId?: string;
  mpesaCheckoutRequestId?: string;
  mpesaReceiptNumber?: string;
  paymentHistory?: PaymentHistoryEntry[];
  refundStatus?: RefundStatus;
  refundEntries?: RefundEntry[];
  inventoryReservedAt?: string;
  inventoryRestoredAt?: string;
  loyaltyAwardedAt?: string;
  loyaltyReversedAt?: string;
  customerDeliveryConfirmed?: boolean;
  customerDeliveryConfirmedAt?: string;
  agentDeliveryConfirmed?: boolean;
  agentDeliveryConfirmedAt?: string;
  adminDeliveryConfirmed?: boolean;
  adminDeliveryConfirmedAt?: string;
  assignedAgentId?: string;
  assignedAgentName?: string;
  comment?: string;
  reviewRating?: number;
}

export interface LedgerEntry {
  id: string;
  userId: string;
  orderId?: number;
  type: "deposit" | "charge" | "reversal" | "refund" | "adjustment";
  direction: "credit" | "debit";
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
  actorId?: string;
  actorEmail?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}
