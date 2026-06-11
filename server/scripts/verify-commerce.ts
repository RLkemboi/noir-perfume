import { archiveProduct, createProduct, duplicateProduct, getAdminProducts, getProductById, getStorefrontProducts, updateProduct, adjustInventory } from "../db/products.js";
import { canUseFirestore } from "../db/firebase.js";
import { evaluatePaymentPolicy } from "../lib/membership.js";
import type { Product } from "../types.js";

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function makeDataUrl(seed: string): string {
  return `data:image/png;base64,${Buffer.from(`noir-${seed}`.repeat(1200)).toString("base64")}`;
}

function buildProduct(): Product {
  const now = new Date().toISOString();
  const id = `verify-${crypto.randomUUID()}`;
  return {
    id,
    slug: `verify-${id.slice(0, 8)}`,
    name: "Verification Product",
    brand: "NOIR",
    subtitle: "Verification",
    description: "Product created by automated commerce verification run.",
    luxuryDescription: "Product created by automated commerce verification run.",
    price: 129,
    discountPrice: 119,
    stockQuantity: 12,
    lowStockThreshold: 4,
    sku: `VER-${id.slice(0, 8).toUpperCase()}`,
    category: "Fragrance",
    collection: "Core",
    gender: "unisex",
    notes: {
      top: ["Bergamot"],
      middle: ["Rose"],
      base: ["Vetiver"],
    },
    tags: ["verification", "test"],
    sizes: ["50ml", "100ml"],
    images: [
      { id: crypto.randomUUID(), url: makeDataUrl("a"), alt: "Primary", isPrimary: true },
      { id: crypto.randomUUID(), url: makeDataUrl("b"), alt: "Secondary", isPrimary: false },
    ],
    status: "published",
    visibility: "public",
    isFeatured: false,
    isNewArrival: false,
    isBestSeller: false,
    displayOrder: 9999,
    seo: {
      title: "Verification Product",
      description: "Commerce verification item",
      keywords: ["verify", "commerce"],
    },
    inventoryHistory: [],
    createdBy: "verification",
    updatedBy: "verification",
    createdAt: now,
    updatedAt: now,
  };
}

async function verifyProductPipeline() {
  const base = buildProduct();
  const created = await createProduct(base);
  assert(created.id === base.id, "Created product id mismatch.");
  assert(created.images.length === 2, "Created product image count mismatch.");
  assert(created.images.every((img) => img.url.startsWith("data:image/")), "Created product images were not hydrated.");

  const fetched = await getProductById(created.id);
  assert(!!fetched, "Created product was not found.");
  assert(fetched!.name === created.name, "Fetched product name mismatch.");
  assert(fetched!.images.every((img) => img.url.startsWith("data:image/")), "Fetched images are not hydrated.");

  const storefront = await getStorefrontProducts();
  assert(storefront.some((product) => product.id === created.id), "Product is not visible in storefront query.");

  const updated = await updateProduct(created.id, {
    name: "Verification Product Updated",
    price: 139,
    status: "draft",
    visibility: "hidden",
  });
  assert(!!updated, "Product update returned null.");
  assert(updated!.name === "Verification Product Updated", "Product name update did not persist.");
  assert(updated!.status === "draft", "Product status update did not persist.");
  const storefrontAfterUnpublish = await getStorefrontProducts();
  assert(!storefrontAfterUnpublish.some((product) => product.id === created.id), "Unpublished product is still in storefront listing.");

  const republished = await updateProduct(created.id, { status: "published", visibility: "public" });
  assert(!!republished && republished.status === "published", "Republish did not persist.");
  const storefrontAfterRepublish = await getStorefrontProducts();
  assert(storefrontAfterRepublish.some((product) => product.id === created.id), "Republished product missing from storefront listing.");

  const inventoryRaised = await adjustInventory(created.id, 5, "admin_adjustment", "verification");
  assert(!!inventoryRaised, "Inventory adjust failed.");
  assert(inventoryRaised!.stockQuantity === base.stockQuantity + 5, "Inventory did not increase correctly.");

  const duplicated = await duplicateProduct(created.id, "verification");
  assert(!!duplicated, "Product duplication failed.");
  assert(duplicated!.id !== created.id, "Duplicated product reused source id.");
  assert(duplicated!.status === "draft", "Duplicated product should be draft.");

  const archived = await archiveProduct(created.id, "verification");
  assert(!!archived, "Archiving product failed.");
  assert(archived!.status === "archived", "Archived product status not persisted.");

  const adminQuery = await getAdminProducts({ search: "Verification Product Updated", page: 1, pageSize: 10 });
  assert(adminQuery.products.some((product) => product.id === created.id), "Archived product not returned in admin query.");

  return {
    createdId: created.id,
    duplicatedId: duplicated!.id,
    firestoreMode: canUseFirestore() ? "firestore" : "memory-fallback",
  };
}

