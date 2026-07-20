/**
 * @jest-environment node
 */
const mockRequireAdmin = jest.fn();
jest.mock("@/lib/supabase/admin-auth", () => ({
  requireAdmin: () => mockRequireAdmin(),
}));

const mockSaveSettings = jest.fn();
jest.mock("@/lib/services/settings-service", () => ({
  saveSettings: (...args: unknown[]) => mockSaveSettings(...args),
}));

import { NextRequest, NextResponse } from "next/server";
import { PATCH } from "@/app/api/admin/settings/route";

afterEach(() => jest.clearAllMocks());

function req(body: unknown) {
  return new NextRequest("http://localhost/api/admin/settings", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/admin/settings", () => {
  it("passes through requireAdmin's rejection", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) });
    const response = await PATCH(req({ upi_id: "shop@upi" }));
    expect(response.status).toBe(403);
    expect(mockSaveSettings).not.toHaveBeenCalled();
  });

  it("400 on a non-string-map payload", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    const response = await PATCH(req({ upi_id: 123 }));
    expect(response.status).toBe(400);
    expect(mockSaveSettings).not.toHaveBeenCalled();
  });

  it("200 and saves the settings map", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    const response = await PATCH(req({ upi_id: "shop@upi", upi_name: "Legacy Mania" }));
    expect(response.status).toBe(200);
    expect(mockSaveSettings).toHaveBeenCalledWith({ upi_id: "shop@upi", upi_name: "Legacy Mania" });
  });
});
