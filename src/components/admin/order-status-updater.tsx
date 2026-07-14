"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const statusOptions = [
  { value: "pending", label: "Pending" },
  { value: "payment_verification", label: "Payment Verification" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
  { value: "refunded", label: "Refunded" },
];

interface OrderStatusUpdaterProps {
  orderId: string;
  currentStatus: string;
}

export default function OrderStatusUpdater({ orderId, currentStatus }: OrderStatusUpdaterProps) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to update status");

      toast.success("Order status updated");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <h2 className="font-bold mb-4">Update Order Status</h2>
      <p className="text-xs text-muted-foreground mb-3">
        To confirm an order, verify its payment from the{" "}
        <a href="/admin/payments" className="text-primary hover:underline">
          Payments
        </a>{" "}
        page instead.
      </p>
      <div className="flex items-center gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="flex-1 px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm"
        >
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          onClick={handleUpdate}
          disabled={loading || status === currentStatus}
          className="btn-primary text-sm px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {loading ? "Updating..." : "Update Status"}
        </button>
      </div>
    </div>
  );
}
