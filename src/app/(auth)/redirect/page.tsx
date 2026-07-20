import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSafeRedirect } from "@/lib/utils";
import { getCallerRole } from "@/lib/supabase/admin-auth";

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

  const role = await getCallerRole(user.id);
  const params = await searchParams;

  if (role === "admin") {
    redirect("/admin");
  } else {
    const target = params.redirect ? decodeURIComponent(params.redirect) : null;
    redirect(getSafeRedirect(target, "/account"));
  }
}
