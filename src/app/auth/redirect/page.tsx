import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export default async function AuthRedirectPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=role&limit=1`,
    {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      cache: "no-store",
    }
  );
  const rows = res.ok ? await res.json() : [];
  const role = rows?.[0]?.role ?? "customer";

  redirect(role === "admin" ? "/admin" : "/account");
}
