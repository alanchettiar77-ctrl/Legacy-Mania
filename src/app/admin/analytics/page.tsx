import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, ShoppingBag, Package, Users } from "lucide-react";

export default async function AdminAnalyticsPage() {
  const supabase = await createClient();

  const [
    { count: totalOrders },
    { count: totalProducts },
    { count: totalUsers },
    { data: deliveredOrders },
    { data: recentEvents },
  ] = await Promise.all([
    supabase.from("orders").select("*", { count: "exact", head: true }),
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("orders").select("total").in("status", ["confirmed", "processing", "shipped", "delivered"]),
    supabase
      .from("analytics_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const totalRevenue = deliveredOrders?.reduce((sum, o) => sum + o.total, 0) ?? 0;

  const stats = [
    { label: "Total Revenue", value: formatCurrency(totalRevenue), icon: TrendingUp, color: "text-green-500", bg: "bg-green-500/10" },
    { label: "Total Orders", value: totalOrders ?? 0, icon: ShoppingBag, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Active Products", value: totalProducts ?? 0, icon: Package, color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "Registered Users", value: totalUsers ?? 0, icon: Users, color: "text-orange-500", bg: "bg-orange-500/10" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Analytics</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-2xl p-5">
            <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Recent events */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h2 className="font-bold mb-4">Recent Events</h2>
        {!recentEvents || recentEvents.length === 0 ? (
          <p className="text-muted-foreground text-sm">No events yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-2 text-xs font-semibold text-muted-foreground">Event</th>
                  <th className="text-left p-2 text-xs font-semibold text-muted-foreground">Time</th>
                </tr>
              </thead>
              <tbody>
                {recentEvents.map((event) => (
                  <tr key={event.id} className="border-b border-border last:border-0">
                    <td className="p-2 font-mono text-xs">{event.event_type}</td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {new Date(event.created_at).toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
