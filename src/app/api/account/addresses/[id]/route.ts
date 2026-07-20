import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { editAddress, removeAddress, AddressNotOwnedError } from "@/lib/services/address-service";
import { addressUpdateSchema } from "@/lib/validation/address";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = addressUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid address details" }, { status: 400 });
  }

  try {
    await editAddress(user.id, id, parsed.data);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AddressNotOwnedError) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update address" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    await removeAddress(user.id, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AddressNotOwnedError) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete address" }, { status: 500 });
  }
}
