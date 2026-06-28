import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

async function getCallerRole(userId: string): Promise<string | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=role&limit=1`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }, cache: "no-store" }
  );
  const rows = res.ok ? await res.json() : [];
  return rows?.[0]?.role ?? null;
}

// GET /api/admin/admins — list all admins
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (await getCallerRole(user.id) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?role=eq.admin&select=id,email,full_name,created_at&order=created_at.asc`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }, cache: "no-store" }
  );
  const admins = res.ok ? await res.json() : [];
  return NextResponse.json(admins);
}

// POST /api/admin/admins — promote a user to admin by email
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (await getCallerRole(user.id) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

  // Find user by email
  const findRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id,email,full_name,role&limit=1`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }, cache: "no-store" }
  );
  const found = findRes.ok ? await findRes.json() : [];
  if (!found.length) return NextResponse.json({ error: "No account found with that email. They must register first." }, { status: 404 });
  if (found[0].role === "admin") return NextResponse.json({ error: "This user is already an admin." }, { status: 409 });

  const updateRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${found[0].id}`,
    {
      method: "PATCH",
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ role: "admin" }),
    }
  );
  const updated = updateRes.ok ? await updateRes.json() : null;
  return NextResponse.json(updated?.[0] ?? found[0]);
}

// DELETE /api/admin/admins — demote an admin back to customer
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (await getCallerRole(user.id) !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  if (id === user.id) return NextResponse.json({ error: "You cannot remove your own admin access." }, { status: 400 });

  // Check there will still be at least one admin left
  const countRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?role=eq.admin&select=id`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }, cache: "no-store" }
  );
  const allAdmins = countRes.ok ? await countRes.json() : [];
  if (allAdmins.length <= 1) return NextResponse.json({ error: "Cannot remove the last admin." }, { status: 400 });

  await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${id}`,
    {
      method: "PATCH",
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ role: "customer" }),
    }
  );
  return NextResponse.json({ success: true });
}
