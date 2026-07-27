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

  it("falls back to the 4 default tiles, each linking to a real category, when given an empty array", () => {
    render(<HeroSection tiles={[]} />);
    expect(screen.getByRole("link", { name: /pikachu/i })).toHaveAttribute("href", "/catalog/pokemon");
    expect(screen.getByRole("link", { name: /goku/i })).toHaveAttribute("href", "/catalog/dragon-ball-z");
    expect(screen.getByRole("link", { name: /naruto/i })).toHaveAttribute("href", "/catalog/naruto");
    expect(screen.getByRole("link", { name: /luffy/i })).toHaveAttribute("href", "/catalog/one-piece");
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
