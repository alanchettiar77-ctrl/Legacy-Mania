import { createClient } from "@/lib/supabase/server";
import { formatCurrency, getStatusColor, getStatusLabel, formatDate } from "@/lib/utils";
import Link from "next/link";
import { ShoppingBag, Package, Users, TrendingUp, Clock, Plus, Settings, Tag } from "lucide-react";

export default async function AdminDashboard() {
  const supabase = await createClient();

  const [
    { count: orderCount },
    { count: productCount },
    { count: userCount },
    { data: recentOrders },
    { data: pendingPayments },
  ] = await Promise.all([
    supabase.from("orders").select("*", { count: "exact", head: true }),
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("orders")
      .select("*")
      .eq("status", "payment_verification")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  // Revenue calculation
  const { data: completedOrders } = await supabase
    .from("orders")
    .select("total")
    .in("status", ["confirmed", "processing", "shipped", "delivered"]);
  const totalRevenue = completedOrders?.reduce((sum, o) => sum + o.total, 0) ?? 0;

  const stats = [
    {
      label: "Total Orders",
      value: orderCount ?? 0,
      icon: ShoppingBag,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      label: "Products",
      value: productCount ?? 0,
      icon: Package,
      color: "text-green-500",
      bg: "bg-green-500/10",
    },
    {
      label: "Users",
      value: userCount ?? 0,
      icon: Users,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
    },
    {
      label: "Revenue",
      value: formatCurrency(totalRevenue),
      icon: TrendingUp,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
    },
  ];

  const quickActions = [
    {
      href: "/admin/products/new",
      icon: Plus,
      label: "Add New Product",
      desc: "Upload a new card to the store",
      color: "bg-green-500/10 border-green-500/30 hover:bg-green-500/20",
      iconColor: "text-green-500",
    },
    {
      href: "/admin/orders",
      icon: ShoppingBag,
      label: "Manage Orders",
      desc: "View and update order statuses",
      color: "bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20",
      iconColor: "text-blue-500",
    },
    {
      href: "/admin/categories",
      icon: Tag,
      label: "Manage Categories",
      desc: "Add or edit product categories",
      color: "bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20",
      iconColor: "text-purple-500",
    },
    {
      href: "/admin/settings",
      icon: Settings,
      label: "Store Settings",
      desc: "Update UPI, WhatsApp & store info",
      color: "bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/20",
      iconColor: "text-orange-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Welcome to Legacy Mania Admin</p>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={`flex flex-col gap-3 p-4 rounded-2xl border transition-all ${action.color}`}
            >
              <div className={`w-9 h-9 rounded-xl bg-background/60 flex items-center justify-center`}>
                <action.icon className={`w-5 h-5 ${action.iconColor}`} />
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground leading-tight">{action.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{action.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending payments */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-yellow-500" />
            <h2 className="font-bold text-foreground">Pending Payments</h2>
            {(pendingPayments?.length ?? 0) > 0 && (
              <span className="bg-yellow-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingPayments?.length}
              </span>
            )}
          </div>
          {!pendingPayments || pendingPayments.length === 0 ? (
            <p className="text-muted-foreground text-sm">No pending payments</p>
          ) : (
            <div className="space-y-2">
              {pendingPayments.map((order) => (
                <a
                  key={order.id}
                  href={`/admin/orders/${order.id}`}
                  className="flex items-center justify-between p-3 rounded-xl bg-accent/50 hover:bg-accent transition-colors"
                >
                  <div>
                    <p className="font-medium text-sm">{order.order_number}</p>
                    <p className="text-xs text-muted-foreground">{order.shipping_name}</p>
                  </div>
                  <span className="font-bold text-sm text-primary">
                    {formatCurrency(order.total)}
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Recent orders */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="font-bold text-foreground mb-4">Recent Orders</h2>
          {!recentOrders || recentOrders.length === 0 ? (
            <p className="text-muted-foreground text-sm">No orders yet</p>
          ) : (
            <div className="space-y-2">
              {recentOrders.map((order) => (
                <a
                  key={order.id}
                  href={`/admin/orders/${order.id}`}
                  className="flex items-center justify-between p-3 rounded-xl bg-accent/50 hover:bg-accent transition-colors"
                >
                  <div>
                    <p className="font-medium text-sm">{order.order_number}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm">{formatCurrency(order.total)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
