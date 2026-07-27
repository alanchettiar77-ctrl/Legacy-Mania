import { z } from "zod";

export const COLOR_THEMES = ["sunrise", "ember", "citrus", "blossom", "ocean", "violet"] as const;
export const LINK_TYPES = ["category", "product", "collection", "search", "page", "custom_url"] as const;

// Relative path ("/catalog/pokemon") or absolute http(s) URL — same rule banners' cta_url uses.
const linkValue = z
  .string()
  .min(1, "Link value is required")
  .max(500)
  .refine(
    (v) => v.startsWith("/") || /^https?:\/\/.+/.test(v) || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v),
    "Link value must be a slug, a relative path, or an http(s) URL"
  );

const baseFields = {
  label: z.string().min(1, "Label is required").max(60),
  icon_emoji: z.string().min(1, "Icon is required").max(8),
  color_theme: z.enum(COLOR_THEMES).default("sunrise"),
  link_type: z.enum(LINK_TYPES).default("category"),
  link_value: linkValue,
  display_order: z.number().int().min(0).optional(),
  is_active: z.boolean().default(true),
};

export const heroTileCreateSchema = z.object(baseFields);

export const heroTileUpdateSchema = z
  .object(baseFields)
  .partial()
  .refine((d) => Object.keys(d).length > 0, "No fields to update");

export const heroTileReorderSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "ids required"),
});

export type HeroTileCreateInput = z.infer<typeof heroTileCreateSchema>;
export type HeroTileUpdateInput = z.infer<typeof heroTileUpdateSchema>;
