import { db } from "./firebase.js";
import type { CartItem, Order } from "../types.js";

const memoryOrders = new Map<number, Order>();
let memoryOrderId = 0;

const ordersCollection = db?.collection("orders");
const metadataDoc = db?.collection("metadata").doc("counters");

export async function createOrder(
  sessionId: string,
  items: CartItem[],
  total: number,
  userId?: string,
  userEmail?: string
): Promise<Order> {
  if (!ordersCollection || !metadataDoc) {
    memoryOrderId += 1;
    const order: Order = {
      orderId: memoryOrderId,
      sessionId,
      items,
      total,
      createdAt: new Date().toISOString(),
      userId,
      userEmail,
    };
    memoryOrders.set(memoryOrderId, order);
    return order;
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
    createdAt: new Date().toISOString(),
    userId,
    userEmail,
  };

  await ordersCollection.doc(String(orderId)).set(order);
  return order;
}

export async function getOrders(): Promise<Order[]> {
  if (!ordersCollection) {
    return Array.from(memoryOrders.values()).sort((a, b) => a.orderId - b.orderId);
  }
  const snapshot = await ordersCollection.orderBy("orderId", "asc").get();
  return snapshot.docs.map((d) => d.data() as Order);
}

export async function getOrdersBySession(sessionId: string): Promise<Order[]> {
  if (!ordersCollection) {
    return Array.from(memoryOrders.values())
      .filter((o) => o.sessionId === sessionId)
      .sort((a, b) => a.orderId - b.orderId);
  }
  const snapshot = await ordersCollection
    .where("sessionId", "==", sessionId)
    .get();
  return snapshot.docs
    .map((d) => d.data() as Order)
    .sort((a, b) => a.orderId - b.orderId);
}

export async function getOrdersByUser(userId: string): Promise<Order[]> {
  if (!ordersCollection) {
    return Array.from(memoryOrders.values())
      .filter((o) => o.userId === userId)
      .sort((a, b) => a.orderId - b.orderId);
  }
  const snapshot = await ordersCollection
    .where("userId", "==", userId)
    .get();
  return snapshot.docs
    .map((d) => d.data() as Order)
    .sort((a, b) => a.orderId - b.orderId);
}

export async function getOrderById(orderId: number): Promise<Order | null> {
  if (!ordersCollection) {
    return memoryOrders.get(orderId) || null;
  }
  const doc = await ordersCollection.doc(String(orderId)).get();
  if (!doc.exists) return null;
  return doc.data() as Order;
}