function verifyPolicyMatrix() {
  const guestCod = evaluatePaymentPolicy({
    isGuest: true,
    tier: "Junior",
    paymentMethod: "PayOnDelivery",
    orderTotal: 100,
    accountBalance: 0,
  });
  assert(!guestCod.allowed, "Guest COD must be blocked.");

  const juniorCard = evaluatePaymentPolicy({
    isGuest: false,
    tier: "Junior",
    paymentMethod: "Card",
    orderTotal: 100,
    accountBalance: 0,
  });
  assert(juniorCard.allowed, "Junior prepay must be allowed.");

  const juniorCod = evaluatePaymentPolicy({
    isGuest: false,
    tier: "Junior",
    paymentMethod: "PayOnDelivery",
    orderTotal: 100,
    accountBalance: 0,
  });
  assert(!juniorCod.allowed, "Junior COD must be blocked.");

  const bronzeCod = evaluatePaymentPolicy({
    isGuest: false,
    tier: "Bronze",
    paymentMethod: "PayOnDelivery",
    orderTotal: 120,
    accountBalance: 0,
  });
  assert(bronzeCod.allowed && bronzeCod.ledgerCharge === 0, "Bronze COD without ledger should be allowed.");

  const silverBadUpfront = evaluatePaymentPolicy({
    isGuest: false,
    tier: "Silver",
    paymentMethod: "PayOnDelivery",
    orderTotal: 200,
    accountBalance: 0,
    upfrontAmount: 90,
  });
  assert(!silverBadUpfront.allowed, "Silver must enforce 50% upfront minimum.");

  const silverGoodUpfront = evaluatePaymentPolicy({
    isGuest: false,
    tier: "Silver",
    paymentMethod: "PayOnDelivery",
    orderTotal: 200,
    accountBalance: 0,
    upfrontAmount: 100,
  });
  assert(silverGoodUpfront.allowed && silverGoodUpfront.ledgerCharge === 100, "Silver valid partial payment should be allowed.");

  const goldCredit = evaluatePaymentPolicy({
    isGuest: false,
    tier: "Gold",
    paymentMethod: "PayOnDelivery",
    orderTotal: 300,
    accountBalance: 0,
    upfrontAmount: 0,
  });
  assert(goldCredit.allowed, "Gold full credit should be allowed.");

  const platinumLimitBlocked = evaluatePaymentPolicy({
    isGuest: false,
    tier: "Platinum",
    paymentMethod: "PayOnDelivery",
    orderTotal: 300,
    accountBalance: -4900,
    upfrontAmount: 0,
  });
  assert(!platinumLimitBlocked.allowed, "Platinum must enforce 5000 outstanding cap.");

  const blackUnlimited = evaluatePaymentPolicy({
    isGuest: false,
    tier: "Black",
    paymentMethod: "PayOnDelivery",
    orderTotal: 3000,
    accountBalance: -20000,
    upfrontAmount: 0,
  });
  assert(blackUnlimited.allowed, "Black tier should allow unlimited open ledger.");
}

async function main() {
  const productResults = await verifyProductPipeline();
  verifyPolicyMatrix();
  console.log(
    JSON.stringify(
      {
        ok: true,
        product: productResults,
        policy: "matrix_passed",
      },
      null,
      2
    )
  );
}

void main().catch((err) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      null,
      2
    )
  );
  process.exit(1);
});
