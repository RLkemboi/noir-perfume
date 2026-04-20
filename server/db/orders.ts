import { db } from "./firebase.js";
import type { CartItem, Order, ShippingDetails, OrderStatus, PaymentMethod, PaymentEntry } from "../types.js";

const memoryOrders = new Map<number, Order>();
let memoryOrderId = 0;

const ordersCollection = db?.collection("orders");
const metadataDoc = db?.collection("metadata").doc("counters");

function normalizeOrder(order: Order): Order {
  const paymentMethod = order.paymentMethod || "Card";
  const amountPaid = order.amountPaid ?? (paymentMethod === "Card" ? order.total : 0);
  const amountDue = order.amountDue ?? Math.max(0, Number((order.total - amountPaid).toFixed(2)));
  const paymentStatus =
    order.paymentStatus ??
    (amountDue === 0 ? "Paid" : amountPaid > 0 ? "Partial" : "Unpaid");

  return {
    ...order,
    shipping: order.shipping,
    paymentMethod,
    paymentStatus,
    amountPaid,
    amountDue,
    paymentPromptCount: order.paymentPromptCount ?? (paymentMethod === "PayOnDelivery" ? 1 : 0),
    paymentHistory:
      order.paymentHistory ??
      (paymentMethod === "Card"
        ? [{ amount: order.total, date: order.createdAt, source: "checkout" }]
        : []),
    statusHistory: order.statusHistory || [],
    customerDeliveryConfirmed: order.customerDeliveryConfirmed ?? false,
    agentDeliveryConfirmed: order.agentDeliveryConfirmed ?? false,
    adminDeliveryConfirmed: order.adminDeliveryConfirmed ?? false,
  };
}

export async function createOrder(
  sessionId: string,
  items: CartItem[],
  total: number,
  userId?: string,
  userEmail?: string,
  shipping?: ShippingDetails,
  paymentMethod: PaymentMethod = "Card",
  payOnDeliveryLimit?: number
): Promise<Order> {
  const initialStatus = "Pending";
  const now = new Date().toISOString();
  const isCard = paymentMethod === "Card";
  const initialPaymentHistory: PaymentEntry[] = isCard
    ? [{ amount: total, date: now, source: "checkout" }]
    : [];
  const initialPromptCount = isCard ? 0 : 1;
  
  if (!ordersCollection || !metadataDoc) {
    memoryOrderId += 1;
    const order: Order = {
      orderId: memoryOrderId,
      sessionId,
      items,
      total,
      createdAt: now,
      userId,
      userEmail,
      shipping,
      status: initialStatus,
      statusHistory: [{ status: initialStatus, date: now }],
      paymentMethod,
      paymentStatus: isCard ? "Paid" : "Unpaid",
      amountPaid: isCard ? total : 0,
      amountDue: isCard ? 0 : total,
      payOnDeliveryLimit,
      paymentPromptRequestedAt: isCard ? undefined : now,
      paymentPromptCount: initialPromptCount,
      paymentHistory: initialPaymentHistory,
      customerDeliveryConfirmed: false,
      agentDeliveryConfirmed: false,
      adminDeliveryConfirmed: false,
    };
    memoryOrders.set(memoryOrderId, order);
    return normalizeOrder(order);
  }

  const orderId = await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(metadataDoc);
    const current = doc.exists ? (doc.data()?.lastOrderId as number) || 0 : 0;
    const next = current + 1;
    transaction.set(metadataDoc, { lastOrderId: next }, { merge: true });
    return next;
  });

  const order: Order = {
    orderId,
    sessionId,
    items,
    total,
    createdAt: now,
    userId,
    userEmail,
    shipping,
    status: initialStatus,
    statusHistory: [{ status: initialStatus, date: now }],
    paymentMethod,
    paymentStatus: isCard ? "Paid" : "Unpaid",
    amountPaid: isCard ? total : 0,
    amountDue: isCard ? 0 : total,
    payOnDeliveryLimit,
    paymentPromptRequestedAt: isCard ? undefined : now,
    paymentPromptCount: initialPromptCount,
    paymentHistory: initialPaymentHistory,
    customerDeliveryConfirmed: false,
    agentDeliveryConfirmed: false,
    adminDeliveryConfirmed: false,
  };

  await ordersCollection.doc(String(orderId)).set(order);
  return normalizeOrder(order);
}

