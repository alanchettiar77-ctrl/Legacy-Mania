const mockGetPaymentById = jest.fn();
const mockUpdatePaymentStatus = jest.fn();

jest.mock("@/lib/repositories/payment-repository", () => ({
  getPaymentById: () => mockGetPaymentById(),
  updatePaymentStatus: (...args: unknown[]) => mockUpdatePaymentStatus(...args),
}));

const mockUpdateOrderStatus = jest.fn();
jest.mock("@/lib/services/order-service", () => ({
  updateStatus: (...args: unknown[]) => mockUpdateOrderStatus(...args),
}));

const mockGetSignedMediaUrl = jest.fn();
jest.mock("@/lib/services/media-service", () => ({
  getSignedMediaUrl: (...args: unknown[]) => mockGetSignedMediaUrl(...args),
}));

import { verifyPayment, rejectPayment, getPaymentScreenshotUrl } from "@/lib/services/payment-service";

describe("verifyPayment", () => {
  afterEach(() => jest.clearAllMocks());

  it("throws when the payment does not exist", async () => {
    mockGetPaymentById.mockResolvedValue(null);
    await expect(verifyPayment("missing", "admin-1")).rejects.toThrow(/not found/i);
  });

  it("marks the payment verified and confirms the order", async () => {
    mockGetPaymentById.mockResolvedValue({ id: "pay-1", order_id: "order-1", screenshot_url: null });
    mockUpdatePaymentStatus.mockResolvedValue(undefined);
    mockUpdateOrderStatus.mockResolvedValue(undefined);

    await verifyPayment("pay-1", "admin-1");

    expect(mockUpdatePaymentStatus).toHaveBeenCalledWith("pay-1", "verified", "admin-1");
    expect(mockUpdateOrderStatus).toHaveBeenCalledWith("order-1", "confirmed");
  });
});

describe("rejectPayment", () => {
  afterEach(() => jest.clearAllMocks());

  it("marks the payment rejected and cancels the order", async () => {
    mockGetPaymentById.mockResolvedValue({ id: "pay-1", order_id: "order-1", screenshot_url: null });
    mockUpdatePaymentStatus.mockResolvedValue(undefined);
    mockUpdateOrderStatus.mockResolvedValue(undefined);

    await rejectPayment("pay-1", "admin-1");

    expect(mockUpdatePaymentStatus).toHaveBeenCalledWith("pay-1", "rejected", "admin-1");
    expect(mockUpdateOrderStatus).toHaveBeenCalledWith("order-1", "cancelled");
  });
});

describe("getPaymentScreenshotUrl", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns null when there is no screenshot", async () => {
    mockGetPaymentById.mockResolvedValue({ id: "pay-1", order_id: "order-1", screenshot_url: null });

    const url = await getPaymentScreenshotUrl("pay-1");

    expect(url).toBeNull();
    expect(mockGetSignedMediaUrl).not.toHaveBeenCalled();
  });

  it("returns a signed URL when a screenshot exists", async () => {
    mockGetPaymentById.mockResolvedValue({ id: "pay-1", order_id: "order-1", screenshot_url: "payments/x.png" });
    mockGetSignedMediaUrl.mockResolvedValue("https://example.com/signed");

    const url = await getPaymentScreenshotUrl("pay-1");

    expect(mockGetSignedMediaUrl).toHaveBeenCalledWith("payments/x.png", "payments");
    expect(url).toBe("https://example.com/signed");
  });
});
