"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from "@/lib/utils";
import { toast } from "sonner";
import { Eye, CheckCircle, Truck, PackageCheck, Loader2 } from "lucide-react";

interface Order {
  id: string;
  order_number: string;
  shipping_name: string;
  shipping_email: string;
  created_at: string;
  total: number;
  status: string;
  order_items: { count: number }[];
  payments: { id: string }[];
}

const NEXT_STATUS: Record<string, { value: string; label: string; icon: React.ElementType; color: string } | null> = {
  payment_verification: { value: "confirmed", label: "Verify Payment", icon: CheckCircle, color: "bg-green-500/10 text-green-600 hover:bg-green-500/20 border border-green-500/30" },
  confirmed: { value: "processing", label: "Start Processing", icon: PackageCheck, color: "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border border-blue-500/30" },
  processing: { value: "shipped", label: "Mark Shipped", icon: Truck, color: "bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20 border border-indigo-500/30" },
  shipped: { value: "delivered", label: "Mark Delivered", icon: CheckCircle, color: "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/30" },
};

export default function OrdersTableClient({ initialOrders }: { initialOrders: Order[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleQuickUpdate = async (orderId: string, newStatus: string) => {
    setLoadingId(orderId);
    try {
      if (newStatus === "confirmed") {
        const order = orders.find((o) => o.id === orderId);
        const paymentId = order?.payments?.[0]?.id;
        if (!paymentId) throw new Error("No payment found for this order");
        const res = await fetch(`/api/admin/payments/${paymentId}/verify`, { method: "PATCH" });
        if (!res.ok) throw new Error("Failed to verify payment");
      } else {
        const res = await fetch(`/api/admin/orders/${orderId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
        if (!res.ok) throw new Error("Failed to update order");
      }

      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)));
      toast.success(`Order updated to ${getStatusLabel(newStatus)}`);
    } catch {
      toast.error("Failed to update order");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {["Order #", "Customer", "Date", "Items", "Total", "Status", "Action", ""].map((h) => (
                <th key={h} className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const next = NEXT_STATUS[order.status] ?? null;
              const isLoading = loadingId === order.id;
              const NextIcon = next?.icon;
              return (
                <tr key={order.id} className="border-b border-border last:border-0 hover:bg-accent/10 transition-colors">
                  <td className="p-4">
                    <p className="font-mono text-sm font-bold text-foreground">{order.order_number}</p>
                  </td>
                  <td className="p-4">
                    <p className="text-sm font-medium text-foreground">{order.shipping_name}</p>
                    <p className="text-xs text-muted-foreground">{order.shipping_email}</p>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground whitespace-nowrap">
                    {formatDate(order.created_at)}
                  </td>
                  <td className="p-4 text-sm text-muted-foreground text-center">
                    {order.order_items?.[0]?.count ?? 0}
                  </td>
                  <td className="p-4 font-bold text-sm whitespace-nowrap">{formatCurrency(order.total)}</td>
                  <td className="p-4">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${getStatusColor(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                  </td>
                  <td className="p-4">
                    {next && (
                      <button
                        onClick={() => handleQuickUpdate(order.id, next.value)}
                        disabled={isLoading}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap disabled:opacity-50 ${next.color}`}
                      >
                        {isLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          NextIcon && <NextIcon className="w-3.5 h-3.5" />
                        )}
                        {next.label}
                      </button>
                    )}
                  </td>
                  <td className="p-4">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground inline-flex"
                      title="View full order"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {orders.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm">No orders yet. Share your store link to start selling!</p>
          </div>
        )}
      </div>
    </div>
  );
}
