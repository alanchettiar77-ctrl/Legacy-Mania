import { z } from "zod";

export const NOTIFICATION_TYPES = [
  "sale",
  "limited_stock",
  "new_arrival",
  "trending",
  "recently_sold",
  "new_collection",
  "offer",
  "flash_sale",
  "announcement",
  "shipping_update",
  "event",
  "countdown",
  "custom",
] as const;

export const NOTIFICATION_DEVICES = ["desktop", "mobile", "both"] as const;

const isoDate = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date");

// Relative path ("/catalog/pokemon") or absolute http(s) URL.
const ctaUrl = z
  .string()
  .max(500)
  .refine(
    (v) => v.startsWith("/") || /^https?:\/\/.+/.test(v),
    "CTA link must be a relative path or an http(s) URL"
  );

const baseFields = {
  title: z.string().min(1, "Title is required").max(120),
  message: z.string().min(1, "Message is required").max(300),
  short_message: z.string().max(120).nullish(),
  type: z.enum(NOTIFICATION_TYPES).default("announcement"),
  cta_text: z.string().max(40).nullish(),
  cta_url: ctaUrl.nullish(),
  priority: z.number().int().min(0).max(100).default(0),
  display_order: z.number().int().min(0).optional(),
  is_active: z.boolean().default(true),
  theme: z.string().max(40).default("primary"),
  icon: z.string().max(40).nullish(),
  animation: z.string().max(40).default("marquee"),
  background_color: z.string().max(30).nullish(),
  text_color: z.string().max(30).nullish(),
  start_date: isoDate.nullish(),
  end_date: isoDate.nullish(),
  device: z.enum(NOTIFICATION_DEVICES).default("both"),
  target_audience: z.record(z.string(), z.unknown()).nullish(),
  country: z.string().max(2).nullish(),
};

function scheduleValid(data: { start_date?: string | null; end_date?: string | null }) {
  if (!data.start_date || !data.end_date) return true;
  return Date.parse(data.end_date) > Date.parse(data.start_date);
}

export const notificationCreateSchema = z
  .object(baseFields)
  .refine(scheduleValid, { message: "End date must be after start date", path: ["end_date"] });

export const notificationUpdateSchema = z
  .object(baseFields)
  .partial()
  .refine((d) => Object.keys(d).length > 0, "No fields to update")
  .refine(scheduleValid, { message: "End date must be after start date", path: ["end_date"] });

export const reorderSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "ids required"),
});

export const bulkSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "ids required"),
  action: z.enum(["activate", "deactivate", "delete"]),
});

export const displaySettingsSchema = z
  .object({
    marqueeSpeedSeconds: z.number().min(5).max(120),
    direction: z.enum(["left", "right"]),
    pauseOnHover: z.boolean(),
    loop: z.boolean(),
    backgroundColor: z.string().max(30),
    textColor: z.string().max(30),
    fontSize: z.enum(["xs", "sm", "base", "lg"]),
    fontWeight: z.enum(["normal", "medium", "semibold", "bold"]),
    paddingY: z.string().max(10),
    borderRadius: z.enum(["none", "sm", "md", "lg", "full"]),
    showOnMobile: z.boolean(),
    showOnDesktop: z.boolean(),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, "No fields to update");

export type NotificationCreateInput = z.infer<typeof notificationCreateSchema>;
export type NotificationUpdateInput = z.infer<typeof notificationUpdateSchema>;
export type DisplaySettingsInput = z.infer<typeof displaySettingsSchema>;
