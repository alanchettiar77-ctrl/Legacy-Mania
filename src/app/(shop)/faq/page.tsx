import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

export const metadata: Metadata = {
  title: "FAQ — Frequently Asked Questions",
  description:
    "Answers to common questions about ordering, payment, shipping, and returns at Legacy Mania.",
};

const faqs = [
  {
    q: "What is the minimum order quantity?",
    a: "You must add at least 5 cards to your cart before checking out. This ensures we can pack orders efficiently and keep prices low for everyone.",
  },
  {
    q: "How do I pay for my order?",
    a: "We accept UPI payments only. During checkout you'll see our UPI QR code — scan it with any UPI app (Google Pay, PhonePe, Paytm, etc.), complete the payment, and upload a screenshot. Our team verifies payments manually within 1–4 hours.",
  },
  {
    q: "How long does delivery take?",
    a: "Orders are typically dispatched within 1–2 business days after payment is verified. Delivery takes 3–7 business days depending on your location within India. Metro cities are usually faster.",
  },
  {
    q: "Are the cards original/authentic?",
    a: "Yes. Every card we sell is an original collectible. We source from verified distributors and individual collectors. We do NOT sell fakes or reprints. Each listing clearly states the condition of the card.",
  },
  {
    q: "What card conditions do you sell?",
    a: "We sell cards in Mint (M), Near Mint (NM), Lightly Played (LP), and Moderately Played (MP) conditions. Condition is clearly mentioned on each product listing.",
  },
  {
    q: "Can I return or exchange a card?",
    a: "We accept returns within 7 days of delivery if the item is significantly different from the listing description, or if it arrives damaged. Contact us via WhatsApp with photos within 24 hours of receiving your order.",
  },
  {
    q: "Do you ship to all states in India?",
    a: "Yes, we ship Pan-India. We use reliable courier services like DTDC, Delhivery, and Blue Dart. Remote areas may take a few extra days.",
  },
  {
    q: "How are cards packaged?",
    a: "Cards are shipped in rigid card sleeves, inside a hard top loader, wrapped in bubble wrap, and placed in a padded envelope or box. Rare and expensive cards get extra protection.",
  },
  {
    q: "Can I track my order?",
    a: "Yes. Once your order ships, you'll receive a tracking number via WhatsApp. You can also check your order status in the My Orders section of your account.",
  },
  {
    q: "I have a specific card I'm looking for. Can you help?",
    a: "Absolutely! Contact us on WhatsApp with the card name, set, and condition you're looking for. We'll check our inventory or source it for you.",
  },
  {
    q: "Do you buy cards from collectors?",
    a: "Yes! We're always looking to add rare cards to our collection. Reach out on WhatsApp with photos and details of the cards you want to sell.",
  },
  {
    q: "What series do you currently stock?",
    a: "We stock Pokémon, Dragon Ball Z, Naruto, One Piece, Digimon, and Yu-Gi-Oh! cards. We regularly add new arrivals, so check back often.",
  },
];

export default function FAQPage() {
  return (
    <div className="section-padding">
      <div className="container-max px-4 md:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-foreground mb-3">
              Frequently Asked Questions
            </h1>
            <p className="text-muted-foreground">
              Everything you need to know about ordering at Legacy Mania.
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <details
                key={i}
                className="group bg-card border border-border rounded-2xl overflow-hidden"
              >
                <summary className="flex items-center justify-between gap-4 px-6 py-4 cursor-pointer list-none font-semibold text-foreground hover:text-primary transition-colors">
                  {faq.q}
                  <ChevronDown className="w-5 h-5 flex-shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-6 pb-5 text-sm text-muted-foreground leading-relaxed border-t border-border pt-4">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>

          <div className="mt-12 text-center bg-accent rounded-2xl p-8">
            <p className="font-semibold text-foreground mb-2">
              Still have questions?
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Our team is available on WhatsApp 10 AM – 8 PM, Mon–Sat.
            </p>
            <Link
              href="/contact"
              className="btn-primary px-6 py-2.5 text-sm"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
