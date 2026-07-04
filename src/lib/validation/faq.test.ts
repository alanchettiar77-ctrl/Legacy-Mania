import { faqCreateSchema, faqUpdateSchema } from "@/lib/validation/faq";

describe("faqCreateSchema", () => {
  it("accepts a valid question/answer pair", () => {
    const result = faqCreateSchema.safeParse({
      question: "Do you ship internationally?",
      answer: "Currently we only ship within India.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty question", () => {
    const result = faqCreateSchema.safeParse({ question: "  ", answer: "Some answer" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty answer", () => {
    const result = faqCreateSchema.safeParse({ question: "Some question?", answer: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a question over 500 characters", () => {
    const result = faqCreateSchema.safeParse({
      question: "a".repeat(501),
      answer: "Some answer",
    });
    expect(result.success).toBe(false);
  });

  it("strips stray control characters from question and answer", () => {
    const result = faqCreateSchema.safeParse({
      question: "Do you ship\x07 internationally?",
      answer: "Yes\x00, we do\x1F.",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.question).toBe("Do you ship internationally?");
      expect(result.data.answer).toBe("Yes, we do.");
    }
  });

  it("preserves newlines and tabs in the answer", () => {
    const result = faqCreateSchema.safeParse({
      question: "Some question?",
      answer: "Line one\nLine two\tindented",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.answer).toBe("Line one\nLine two\tindented");
    }
  });
});

describe("faqUpdateSchema", () => {
  it("accepts a partial update with only is_active", () => {
    const result = faqUpdateSchema.safeParse({ is_active: false });
    expect(result.success).toBe(true);
  });

  it("accepts a partial update with only display_order", () => {
    const result = faqUpdateSchema.safeParse({ display_order: 3 });
    expect(result.success).toBe(true);
  });

  it("rejects a negative display_order", () => {
    const result = faqUpdateSchema.safeParse({ display_order: -1 });
    expect(result.success).toBe(false);
  });

  it("accepts an empty object (no-op update)", () => {
    const result = faqUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