export async function updateOrderStatus(orderId: number, status: OrderStatus): Promise<Order | null> {
  const now = new Date().toISOString();
  
  if (!ordersCollection) {
    const order = memoryOrders.get(orderId);
    if (!order) return null;
    order.status = status;
    if (!order.statusHistory) {
      order.statusHistory = [];
    }
    order.statusHistory.push({ status, date: now });
    memoryOrders.set(orderId, order);
    return normalizeOrder(order);
  }

  const docRef = ordersCollection.doc(String(orderId));
  const doc = await docRef.get();
  if (!doc.exists) return null;

  const order = doc.data() as Order;
  order.status = status;
  if (!order.statusHistory) {
    order.statusHistory = [];
  }
  order.statusHistory.push({ status, date: now });

  await docRef.update({
    status: order.status,
    statusHistory: order.statusHistory
  });
  
  return normalizeOrder(order);
}

async function saveOrder(orderId: number, order: Order): Promise<Order> {
  const normalized = normalizeOrder(order);
  if (!ordersCollection) {
    memoryOrders.set(orderId, normalized);
    return normalized;
  }

  await ordersCollection.doc(String(orderId)).set(normalized);
  return normalized;
}

export async function getOrders(): Promise<Order[]> {
  if (!ordersCollection) {
    return Array.from(memoryOrders.values()).map(normalizeOrder).sort((a, b) => a.orderId - b.orderId);
  }
  const snapshot = await ordersCollection.orderBy("orderId", "asc").get();
  return snapshot.docs.map((d) => normalizeOrder(d.data() as Order));
}

export async function getOrdersBySession(sessionId: string): Promise<Order[]> {
  if (!ordersCollection) {
    return Array.from(memoryOrders.values())
      .map(normalizeOrder)
      .filter((o) => o.sessionId === sessionId)
      .sort((a, b) => a.orderId - b.orderId);
  }
  const snapshot = await ordersCollection
    .where("sessionId", "==", sessionId)
    .get();
  return snapshot.docs
    .map((d) => normalizeOrder(d.data() as Order))
    .sort((a, b) => a.orderId - b.orderId);
}

export async function getOrdersByUser(userId: string): Promise<Order[]> {
  if (!ordersCollection) {
    return Array.from(memoryOrders.values())
      .map(normalizeOrder)
      .filter((o) => o.userId === userId)
      .sort((a, b) => a.orderId - b.orderId);
  }
  const snapshot = await ordersCollection
    .where("userId", "==", userId)
    .get();
  return snapshot.docs
    .map((d) => normalizeOrder(d.data() as Order))
    .sort((a, b) => a.orderId - b.orderId);
}

export async function getShippedOrders(): Promise<Order[]> {
  if (!ordersCollection) {
    return Array.from(memoryOrders.values())
      .map(normalizeOrder)
      .filter((o) => o.status === "Shipped")
      .sort((a, b) => a.orderId - b.orderId);
  }
  const snapshot = await ordersCollection
    .where("status", "==", "Shipped")
    .get();
  return snapshot.docs.map((d) => normalizeOrder(d.data() as Order));
}

export async function getOrderById(orderId: number): Promise<Order | null> {
  if (!ordersCollection) {
    const order = memoryOrders.get(orderId);
    return order ? normalizeOrder(order) : null;
  }
  const doc = await ordersCollection.doc(String(orderId)).get();
  if (!doc.exists) return null;
  return normalizeOrder(doc.data() as Order);
}

export async function getAgentOrders(agentId: string): Promise<Order[]> {
  if (!ordersCollection) {
    return Array.from(memoryOrders.values())
      .map(normalizeOrder)
      .filter((o) => o.assignedAgentId === agentId)
      .sort((a, b) => a.orderId - b.orderId);
  }
  const snapshot = await ordersCollection
    .where("assignedAgentId", "==", agentId)
    .get();
  return snapshot.docs.map((d) => normalizeOrder(d.data() as Order));
}

