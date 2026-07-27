import { z } from "zod";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const categorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(slugPattern, "Slug must be lowercase letters, numbers, and hyphens only"),
  description: z.string().nullable().optional(),
  parent_id: z.string().uuid().nullable().optional(),
  display_order: z.coerce.number().default(0),
  is_active: z.boolean().default(true),
  meta_title: z.string().max(200).nullable().optional(),
  meta_description: z.string().max(500).nullable().optional(),
});

export const categoryUpdateSchema = categorySchema.partial();

export const categoryDeleteSchema = z
  .object({
    reassignChildrenTo: z.string().uuid(),
    reassignProductsTo: z.string().uuid(),
  })
  .partial();

export const categoryReassignProductsSchema = z.object({
  toCategoryId: z.string().uuid(),
});

export type CategoryInput = z.infer<typeof categorySchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
export type CategoryDeleteInput = z.infer<typeof categoryDeleteSchema>;
export type CategoryReassignProductsInput = z.infer<typeof categoryReassignProductsSchema>;
