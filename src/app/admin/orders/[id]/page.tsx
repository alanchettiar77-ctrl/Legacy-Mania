import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from "@/lib/utils";
import Image from "next/image";
import OrderStatusUpdater from "@/components/admin/order-status-updater";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("*, order_items(*), payment:payments(*)")
    .eq("id", id)
    .single();

  if (!order) notFound();

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{order.order_number}</h1>
          <p className="text-muted-foreground text-sm">{formatDate(order.created_at)}</p>
        </div>
        <span className={`text-sm font-semibold px-3 py-1.5 rounded-full ${getStatusColor(order.status)}`}>
          {getStatusLabel(order.status)}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Customer info */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="font-bold mb-4">Customer Details</h2>
          <dl className="space-y-2 text-sm">
            {[
              { label: "Name", value: order.shipping_name },
              { label: "Email", value: order.shipping_email },
              { label: "Phone", value: order.shipping_phone },
              { label: "Address", value: order.shipping_address },
              { label: "City", value: order.shipping_city },
              { label: "State", value: order.shipping_state },
              { label: "Pincode", value: order.shipping_pincode },
            ].map(({ label, value }) => (
              <div key={label} className="flex gap-2">
                <dt className="text-muted-foreground w-20 flex-shrink-0">{label}:</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Payment info */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="font-bold mb-4">Payment Details</h2>
          {order.payment ? (
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-bold">{formatCurrency((order.payment as { amount: number }).amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status:</span>
                <span className={`font-semibold ${(order.payment as { status: string }).status === "verified" ? "text-green-500" : "text-yellow-500"}`}>
                  {(order.payment as { status: string }).status}
                </span>
              </div>
              {(order.payment as { screenshot_url: string | null }).screenshot_url && (
                <div>
                  <p className="text-muted-foreground text-xs mb-2">Payment Screenshot:</p>
                  <a
                    href={(order.payment as { screenshot_url: string }).screenshot_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary text-sm hover:underline"
                  >
                    View Screenshot
                  </a>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No payment record</p>
          )}
        </div>
      </div>

      {/* Order items */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h2 className="font-bold mb-4">Order Items</h2>
        <div className="space-y-3">
          {(order.order_items as Array<{
            id: string;
            product_image: string | null;
            product_name: string;
            quantity: number;
            unit_price: number;
            total_price: number;
          }>).map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                {item.product_image && (
                  <Image src={item.product_image} alt={item.product_name} fill className="object-cover" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{item.product_name}</p>
                <p className="text-xs text-muted-foreground">Qty: {item.quantity} × {formatCurrency(item.unit_price)}</p>
              </div>
              <span className="font-bold text-sm">{formatCurrency(item.total_price)}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-border mt-4 pt-4 flex justify-between font-bold">
          <span>Total</span>
          <span className="text-primary">{formatCurrency(order.total)}</span>
        </div>
      </div>

      {/* Status updater */}
      <OrderStatusUpdater orderId={order.id} currentStatus={order.status} paymentId={
        order.payment ? (order.payment as { id: string }).id : null
      } />
    </div>
  );
}
