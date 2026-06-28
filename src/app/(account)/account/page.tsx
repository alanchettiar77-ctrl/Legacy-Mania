import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "My Account" };

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const { count: orderCount } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Account</h1>
        <p className="text-muted-foreground text-sm">
          Welcome back, {profile?.full_name || user.email}!
        </p>
      </div>

      {/* Profile card */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 text-primary font-bold text-2xl flex items-center justify-center">
            {(profile?.full_name?.[0] || user.email?.[0] || "U").toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-lg text-foreground">{profile?.full_name || "—"}</p>
            <p className="text-muted-foreground text-sm">{user.email}</p>
            {profile?.phone && (
              <p className="text-muted-foreground text-sm">{profile.phone}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-accent/50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{orderCount ?? 0}</p>
            <p className="text-xs text-muted-foreground">Total Orders</p>
          </div>
          <div className="bg-accent/50 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-foreground">
              {new Date(user.created_at).getFullYear()}
            </p>
            <p className="text-xs text-muted-foreground">Member Since</p>
          </div>
        </div>
      </div>
    </div>
  );
}
