import { getSafeRedirect } from "./utils";

describe("getSafeRedirect", () => {
  it("returns a plain relative path unchanged", () => {
    expect(getSafeRedirect("/checkout", "/admin")).toBe("/checkout");
  });

  it("returns a relative path with query/hash unchanged", () => {
    expect(getSafeRedirect("/account/orders?tab=open", "/admin")).toBe("/account/orders?tab=open");
  });

  it("falls back on null", () => {
    expect(getSafeRedirect(null, "/admin")).toBe("/admin");
  });

  it("falls back on undefined", () => {
    expect(getSafeRedirect(undefined, "/admin")).toBe("/admin");
  });

  it("falls back on empty string", () => {
    expect(getSafeRedirect("", "/admin")).toBe("/admin");
  });

  it("falls back on an absolute URL (no leading slash)", () => {
    expect(getSafeRedirect("https://evil.com", "/admin")).toBe("/admin");
  });

  it("falls back on a protocol-relative URL (//)", () => {
    expect(getSafeRedirect("//evil.com", "/admin")).toBe("/admin");
  });

  it("falls back on a backslash protocol-relative URL (/\\\\)", () => {
    expect(getSafeRedirect("/\\evil.com", "/admin")).toBe("/admin");
  });

  it("falls back on a bare protocol string with no slash", () => {
    expect(getSafeRedirect("javascript:alert(1)", "/admin")).toBe("/admin");
  });
});
