import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listAddresses, createAddress } from "@/lib/services/address-service";
import { addressSchema } from "@/lib/validation/address";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const addresses = await listAddresses(user.id);
  return NextResponse.json(addresses);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = addressSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid address details" }, { status: 400 });
  }

  const address = await createAddress(user.id, parsed.data);
  return NextResponse.json(address, { status: 201 });
}
