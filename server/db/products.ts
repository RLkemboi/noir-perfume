import { db, canUseFirestore, disableFirestore } from "./firebase.js";
import type { InventoryAdjustment, Product, ProductCollection, ProductImage, ProductStatus, ProductVisibility } from "../types.js";
import { products as seedProducts } from "../data/products.js";

const memoryProducts = new Map<string, Product>();
const productsCollection = db?.collection("products");
const productMediaCollection = db?.collection("product_media");
const MEDIA_URL_PREFIX = "media://";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parsePrice(price: string): number {
  return Number(price.replace(/[^0-9.]/g, "")) || 0;
}

function isInlineImageUrl(url: string): boolean {
  return url.startsWith("data:image/");
}

function toMediaUrl(imageId: string): string {
  return `${MEDIA_URL_PREFIX}${imageId}`;
}

function getMediaImageId(url: string): string | null {
  if (!url.startsWith(MEDIA_URL_PREFIX)) return null;
  const imageId = url.slice(MEDIA_URL_PREFIX.length).trim();
  return imageId || null;
}

function getMediaDocId(productId: string, imageId: string): string {
  return `${productId}__${imageId}`;
}

function toAdminProduct(seed: (typeof seedProducts)[number], index: number): Product {
  const primaryImage: ProductImage = {
    id: `${seed.id}-primary`,
    url: seed.image,
    alt: seed.name,
    isPrimary: true,
  };
  const now = new Date().toISOString();
  return {
    id: seed.id,
    slug: slugify(seed.name),
    name: seed.name,
    brand: seed.brand,
    subtitle: seed.subtitle,
    description: seed.description,
    luxuryDescription: seed.description,
    price: parsePrice(seed.price),
    stockQuantity: seed.collection === "Archive" ? 8 : 24,
    lowStockThreshold: 5,
    sku: `NOIR-${String(index + 1).padStart(4, "0")}`,
    category: "Fragrance",
    collection: (seed.collection || "Core") as ProductCollection,
    gender: "unisex",
    notes: {
      top: seed.topNotes,
      middle: seed.heartNotes,
      base: seed.baseNotes,
    },
    tags: [
      seed.tags.drive,
      seed.tags.element,
      seed.tags.occasion,
      seed.collection || "Core",
      seed.brand,
    ],
    sizes: ["50ml", "100ml"],
    images: [primaryImage],
    status: "published",
    visibility: "public",
    isFeatured: index < 6,
    isNewArrival: index < 4,
    isBestSeller: seed.rating >= 4.8,
    displayOrder: index,
    seo: {
      title: `${seed.name} by ${seed.brand}`,
      description: seed.description,
      keywords: [seed.brand, seed.name, seed.collection || "Core"],
    },
    inventoryHistory: [],
    createdBy: "seed",
    updatedBy: "seed",
    createdAt: now,
    updatedAt: now,
  };
}

function seedMemoryProducts() {
  if (memoryProducts.size > 0) return;
  seedProducts.forEach((product, index) => {
    const mapped = toAdminProduct(product, index);
    memoryProducts.set(mapped.id, mapped);
  });
}

async function withProductsFallback<T>(action: () => Promise<T>, fallback: () => T | Promise<T>): Promise<T> {
  if (!productsCollection || !canUseFirestore()) {
    seedMemoryProducts();
    return await fallback();
  }

  try {
    return await action();
  } catch (err) {
    if (disableFirestore(err)) {
      seedMemoryProducts();
      return await fallback();
    }
    throw err;
  }
}

/**
 * Adds any seed products missing from Firestore without touching existing docs,
 * so admin edits survive and newly added seed entries reach the live catalog.
 */
export async function syncSeedProducts(): Promise<{ mode: "firestore" | "memory"; added: string[]; existing: number }> {
  if (!productsCollection || !canUseFirestore()) {
    seedMemoryProducts();
    return { mode: "memory", added: [], existing: memoryProducts.size };
  }

  const snapshot = await productsCollection.get();
  const existingIds = new Set(snapshot.docs.map((doc) => doc.id));
  const added: string[] = [];

  const batch = db!.batch();
  seedProducts.forEach((seed, index) => {
    if (existingIds.has(seed.id)) return;
    const product = toAdminProduct(seed, index);
    batch.set(productsCollection.doc(product.id), product);
    added.push(`${product.id}:${product.name}`);
  });

  if (added.length > 0) {
    await batch.commit();
  }

  return { mode: "firestore", added, existing: existingIds.size };
}

async function ensureFirestoreSeeded(): Promise<void> {
  if (!productsCollection || !canUseFirestore()) return;
  const snapshot = await productsCollection.limit(1).get();
  if (!snapshot.empty) return;

  const batch = db!.batch();
  seedProducts.forEach((seed, index) => {
    const product = toAdminProduct(seed, index);
    batch.set(productsCollection.doc(product.id), product);
  });
  await batch.commit();
}

