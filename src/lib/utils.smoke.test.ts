import { cn } from "@/lib/utils";

describe("jest infrastructure smoke test", () => {
  it("resolves the @/ path alias and runs a basic assertion", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });
});
