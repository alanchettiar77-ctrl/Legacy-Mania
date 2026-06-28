/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { Users } from "lucide-react";

export default async function AdminUsersPage() {
  const supabase = await createAdminClient();
  const { data: usersRaw } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  const users = usersRaw as Array<{ id: string; full_name: string | null; email: string; phone: string | null; role: string; created_at: string }> | null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Users</h1>
        <p className="text-muted-foreground text-sm">{users?.length ?? 0} registered users</p>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {["User", "Email", "Phone", "Role", "Joined"].map((h) => (
                  <th key={h} className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users?.map((user) => (
                <tr key={user.id} className="border-b border-border last:border-0 hover:bg-accent/20 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center">
                        {(user.full_name?.[0] || user.email?.[0] || "U").toUpperCase()}
                      </div>
                      <span className="font-medium text-sm">{user.full_name || "—"}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">{user.email}</td>
                  <td className="p-4 text-sm text-muted-foreground">{user.phone || "—"}</td>
                  <td className="p-4">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      user.role === "admin"
                        ? "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">
                    {formatDate(user.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!users || users.length === 0) && (
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground text-sm">No users yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
