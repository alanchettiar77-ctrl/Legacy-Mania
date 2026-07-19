import { render, screen } from "@testing-library/react";
import AnnouncementBar, { type AnnouncementItem } from "@/components/home/announcement-bar";

const item = (over: Partial<AnnouncementItem> = {}): AnnouncementItem => ({
  id: "n1",
  message: "🔥 Big sale!",
  short_message: null,
  icon: null,
  cta_text: null,
  cta_url: null,
  device: "both",
  ...over,
});

describe("AnnouncementBar", () => {
  it("renders nothing when there are no notifications", () => {
    const { container } = render(<AnnouncementBar items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when hidden on all devices", () => {
    const { container } = render(
      <AnnouncementBar items={[item()]} config={{ showOnMobile: false, showOnDesktop: false }} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders messages (doubled for seamless marquee)", () => {
    render(<AnnouncementBar items={[item()]} />);
    expect(screen.getAllByText(/Big sale!/)).toHaveLength(2);
  });

  it("renders a CTA link when text and url are set", () => {
    render(<AnnouncementBar items={[item({ cta_text: "Shop now", cta_url: "/catalog" })]} />);
    const links = screen.getAllByRole("link", { name: "Shop now" });
    expect(links[0]).toHaveAttribute("href", "/catalog");
  });

  it("applies configured speed and background", () => {
    const { container } = render(
      <AnnouncementBar items={[item()]} config={{ marqueeSpeedSeconds: 15, backgroundColor: "#123456" }} />
    );
    const bar = container.firstChild as HTMLElement;
    expect(bar.style.backgroundColor).toBe("rgb(18, 52, 86)");
    const track = bar.firstChild as HTMLElement;
    expect(track.style.animationDuration).toBe("15s");
  });
});
