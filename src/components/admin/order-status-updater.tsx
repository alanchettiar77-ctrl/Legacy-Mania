"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const statusOptions = [
  { value: "pending", label: "Pending" },
  { value: "payment_verification", label: "Payment Verification" },
  { value: "confirmed", label: "Confirmed" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
  { value: "refunded", label: "Refunded" },
];

interface OrderStatusUpdaterProps {
  orderId: string;
  currentStatus: string;
  paymentId: string | null;
}

export default function OrderStatusUpdater({
  orderId,
  currentStatus,
  paymentId,
}: OrderStatusUpdaterProps) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = createClient() as any;
      await supabase
        .from("orders")
        .update({ status: status as "pending" | "payment_verification" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded" })
        .eq("id", orderId);

      // Auto-verify payment when confirming order
      if (status === "confirmed" && paymentId) {
        await supabase
          .from("payments")
          .update({ status: "verified" as const, verified_at: new Date().toISOString() })
          .eq("id", paymentId);
      }

      toast.success("Order status updated");
      router.refresh();
    } catch {
      toast.error("Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <h2 className="font-bold mb-4">Update Order Status</h2>
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
