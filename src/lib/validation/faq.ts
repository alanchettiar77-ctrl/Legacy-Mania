import { z } from "zod";

export const faqCreateSchema = z.object({
  question: z.string().trim().min(1, "Question is required").max(500, "Question is too long"),
  answer: z.string().trim().min(1, "Answer is required").max(5000, "Answer is too long"),
  display_order: z.number().int().min(0).optional(),
});

export const faqUpdateSchema = z.object({
  question: z.string().trim().min(1, "Question is required").max(500, "Question is too long").optional(),
  answer: z.string().trim().min(1, "Answer is required").max(5000, "Answer is too long").optional(),
  display_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

export type FaqCreateInput = z.infer<typeof faqCreateSchema>;
export type FaqUpdateInput = z.infer<typeof faqUpdateSchema>;
