import { render } from "@testing-library/react";
import CartDrawer from "@/components/cart/cart-drawer";
import { useCartStore } from "@/store/cart";

describe("CartDrawer inert attribute", () => {
  afterEach(() => {
    useCartStore.setState({ isOpen: false, items: [] });
  });

  it("sets the inert attribute on the drawer when closed", () => {
    useCartStore.setState({ isOpen: false });
    const { getByRole } = render(<CartDrawer />);
    const drawer = getByRole("dialog", { hidden: true });
    expect(drawer.hasAttribute("inert")).toBe(true);
  });

  it("removes the inert attribute on the drawer when open", () => {
    useCartStore.setState({ isOpen: true });
    const { getByRole } = render(<CartDrawer />);
    const drawer = getByRole("dialog");
    expect(drawer.hasAttribute("inert")).toBe(false);
  });
});
