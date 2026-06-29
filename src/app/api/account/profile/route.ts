import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const full_name = typeof body.full_name === "string" ? body.full_name.trim() : null;
  const phone = typeof body.phone === "string" ? body.phone.trim() || null : null;

  if (!full_name || full_name.length < 2) {
    return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
  }

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}`,
    {
      method: "PATCH",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ full_name, phone }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    console.error("Profile update error:", text);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
