import { z } from "zod";

// Empty string = clear the slot (fall back to built-in text logo / defaults).
const assetUrl = z
  .string()
  .max(500)
  .refine(
    (v) => v === "" || v.startsWith("/") || /^https?:\/\/.+/.test(v),
    "Must be empty, a relative path, or an http(s) URL"
  );

export const BRANDING_SLOTS = [
  "logo_url",
  "hero_logo_url",
  "badge_logo_url",
  "favicon_url",
  "apple_touch_icon_url",
  "og_image_url",
  "twitter_card_url",
  "pwa_icon_url",
] as const;

export const brandingUpdateSchema = z
  .object({
    logo_url: assetUrl,
    logo_hidden: z.boolean(),
    hero_logo_url: assetUrl,
    badge_logo_url: assetUrl,
    favicon_url: assetUrl,
    apple_touch_icon_url: assetUrl,
    og_image_url: assetUrl,
    twitter_card_url: assetUrl,
    pwa_icon_url: assetUrl,
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, "No fields to update");

export const categoryAppearanceSchema = z
  .object({
    backgroundColor: z.string().max(50),
    gradient: z.string().max(200),
    borderColor: z.string().max(50),
    accentColor: z.string().max(50),
    hoverColor: z.string().max(50),
    textColor: z.string().max(50),
    borderRadius: z.enum(["none", "sm", "md", "lg", "xl", "2xl", "full"]),
    shadow: z.enum(["none", "sm", "md", "lg"]),
    animationEnabled: z.boolean(),
    badge: z.string().max(20),
  })
  .partial();

export const categoryBrandingSchema = z
  .object({
    icon_url: assetUrl.nullable(),
    appearance: categoryAppearanceSchema,
    is_featured: z.boolean(),
    show_on_homepage: z.boolean(),
    is_active: z.boolean(),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, "No fields to update");

export const categoryOrderSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "ids required"),
});

export type BrandingUpdateInput = z.infer<typeof brandingUpdateSchema>;
export type CategoryBrandingInput = z.infer<typeof categoryBrandingSchema>;
export type CategoryAppearance = z.infer<typeof categoryAppearanceSchema>;
