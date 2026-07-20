const mockUpsertSetting = jest.fn();
jest.mock("@/lib/repositories/settings-repository", () => ({
  upsertSetting: (...args: unknown[]) => mockUpsertSetting(...args),
}));

import { saveSettings } from "./settings-service";

afterEach(() => jest.clearAllMocks());

it("upserts each entry in the given key/value map", async () => {
  await saveSettings({ upi_id: "shop@upi", upi_name: "Legacy Mania" });
  expect(mockUpsertSetting).toHaveBeenCalledWith("upi_id", "shop@upi");
  expect(mockUpsertSetting).toHaveBeenCalledWith("upi_name", "Legacy Mania");
  expect(mockUpsertSetting).toHaveBeenCalledTimes(2);
});
