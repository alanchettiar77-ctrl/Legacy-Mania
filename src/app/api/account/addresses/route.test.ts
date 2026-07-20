/**
 * @jest-environment node
 */
const mockGetUser = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}));

const mockListAddresses = jest.fn();
const mockCreateAddress = jest.fn();
jest.mock("@/lib/services/address-service", () => ({
  listAddresses: (...args: unknown[]) => mockListAddresses(...args),
  createAddress: (...args: unknown[]) => mockCreateAddress(...args),
}));

import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/account/addresses/route";

afterEach(() => jest.clearAllMocks());

const validAddress = {
  label: "Home",
  name: "Arjun Sharma",
  phone: "9876543210",
  street: "123, MG Road",
  city: "Mumbai",
  state: "Maharashtra",
  pincode: "400001",
  is_default: false,
};

describe("GET /api/account/addresses", () => {
  it("401 when not logged in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    expect((await GET()).status).toBe(401);
    expect(mockListAddresses).not.toHaveBeenCalled();
  });

  it("lists addresses scoped to the caller", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockListAddresses.mockResolvedValue([{ id: "a1" }]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(mockListAddresses).toHaveBeenCalledWith("user-1");
  });
});

describe("POST /api/account/addresses", () => {
  function req(body: unknown) {
    return new NextRequest("http://localhost/api/account/addresses", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  it("401 when not logged in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    expect((await POST(req(validAddress))).status).toBe(401);
    expect(mockCreateAddress).not.toHaveBeenCalled();
  });

  it("400 on invalid input", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const response = await POST(req({ ...validAddress, pincode: "abc" }));
    expect(response.status).toBe(400);
    expect(mockCreateAddress).not.toHaveBeenCalled();
  });

  it("201 and creates the address scoped to the caller", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockCreateAddress.mockResolvedValue({ id: "a1", ...validAddress });
    const response = await POST(req(validAddress));
    expect(response.status).toBe(201);
    expect(mockCreateAddress).toHaveBeenCalledWith("user-1", validAddress);
  });
});
