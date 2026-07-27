import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CategoryForm from "./category-form";

const mockPush = jest.fn();
const mockRefresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

global.fetch = jest.fn();

beforeEach(() => (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) }));
afterEach(() => jest.clearAllMocks());

describe("CategoryForm", () => {
  it("auto-slugs from the name on create only", () => {
    render(<CategoryForm parentCategories={[]} excludeCategoryIds={[]} />);
    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: "T-Shirts" } });
    expect(screen.getByLabelText(/^slug/i)).toHaveValue("t-shirts");
  });

  it("does not auto-slug when editing an existing category", () => {
    render(
      <CategoryForm
        parentCategories={[]}
        excludeCategoryIds={[]}
        initialData={{ id: "cat-1", name: "Kanto", slug: "kanto" }}
      />
    );
    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: "Kanto Region" } });
    expect(screen.getByLabelText(/^slug/i)).toHaveValue("kanto");
  });

  it("excludes the category itself and its descendants from the parent dropdown", () => {
    render(
      <CategoryForm
        parentCategories={[
          { id: "pokemon", name: "Pokémon" },
          { id: "kanto", name: "Kanto" },
          { id: "starters", name: "Starters" },
        ]}
        excludeCategoryIds={["kanto", "starters"]}
        initialData={{ id: "kanto", name: "Kanto", slug: "kanto" }}
      />
    );
    expect(screen.queryByRole("option", { name: "Kanto" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Starters" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Pokémon" })).toBeInTheDocument();
  });

  it("submits SEO fields alongside content fields", async () => {
    render(<CategoryForm parentCategories={[]} excludeCategoryIds={[]} />);
    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: "Kanto" } });
    fireEvent.change(screen.getByLabelText(/meta title/i), { target: { value: "Kanto — Legacy Mania" } });
    fireEvent.click(screen.getByRole("button", { name: /add category/i }));
    await waitFor(() => {
      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.meta_title).toBe("Kanto — Legacy Mania");
    });
  });
});
