const mockConsume = jest.fn();
const mockRelease = jest.fn();

jest.mock("@/lib/repositories/inventory-repository", () => ({
  consumeReservationForProduct: (...args: unknown[]) => mockConsume(...args),
  releaseReservationForProduct: (...args: unknown[]) => mockRelease(...args),
}));

import { consumeReservation, releaseReservation } from "@/lib/services/inventory-service";

describe("consumeReservation", () => {
  afterEach(() => jest.clearAllMocks());

  it("calls consumeReservationForProduct once per item", async () => {
    mockConsume.mockResolvedValue(undefined);

    await consumeReservation([
      { productId: "p1", quantity: 2 },
      { productId: "p2", quantity: 1 },
    ]);

    expect(mockConsume).toHaveBeenNthCalledWith(1, "p1", 2);
    expect(mockConsume).toHaveBeenNthCalledWith(2, "p2", 1);
    expect(mockConsume).toHaveBeenCalledTimes(2);
  });
});

describe("releaseReservation", () => {
  afterEach(() => jest.clearAllMocks());

  it("calls releaseReservationForProduct once per item", async () => {
    mockRelease.mockResolvedValue(undefined);

    await releaseReservation([{ productId: "p1", quantity: 3 }]);

    expect(mockRelease).toHaveBeenCalledWith("p1", 3);
  });

  it("does nothing for an empty item list", async () => {
    await releaseReservation([]);
    expect(mockRelease).not.toHaveBeenCalled();
  });
});