async function persistProductMedia(product: Product): Promise<Product> {
  if (!productMediaCollection || !canUseFirestore()) {
    return product;
  }

  const mediaSnapshot = await productMediaCollection.where("productId", "==", product.id).get();
  const desiredMediaDocIds = new Set<string>();
  const nextImages: ProductImage[] = [];

  for (const image of product.images || []) {
    const imageId = image.id || crypto.randomUUID();
    const mediaDocId = getMediaDocId(product.id, imageId);

    if (isInlineImageUrl(image.url)) {
      desiredMediaDocIds.add(mediaDocId);
      await productMediaCollection.doc(mediaDocId).set({
        id: mediaDocId,
        productId: product.id,
        imageId,
        dataUrl: image.url,
        updatedAt: new Date().toISOString(),
      });
      nextImages.push({
        ...image,
        id: imageId,
        url: toMediaUrl(imageId),
      });
      continue;
    }

    const mediaImageId = getMediaImageId(image.url);
    if (mediaImageId) {
      desiredMediaDocIds.add(getMediaDocId(product.id, mediaImageId));
      nextImages.push({
        ...image,
        id: imageId,
        url: toMediaUrl(mediaImageId),
      });
      continue;
    }

    nextImages.push({
      ...image,
      id: imageId,
    });
  }

  const staleDocs = mediaSnapshot.docs.filter((doc) => !desiredMediaDocIds.has(doc.id));
  if (staleDocs.length > 0) {
    const batch = db!.batch();
    for (const stale of staleDocs) {
      batch.delete(stale.ref);
    }
    await batch.commit();
  }

  return {
    ...product,
    images: nextImages,
  };
}

async function hydrateProductMedia(product: Product): Promise<Product> {
  if (!productMediaCollection || !canUseFirestore()) {
    return product;
  }

  const hydratedImages = await Promise.all(
    (product.images || []).map(async (image) => {
      const imageId = getMediaImageId(image.url);
      if (!imageId) return image;

      const mediaDocId = getMediaDocId(product.id, imageId);
      const snapshot = await productMediaCollection.doc(mediaDocId).get();
      if (!snapshot.exists) {
        return image;
      }

      const media = snapshot.data() as { dataUrl?: string };
      return {
        ...image,
        id: image.id || imageId,
        url: media.dataUrl || image.url,
      };
    })
  );

  return {
    ...product,
    images: hydratedImages,
  };
}

export interface ProductQuery {
  search?: string;
  status?: ProductStatus | "all";
  visibility?: ProductVisibility | "all";
  collection?: ProductCollection | "all";
  page?: number;
  pageSize?: number;
}

function applyQuery(products: Product[], query: ProductQuery): Product[] {
  const search = query.search?.trim().toLowerCase();
  return products
    .filter((product) => {
      if (query.status && query.status !== "all" && product.status !== query.status) return false;
      if (query.visibility && query.visibility !== "all" && product.visibility !== query.visibility) return false;
      if (query.collection && query.collection !== "all" && product.collection !== query.collection) return false;
      if (!search) return true;
      return (
        product.name.toLowerCase().includes(search) ||
        product.brand.toLowerCase().includes(search) ||
        product.sku.toLowerCase().includes(search) ||
        product.tags.some((tag) => tag.toLowerCase().includes(search))
      );
    })
    .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
}

export async function getAdminProducts(query: ProductQuery = {}): Promise<{
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
  lowStockCount: number;
}> {
  const page = Math.max(1, query.page || 1);
  // 500 ceiling: the storefront fetches the full published catalog in one page.
  const pageSize = Math.max(1, Math.min(500, query.pageSize || 20));

  return withProductsFallback(
    async () => {
      await ensureFirestoreSeeded();
      const snapshot = await productsCollection!.get();
      const allProducts = await Promise.all(
        snapshot.docs.map(async (doc) => hydrateProductMedia(doc.data() as Product))
      );
      const filtered = applyQuery(allProducts, query);
      const start = (page - 1) * pageSize;
      return {
        products: filtered.slice(start, start + pageSize),
        total: filtered.length,
        page,
        pageSize,
        lowStockCount: allProducts.filter((product) => product.stockQuantity <= product.lowStockThreshold).length,
      };
    },
    () => {
      seedMemoryProducts();
      const allProducts = Array.from(memoryProducts.values());
      const filtered = applyQuery(allProducts, query);
      const start = (page - 1) * pageSize;
      return {
        products: filtered.slice(start, start + pageSize),
        total: filtered.length,
        page,
        pageSize,
        lowStockCount: allProducts.filter((product) => product.stockQuantity <= product.lowStockThreshold).length,
      };
    }
  );
}

export async function getStorefrontProducts(): Promise<Product[]> {
  const result = await getAdminProducts({ page: 1, pageSize: 500, status: "published", visibility: "public" });
  return result.products;
}

