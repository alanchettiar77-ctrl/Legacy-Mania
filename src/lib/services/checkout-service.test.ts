const mockCreateOrderViaRpc = jest.fn();

jest.mock("@/lib/repositories/checkout-repository", () => ({
  createOrderViaRpc: (...args: unknown[]) => mockCreateOrderViaRpc(...args),
}));

import { createOrder } from "@/lib/services/checkout-service";
import type { CheckoutInput } from "@/lib/validation/checkout";

const baseInput: CheckoutInput = {
  items: [{ productId: "550e8400-e29b-41d4-a716-446655440000", quantity: 5 }],
  name: "Arjun Sharma",
  email: "arjun@example.com",
  phone: "9876543210",
  address: "123 MG Road, Flat 4B",
  city: "Mumbai",
  state: "Maharashtra",
  pincode: "400001",
};

describe("createOrder", () => {
  afterEach(() => jest.clearAllMocks());

  it("rejects an order below the 5-card minimum before calling the repository", async () => {
    const input = { ...baseInput, items: [{ ...baseInput.items[0], quantity: 4 }] };

    await expect(createOrder(input, null)).rejects.toThrow(/minimum order quantity is 5/i);
    expect(mockCreateOrderViaRpc).not.toHaveBeenCalled();
  });

  it("sums quantities across multiple items to check the minimum", async () => {
    const input = {
      ...baseInput,
      items: [
        { productId: "550e8400-e29b-41d4-a716-446655440000", quantity: 2 },
        { productId: "660e8400-e29b-41d4-a716-446655440001", quantity: 3 },
      ],
    };
    mockCreateOrderViaRpc.mockResolvedValue({ id: "order-1", order_number: "LM-123", total: 500 });

    const result = await createOrder(input, null);

    expect(mockCreateOrderViaRpc).toHaveBeenCalled();
    expect(result.orderId).toBe("order-1");
  });

  it("passes guestEmail when there is no signed-in user", async () => {
    mockCreateOrderViaRpc.mockResolvedValue({ id: "order-1", order_number: "LM-123", total: 500 });

    await createOrder(baseInput, null);

    const [params] = mockCreateOrderViaRpc.mock.calls[0];
    expect(params.userId).toBeNull();
    expect(params.guestEmail).toBe("arjun@example.com");
  });

  it("passes userId and null guestEmail when a user is signed in", async () => {
    mockCreateOrderViaRpc.mockResolvedValue({ id: "order-1", order_number: "LM-123", total: 500 });

    await createOrder(baseInput, "user-1");

    const [params] = mockCreateOrderViaRpc.mock.calls[0];
    expect(params.userId).toBe("user-1");
    expect(params.guestEmail).toBeNull();
  });

  it("returns the order id, order number, and total from the RPC result", async () => {
    mockCreateOrderViaRpc.mockResolvedValue({ id: "order-1", order_number: "LM-999", total: 1234.5 });

    const result = await createOrder(baseInput, null);

    expect(result).toEqual({ orderId: "order-1", orderNumber: "LM-999", total: 1234.5 });
  });
});
