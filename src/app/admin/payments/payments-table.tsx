"use client";

import { useState } from "react";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";

interface PaymentRow {
  id: string;
  amount: number;
  status: "pending" | "verified" | "rejected";
  created_at: string;
  order: { order_number: string; shipping_name: string } | null;
}

async function apiRequest(path: string, options?: RequestInit) {
  const res = await fetch(path, { ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "Request failed");
  return body;
}

export default function PaymentsTable({ initialPayments }: { initialPayments: PaymentRow[] }) {
  const [payments, setPayments] = useState(initialPayments);

  const verify = async (id: string) => {
    try {
      await apiRequest(`/api/admin/payments/${id}/verify`, { method: "PATCH" });
      setPayments((prev) => prev.map((p) => (p.id === id ? { ...p, status: "verified" } : p)));
      toast.success("Payment verified");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to verify payment");
    }
  };

  const reject = async (id: string) => {
    try {
      await apiRequest(`/api/admin/payments/${id}/reject`, { method: "PATCH" });
      setPayments((prev) => prev.map((p) => (p.id === id ? { ...p, status: "rejected" } : p)));
      toast.success("Payment rejected");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject payment");
    }
  };

  const viewScreenshot = async (id: string) => {
    try {
      const { url } = await apiRequest(`/api/admin/payments/${id}/screenshot-url`);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No screenshot available");
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Order</th>
              <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer</th>
              <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amount</th>
              <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
              <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
              <th className="text-right p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id} className="border-b border-border last:border-0 hover:bg-accent/20 transition-colors">
                <td className="p-4 text-sm font-mono">{payment.order?.order_number ?? "—"}</td>
                <td className="p-4 text-sm">{payment.order?.shipping_name ?? "—"}</td>
                <td className="p-4 text-sm font-semibold">{formatCurrency(payment.amount)}</td>
                <td className="p-4">
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      payment.status === "verified"
                        ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                        : payment.status === "rejected"
                        ? "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                        : "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300"
                    }`}
                  >
                    {payment.status}
                  </span>
                </td>
                <td className="p-4 text-sm text-muted-foreground">{formatDate(payment.created_at)}</td>
                <td className="p-4">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => viewScreenshot(payment.id)} className="text-xs text-primary hover:underline">
                      View Screenshot
                    </button>
                    {payment.status === "pending" && (
                      <>
                        <button
                          onClick={() => verify(payment.id)}
                          className="text-xs px-3 py-1.5 rounded-lg bg-green-500/10 text-green-600 hover:bg-green-500/20"
                        >
                          Verify
                        </button>
                        <button
                          onClick={() => reject(payment.id)}
                          className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {payments.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">No payments yet.</div>
        )}
      </div>
    </div>
  );
}
