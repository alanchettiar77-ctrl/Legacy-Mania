import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSafeRedirect } from "@/lib/utils";

export default async function AuthRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  const profileRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}&select=role&limit=1`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      cache: "no-store",
    }
  );

  const profiles = profileRes.ok ? await profileRes.json() : [];
  const role = profiles?.[0]?.role;

  const params = await searchParams;

  if (role === "admin") {
    redirect("/admin");
  } else {
    const target = params.redirect ? decodeURIComponent(params.redirect) : null;
    redirect(getSafeRedirect(target, "/account"));
  }
}
