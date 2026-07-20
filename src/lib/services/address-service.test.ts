const mockListAddressesForUser = jest.fn();
const mockGetAddressById = jest.fn();
const mockInsertAddress = jest.fn();
const mockUpdateAddress = jest.fn();
const mockDeleteAddress = jest.fn();
const mockUnsetDefaultForUser = jest.fn();
jest.mock("@/lib/repositories/address-repository", () => ({
  listAddressesForUser: (...args: unknown[]) => mockListAddressesForUser(...args),
  getAddressById: (...args: unknown[]) => mockGetAddressById(...args),
  insertAddress: (...args: unknown[]) => mockInsertAddress(...args),
  updateAddress: (...args: unknown[]) => mockUpdateAddress(...args),
  deleteAddress: (...args: unknown[]) => mockDeleteAddress(...args),
  unsetDefaultForUser: (...args: unknown[]) => mockUnsetDefaultForUser(...args),
}));

import {
  listAddresses,
  createAddress,
  editAddress,
  removeAddress,
  setDefaultAddress,
  AddressNotOwnedError,
} from "./address-service";

afterEach(() => jest.clearAllMocks());

const sampleInput = {
  label: "Home",
  name: "Arjun",
  phone: "9876543210",
  street: "123 MG Road",
  city: "Mumbai",
  state: "Maharashtra",
  pincode: "400001",
  is_default: false,
};

describe("listAddresses", () => {
  it("delegates to the repository for the given user", async () => {
    mockListAddressesForUser.mockResolvedValue([{ id: "a1" }]);
    const result = await listAddresses("user-1");
    expect(mockListAddressesForUser).toHaveBeenCalledWith("user-1");
    expect(result).toEqual([{ id: "a1" }]);
  });
});

describe("createAddress", () => {
  it("does not unset other defaults when is_default is false", async () => {
    mockInsertAddress.mockResolvedValue({ id: "a1" });
    await createAddress("user-1", sampleInput);
    expect(mockUnsetDefaultForUser).not.toHaveBeenCalled();
    expect(mockInsertAddress).toHaveBeenCalledWith("user-1", sampleInput);
  });

  it("unsets other defaults first when is_default is true", async () => {
    mockInsertAddress.mockResolvedValue({ id: "a1" });
    await createAddress("user-1", { ...sampleInput, is_default: true });
    expect(mockUnsetDefaultForUser).toHaveBeenCalledWith("user-1");
  });
});

describe("editAddress", () => {
  it("throws AddressNotOwnedError when the address belongs to a different user", async () => {
    mockGetAddressById.mockResolvedValue({ id: "a1", user_id: "someone-else" });
    await expect(editAddress("user-1", "a1", { city: "Delhi" })).rejects.toThrow(AddressNotOwnedError);
    expect(mockUpdateAddress).not.toHaveBeenCalled();
  });

  it("throws AddressNotOwnedError when the address does not exist", async () => {
    mockGetAddressById.mockResolvedValue(null);
    await expect(editAddress("user-1", "a1", { city: "Delhi" })).rejects.toThrow(AddressNotOwnedError);
  });

  it("updates when the caller owns the address", async () => {
    mockGetAddressById.mockResolvedValue({ id: "a1", user_id: "user-1" });
    await editAddress("user-1", "a1", { city: "Delhi" });
    expect(mockUpdateAddress).toHaveBeenCalledWith("a1", { city: "Delhi" });
  });

  it("unsets other defaults when setting is_default true on an owned address", async () => {
    mockGetAddressById.mockResolvedValue({ id: "a1", user_id: "user-1" });
    await editAddress("user-1", "a1", { is_default: true });
    expect(mockUnsetDefaultForUser).toHaveBeenCalledWith("user-1");
  });
});

describe("removeAddress", () => {
  it("throws AddressNotOwnedError for a non-owned address", async () => {
    mockGetAddressById.mockResolvedValue({ id: "a1", user_id: "someone-else" });
    await expect(removeAddress("user-1", "a1")).rejects.toThrow(AddressNotOwnedError);
    expect(mockDeleteAddress).not.toHaveBeenCalled();
  });

  it("deletes when the caller owns the address", async () => {
    mockGetAddressById.mockResolvedValue({ id: "a1", user_id: "user-1" });
    await removeAddress("user-1", "a1");
    expect(mockDeleteAddress).toHaveBeenCalledWith("a1");
  });
});

describe("setDefaultAddress", () => {
  it("throws AddressNotOwnedError for a non-owned address", async () => {
    mockGetAddressById.mockResolvedValue({ id: "a1", user_id: "someone-else" });
    await expect(setDefaultAddress("user-1", "a1")).rejects.toThrow(AddressNotOwnedError);
    expect(mockUnsetDefaultForUser).not.toHaveBeenCalled();
  });

  it("unsets others then sets this one as default when owned", async () => {
    mockGetAddressById.mockResolvedValue({ id: "a1", user_id: "user-1" });
    await setDefaultAddress("user-1", "a1");
    expect(mockUnsetDefaultForUser).toHaveBeenCalledWith("user-1");
    expect(mockUpdateAddress).toHaveBeenCalledWith("a1", { is_default: true });
  });
});
