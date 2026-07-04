import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import FAQAccordion from "@/components/faq/FAQAccordion";

export const metadata: Metadata = {
  title: "FAQ — Frequently Asked Questions",
  description:
    "Answers to common questions about products, payments, shipping, and returns at Legacy Mania.",
};

export default async function FAQPage() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: faqs } = await db
    .from("faqs")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: (faqs ?? []).map((faq: { question: string; answer: string }) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };

  return (
    <div className="section-padding">
      <script
        type="application/ld+json"
        // Escape "<" so an admin-authored answer containing the literal text "</script>"
        // can't prematurely close this tag. "<" is a valid JSON escape for "<" that
        // JSON.parse (and structured-data parsers) decode back to a literal "<" unchanged.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <div className="container-max px-4 md:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-foreground mb-3">
              Frequently Asked Questions
            </h1>
            <p className="text-muted-foreground">
              Everything you need to know about shopping at Legacy Mania.
            </p>
          </div>

          {faqs && faqs.length > 0 ? (
            <FAQAccordion faqs={faqs} />
          ) : (
            <p className="text-center text-muted-foreground py-12">
              No FAQs yet — check back soon, or contact us with your question.
            </p>
          )}

          <div className="mt-12 text-center bg-accent rounded-2xl p-8">
            <p className="font-semibold text-foreground mb-2">
              Still have questions?
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Our team is available on WhatsApp 10 AM – 8 PM, Mon–Sat.
            </p>
            <Link href="/contact" className="btn-primary px-6 py-2.5 text-sm">
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
