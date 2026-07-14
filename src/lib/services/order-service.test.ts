const mockGetOrderById = jest.fn();
const mockUpdateOrderStatusInDb = jest.fn();
const mockGetOrderItemsForOrder = jest.fn();

jest.mock("@/lib/repositories/order-repository", () => ({
  getOrderById: () => mockGetOrderById(),
  updateOrderStatusInDb: (...args: unknown[]) => mockUpdateOrderStatusInDb(...args),
  getOrderItemsForOrder: () => mockGetOrderItemsForOrder(),
}));

const mockConsumeReservation = jest.fn();
const mockReleaseReservation = jest.fn();

jest.mock("@/lib/services/inventory-service", () => ({
  consumeReservation: (...args: unknown[]) => mockConsumeReservation(...args),
  releaseReservation: (...args: unknown[]) => mockReleaseReservation(...args),
}));

import { updateStatus, InvalidStatusTransitionError } from "@/lib/services/order-service";

describe("updateStatus", () => {
  afterEach(() => jest.clearAllMocks());

  it("throws when the order does not exist", async () => {
    mockGetOrderById.mockResolvedValue(null);

    await expect(updateStatus("missing", "cancelled")).rejects.toThrow(/not found/i);
  });

  it("rejects an invalid transition with InvalidStatusTransitionError", async () => {
    mockGetOrderById.mockResolvedValue({ id: "o1", status: "pending" });

    await expect(updateStatus("o1", "shipped")).rejects.toThrow(InvalidStatusTransitionError);
    expect(mockUpdateOrderStatusInDb).not.toHaveBeenCalled();
  });

  it("allows pending -> payment_verification and does not touch inventory", async () => {
    mockGetOrderById.mockResolvedValue({ id: "o1", status: "pending" });
    mockUpdateOrderStatusInDb.mockResolvedValue(undefined);

    await updateStatus("o1", "payment_verification");

    expect(mockUpdateOrderStatusInDb).toHaveBeenCalledWith("o1", "payment_verification");
    expect(mockConsumeReservation).not.toHaveBeenCalled();
    expect(mockReleaseReservation).not.toHaveBeenCalled();
  });

  it("consumes the reservation when transitioning to confirmed", async () => {
    mockGetOrderById.mockResolvedValue({ id: "o1", status: "payment_verification" });
    mockUpdateOrderStatusInDb.mockResolvedValue(undefined);
    mockGetOrderItemsForOrder.mockResolvedValue([
      { product_id: "p1", quantity: 2 },
      { product_id: null, quantity: 1 },
    ]);

    await updateStatus("o1", "confirmed");

    expect(mockConsumeReservation).toHaveBeenCalledWith([{ productId: "p1", quantity: 2 }]);
  });

  it("releases the reservation when cancelling a pre-confirmation order", async () => {
    mockGetOrderById.mockResolvedValue({ id: "o1", status: "payment_verification" });
    mockUpdateOrderStatusInDb.mockResolvedValue(undefined);
    mockGetOrderItemsForOrder.mockResolvedValue([{ product_id: "p1", quantity: 3 }]);

    await updateStatus("o1", "cancelled");

    expect(mockReleaseReservation).toHaveBeenCalledWith([{ productId: "p1", quantity: 3 }]);
  });

  it("does not touch inventory when cancelling a post-confirmation order", async () => {
    mockGetOrderById.mockResolvedValue({ id: "o1", status: "processing" });
    mockUpdateOrderStatusInDb.mockResolvedValue(undefined);

    await updateStatus("o1", "cancelled");

    expect(mockReleaseReservation).not.toHaveBeenCalled();
    expect(mockConsumeReservation).not.toHaveBeenCalled();
  });

  it("does not persist the status change when the inventory mutation fails", async () => {
    mockGetOrderById.mockResolvedValue({ id: "o1", status: "payment_verification" });
    mockGetOrderItemsForOrder.mockResolvedValue([{ product_id: "p1", quantity: 2 }]);
    mockConsumeReservation.mockRejectedValue(new Error("inventory RPC failed"));

    await expect(updateStatus("o1", "confirmed")).rejects.toThrow("inventory RPC failed");

    expect(mockUpdateOrderStatusInDb).not.toHaveBeenCalled();
  });
});
