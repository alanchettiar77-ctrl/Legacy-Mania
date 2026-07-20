/**
 * @jest-environment node
 */
const mockGetUser = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}));

const mockEditAddress = jest.fn();
const mockRemoveAddress = jest.fn();
jest.mock("@/lib/services/address-service", () => {
  const actual = jest.requireActual("@/lib/services/address-service");
  return {
    editAddress: (...args: unknown[]) => mockEditAddress(...args),
    removeAddress: (...args: unknown[]) => mockRemoveAddress(...args),
    AddressNotOwnedError: actual.AddressNotOwnedError,
  };
});

import { NextRequest } from "next/server";
import { PATCH, DELETE } from "@/app/api/account/addresses/[id]/route";
import { AddressNotOwnedError } from "@/lib/services/address-service";

afterEach(() => jest.clearAllMocks());

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/account/addresses/[id]", () => {
  function req(body: unknown) {
    return new NextRequest("http://localhost/api/account/addresses/a1", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  it("401 when not logged in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const response = await PATCH(req({ city: "Delhi" }), params("a1"));
    expect(response.status).toBe(401);
    expect(mockEditAddress).not.toHaveBeenCalled();
  });

  it("404 when the address isn't owned by the caller", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockEditAddress.mockRejectedValue(new AddressNotOwnedError());
    const response = await PATCH(req({ city: "Delhi" }), params("a1"));
    expect(response.status).toBe(404);
  });

  it("200 and updates when owned", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockEditAddress.mockResolvedValue(undefined);
    const response = await PATCH(req({ city: "Delhi" }), params("a1"));
    expect(response.status).toBe(200);
    expect(mockEditAddress).toHaveBeenCalledWith("user-1", "a1", { city: "Delhi" });
  });
});

describe("DELETE /api/account/addresses/[id]", () => {
  const req = new NextRequest("http://localhost/api/account/addresses/a1", { method: "DELETE" });

  it("401 when not logged in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const response = await DELETE(req, params("a1"));
    expect(response.status).toBe(401);
    expect(mockRemoveAddress).not.toHaveBeenCalled();
  });

  it("404 when the address isn't owned by the caller", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockRemoveAddress.mockRejectedValue(new AddressNotOwnedError());
    const response = await DELETE(req, params("a1"));
    expect(response.status).toBe(404);
  });

  it("200 and deletes when owned", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockRemoveAddress.mockResolvedValue(undefined);
    const response = await DELETE(req, params("a1"));
    expect(response.status).toBe(200);
    expect(mockRemoveAddress).toHaveBeenCalledWith("user-1", "a1");
  });
});
