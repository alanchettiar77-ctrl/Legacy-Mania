import { createAdminClient } from "@/lib/supabase/server";

export interface AnalyticsCounts {
  totalOrders: number;
  totalProducts: number;
  totalUsers: number;
  revenueRows: Array<{ total: number }>;
  statusRows: Array<{ status: string }>;
}

/**
 * Aggregate storefront counts for the admin dashboard. Uses the service-role client —
 * callers are responsible for admin authorization before invoking this.
 */
export async function fetchAnalyticsCounts(): Promise<AnalyticsCounts> {
  const supabase = await createAdminClient();

  const [
    { count: totalOrders },
    { count: totalProducts },
    { count: totalUsers },
    { data: revenueRaw },
    { data: statusRaw },
  ] = await Promise.all([
    supabase.from("orders").select("*", { count: "exact", head: true }),
    supabase.from("products").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("orders").select("total").in("status", ["confirmed", "processing", "shipped", "delivered"]),
    supabase.from("orders").select("status"),
  ]);

  return {
    totalOrders: totalOrders ?? 0,
    totalProducts: totalProducts ?? 0,
    totalUsers: totalUsers ?? 0,
    revenueRows: (revenueRaw ?? []) as Array<{ total: number }>,
    statusRows: (statusRaw ?? []) as Array<{ status: string }>,
  };
}
