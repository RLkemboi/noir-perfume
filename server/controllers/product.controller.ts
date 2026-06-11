import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { Product } from "../types.js";
import {
  adjustInventory,
  archiveProduct,
  createProduct,
  duplicateProduct,
  getAdminProducts,
  getProductById,
  updateProduct,
} from "../db/products.js";
import { ProductCreateSchema, ProductUpdateSchema } from "../schemas/product.schema.js";

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new HTTPException(400, { message: `${field} is required.` });
  }
  return value.trim();
}

function formatValidationError(error: z.ZodError): string {
  const [issue] = error.issues;
  if (!issue) return "Invalid product payload.";
  const field = issue.path.join(".") || "payload";
  return `${field}: ${issue.message}`;
}

function normalizeProductPayload(body: Record<string, unknown>, actor = "admin"): Product {
  const now = new Date().toISOString();
  return {
    id: typeof body.id === "string" && body.id ? body.id : crypto.randomUUID(),
    slug: requireString(body.slug, "Slug"),
    name: requireString(body.name, "Name"),
    brand: requireString(body.brand, "Brand"),
    subtitle: typeof body.subtitle === "string" ? body.subtitle : "",
    description: requireString(body.description, "Description"),
    luxuryDescription: typeof body.luxuryDescription === "string" ? body.luxuryDescription : requireString(body.description, "Description"),
    price: Number(body.price),
    discountPrice: body.discountPrice == null ? undefined : Number(body.discountPrice),
    stockQuantity: Math.max(0, Math.floor(Number(body.stockQuantity) || 0)),
    lowStockThreshold: Math.max(0, Math.floor(Number(body.lowStockThreshold) || 5)),
    sku: requireString(body.sku, "SKU"),
    category: requireString(body.category, "Category"),
    collection: (body.collection as Product["collection"]) || "Core",
    gender: (body.gender as Product["gender"]) || "unisex",
    notes: (body.notes as Product["notes"]) || { top: [], middle: [], base: [] },
    tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
    sizes: Array.isArray(body.sizes) ? body.sizes.map(String) : [],
    images: Array.isArray(body.images)
      ? (body.images as Product["images"]).map((image) => ({
          ...image,
          id: image.id || crypto.randomUUID(),
        }))
      : [],
    status: (body.status as Product["status"]) || "draft",
    visibility: (body.visibility as Product["visibility"]) || "hidden",
    isFeatured: Boolean(body.isFeatured),
    isNewArrival: Boolean(body.isNewArrival),
    isBestSeller: Boolean(body.isBestSeller),
    displayOrder: Math.max(0, Math.floor(Number(body.displayOrder) || 0)),
    seo: typeof body.seo === "object" && body.seo ? (body.seo as Product["seo"]) : undefined,
    inventoryHistory: Array.isArray(body.inventoryHistory) ? (body.inventoryHistory as Product["inventoryHistory"]) : [],
    createdBy: typeof body.createdBy === "string" && body.createdBy ? body.createdBy : actor,
    updatedBy: actor,
    createdAt: typeof body.createdAt === "string" && body.createdAt ? body.createdAt : now,
    updatedAt: now,
  };
}

export const getProducts = async (c: Context) => {
  const search = c.req.query("search") || "";
  const status = (c.req.query("status") || "all") as "all" | Product["status"];
  const visibility = (c.req.query("visibility") || "all") as "all" | Product["visibility"];
  const collection = (c.req.query("collection") || "all") as "all" | Product["collection"];
  const page = Number(c.req.query("page") || 1);
  const pageSize = Number(c.req.query("pageSize") || 20);

  const result = await getAdminProducts({ search, status, visibility, collection, page, pageSize });
  return c.json(result);
};

export const createProductHandler = async (c: Context) => {
  const body = (await c.req.json()) as Record<string, unknown>;
  const parsed = ProductCreateSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: formatValidationError(parsed.error) });
  }
  const product = normalizeProductPayload(parsed.data as Record<string, unknown>);
  const created = await createProduct(product);
  return c.json(created, 201);
};

export const updateProductHandler = async (c: Context) => {
  const id = requireString(c.req.param("id"), "Product id");
  const current = await getProductById(id);
  if (!current) throw new HTTPException(404, { message: "Product not found" });
  const body = (await c.req.json()) as Record<string, unknown>;
  const parsed = ProductUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw new HTTPException(400, { message: formatValidationError(parsed.error) });
  }
  const updatedPayload = normalizeProductPayload({
    ...current,
    ...parsed.data,
    id,
    createdAt: current.createdAt,
    createdBy: current.createdBy,
  });
  const updated = await updateProduct(id, updatedPayload);
  return c.json(updated);
};

export const archiveProductHandler = async (c: Context) => {
  const id = requireString(c.req.param("id"), "Product id");
  const product = await archiveProduct(id);
  if (!product) throw new HTTPException(404, { message: "Product not found" });
  return c.json(product);
};

export const duplicateProductHandler = async (c: Context) => {
  const id = requireString(c.req.param("id"), "Product id");
  const duplicated = await duplicateProduct(id);
  if (!duplicated) throw new HTTPException(404, { message: "Product not found" });
  return c.json(duplicated, 201);
};

export const adjustInventoryHandler = async (c: Context) => {
  const id = requireString(c.req.param("id"), "Product id");
  const body = (await c.req.json()) as { delta?: number; note?: string };
  if (!Number.isFinite(body.delta)) throw new HTTPException(400, { message: "Inventory delta is required." });
  const updated = await adjustInventory(id, Number(body.delta), "admin_adjustment", "admin", undefined, undefined, body.note);
  if (!updated) throw new HTTPException(404, { message: "Product not found" });
  return c.json(updated);
};
