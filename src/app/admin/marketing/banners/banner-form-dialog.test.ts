process.env.TZ = "America/New_York";

import { toLocalInput, toIsoOrNull } from "./banner-form-dialog";

describe("banner-form-dialog date conversion", () => {
  it("round-trips a UTC ISO string through toLocalInput -> toIsoOrNull to the same instant", () => {
    const original = "2026-03-15T10:30:00.000Z";
    const localInput = toLocalInput(original);
    const roundTripped = toIsoOrNull(localInput);

    expect(roundTripped).not.toBeNull();
    expect(new Date(roundTripped as string).getTime()).toBe(
      new Date(original).getTime()
    );
  });

  it("round-trips a second, distinct UTC ISO string consistently", () => {
    const original = "2025-12-31T23:45:00.000Z";
    const localInput = toLocalInput(original);
    const roundTripped = toIsoOrNull(localInput);

    expect(new Date(roundTripped as string).getTime()).toBe(
      new Date(original).getTime()
    );
  });

  it("returns an empty string for null input", () => {
    expect(toLocalInput(null)).toBe("");
  });

  it("returns null for an empty string input", () => {
    expect(toIsoOrNull("")).toBeNull();
  });
});
