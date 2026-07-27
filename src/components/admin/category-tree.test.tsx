import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CategoryTree from "./category-tree";
import type { CategoryWithChildren } from "@/types";

global.fetch = jest.fn();

function makeCategory(overrides: Partial<CategoryWithChildren> = {}): CategoryWithChildren {
  return {
    id: "pokemon",
    name: "Pokémon",
    slug: "pokemon",
    description: null,
    image_url: null,
    icon_url: null,
    appearance: {},
    is_featured: false,
    show_on_homepage: true,
    parent_id: null,
    display_order: 0,
    is_active: true,
    meta_title: null,
    meta_description: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    children: [],
    ...overrides,
  } as CategoryWithChildren;
}

beforeEach(() => (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) }));
afterEach(() => jest.clearAllMocks());

describe("CategoryTree", () => {
  it("renders nested categories at any depth", () => {
    const tree = [
      makeCategory({
        id: "pokemon",
        name: "Pokémon",
        children: [
          makeCategory({ id: "kanto", name: "Kanto", parent_id: "pokemon", children: [
            makeCategory({ id: "starters", name: "Starters", parent_id: "kanto" }),
          ] }),
        ],
      }),
    ];
    render(<CategoryTree categories={tree} onChanged={jest.fn()} />);
    expect(screen.getByText("Pokémon")).toBeInTheDocument();
    expect(screen.getByText("Kanto")).toBeInTheDocument();
    expect(screen.getByText("Starters")).toBeInTheDocument();
  });

  it("calls PATCH to toggle is_active when the hide/unhide control is used", async () => {
    render(<CategoryTree categories={[makeCategory({ id: "kanto", name: "Kanto", is_active: true })]} onChanged={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /hide/i }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/admin/categories/kanto",
        expect.objectContaining({ method: "PATCH", body: JSON.stringify({ is_active: false }) })
      );
    });
  });

  it("calls DELETE when the delete control is confirmed", async () => {
    window.confirm = jest.fn(() => true);
    render(<CategoryTree categories={[makeCategory({ id: "kanto", name: "Kanto" })]} onChanged={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/admin/categories/kanto",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  it("does not call DELETE when the confirmation is declined", () => {
    window.confirm = jest.fn(() => false);
    render(<CategoryTree categories={[makeCategory({ id: "kanto", name: "Kanto" })]} onChanged={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("shows a 409 error message inline instead of throwing when delete is blocked", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: "This category has products — reassign them first" }),
    });
    window.confirm = jest.fn(() => true);
    render(<CategoryTree categories={[makeCategory({ id: "kanto", name: "Kanto" })]} onChanged={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    await waitFor(() => {
      expect(screen.getByText(/reassign them first/i)).toBeInTheDocument();
    });
  });
});
