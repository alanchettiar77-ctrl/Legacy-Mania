import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCallerRole } from "@/lib/supabase/admin-auth";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ role: null }, { status: 401 });

  const role = (await getCallerRole(user.id)) ?? "customer";

  return NextResponse.json({ role });
}
