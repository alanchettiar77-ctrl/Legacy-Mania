import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toaster } from "sonner";
import ProductForm from "@/components/admin/product-form";

const originalFetch = global.fetch;

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

describe("ProductForm image upload", () => {
  afterEach(() => {
    jest.clearAllMocks();
    global.fetch = originalFetch;
  });

  it("uploads a selected file through POST /api/media/upload with the products namespace", async () => {
    const user = userEvent.setup();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ path: "products/x.png", publicUrl: "https://example.com/x.png", dimensionWarning: null }),
    }) as unknown as typeof fetch;

    render(<ProductForm categories={[]} />);

    const file = new File(["data"], "card.png", { type: "image/png" });
    const input = screen.getByLabelText(/upload images/i, { selector: "input" });
    await user.upload(input, file);

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/media/upload",
      expect.objectContaining({ method: "POST" })
    );
    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    const sentFormData = options.body as FormData;
    expect(sentFormData.get("namespace")).toBe("products");
    expect(await screen.findByAltText("Image 1")).toBeInTheDocument();
  });

  it("shows an error toast when the upload API returns an error", async () => {
    const user = userEvent.setup();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "File exceeds the 2MB maximum size." }),
    }) as unknown as typeof fetch;

    render(
      <>
        <ProductForm categories={[]} />
        <Toaster />
      </>
    );

    const file = new File(["data"], "card.png", { type: "image/png" });
    const input = screen.getByLabelText(/upload images/i, { selector: "input" });
    await user.upload(input, file);

    expect(await screen.findByText(/File exceeds the 2MB maximum size\./)).toBeInTheDocument();
  });
});
