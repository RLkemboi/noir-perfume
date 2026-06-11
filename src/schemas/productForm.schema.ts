import { z } from 'zod';

export const productFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Slug must be URL-safe"),
  brand: z.string().min(1, "Brand is required"),
  description: z.string().min(10, "Description too short"),
  luxuryDescription: z.string().optional(),
  price: z.coerce.number().positive("Price must be > 0"),
  discountPrice: z.coerce.number().nonnegative().optional(),
  stockQuantity: z.coerce.number().int().nonnegative(),
  sku: z.string().min(1, "SKU is required"),
  category: z.string().min(1, "Category is required"),
  gender: z.enum(['masculine', 'feminine', 'unisex']),
  notes: z.object({
    top: z.array(z.string()),
    middle: z.array(z.string()),
    base: z.array(z.string()),
  }),
  tags: z.array(z.string()),
  sizes: z.array(z.string()),
  status: z.enum(['published', 'draft', 'archived']),
  visibility: z.enum(['public', 'hidden']),
  isFeatured: z.boolean(),
  isNewArrival: z.boolean(),
  isBestSeller: z.boolean(),
  images: z.array(z.object({
    id: z.string().optional(),
    url: z.string(),
    alt: z.string(),
    isPrimary: z.boolean(),
  })),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;
