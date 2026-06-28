import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ role: null }, { status: 401 });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  const res = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}&select=role&limit=1`,
    {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      cache: "no-store",
    }
  );

  const rows = res.ok ? await res.json() : [];
  const role = rows?.[0]?.role ?? "customer";

  return NextResponse.json({ role });
}
