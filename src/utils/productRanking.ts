import type { StorefrontProduct } from "./storefrontProductAdapter";

// Generic fallback artwork — products carrying these have no real bottle shot yet.
const PLACEHOLDER_IMAGES = new Set(["/assets/hero.png", "/assets/hero-perfume.jpg"]);

export function hasProductShot(product: StorefrontProduct): boolean {
  return Boolean(product.image) && !PLACEHOLDER_IMAGES.has(product.image);
}

/** Houses whose entire catalogue has real product shots. */
export function getCompletedHouses(products: StorefrontProduct[]): Set<string> {
  const completed = new Set(products.map((p) => p.brand));
  for (const product of products) {
    if (!hasProductShot(product)) completed.delete(product.brand);
  }
  return completed;
}

/**
 * The default storefront catalogue: only perfumes with a real product shot,
 * or perfumes belonging to a house whose catalogue is fully shot.
 */
export function filterDefaultCatalog(products: StorefrontProduct[]): StorefrontProduct[] {
  const completedHouses = getCompletedHouses(products);
  return products.filter((p) => hasProductShot(p) || completedHouses.has(p.brand));
}

export function parsePrice(price: string): number {
  const value = Number.parseFloat(price.replace(/[^0-9.]/g, ""));
  return Number.isFinite(value) ? value : 0;
}

function popularityScore(product: StorefrontProduct): number {
  // Rating dominates, review volume breaks ties on a log scale.
  return product.rating * Math.log10(product.reviews + 1);
}

/**
 * Ranks the catalogue for display.
 *
 * Without an active category (brand/collection/search) the list leads with the
 * most expensive perfumes. Once the visitor narrows down, ranking switches to
 * popularity with a slight price bias.
 */
export function rankProducts(
  products: StorefrontProduct[],
  options: { hasActiveCategory: boolean }
): StorefrontProduct[] {
  if (products.length === 0) return products;

  if (!options.hasActiveCategory) {
    return [...products].sort(
      (a, b) => parsePrice(b.price) - parsePrice(a.price) || popularityScore(b) - popularityScore(a)
    );
  }

  const maxPrice = Math.max(...products.map((p) => parsePrice(p.price)), 1);
  const maxPopularity = Math.max(...products.map(popularityScore), 1);
  const score = (p: StorefrontProduct) =>
    0.85 * (popularityScore(p) / maxPopularity) + 0.15 * (parsePrice(p.price) / maxPrice);

  return [...products].sort((a, b) => score(b) - score(a));
}

/** Popularity-with-price-bias comparator score, exposed for tie-breaking matches. */
export function promotionScore(product: StorefrontProduct, catalog: StorefrontProduct[]): number {
  const maxPrice = Math.max(...catalog.map((p) => parsePrice(p.price)), 1);
  const maxPopularity = Math.max(...catalog.map(popularityScore), 1);
  return 0.85 * (popularityScore(product) / maxPopularity) + 0.15 * (parsePrice(product.price) / maxPrice);
}
