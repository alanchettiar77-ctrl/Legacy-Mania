import { z } from "zod";

export const productSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z.string().min(2).max(200),
  description: z.string().nullable().default(null),
  price: z.coerce.number().min(1),
  compare_price: z.coerce.number().nullable().default(null),
  images: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  category_id: z.string().nullable().default(null),
  series: z.string().nullable().default(null),
  saga: z.string().nullable().default(null),
  collection: z.string().nullable().default(null),
  stock_quantity: z.coerce.number().min(0),
  sku: z.string().nullable().default(null),
  is_active: z.boolean(),
  is_featured: z.boolean(),
  is_new: z.boolean(),
  meta_title: z.string().nullable().default(null),
  meta_description: z.string().nullable().default(null),
});

export const productUpdateSchema = productSchema.partial();

export type ProductInput = z.infer<typeof productSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
