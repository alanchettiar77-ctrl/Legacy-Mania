import { render, screen } from "@testing-library/react";
import BrandLogo from "@/components/brand-logo";

describe("BrandLogo", () => {
  it("renders nothing when hidden", () => {
    const { container } = render(<BrandLogo logoUrl="/logo.png" hidden />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the uploaded logo image with alt text when a url is set", () => {
    render(<BrandLogo logoUrl="/logo.png" />);
    const img = screen.getByRole("img", { name: "Legacy Mania" });
    expect(img).toBeInTheDocument();
  });

  it("falls back to the text wordmark when no url is set", () => {
    render(<BrandLogo />);
    expect(screen.getByText("Legacy")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("omits the wordmark text when withText is false", () => {
    render(<BrandLogo withText={false} />);
    expect(screen.queryByText("Legacy")).toBeNull();
  });
});
