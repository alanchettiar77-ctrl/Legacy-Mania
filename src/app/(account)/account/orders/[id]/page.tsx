import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  formatCurrency,
  formatDate,
  getStatusColor,
  getStatusLabel,
} from "@/lib/utils";
import { ArrowLeft, Package, MapPin, CreditCard } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Order Details" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order } = await (supabase as any)
    .from("orders")
    .select(
      "*, order_items(*, product:products(name, images, slug)), payments(*)"
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!order) notFound();

  const payment = order.payments?.[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/account/orders"
          className="p-2 rounded-xl hover:bg-accent transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {order.order_number}
          </h1>
          <p className="text-sm text-muted-foreground">
            Placed on {formatDate(order.created_at)}
          </p>
        </div>
        <span
          className={`ml-auto text-xs font-semibold px-3 py-1.5 rounded-full ${getStatusColor(order.status)}`}
        >
          {getStatusLabel(order.status)}
        </span>
      </div>

      {/* Order items */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-4 h-4 text-primary" />
          <h2 className="font-bold">Items Ordered</h2>
        </div>
        <div className="space-y-3">
          {order.order_items?.map(
            (item: {
              id: string;
              quantity: number;
              unit_price: number;
              product: { name: string; images: string[]; slug: string } | null;
            }) => (
              <div
                key={item.id}
                className="flex items-center gap-4 py-3 border-b border-border last:border-0"
              >
                <div className="w-12 h-12 rounded-xl bg-muted flex-shrink-0 overflow-hidden">
                  {item.product?.images?.[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.product.images[0]}
                      alt={item.product.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {item.product?.name ?? "Product"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Qty: {item.quantity} × {formatCurrency(item.unit_price)}
                  </p>
                </div>
                <p className="font-bold text-sm">
                  {formatCurrency(item.quantity * item.unit_price)}
                </p>
              </div>
            )
          )}
        </div>
        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
          <span className="font-semibold">Total</span>
          <span className="text-xl font-bold text-primary">
            {formatCurrency(order.total)}
          </span>
        </div>
      </div>

      {/* Delivery address */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-4 h-4 text-primary" />
          <h2 className="font-bold">Delivery Address</h2>
        </div>
        <div className="text-sm text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground">{order.customer_name}</p>
          <p>{order.customer_phone}</p>
          <p>{order.shipping_address?.street}</p>
          <p>
            {order.shipping_address?.city}, {order.shipping_address?.state}{" "}
            {order.shipping_address?.pincode}
          </p>
        </div>
      </div>

      {/* Payment */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-4 h-4 text-primary" />
          <h2 className="font-bold">Payment</h2>
        </div>
        {payment ? (
          <div className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Method</span>
              <span className="capitalize">{payment.payment_method}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span
                className={`font-semibold capitalize ${
                  payment.status === "verified"
                    ? "text-green-500"
                    : payment.status === "rejected"
                      ? "text-red-500"
                      : "text-yellow-500"
                }`}
              >
                {payment.status}
              </span>
            </div>
            {payment.upi_transaction_id && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">UPI Ref</span>
                <span className="font-mono text-xs">
                  {payment.upi_transaction_id}
                </span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Payment info not available
          </p>
        )}
      </div>

      {/* Order timeline */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h2 className="font-bold mb-4">Order Status</h2>
        <div className="space-y-3">
          {[
            { key: "pending", label: "Order Placed" },
            { key: "payment_verification", label: "Payment Under Review" },
            { key: "confirmed", label: "Order Confirmed" },
            { key: "processing", label: "Processing" },
            { key: "shipped", label: "Shipped" },
            { key: "delivered", label: "Delivered" },
          ].map((step, i, arr) => {
            const statuses = arr.map((s) => s.key);
            const currentIdx = statuses.indexOf(order.status);
            const stepIdx = statuses.indexOf(step.key);
            const isCompleted = stepIdx <= currentIdx;
            const isCurrent = stepIdx === currentIdx;
            return (
              <div key={step.key} className="flex items-center gap-3">
                <div
                  className={`w-3 h-3 rounded-full flex-shrink-0 ${
                    isCompleted
                      ? isCurrent
                        ? "bg-primary ring-4 ring-primary/20"
                        : "bg-primary"
                      : "bg-border"
                  }`}
                />
                <span
                  className={`text-sm ${
                    isCurrent
                      ? "font-semibold text-foreground"
                      : isCompleted
                        ? "text-foreground"
                        : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
