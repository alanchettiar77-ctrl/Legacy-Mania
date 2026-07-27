import { render, screen } from "@testing-library/react";
import HeroSection from "./hero-section";

describe("HeroSection", () => {
  it("renders each tile as a link to its resolved href", () => {
    render(
      <HeroSection
        tiles={[
          {
            id: "t1",
            label: "Ash",
            icon_emoji: "🎒",
            color_theme: "sunrise",
            link_type: "category",
            link_value: "pokemon",
            display_order: 0,
            is_active: true,
          },
        ]}
      />
    );
    const link = screen.getByRole("link", { name: /ash/i });
    expect(link).toHaveAttribute("href", "/catalog/pokemon");
  });

  it("renders zero tile links when given an empty array (trusts the server-decided prop, doesn't second-guess it)", () => {
    render(<HeroSection tiles={[]} />);
    const tileLinks = screen
      .queryAllByRole("link")
      .filter((link) => link.getAttribute("href")?.startsWith("/catalog/"));
    expect(tileLinks).toHaveLength(0);
  });

  it("skips inactive tiles", () => {
    render(
      <HeroSection
        tiles={[
          {
            id: "t1",
            label: "Hidden",
            icon_emoji: "🙈",
            color_theme: "sunrise",
            link_type: "category",
            link_value: "pokemon",
            display_order: 0,
            is_active: false,
          },
        ]}
      />
    );
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
  });
});
