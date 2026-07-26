import { render, screen } from "@testing-library/react";
import BannerCarousel from "@/components/home/banner-carousel";
import type { BannerRow } from "@/lib/services/banner-service";

jest.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    { get: () => (props: React.ComponentProps<"div">) => <div {...props} /> }
  ),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function makeBanner(overrides: Partial<BannerRow> = {}): BannerRow {
  return {
    id: "b1",
    title: "Summer Sale",
    subtitle: null,
    cta_text: "Shop Now",
    cta_url: "/catalog",
    category_id: null,
    desktop_image_url: "https://example.com/desktop.webp",
    mobile_image_url: null,
    alt_text: "Summer sale",
    aria_label: null,
    image_title: null,
    overlay_enabled: false,
    overlay_opacity: 0.4,
    banner_type: "image",
    video_url: null,
    display_order: 0,
    is_active: true,
    start_date: null,
    end_date: null,
    seo_meta_title: null,
    seo_meta_description: null,
    seo_keywords: null,
    og_title: null,
    og_description: null,
    og_image_url: null,
    canonical_url: null,
    schema_type: null,
    created_by: null,
    updated_by: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

describe("BannerCarousel", () => {
  it("renders nothing when there are no banners", () => {
    const { container } = render(<BannerCarousel banners={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a slide for each banner", () => {
    render(<BannerCarousel banners={[makeBanner({ id: "b1" }), makeBanner({ id: "b2", title: "Second" })]} />);
    expect(screen.getByText("Summer Sale")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
  });

  it("links the CTA to cta_url", () => {
    render(<BannerCarousel banners={[makeBanner()]} />);
    expect(screen.getByRole("link", { name: "Shop Now" })).toHaveAttribute("href", "/catalog");
  });

  it("uses alt_text on the banner image", () => {
    render(<BannerCarousel banners={[makeBanner()]} />);
    expect(screen.getByAltText("Summer sale")).toBeInTheDocument();
  });
});
