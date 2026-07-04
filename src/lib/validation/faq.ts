import { z } from "zod";

// Strips Unicode category-Cc control characters (0x00-0x1F, 0x7F), excluding newline (\n,
// 0x0A) and tab (\t, 0x09) since FAQ answers may legitimately contain line breaks.
const stripControlChars = (value: string) =>
  value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

export const faqCreateSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, "Question is required")
    .max(500, "Question is too long")
    .transform(stripControlChars),
  answer: z
    .string()
    .trim()
    .min(1, "Answer is required")
    .max(5000, "Answer is too long")
    .transform(stripControlChars),
  display_order: z.number().int().min(0).optional(),
});

export const faqUpdateSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, "Question is required")
    .max(500, "Question is too long")
    .transform(stripControlChars)
    .optional(),
  answer: z
    .string()
    .trim()
    .min(1, "Answer is required")
    .max(5000, "Answer is too long")
    .transform(stripControlChars)
    .optional(),
  display_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

export type FaqCreateInput = z.infer<typeof faqCreateSchema>;
export type FaqUpdateInput = z.infer<typeof faqUpdateSchema>;
