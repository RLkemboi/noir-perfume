import "dotenv/config";
import { db, canUseFirestore } from "../db/firebase.js";
import { calculateLoyaltyPoints, TIER_POLICIES } from "../lib/membership.js";
import type { UserProfile, UserTier } from "../types.js";

function safeTier(tier: unknown): UserTier {
  return typeof tier === "string" && tier in TIER_POLICIES ? (tier as UserTier) : "Junior";
}

/**
 * One-off: points were historically awarded at amount x tierMultiplier
 * (~100-165% of spend) instead of the intended 5% base rate. Recompute
 * every customer's balance from lifetime spend at the corrected rate.
 */
async function main() {
  if (!db || !canUseFirestore()) {
    console.log(JSON.stringify({ ok: false, error: "Firestore not connected" }));
    process.exitCode = 1;
    return;
  }

  const snapshot = await db.collection("users").get();
  const changes: Array<{ id: string; email?: string; before: number; after: number }> = [];
  const batch = db.batch();

  for (const doc of snapshot.docs) {
    const profile = doc.data() as UserProfile & { email?: string };
    if (profile.role && profile.role !== "Customer") continue; // staff/admin sentinels untouched
    const before = Number(profile.points ?? 0);
    const after = calculateLoyaltyPoints(Number(profile.totalSpent ?? 0), safeTier(profile.tier));
    if (before === after) continue;
    batch.update(doc.ref, { points: after });
    changes.push({ id: doc.id, email: profile.email, before, after });
  }

  if (changes.length > 0) await batch.commit();
  console.log(JSON.stringify({ ok: true, usersScanned: snapshot.size, recalibrated: changes }, null, 2));
}

void main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
  process.exit(1);
});
