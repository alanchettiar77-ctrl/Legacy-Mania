/**
 * @jest-environment node
 */
const mockFetchCounts = jest.fn();
jest.mock("@/lib/repositories/analytics-repository", () => ({
  fetchAnalyticsCounts: () => mockFetchCounts(),
}));

import { getAnalyticsSummary } from "@/lib/services/analytics-service";

describe("getAnalyticsSummary", () => {
  afterEach(() => jest.clearAllMocks());

  it("aggregates revenue and orders by status", async () => {
    mockFetchCounts.mockResolvedValue({
      totalOrders: 3,
      totalProducts: 10,
      totalUsers: 5,
      revenueRows: [{ total: 100 }, { total: 250 }, { total: null }],
      statusRows: [{ status: "pending" }, { status: "confirmed" }, { status: "confirmed" }],
    });

    const summary = await getAnalyticsSummary();

    expect(summary).toEqual({
      totalOrders: 3,
      totalProducts: 10,
      totalUsers: 5,
      totalRevenue: 350,
      ordersByStatus: { pending: 1, confirmed: 2 },
    });
  });

  it("handles empty data", async () => {
    mockFetchCounts.mockResolvedValue({
      totalOrders: 0,
      totalProducts: 0,
      totalUsers: 0,
      revenueRows: [],
      statusRows: [],
    });

    const summary = await getAnalyticsSummary();

    expect(summary.totalRevenue).toBe(0);
    expect(summary.ordersByStatus).toEqual({});
  });

  it("only exposes aggregate keys (no PII fields)", async () => {
    mockFetchCounts.mockResolvedValue({
      totalOrders: 1,
      totalProducts: 1,
      totalUsers: 1,
      revenueRows: [{ total: 10 }],
      statusRows: [{ status: "pending" }],
    });

    const summary = await getAnalyticsSummary();

    expect(Object.keys(summary).sort()).toEqual([
      "ordersByStatus",
      "totalOrders",
      "totalProducts",
      "totalRevenue",
      "totalUsers",
    ]);
  });

  it("propagates repository errors", async () => {
    mockFetchCounts.mockRejectedValue(new Error("db down"));
    await expect(getAnalyticsSummary()).rejects.toThrow("db down");
  });
});
