/**
 * @jest-environment node
 */
// src/app/api/checkout/route.test.ts

const mockCheckRateLimit = jest.fn();
jest.mock("@/lib/rate-limit", () => {
  const actual = jest.requireActual("@/lib/rate-limit");
  return { ...actual, checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args) };
});

const mockCreateOrder = jest.fn();
jest.mock("@/lib/services/checkout-service", () => ({
  createOrder: (...args: unknown[]) => mockCreateOrder(...args),
}));

const mockGetUser = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/checkout/route";

const validBody = {
  items: [{ productId: "550e8400-e29b-41d4-a716-446655440000", quantity: 5 }],
  name: "Arjun Sharma",
  email: "arjun@example.com",
  phone: "9876543210",
  address: "123 MG Road, Flat 4B",
  city: "Mumbai",
  state: "Maharashtra",
  pincode: "400001",
};

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/checkout", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/checkout", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns 429 when rate-limited", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 1000 });

    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(429);
  });

  it("returns 400 when the body fails validation", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 });

    const response = await POST(makeRequest({ ...validBody, phone: "invalid" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("returns 400 with the service's error message when createOrder rejects", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 });
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockCreateOrder.mockRejectedValue(new Error("Insufficient stock for Charizard Holo"));

    const response = await POST(makeRequest(validBody));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Insufficient stock for Charizard Holo");
  });

  it("creates the order for a guest and returns 201", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 });
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockCreateOrder.mockResolvedValue({ orderId: "order-1", orderNumber: "LM-123", total: 500 });

    const response = await POST(makeRequest(validBody));
    const body = await response.json();

    expect(mockCreateOrder).toHaveBeenCalledWith(expect.objectContaining({ name: "Arjun Sharma" }), null);
    expect(response.status).toBe(201);
    expect(body.orderNumber).toBe("LM-123");
  });

  it("passes the signed-in user's id when a session exists", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 });
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockCreateOrder.mockResolvedValue({ orderId: "order-1", orderNumber: "LM-123", total: 500 });

    await POST(makeRequest(validBody));

    expect(mockCreateOrder).toHaveBeenCalledWith(expect.anything(), "user-1");
  });
});
