import { db, canUseFirestore, disableFirestore } from "./firebase.js";
import type { CartItem } from "../types.js";

const memoryCarts = new Map<string, CartItem[]>();
const cartsCollection = db?.collection("carts");

async function withCartFallback<T>(action: () => Promise<T>, fallback: () => T | Promise<T>): Promise<T> {
  if (!cartsCollection || !canUseFirestore()) {
    return await fallback();
  }

  try {
    return await action();
  } catch (err) {
    if (disableFirestore(err)) {
      return await fallback();
    }
    throw err;
  }
}

export async function getCart(sessionId: string): Promise<CartItem[]> {
  return withCartFallback(
    async () => {
      const doc = await cartsCollection!.doc(sessionId).get();
      if (!doc.exists) return [];
      return (doc.data()?.items as CartItem[]) || [];
    },
    () => memoryCarts.get(sessionId) || []
  );
}

export async function setCart(sessionId: string, items: CartItem[]): Promise<void> {
  await withCartFallback(
    async () => {
      await cartsCollection!.doc(sessionId).set({
        items,
        updatedAt: new Date().toISOString(),
      });
    },
    () => {
      if (items.length === 0) {
        memoryCarts.delete(sessionId);
      } else {
        memoryCarts.set(sessionId, items);
      }
    }
  );
}

export async function deleteCart(sessionId: string): Promise<void> {
  await withCartFallback(
    async () => {
      await cartsCollection!.doc(sessionId).delete();
    },
    () => {
      memoryCarts.delete(sessionId);
    }
  );
}