export async function assignOrderToAgent(orderId: number, agentId: string, agentName: string): Promise<Order | null> {
  const now = new Date().toISOString();
  const nextStatus = "Out for Delivery";

  if (!ordersCollection) {
    const order = memoryOrders.get(orderId);
    if (!order) return null;
    order.status = nextStatus;
    if (!order.statusHistory) {
      order.statusHistory = [];
    }
    order.statusHistory.push({ status: nextStatus, date: now });
    order.assignedAgentId = agentId;
    order.assignedAgentName = agentName;
    memoryOrders.set(orderId, order);
    return normalizeOrder(order);
  }

  const docRef = ordersCollection.doc(String(orderId));
  const doc = await docRef.get();
  if (!doc.exists) return null;

  const order = doc.data() as Order;
  order.status = nextStatus;
  if (!order.statusHistory) {
    order.statusHistory = [];
  }
  order.statusHistory.push({ status: nextStatus, date: now });
  order.assignedAgentId = agentId;
  order.assignedAgentName = agentName;

  await docRef.update({
    status: order.status,
    statusHistory: order.statusHistory,
    assignedAgentId: agentId,
    assignedAgentName: agentName
  });

  return normalizeOrder(order);
}

export async function updateOrderComment(orderId: number, comment: string, reviewRating?: number): Promise<Order | null> {
  if (!ordersCollection) {
    const order = memoryOrders.get(orderId);
    if (!order) return null;
    order.comment = comment;
    order.reviewRating = reviewRating;
    memoryOrders.set(orderId, order);
    return normalizeOrder(order);
  }

  const docRef = ordersCollection.doc(String(orderId));
  const doc = await docRef.get();
  if (!doc.exists) return null;

  await docRef.update({ comment, reviewRating });
  const updated = (await docRef.get()).data() as Order;
  return normalizeOrder(updated);
}

export async function confirmAgentDelivery(orderId: number): Promise<Order | null> {
  const now = new Date().toISOString();
  const order = await getOrderById(orderId);
  if (!order) return null;

  order.agentDeliveryConfirmed = true;
  order.agentDeliveryConfirmedAt = now;
  if (order.status !== "Delivered") {
    order.status = "Delivered";
    order.statusHistory = [...(order.statusHistory || []), { status: "Delivered", date: now }];
  }

  return saveOrder(orderId, order);
}

export async function confirmCustomerDelivery(orderId: number): Promise<Order | null> {
  const now = new Date().toISOString();
  const order = await getOrderById(orderId);
  if (!order) return null;

  order.customerDeliveryConfirmed = true;
  order.customerDeliveryConfirmedAt = now;

  return saveOrder(orderId, order);
}

export async function confirmAdminDelivery(orderId: number): Promise<Order | null> {
  const now = new Date().toISOString();
  const order = await getOrderById(orderId);
  if (!order) return null;

  order.adminDeliveryConfirmed = true;
  order.adminDeliveryConfirmedAt = now;

  return saveOrder(orderId, order);
}

export async function requestPaymentPrompt(orderId: number): Promise<Order | null> {
  const now = new Date().toISOString();
  const order = await getOrderById(orderId);
  if (!order) return null;

  order.paymentPromptRequestedAt = now;
  order.paymentPromptCount = (order.paymentPromptCount || 0) + 1;

  return saveOrder(orderId, order);
}

export async function recordOrderPayment(
  orderId: number,
  amount: number,
  source: PaymentEntry["source"] = "customer_portal"
): Promise<Order | null> {
  const now = new Date().toISOString();
  const order = await getOrderById(orderId);
  if (!order) return null;

  const normalizedAmount = Number(amount.toFixed(2));
  order.amountPaid = Number(((order.amountPaid || 0) + normalizedAmount).toFixed(2));
  order.amountDue = Math.max(0, Number((order.total - order.amountPaid).toFixed(2)));
  order.paymentStatus = order.amountDue === 0 ? "Paid" : order.amountPaid > 0 ? "Partial" : "Unpaid";
  order.paymentHistory = [...(order.paymentHistory || []), { amount: normalizedAmount, date: now, source }];

  return saveOrder(orderId, order);
}
