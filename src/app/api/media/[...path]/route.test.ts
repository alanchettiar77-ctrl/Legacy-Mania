/**
 * @jest-environment node
 */
// src/app/api/media/[...path]/route.test.ts

const mockRequireAdmin = jest.fn();
jest.mock("@/lib/supabase/admin-auth", () => ({
  requireAdmin: () => mockRequireAdmin(),
}));

const mockDeleteMedia = jest.fn();
jest.mock("@/lib/services/media-service", () => {
  const actual = jest.requireActual("@/lib/services/media-service");
  return { ...actual, deleteMedia: (...args: unknown[]) => mockDeleteMedia(...args) };
});

import { NextRequest, NextResponse } from "next/server";
import { DELETE } from "@/app/api/media/[...path]/route";

function makeRequest(path: string[]) {
  const req = new NextRequest(`http://localhost/api/media/${path.join("/")}`, { method: "DELETE" });
  return { req, params: Promise.resolve({ path }) };
}

describe("DELETE /api/media/:path", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns the requireAdmin response when not authorized", async () => {
    const forbidden = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    mockRequireAdmin.mockResolvedValue({ ok: false, response: forbidden });

    const { req, params } = makeRequest(["banners", "x.png"]);
    const response = await DELETE(req, { params });

    expect(response.status).toBe(403);
  });

  it("returns 400 for an invalid namespace segment", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });

    const { req, params } = makeRequest(["not-a-namespace", "x.png"]);
    const response = await DELETE(req, { params });

    expect(response.status).toBe(400);
  });

  it("returns 400 when there is no filename segment", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });

    const { req, params } = makeRequest(["banners"]);
    const response = await DELETE(req, { params });

    expect(response.status).toBe(400);
  });

  it("deletes the file and returns success", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockDeleteMedia.mockResolvedValue(undefined);

    const { req, params } = makeRequest(["banners", "x.png"]);
    const response = await DELETE(req, { params });
    const body = await response.json();

    expect(mockDeleteMedia).toHaveBeenCalledWith("banners/x.png", "banners");
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
