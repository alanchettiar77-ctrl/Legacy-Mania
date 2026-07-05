const mockInsertAuditLog = jest.fn();
const mockQueryAuditLogs = jest.fn();

jest.mock("@/lib/repositories/audit-repository", () => ({
  insertAuditLog: (...args: unknown[]) => mockInsertAuditLog(...args),
  queryAuditLogs: (...args: unknown[]) => mockQueryAuditLogs(...args),
}));

import { recordAuditLog, queryAuditLog } from "@/lib/services/audit-service";

describe("recordAuditLog", () => {
  afterEach(() => jest.clearAllMocks());

  it("passes the input through to the repository", async () => {
    mockInsertAuditLog.mockResolvedValue(undefined);

    await recordAuditLog({
      userId: "admin-1",
      action: "create",
      tableName: "banners",
      recordId: "banner-1",
      newValues: { title: "Sale" },
    });

    expect(mockInsertAuditLog).toHaveBeenCalledWith({
      userId: "admin-1",
      action: "create",
      tableName: "banners",
      recordId: "banner-1",
      newValues: { title: "Sale" },
    });
  });

  it("never throws when the repository write fails", async () => {
    mockInsertAuditLog.mockRejectedValue(new Error("network down"));

    await expect(
      recordAuditLog({ userId: "admin-1", action: "create", tableName: "banners" })
    ).resolves.toBeUndefined();
  });
});

describe("queryAuditLog", () => {
  afterEach(() => jest.clearAllMocks());

  it("passes filters through and returns the repository result", async () => {
    const rows = [{ id: "log-1", action: "create", table_name: "banners" }];
    mockQueryAuditLogs.mockResolvedValue(rows);

    const result = await queryAuditLog({ tableName: "banners" });

    expect(mockQueryAuditLogs).toHaveBeenCalledWith({ tableName: "banners" });
    expect(result).toEqual(rows);
  });
});
