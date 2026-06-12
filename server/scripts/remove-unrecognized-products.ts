import "dotenv/config";
import { db, canUseFirestore } from "../db/firebase.js";

// Fictional template houses — not real fragrance brands.
const UNRECOGNIZED_BRANDS = new Set(["NOIR", "Maison Obscura", "Attar Royal", "Haus Alchemy"]);

async function main() {
  if (!db || !canUseFirestore()) {
    console.log(JSON.stringify({ ok: false, error: "Firestore not connected" }));
    process.exitCode = 1;
    return;
  }

  const snapshot = await db.collection("products").get();
  const doomed = snapshot.docs.filter((doc) => {
    const data = doc.data() as { brand?: string };
    return data.brand != null && UNRECOGNIZED_BRANDS.has(data.brand);
  });

  const doomedIds = new Set(doomed.map((doc) => doc.id));
  const mediaSnapshot = await db.collection("product_media").get();
  const doomedMedia = mediaSnapshot.docs.filter((doc) => doomedIds.has(doc.id.split("__")[0]));

  const batch = db.batch();
  doomed.forEach((doc) => batch.delete(doc.ref));
  doomedMedia.forEach((doc) => batch.delete(doc.ref));
  if (doomed.length + doomedMedia.length > 0) await batch.commit();

  console.log(
    JSON.stringify(
      {
        ok: true,
        removedProducts: doomed.map((doc) => {
          const data = doc.data() as { name?: string; brand?: string };
          return `${doc.id}: ${data.brand} ${data.name}`;
        }),
        removedMediaDocs: doomedMedia.length,
        remainingProducts: snapshot.size - doomed.length,
      },
      null,
      2
    )
  );
}

void main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
  process.exit(1);
});
