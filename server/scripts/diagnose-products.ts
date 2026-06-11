import "dotenv/config";
import { db, canUseFirestore } from "../db/firebase.js";

async function main() {
  if (!db || !canUseFirestore()) {
    console.log(JSON.stringify({ ok: false, error: "Firestore not connected" }));
    return;
  }

  const snapshot = await db.collection("products").get();
  const all = snapshot.docs.map((d) => d.data() as { id: string; name: string; brand: string; status: string; visibility: string; images?: Array<{ url: string }> });
  const tomFord = all.filter((p) => p.brand === "Tom Ford");

  console.log(
    JSON.stringify(
      {
        ok: true,
        projectId: process.env.FIREBASE_PROJECT_ID,
        totalProducts: all.length,
        published: all.filter((p) => p.status === "published" && p.visibility === "public").length,
        tomFordCount: tomFord.length,
        tomFord: tomFord.map((p) => ({ id: p.id, name: p.name, status: p.status, image: p.images?.[0]?.url })),
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
