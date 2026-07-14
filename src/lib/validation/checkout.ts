import { z } from "zod";

export const checkoutItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

export const checkoutSchema = z.object({
  items: z.array(checkoutItemSchema).min(1, "At least one item is required"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian mobile number"),
  address: z.string().min(10, "Please enter a complete address"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(1, "State is required"),
  pincode: z.string().regex(/^\d{6}$/, "Invalid pincode"),
  notes: z.string().optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
