const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export interface AddressRow {
  id: string;
  user_id: string;
  label: string;
  name: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface AddressInput {
  label: string;
  name: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
}

const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

export async function listAddressesForUser(userId: string): Promise<AddressRow[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/addresses?user_id=eq.${userId}&select=*&order=is_default.desc,created_at.asc`,
    { headers: HEADERS, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Failed to list addresses: ${res.status}`);
  return res.json();
}

export async function getAddressById(id: string): Promise<AddressRow | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/addresses?id=eq.${id}&select=*&limit=1`, {
    headers: HEADERS,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch address: ${res.status}`);
  const rows = await res.json();
  return rows[0] ?? null;
}

export async function insertAddress(userId: string, input: AddressInput): Promise<AddressRow> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/addresses`, {
    method: "POST",
    headers: { ...HEADERS, Prefer: "return=representation" },
    body: JSON.stringify({ ...input, user_id: userId }),
  });
  if (!res.ok) throw new Error(`Failed to create address: ${res.status}`);
  const rows = await res.json();
  return rows[0];
}

export async function updateAddress(id: string, input: Partial<AddressInput>): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/addresses?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...HEADERS, Prefer: "return=minimal" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to update address: ${res.status}`);
}

export async function deleteAddress(id: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/addresses?id=eq.${id}`, {
    method: "DELETE",
    headers: HEADERS,
  });
  if (!res.ok) throw new Error(`Failed to delete address: ${res.status}`);
}

export async function unsetDefaultForUser(userId: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/addresses?user_id=eq.${userId}`, {
    method: "PATCH",
    headers: { ...HEADERS, Prefer: "return=minimal" },
    body: JSON.stringify({ is_default: false }),
  });
  if (!res.ok) throw new Error(`Failed to unset default addresses: ${res.status}`);
}
