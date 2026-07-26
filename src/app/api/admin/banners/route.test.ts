/**
 * @jest-environment node
 */
const mockCheckRateLimit = jest.fn();
jest.mock("@/lib/rate-limit", () => {
  const actual = jest.requireActual("@/lib/rate-limit");
  return { ...actual, checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args) };
});

const mockRequireAdmin = jest.fn();
jest.mock("@/lib/supabase/admin-auth", () => ({
  requireAdmin: () => mockRequireAdmin(),
}));

const mockRecordAuditLog = jest.fn();
jest.mock("@/lib/services/audit-service", () => ({
  recordAuditLog: (...args: unknown[]) => mockRecordAuditLog(...args),
}));

const mockListAllBanners = jest.fn();
const mockCreateBanner = jest.fn();
jest.mock("@/lib/services/banner-service", () => ({
  listAllBanners: (...args: unknown[]) => mockListAllBanners(...args),
  createBanner: (...args: unknown[]) => mockCreateBanner(...args),
}));

import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/admin/banners/route";

const validBody = {
  title: "Summer Sale",
  desktop_image_url: "https://example.com/desktop.webp",
  alt_text: "Summer sale banner",
};

function makeGet() {
  return new NextRequest("http://localhost/api/admin/banners");
}
function makePost(body: unknown) {
  return new NextRequest("http://localhost/api/admin/banners", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const adminOk = { ok: true, userId: "admin-1" };

describe("GET /api/admin/banners", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns 429 when rate-limited", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() });
    const response = await GET(makeGet());
    expect(response.status).toBe(429);
  });

  it("returns 401-shaped response when not admin", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() });
    const fakeResponse = new Response(null, { status: 401 });
    mockRequireAdmin.mockResolvedValue({ ok: false, response: fakeResponse });
    const response = await GET(makeGet());
    expect(response.status).toBe(401);
  });

  it("returns the banner list for an admin", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() });
    mockRequireAdmin.mockResolvedValue(adminOk);
    mockListAllBanners.mockResolvedValue([{ id: "b1" }]);

    const response = await GET(makeGet());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([{ id: "b1" }]);
  });
});

describe("POST /api/admin/banners", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns 400 when the body fails validation", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() });
    mockRequireAdmin.mockResolvedValue(adminOk);

    const response = await POST(makePost({ title: "" }));
    expect(response.status).toBe(400);
  });

  it("creates a banner and records an audit log entry", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() });
    mockRequireAdmin.mockResolvedValue(adminOk);
    mockCreateBanner.mockResolvedValue({ id: "b1", ...validBody });

    const response = await POST(makePost(validBody));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.id).toBe("b1");
    expect(mockRecordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "admin-1", action: "banner.create", recordId: "b1" })
    );
  });
});
