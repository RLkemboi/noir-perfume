export type CartItem = {
  productId: string;
  name: string;
  brand: string;
  price: string;
  image: string;
  quantity: number;
};

export interface ShippingDetails {
  fullName: string;
  email: string;
  address: string;
  city: string;
  country: string;
  postalCode: string;
  phone: string;
  source?: "manual" | "saved" | "map";
  label?: string;
  latitude?: number;
  longitude?: number;
}

export type OrderStatus = "Pending" | "Processing" | "Shipped" | "Out for Delivery" | "Delivered" | "Cancelled";
export type PaymentMethod = "Card" | "PayOnDelivery" | "Mpesa";
export type PaymentStatus = "Unpaid" | "Partial" | "Paid";
export type EmploymentStatus = "Active" | "PendingApproval" | "Suspended";

export type UserRole = "Customer" | "Operator" | "Manager" | "DeliveryAgent" | "Admin" | "Marketing";

/** Strict payment event record — each item in paymentHistory */
export interface PaymentHistoryEntry {
  paymentId: string;       // unique ID for this payment event
  amount: number;
  timestamp: number;       // unix epoch milliseconds
  method: string;          // e.g. "Card", "Mpesa", "PayOnDelivery"
  status: string;          // e.g. "success", "pending", "failed"
}

/** @deprecated Use PaymentHistoryEntry. Kept for legacy write-path compatibility. */
export interface PaymentEntry {
  amount: number;
  date: string;
  source: "checkout" | "customer_portal" | "manual_admin" | "mpesa_stk";
}

export interface Order {
  orderId: number;
  sessionId: string;
  customerId: string;        // required — canonical customer identifier (uid or session)
  items: CartItem[];
  total: number;
  createdAt: string;
  userId?: string;           // legacy alias — prefer customerId for new code
  userEmail?: string;
  shipping?: ShippingDetails;
  status: OrderStatus;
  statusHistory: { status: OrderStatus; date: string }[];
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  amountPaid: number;
  amountDue: number;
  payOnDeliveryLimit?: number;
  paymentPromptRequestedAt?: string;
  paymentPromptCount?: number;
  paymentHistory?: PaymentHistoryEntry[];
  confirmedByAdminId?: string;   // uid of the admin who confirmed this order
  deliveryAgentId?: string;      // uid of the assigned delivery agent
  cancelledAt?: string;
  cancellationMessage?: string;
  paymentPhone?: string;
  paymentReference?: string;
  paymentProvider?: "Card" | "PayOnDelivery" | "Mpesa";
  paymentRequestedAt?: string;
  paymentLastError?: string;
  mpesaMerchantRequestId?: string;
  mpesaCheckoutRequestId?: string;
  mpesaReceiptNumber?: string;
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

export type UserTier = "Junior" | "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond" | "The Alchemist Circle";

export interface UserProfile {
  userId: string;
  email: string;
  tier: UserTier;
  role: UserRole;
  isApproved: boolean;
  points: number;
  totalSpent: number;
  accountBalance?: number;
  joinedAt: string;
  employmentStatus?: EmploymentStatus;
  department?: string;
  hrNotes?: string;
  lastRoleUpdatedAt?: string;
}
