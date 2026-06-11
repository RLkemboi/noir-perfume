import { db, canUseFirestore, disableFirestore } from "./firebase.js";
import type { LedgerEntry } from "../types.js";

const memoryLedger = new Map<string, LedgerEntry[]>();
const ledgerCollection = db?.collection("ledger_entries");

async function withLedgerFallback<T>(action: () => Promise<T>, fallback: () => T | Promise<T>): Promise<T> {
  if (!ledgerCollection || !canUseFirestore()) {
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

export async function addLedgerEntry(entry: LedgerEntry): Promise<LedgerEntry> {
  return withLedgerFallback(
    async () => {
      await ledgerCollection!.doc(entry.id).set(entry);
      return entry;
    },
    () => {
      const current = memoryLedger.get(entry.userId) || [];
      memoryLedger.set(entry.userId, [entry, ...current]);
      return entry;
    }
  );
}

export async function getUserLedger(userId: string): Promise<LedgerEntry[]> {
  return withLedgerFallback(
    async () => {
      const snapshot = await ledgerCollection!.where("userId", "==", userId).get();
      return snapshot.docs
        .map((doc) => doc.data() as LedgerEntry)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    },
    () => [...(memoryLedger.get(userId) || [])]
  );
}
