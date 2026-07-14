import { createClient } from "@/lib/supabase/server";
import PaymentsTable from "./payments-table";

export default async function AdminPaymentsPage() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: paymentsRaw } = await db
    .from("payments")
    .select("*, order:orders(order_number, shipping_name)")
    .order("created_at", { ascending: false });

  const payments = paymentsRaw ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Payments</h1>
        <p className="text-muted-foreground text-sm">{payments.length} payments total</p>
      </div>
      <PaymentsTable initialPayments={payments} />
    </div>
  );
}
