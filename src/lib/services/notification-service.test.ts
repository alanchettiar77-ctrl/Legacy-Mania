/**
 * @jest-environment node
 */
jest.mock("@/lib/repositories/notification-repository", () => ({
  listNotifications: jest.fn(),
  listActiveNotifications: jest.fn(),
  getNotification: jest.fn(),
  getMaxDisplayOrder: jest.fn(),
  insertNotification: jest.fn(),
  updateNotification: jest.fn(),
  softDeleteNotification: jest.fn(),
  reorderNotifications: jest.fn(),
  getDisplaySettings: jest.fn(),
  updateDisplaySettings: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockRepo = jest.requireMock("@/lib/repositories/notification-repository");

import {
  getHomepageNotifications,
  createNotification,
  duplicateNotification,
  bulkAction,
  updateDisplayConfig,
  DEFAULT_DISPLAY_CONFIG,
} from "@/lib/services/notification-service";

const ROW = {
  id: "n1",
  title: "Sale",
  message: "🔥 Sale on!",
  short_message: null,
  type: "sale",
  cta_text: null,
  cta_url: null,
  priority: 5,
  display_order: 0,
  is_active: true,
  theme: "primary",
  icon: null,
  animation: "marquee",
  background_color: null,
  text_color: null,
  start_date: null,
  end_date: null,
  device: "both",
  target_audience: null,
  country: null,
  created_by: "a1",
  updated_by: "a1",
  created_at: "2026-07-19T00:00:00Z",
  updated_at: "2026-07-19T00:00:00Z",
  deleted_at: null,
};

afterEach(() => jest.clearAllMocks());

describe("getHomepageNotifications", () => {
  it("returns items with merged display config", async () => {
    mockRepo.listActiveNotifications.mockResolvedValue([ROW]);
    mockRepo.getDisplaySettings.mockResolvedValue({ marqueeSpeedSeconds: 15 });

    const result = await getHomepageNotifications("both");

    expect(result.items).toEqual([ROW]);
    expect(result.config.marqueeSpeedSeconds).toBe(15);
    expect(result.config.pauseOnHover).toBe(true);
  });

  it("never throws — returns empty items and defaults on repo failure", async () => {
    mockRepo.listActiveNotifications.mockRejectedValue(new Error("db down"));
    mockRepo.getDisplaySettings.mockRejectedValue(new Error("db down"));

    const result = await getHomepageNotifications();

    expect(result.items).toEqual([]);
    expect(result.config).toEqual(DEFAULT_DISPLAY_CONFIG);
  });
});

describe("createNotification", () => {
  it("appends at next display_order and stamps created_by/updated_by", async () => {
    mockRepo.getMaxDisplayOrder.mockResolvedValue(4);
    mockRepo.insertNotification.mockResolvedValue(ROW);

    await createNotification(
      { title: "t", message: "m", type: "sale", priority: 0, is_active: true, theme: "primary", animation: "marquee", device: "both" },
      "admin-1"
    );

    expect(mockRepo.insertNotification).toHaveBeenCalledWith(
      expect.objectContaining({ display_order: 5, created_by: "admin-1", updated_by: "admin-1" })
    );
  });

  it("respects an explicit display_order", async () => {
    mockRepo.insertNotification.mockResolvedValue(ROW);

    await createNotification(
      { title: "t", message: "m", type: "sale", priority: 0, is_active: true, theme: "primary", animation: "marquee", device: "both", display_order: 2 },
      "admin-1"
    );

    expect(mockRepo.getMaxDisplayOrder).not.toHaveBeenCalled();
    expect(mockRepo.insertNotification).toHaveBeenCalledWith(
      expect.objectContaining({ display_order: 2 })
    );
  });
});

describe("duplicateNotification", () => {
  it("copies fields, marks inactive, appends '(copy)', returns null when source missing", async () => {
    mockRepo.getNotification.mockResolvedValue(ROW);
    mockRepo.getMaxDisplayOrder.mockResolvedValue(9);
    mockRepo.insertNotification.mockResolvedValue({ ...ROW, id: "n2" });

    await duplicateNotification("n1", "admin-2");

    expect(mockRepo.insertNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Sale (copy)",
        is_active: false,
        display_order: 10,
        created_by: "admin-2",
      })
    );
    const inserted = mockRepo.insertNotification.mock.calls[0][0];
    expect(inserted.id).toBeUndefined();
    expect(inserted.created_at).toBeUndefined();

    mockRepo.getNotification.mockResolvedValue(null);
    expect(await duplicateNotification("missing", "admin-2")).toBeNull();
  });
});

describe("bulkAction", () => {
  it("activates/deactivates and counts processed rows", async () => {
    mockRepo.updateNotification.mockResolvedValueOnce(ROW).mockResolvedValueOnce(null);

    const result = await bulkAction(["n1", "n-missing"], "deactivate", "admin-1");

    expect(result.processed).toBe(1);
    expect(mockRepo.updateNotification).toHaveBeenCalledWith(
      "n1",
      expect.objectContaining({ is_active: false, updated_by: "admin-1" })
    );
  });

  it("soft-deletes on delete action", async () => {
    mockRepo.softDeleteNotification.mockResolvedValue(true);

    const result = await bulkAction(["n1"], "delete", "admin-1");

    expect(result.processed).toBe(1);
    expect(mockRepo.softDeleteNotification).toHaveBeenCalledWith("n1", "admin-1");
  });
});

describe("updateDisplayConfig", () => {
  it("merges patch over stored config and persists", async () => {
    mockRepo.getDisplaySettings.mockResolvedValue({ marqueeSpeedSeconds: 40 });
    mockRepo.updateDisplaySettings.mockResolvedValue(undefined);

    const merged = await updateDisplayConfig({ direction: "right" }, "admin-1");

    expect(merged.marqueeSpeedSeconds).toBe(40);
    expect(merged.direction).toBe("right");
    expect(mockRepo.updateDisplaySettings).toHaveBeenCalledWith(
      expect.objectContaining({ direction: "right" }),
      "admin-1"
    );
  });
});
