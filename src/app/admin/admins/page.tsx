import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Shield } from "lucide-react";
import AdminsClient from "./admins-client";

export default async function AdminsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  const res = await fetch(
    `${supabaseUrl}/rest/v1/profiles?role=eq.admin&select=id,email,full_name,created_at&order=created_at.asc`,
    {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      cache: "no-store",
    }
  );
  const admins = res.ok ? await res.json() : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Access</h1>
          <p className="text-sm text-muted-foreground">
            Manage who can access this admin panel
          </p>
        </div>
      </div>

      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400">
        Only grant admin access to people you fully trust — admins can manage products, orders, and store settings.
      </div>

      <AdminsClient initialAdmins={admins} currentUserId={user.id} />
    </div>
  );
}
