import { fetchAnalyticsCounts } from "@/lib/repositories/analytics-repository";

export interface AnalyticsSummary {
  totalOrders: number;
  totalProducts: number;
  totalUsers: number;
  totalRevenue: number;
  ordersByStatus: Record<string, number>;
}

/**
 * Admin-only aggregate metrics. Returns counts and totals only — no rows, no
 * customer-identifying fields — so the response can never leak PII.
 */
export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const counts = await fetchAnalyticsCounts();

  const totalRevenue = counts.revenueRows.reduce((sum, o) => sum + (o.total ?? 0), 0);

  const ordersByStatus = counts.statusRows.reduce((acc: Record<string, number>, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  return {
    totalOrders: counts.totalOrders,
    totalProducts: counts.totalProducts,
    totalUsers: counts.totalUsers,
    totalRevenue,
    ordersByStatus,
  };
}
