import { z } from "zod";

export const addressSchema = z.object({
  label: z.string().min(1).max(40),
  name: z.string().min(2).max(100),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/),
  street: z.string().min(5).max(200),
  city: z.string().min(2).max(100),
  state: z.string().min(2).max(100),
  pincode: z.string().trim().regex(/^\d{6}$/),
  is_default: z.boolean().default(false),
});

export const addressUpdateSchema = addressSchema.partial();

export type AddressInput = z.infer<typeof addressSchema>;
export type AddressUpdateInput = z.infer<typeof addressUpdateSchema>;
