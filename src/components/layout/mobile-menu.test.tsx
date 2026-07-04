import { render } from "@testing-library/react";
import MobileMenu from "@/components/layout/mobile-menu";

describe("MobileMenu inert attribute", () => {
  it("sets the inert attribute on the drawer when closed", () => {
    const { getByRole } = render(<MobileMenu isOpen={false} onClose={() => {}} />);
    const drawer = getByRole("dialog", { hidden: true });
    expect(drawer.hasAttribute("inert")).toBe(true);
  });

  it("removes the inert attribute on the drawer when open", () => {
    const { getByRole } = render(<MobileMenu isOpen={true} onClose={() => {}} />);
    const drawer = getByRole("dialog");
    expect(drawer.hasAttribute("inert")).toBe(false);
  });
});
