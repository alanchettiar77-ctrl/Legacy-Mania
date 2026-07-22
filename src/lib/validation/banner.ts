import { z } from "zod";

export const BANNER_TYPES = ["image", "video", "promotional", "seasonal"] as const;

const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date");

// Relative path ("/catalog/pokemon") or absolute http(s) URL — same rule as notifications' cta_url.
const ctaUrl = z
  .string()
  .max(500)
  .refine(
    (v) => v.startsWith("/") || /^https?:\/\/.+/.test(v),
    "CTA link must be a relative path or an http(s) URL"
  );

const baseFields = {
  title: z.string().min(1, "Title is required").max(120),
  subtitle: z.string().max(200).nullish(),
  cta_text: z.string().max(40).nullish(),
  cta_url: ctaUrl.nullish(),
  category_id: z.string().uuid().nullish(),
  desktop_image_url: z.string().min(1, "Desktop image is required"),
  mobile_image_url: z.string().nullish(),
  alt_text: z.string().min(1, "Alt text is required").max(200),
  aria_label: z.string().max(200).nullish(),
  image_title: z.string().max(200).nullish(),
  overlay_enabled: z.boolean().default(false),
  overlay_opacity: z.number().min(0).max(1).default(0.4),
  banner_type: z.enum(BANNER_TYPES).default("image"),
  video_url: z.string().max(500).nullish(),
  display_order: z.number().int().min(0).optional(),
  is_active: z.boolean().default(true),
  start_date: isoDate.nullish(),
  end_date: isoDate.nullish(),
  // Future-ready SEO fields — stored and admin-editable, never rendered on the frontend yet.
  seo_meta_title: z.string().max(200).nullish(),
  seo_meta_description: z.string().max(300).nullish(),
  seo_keywords: z.string().max(300).nullish(),
  og_title: z.string().max(200).nullish(),
  og_description: z.string().max(300).nullish(),
  og_image_url: z.string().max(500).nullish(),
  canonical_url: z.string().max(500).nullish(),
  schema_type: z.string().max(60).nullish(),
};

function scheduleValid(data: { start_date?: string | null; end_date?: string | null }) {
  if (!data.start_date || !data.end_date) return true;
  return Date.parse(data.end_date) > Date.parse(data.start_date);
}

export const bannerCreateSchema = z
  .object(baseFields)
  .refine(scheduleValid, { message: "End date must be after start date", path: ["end_date"] });

export const bannerUpdateSchema = z
  .object(baseFields)
  .partial()
  .refine((d) => Object.keys(d).length > 0, "No fields to update")
  .refine(scheduleValid, { message: "End date must be after start date", path: ["end_date"] });

export const bannerReorderSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "ids required"),
});

export type BannerCreateInput = z.infer<typeof bannerCreateSchema>;
export type BannerUpdateInput = z.infer<typeof bannerUpdateSchema>;
