import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createAdminClient();

    const [
      { count: totalOrders },
      { count: totalProducts },
      { count: totalUsers },
      { data: revenueDataRaw },
      { data: allOrdersRaw },
    ] = await Promise.all([
      supabase.from("orders").select("*", { count: "exact", head: true }),
      supabase.from("products").select("*", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("orders").select("total").in("status", ["confirmed", "processing", "shipped", "delivered"]),
      supabase.from("orders").select("status"),
    ]);

    const revenueData = revenueDataRaw as Array<{ total: number }> | null;
    const allOrders = allOrdersRaw as Array<{ status: string }> | null;

    const totalRevenue = (revenueData ?? []).reduce((sum, o) => sum + (o.total ?? 0), 0);

    const ordersByStatus = (allOrders ?? []).reduce((acc: Record<string, number>, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      totalOrders,
      totalProducts,
      totalUsers,
      totalRevenue,
      ordersByStatus,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
