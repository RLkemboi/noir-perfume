import { z } from "zod";

const PRODUCT_STATUSES = ["published", "draft", "archived"] as const;
const PRODUCT_VISIBILITY = ["public", "hidden"] as const;
const PRODUCT_COLLECTIONS = ["Core", "Limited", "Archive", "Seasonal"] as const;
const PRODUCT_GENDERS = ["masculine", "feminine", "unisex"] as const;
const MAX_IMAGE_DATA_URL_BYTES = 300 * 1024;
const MAX_TOTAL_INLINE_IMAGE_BYTES = 900 * 1024;

function estimateDataUrlBytes(url: string): number {
  const base64 = url.split(",")[1] || "";
  return Math.ceil((base64.length * 3) / 4);
}

const ProductImageSchema = z.object({
  id: z.string().trim().optional(),
  url: z
    .string()
    .trim()
    .min(1, "Image URL is required")
    .refine(
      (value) => value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:image/"),
      "Image URL must be https/http or data:image URI."
    )
    .refine((value) => !value.startsWith("data:image/") || estimateDataUrlBytes(value) <= MAX_IMAGE_DATA_URL_BYTES, {
      message: "Inline image payload is too large. Please upload a smaller image.",
    }),
  alt: z.string().trim().min(1, "Image alt text is required"),
  isPrimary: z.boolean().default(false),
});

const ProductNotesSchema = z.object({
  top: z.array(z.string().trim().min(1)).default([]),
  middle: z.array(z.string().trim().min(1)).default([]),
  base: z.array(z.string().trim().min(1)).default([]),
});

const ProductSeoSchema = z
  .object({
    title: z.string().trim().optional(),
    description: z.string().trim().optional(),
    keywords: z.array(z.string().trim().min(1)).optional(),
  })
  .optional();

const ProductPayloadBaseSchema = z.object({
  id: z.string().trim().optional(),
  slug: z.string().trim().min(1).regex(/^[a-z0-9-]+$/, "Slug must be lowercase URL-safe text."),
  name: z.string().trim().min(1, "Name is required."),
  brand: z.string().trim().min(1, "Brand is required."),
  subtitle: z.string().trim().optional().default(""),
  description: z.string().trim().min(10, "Description must contain at least 10 characters."),
  luxuryDescription: z.string().trim().optional(),
  price: z.coerce.number().positive("Price must be greater than zero."),
  discountPrice: z.coerce.number().nonnegative().optional(),
  stockQuantity: z.coerce.number().int().nonnegative().default(0),
  lowStockThreshold: z.coerce.number().int().nonnegative().default(5),
  sku: z.string().trim().min(1, "SKU is required."),
  category: z.string().trim().min(1, "Category is required."),
  collection: z.enum(PRODUCT_COLLECTIONS).default("Core"),
  gender: z.enum(PRODUCT_GENDERS).default("unisex"),
  notes: ProductNotesSchema.default({ top: [], middle: [], base: [] }),
  tags: z.array(z.string().trim().min(1)).default([]),
  sizes: z.array(z.string().trim().min(1)).default([]),
  images: z.array(ProductImageSchema).max(8, "A product supports up to 8 images.").default([]),
  status: z.enum(PRODUCT_STATUSES).default("draft"),
  visibility: z.enum(PRODUCT_VISIBILITY).default("hidden"),
  isFeatured: z.boolean().default(false),
  isNewArrival: z.boolean().default(false),
  isBestSeller: z.boolean().default(false),
  displayOrder: z.coerce.number().int().nonnegative().default(0),
  seo: ProductSeoSchema,
});

function getTotalInlineImageBytes(images: Array<{ url: string }>): number {
  return images.reduce((sum, image) => {
    if (!image.url.startsWith("data:image/")) return sum;
    return sum + estimateDataUrlBytes(image.url);
  }, 0);
}

export const ProductCreateSchema = ProductPayloadBaseSchema.superRefine((value, ctx) => {
  if (value.discountPrice != null && value.discountPrice >= value.price) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Discount price must be lower than price.",
      path: ["discountPrice"],
    });
  }

  if (getTotalInlineImageBytes(value.images) > MAX_TOTAL_INLINE_IMAGE_BYTES) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Combined inline image payload is too large. Remove or compress images.",
      path: ["images"],
    });
  }
});

export const ProductUpdateSchema = ProductPayloadBaseSchema.partial().superRefine((value, ctx) => {
  if (value.discountPrice != null && value.price != null && value.discountPrice >= value.price) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Discount price must be lower than price.",
      path: ["discountPrice"],
    });
  }

  if (value.images && getTotalInlineImageBytes(value.images) > MAX_TOTAL_INLINE_IMAGE_BYTES) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Combined inline image payload is too large. Remove or compress images.",
      path: ["images"],
    });
  }
});

export type ProductCreateInput = z.infer<typeof ProductCreateSchema>;
export type ProductUpdateInput = z.infer<typeof ProductUpdateSchema>;
