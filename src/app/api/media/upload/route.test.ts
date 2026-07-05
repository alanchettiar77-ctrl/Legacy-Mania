/**
 * @jest-environment node
 */
// src/app/api/media/upload/route.test.ts

const mockRequireAdmin = jest.fn();
jest.mock("@/lib/supabase/admin-auth", () => ({
  requireAdmin: () => mockRequireAdmin(),
}));

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

import { NextRequest } from "next/server";
import { POST } from "@/app/api/media/upload/route";

function makeUploadRequest(fileContent: string, namespace: string | null, fileName = "test.png") {
  const formData = new FormData();
  if (fileContent) {
    formData.append("file", new Blob([fileContent], { type: "image/png" }), fileName);
  }
  if (namespace !== null) {
    formData.append("namespace", namespace);
  }
  return new NextRequest("http://localhost/api/media/upload", { method: "POST", body: formData });
}

describe("POST /api/media/upload", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns the requireAdmin response when not authorized", async () => {
    const { NextResponse } = await import("next/server");
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await POST(makeUploadRequest("data", "banners"));

    expect(response.status).toBe(401);
  });

  it("returns 429 when rate-limited", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 1000 });

    const response = await POST(makeUploadRequest("data", "banners"));

    expect(response.status).toBe(429);
  });

  it("returns 400 when no file is provided", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 });

    const response = await POST(makeUploadRequest("", null));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/file is required/i);
  });

  it("returns 400 for an invalid namespace", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 });

    const response = await POST(makeUploadRequest("data", "not-a-real-namespace"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/namespace/i);
  });

  it("returns 400 when validation fails", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 });
    mockValidateFile.mockResolvedValue({ valid: false, error: "Unsupported file type" });

    const response = await POST(makeUploadRequest("data", "banners"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Unsupported file type");
  });

  it("uploads and returns 201 with the result when valid", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 });
    mockValidateFile.mockResolvedValue({ valid: true, dimensionWarning: undefined });
    mockUploadMedia.mockResolvedValue({ path: "banners/x.png", publicUrl: "https://example.com/x.png" });

    const response = await POST(makeUploadRequest("data", "banners"));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.path).toBe("banners/x.png");
    expect(body.publicUrl).toBe("https://example.com/x.png");
    expect(body.dimensionWarning).toBeNull();
  });

  it("returns 500 with a structured error when uploadMedia throws", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 });
    mockValidateFile.mockResolvedValue({ valid: true, dimensionWarning: undefined });
    mockUploadMedia.mockRejectedValue(new Error("Storage bucket unavailable"));

    const response = await POST(makeUploadRequest("data", "banners"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Storage bucket unavailable" });
  });
});
