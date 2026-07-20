import { createClient } from "@/lib/supabase/server";
import OrdersTableClient from "./orders-table-client";

export default async function AdminOrdersPage() {
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("*, order_items(count), payments(id)")
    .order("created_at", { ascending: false });

  const pendingCount = orders?.filter((o) => o.status === "payment_verification").length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Orders</h1>
          <p className="text-muted-foreground text-sm">
            {orders?.length ?? 0} total orders
            {pendingCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 bg-yellow-500/10 text-yellow-600 border border-yellow-500/30 text-xs font-semibold px-2 py-0.5 rounded-full">
                {pendingCount} awaiting payment verification
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="text-xs text-muted-foreground bg-accent/30 border border-border rounded-xl px-4 py-2.5">
        💡 Use the action buttons in each row to update order status without opening the order.
      </div>

      <OrdersTableClient initialOrders={(orders ?? []) as Parameters<typeof OrdersTableClient>[0]["initialOrders"]} />
    </div>
  );
}
