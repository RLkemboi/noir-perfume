import { db } from "./firebase.js";
import type { CartItem } from "../types.js";

const memoryCarts = new Map<string, CartItem[]>();
const cartsCollection = db?.collection("carts");

export async function getCart(sessionId: string): Promise<CartItem[]> {
  if (!cartsCollection) {
    return memoryCarts.get(sessionId) || [];
  }
  const doc = await cartsCollection.doc(sessionId).get();
  if (!doc.exists) return [];
  return (doc.data()?.items as CartItem[]) || [];
}

export async function setCart(sessionId: string, items: CartItem[]): Promise<void> {
  if (!cartsCollection) {
    if (items.length === 0) {
      memoryCarts.delete(sessionId);
    } else {
      memoryCarts.set(sessionId, items);
    }
    return;
  }
  await cartsCollection.doc(sessionId).set({
    items,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteCart(sessionId: string): Promise<void> {
  if (!cartsCollection) {
    memoryCarts.delete(sessionId);
    return;
  }
  await cartsCollection.doc(sessionId).delete();
}
