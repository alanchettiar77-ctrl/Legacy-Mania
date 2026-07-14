/**
 * @jest-environment node
 */
// src/app/api/checkout/[orderId]/screenshot/route.test.ts

const mockCheckRateLimit = jest.fn();
jest.mock("@/lib/rate-limit", () => {
  const actual = jest.requireActual("@/lib/rate-limit");
  return { ...actual, checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args) };
});

const mockValidateFile = jest.fn();
const mockUploadMedia = jest.fn();
jest.mock("@/lib/services/media-service", () => {
  const actual = jest.requireActual("@/lib/services/media-service");
  return {
    ...actual,
    validateFile: (...args: unknown[]) => mockValidateFile(...args),
    uploadMedia: (...args: unknown[]) => mockUploadMedia(...args),
  };
});

const mockEq = jest.fn();
const mockUpdate = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn(() => ({ update: mockUpdate }));
jest.mock("@/lib/supabase/server", () => ({
  createAdminClient: async () => ({ from: mockFrom }),
}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/checkout/[orderId]/screenshot/route";

function makeRequest(fileContent: string | null) {
  const formData = new FormData();
  if (fileContent !== null) {
    formData.append("file", new Blob([fileContent], { type: "image/png" }), "screenshot.png");
  }
  const req = new NextRequest("http://localhost/api/checkout/order-1/screenshot", {
    method: "POST",
    body: formData,
  });
  return { req, params: Promise.resolve({ orderId: "order-1" }) };
}

describe("POST /api/checkout/:orderId/screenshot", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns 429 when rate-limited", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 1000 });

    const { req, params } = makeRequest("data");
    const response = await POST(req, { params });

    expect(response.status).toBe(429);
  });

  it("returns 400 when no file is provided", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 });

    const { req, params } = makeRequest(null);
    const response = await POST(req, { params });

    expect(response.status).toBe(400);
  });

  it("returns 400 when validation fails", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 });
    mockValidateFile.mockResolvedValue({ valid: false, error: "File exceeds the 2MB maximum size." });

    const { req, params } = makeRequest("data");
    const response = await POST(req, { params });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("File exceeds the 2MB maximum size.");
  });

  it("uploads via the payments namespace, updates the payment and order, and returns success", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 });
    mockValidateFile.mockResolvedValue({ valid: true });
    mockUploadMedia.mockResolvedValue({ path: "payments/order-1.png", publicUrl: null });
    mockEq.mockResolvedValue({ error: null });

    const { req, params } = makeRequest("data");
    const response = await POST(req, { params });
    const body = await response.json();

    expect(mockUploadMedia).toHaveBeenCalledWith(expect.any(Buffer), "image/png", "payments");
    expect(mockFrom).toHaveBeenCalledWith("payments");
    expect(mockFrom).toHaveBeenCalledWith("orders");
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("returns 500 when the database update fails", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 });
    mockValidateFile.mockResolvedValue({ valid: true });
    mockUploadMedia.mockResolvedValue({ path: "payments/order-1.png", publicUrl: null });
    mockEq.mockResolvedValue({ error: { message: "db down" } });

    const { req, params } = makeRequest("data");
    const response = await POST(req, { params });

    expect(response.status).toBe(500);
  });
});
