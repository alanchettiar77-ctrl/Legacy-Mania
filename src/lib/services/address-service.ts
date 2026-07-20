import {
  listAddressesForUser,
  getAddressById,
  insertAddress,
  updateAddress,
  deleteAddress,
  unsetDefaultForUser,
  type AddressRow,
  type AddressInput,
} from "@/lib/repositories/address-repository";

export class AddressNotOwnedError extends Error {
  constructor() {
    super("Address not found");
  }
}

export async function listAddresses(userId: string): Promise<AddressRow[]> {
  return listAddressesForUser(userId);
}

export async function createAddress(userId: string, input: AddressInput): Promise<AddressRow> {
  if (input.is_default) {
    await unsetDefaultForUser(userId);
  }
  return insertAddress(userId, input);
}

async function assertOwnership(userId: string, addressId: string): Promise<void> {
  const existing = await getAddressById(addressId);
  if (!existing || existing.user_id !== userId) {
    throw new AddressNotOwnedError();
  }
}

export async function editAddress(
  userId: string,
  addressId: string,
  input: Partial<AddressInput>
): Promise<void> {
  await assertOwnership(userId, addressId);
  if (input.is_default) {
    await unsetDefaultForUser(userId);
  }
  await updateAddress(addressId, input);
}

export async function removeAddress(userId: string, addressId: string): Promise<void> {
  await assertOwnership(userId, addressId);
  await deleteAddress(addressId);
}

export async function setDefaultAddress(userId: string, addressId: string): Promise<void> {
  await assertOwnership(userId, addressId);
  await unsetDefaultForUser(userId);
  await updateAddress(addressId, { is_default: true });
}