export async function getProductById(id: string): Promise<Product | null> {
  return withProductsFallback(
    async () => {
      await ensureFirestoreSeeded();
      const doc = await productsCollection!.doc(id).get();
      if (!doc.exists) return null;
      return hydrateProductMedia(doc.data() as Product);
    },
    () => {
      seedMemoryProducts();
      return memoryProducts.get(id) || null;
    }
  );
}

export async function createProduct(product: Product): Promise<Product> {
  return withProductsFallback(
    async () => {
      const persisted = await persistProductMedia(product);
      await productsCollection!.doc(product.id).set(persisted);
      return hydrateProductMedia(persisted);
    },
    () => {
      seedMemoryProducts();
      memoryProducts.set(product.id, product);
      return product;
    }
  );
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<Product | null> {
  return withProductsFallback(
    async () => {
      await ensureFirestoreSeeded();
      const currentSnapshot = await productsCollection!.doc(id).get();
      if (!currentSnapshot.exists) return null;
      const current = currentSnapshot.data() as Product;
      const next: Product = { ...current, ...updates, id, updatedAt: new Date().toISOString() };
      const persisted = await persistProductMedia(next);
      await productsCollection!.doc(id).set(persisted);
      return hydrateProductMedia(persisted);
    },
    () => {
      seedMemoryProducts();
      const current = memoryProducts.get(id);
      if (!current) return null;
      const next = { ...current, ...updates, id, updatedAt: new Date().toISOString() };
      memoryProducts.set(id, next);
      return next;
    }
  );
}

export async function duplicateProduct(id: string, actorId = "admin"): Promise<Product | null> {
  const current = await getProductById(id);
  if (!current) return null;
  const nextId = crypto.randomUUID();
  const now = new Date().toISOString();
  const duplicated: Product = {
    ...current,
    id: nextId,
    slug: `${current.slug}-copy-${nextId.slice(0, 6)}`,
    sku: `${current.sku}-COPY-${nextId.slice(0, 4).toUpperCase()}`,
    name: `${current.name} Copy`,
    status: "draft",
    visibility: "hidden",
    inventoryHistory: [
      {
        id: crypto.randomUUID(),
        productId: nextId,
        delta: 0,
        previousStock: current.stockQuantity,
        nextStock: current.stockQuantity,
        reason: "duplicate_seed",
        actorId,
        createdAt: now,
        note: `Duplicated from ${current.id}`,
      },
    ],
    createdAt: now,
    updatedAt: now,
    createdBy: actorId,
    updatedBy: actorId,
  };
  return createProduct(duplicated);
}

export async function archiveProduct(id: string, actorId = "admin"): Promise<Product | null> {
  return updateProduct(id, {
    status: "archived",
    visibility: "hidden",
    updatedBy: actorId,
  });
}

export async function adjustInventory(
  productId: string,
  delta: number,
  reason: InventoryAdjustment["reason"],
  actorId?: string,
  actorEmail?: string,
  orderId?: number,
  note?: string
): Promise<Product | null> {
  return withProductsFallback(
    async () => {
      await ensureFirestoreSeeded();
      const docRef = productsCollection!.doc(productId);
      const updated = await db!.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(docRef);
        if (!snapshot.exists) return null;
        const current = snapshot.data() as Product;
        const nextStock = current.stockQuantity + delta;
        if (nextStock < 0) {
          throw new Error(`Insufficient inventory for ${current.name}.`);
        }
        const adjustment: InventoryAdjustment = {
          id: crypto.randomUUID(),
          productId,
          delta,
          previousStock: current.stockQuantity,
          nextStock,
          reason,
          actorId,
          actorEmail,
          orderId,
          note,
          createdAt: new Date().toISOString(),
        };
        const next: Product = {
          ...current,
          stockQuantity: nextStock,
          inventoryHistory: [adjustment, ...(current.inventoryHistory || [])].slice(0, 200),
          updatedAt: new Date().toISOString(),
          updatedBy: actorId || current.updatedBy,
        };
        transaction.set(docRef, next);
        return next;
      });
      return updated;
    },
    () => {
      seedMemoryProducts();
      const current = memoryProducts.get(productId);
      if (!current) return null;
      const nextStock = current.stockQuantity + delta;
      if (nextStock < 0) {
        throw new Error(`Insufficient inventory for ${current.name}.`);
      }
      const adjustment: InventoryAdjustment = {
        id: crypto.randomUUID(),
        productId,
        delta,
        previousStock: current.stockQuantity,
        nextStock,
        reason,
        actorId,
        actorEmail,
        orderId,
        note,
        createdAt: new Date().toISOString(),
      };
      const next: Product = {
        ...current,
        stockQuantity: nextStock,
        inventoryHistory: [adjustment, ...(current.inventoryHistory || [])].slice(0, 200),
        updatedAt: new Date().toISOString(),
        updatedBy: actorId || current.updatedBy,
      };
      memoryProducts.set(productId, next);
      return next;
    }
  );
}
