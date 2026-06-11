import "dotenv/config";
import { syncSeedProducts } from "../db/products.js";

async function main() {
  const result = await syncSeedProducts();
  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: result.mode,
        existingBeforeSync: result.existing,
        addedCount: result.added.length,
        added: result.added,
      },
      null,
      2
    )
  );
}

void main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }, null, 2));
  process.exit(1);
});
