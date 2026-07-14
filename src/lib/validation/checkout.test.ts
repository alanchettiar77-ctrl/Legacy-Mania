import { checkoutSchema } from "@/lib/validation/checkout";

const validInput = {
  items: [{ productId: "550e8400-e29b-41d4-a716-446655440000", quantity: 5 }],
  name: "Arjun Sharma",
  email: "arjun@example.com",
  phone: "9876543210",
  address: "123 MG Road, Flat 4B",
  city: "Mumbai",
  state: "Maharashtra",
  pincode: "400001",
};

describe("checkoutSchema", () => {
  it("accepts a fully valid checkout payload", () => {
    expect(checkoutSchema.safeParse(validInput).success).toBe(true);
  });

  it("rejects an empty items array", () => {
    const result = checkoutSchema.safeParse({ ...validInput, items: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a non-Indian mobile number", () => {
    const result = checkoutSchema.safeParse({ ...validInput, phone: "12345" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid pincode", () => {
    const result = checkoutSchema.safeParse({ ...validInput, pincode: "1234" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive item quantity", () => {
    const result = checkoutSchema.safeParse({
      ...validInput,
      items: [{ productId: validInput.items[0].productId, quantity: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts an optional notes field", () => {
    const result = checkoutSchema.safeParse({ ...validInput, notes: "Leave at the door" });
    expect(result.success).toBe(true);
  });
});
