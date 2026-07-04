import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FAQAccordion from "@/components/faq/FAQAccordion";

const faqs = [
  { id: "1", question: "What products does Legacy Mania sell?", answer: "Collectibles and memorabilia." },
  { id: "2", question: "Do you offer Cash on Delivery (COD)?", answer: "No, prepaid only." },
];

describe("FAQAccordion", () => {
  it("renders every question", () => {
    render(<FAQAccordion faqs={faqs} />);
    expect(screen.getByText("What products does Legacy Mania sell?")).toBeInTheDocument();
    expect(screen.getByText("Do you offer Cash on Delivery (COD)?")).toBeInTheDocument();
  });

  it("hides answers until their question is clicked, then shows it", async () => {
    const user = userEvent.setup();
    render(<FAQAccordion faqs={faqs} />);

    expect(screen.queryByText("Collectibles and memorabilia.")).not.toBeInTheDocument();

    await user.click(screen.getByText("What products does Legacy Mania sell?"));

    expect(screen.getByText("Collectibles and memorabilia.")).toBeVisible();
  });

  it("exposes accordion triggers as buttons for keyboard/AT accessibility", () => {
    render(<FAQAccordion faqs={faqs} />);
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });
});
