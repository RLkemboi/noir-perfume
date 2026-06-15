import type { Product as ManagedProduct } from "../../server/types";
import type { Product as LegacyStorefrontProduct } from "../data/products";

export type StorefrontProduct = LegacyStorefrontProduct;

function toCollection(value: ManagedProduct["collection"]): StorefrontProduct["collection"] {
  if (value === "Seasonal") return "Limited";
  return value;
}

function parseStyleTags(tags: string[]) {
  const lower = tags.map((tag) => tag.toLowerCase());
  const includesAny = (values: string[]) => values.some((value) => lower.includes(value));

  const drive: StorefrontProduct["tags"]["drive"] = includesAny(["power", "bold", "intense"])
    ? "power"
    : includesAny(["passion", "romance", "seductive"])
      ? "passion"
      : includesAny(["mystery", "night", "dark"])
        ? "mystery"
        : "precision";
  const element: StorefrontProduct["tags"]["element"] = includesAny(["oud", "woody", "smoky"])
    ? "oud"
    : includesAny(["amber", "warm", "resinous"])
      ? "amber"
      : includesAny(["floral", "rose", "jasmine"])
        ? "floral"
        : "fresh";
  const occasion: StorefrontProduct["tags"]["occasion"] = includesAny(["boardroom", "office", "formal"])
    ? "boardroom"
    : includesAny(["evening", "night", "date"])
      ? "evening"
      : includesAny(["intimate", "romantic"])
        ? "intimate"
        : "signature";

  return { drive, element, occasion };
}

export function mapManagedProductToStorefront(product: ManagedProduct): StorefrontProduct {
  const primaryImage = product.images.find((image) => image.isPrimary) || product.images[0];
  const notesTop = product.notes?.top ?? [];
  const notesMiddle = product.notes?.middle ?? [];
  const notesBase = product.notes?.base ?? [];

  return {
    id: product.id,
    name: product.name,
    brand: product.brand,
    subtitle: product.subtitle || product.category,
    description: product.description,
    price: `KES ${Math.round(product.price).toLocaleString()}`,
    image: primaryImage?.url || "/assets/hero-perfume.jpg",
    topNotes: notesTop.length > 0 ? notesTop : ["Bergamot"],
    heartNotes: notesMiddle.length > 0 ? notesMiddle : ["Rose"],
    baseNotes: notesBase.length > 0 ? notesBase : ["Musk"],
    longevity: product.collection === "Archive" ? 94 : product.collection === "Limited" ? 90 : 86,
    sillage: product.collection === "Archive" ? 90 : product.collection === "Limited" ? 84 : 78,
    rating: product.isBestSeller ? 4.9 : product.isFeatured ? 4.8 : 4.6,
    reviews: Math.max(120, (product.inventoryHistory?.length || 0) * 7 + (product.stockQuantity || 0) * 3),
    collection: toCollection(product.collection),
    tags: parseStyleTags(product.tags || []),
  };
}
