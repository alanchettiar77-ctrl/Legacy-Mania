/**
 * @jest-environment node
 */
import {
  notificationCreateSchema,
  notificationUpdateSchema,
  reorderSchema,
  bulkSchema,
  displaySettingsSchema,
} from "@/lib/validation/notification";

describe("notificationCreateSchema", () => {
  it("accepts a minimal valid notification with defaults", () => {
    const parsed = notificationCreateSchema.parse({ title: "Sale", message: "🔥 Big sale!" });
    expect(parsed.type).toBe("announcement");
    expect(parsed.device).toBe("both");
    expect(parsed.is_active).toBe(true);
    expect(parsed.priority).toBe(0);
  });

  it("rejects empty title and message", () => {
    expect(notificationCreateSchema.safeParse({ title: "", message: "x" }).success).toBe(false);
    expect(notificationCreateSchema.safeParse({ title: "x", message: "" }).success).toBe(false);
  });

  it("rejects unknown type and device", () => {
    expect(
      notificationCreateSchema.safeParse({ title: "t", message: "m", type: "nope" }).success
    ).toBe(false);
    expect(
      notificationCreateSchema.safeParse({ title: "t", message: "m", device: "tv" }).success
    ).toBe(false);
  });

  it("accepts relative and http(s) cta urls, rejects javascript:", () => {
    expect(
      notificationCreateSchema.safeParse({ title: "t", message: "m", cta_url: "/catalog" }).success
    ).toBe(true);
    expect(
      notificationCreateSchema.safeParse({ title: "t", message: "m", cta_url: "https://x.com" }).success
    ).toBe(true);
    expect(
      notificationCreateSchema.safeParse({ title: "t", message: "m", cta_url: "javascript:alert(1)" })
        .success
    ).toBe(false);
  });

  it("rejects end_date before start_date", () => {
    const result = notificationCreateSchema.safeParse({
      title: "t",
      message: "m",
      start_date: "2026-08-01T00:00:00Z",
      end_date: "2026-07-01T00:00:00Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("notificationUpdateSchema", () => {
  it("rejects empty patch", () => {
    expect(notificationUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("accepts partial patch", () => {
    expect(notificationUpdateSchema.safeParse({ is_active: false }).success).toBe(true);
  });
});

describe("reorderSchema / bulkSchema", () => {
  const id = "123e4567-e89b-12d3-a456-426614174000";

  it("requires uuid ids", () => {
    expect(reorderSchema.safeParse({ ids: ["not-a-uuid"] }).success).toBe(false);
    expect(reorderSchema.safeParse({ ids: [id] }).success).toBe(true);
  });

  it("requires a known bulk action", () => {
    expect(bulkSchema.safeParse({ ids: [id], action: "explode" }).success).toBe(false);
    expect(bulkSchema.safeParse({ ids: [id], action: "deactivate" }).success).toBe(true);
  });
});

describe("displaySettingsSchema", () => {
  it("accepts a partial config", () => {
    expect(displaySettingsSchema.safeParse({ marqueeSpeedSeconds: 20 }).success).toBe(true);
  });

  it("rejects out-of-range speed and empty patch", () => {
    expect(displaySettingsSchema.safeParse({ marqueeSpeedSeconds: 2 }).success).toBe(false);
    expect(displaySettingsSchema.safeParse({}).success).toBe(false);
  });
});
