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
export type PaymentMethod = "Card" | "PayOnDelivery";
export type PaymentStatus = "Unpaid" | "Partial" | "Paid";

export type UserRole = "Customer" | "Operator" | "Manager" | "DeliveryAgent" | "Admin" | "Marketing";

export interface PaymentEntry {
  amount: number;
  date: string;
  source: "checkout" | "customer_portal" | "manual_admin";
}

export interface Order {
  orderId: number;
  sessionId: string;
  items: CartItem[];
  total: number;
  createdAt: string;
  userId?: string;
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
  paymentHistory?: PaymentEntry[];
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

export type UserTier = "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond" | "The Alchemist Circle";

export interface UserProfile {
  userId: string;
  email: string;
  tier: UserTier;
  role: UserRole;
  isApproved: boolean;
  points: number;
  totalSpent: number;
  joinedAt: string;
}
