import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description:
    "Terms and conditions for using the Legacy Mania collectible marketplace.",
};

export default function TermsPage() {
  return (
    <div className="section-padding">
      <div className="container-max px-4 md:px-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Terms &amp; Conditions
          </h1>
          <p className="text-muted-foreground mb-10">Last updated: June 2026</p>

          <div className="space-y-10 text-sm text-muted-foreground leading-relaxed">
            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">
                1. Acceptance of Terms
              </h2>
              <p>
                By accessing or using the Legacy Mania website (legacymania.in),
                you agree to be bound by these Terms and Conditions. If you do
                not agree, please do not use our services.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">
                2. Use of the Platform
              </h2>
              <p>You agree to:</p>
              <ul className="list-disc pl-5 mt-3 space-y-1">
                <li>
                  Provide accurate information when creating an account or
                  placing an order
                </li>
                <li>
                  Not use the platform for any fraudulent or unlawful purpose
                </li>
                <li>
                  Not upload fake payment screenshots or misrepresent payments
                </li>
                <li>
                  Not reverse-engineer, scrape, or otherwise misuse the website
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">
                3. Orders and Payment
              </h2>
              <p>
                All orders are subject to availability. Prices are listed in
                Indian Rupees (₹) inclusive of applicable taxes. We reserve the
                right to cancel any order if payment cannot be verified or if
                items are found to be unavailable after order placement, with a
                full refund to the customer.
              </p>
              <p className="mt-2">
                We accept UPI payments only. Orders are only dispatched after
                successful payment verification by our team.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">
                4. Product Descriptions
              </h2>
              <p>
                We make every effort to accurately describe our products,
                including card condition, set, and edition. Minor colour
                variations due to screen differences may occur. If a product is
                materially different from its listing, you are eligible for a
                return per our Return Policy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">
                5. Intellectual Property
              </h2>
              <p>
                All content on Legacy Mania — including logos, images, text,
                and design — is the property of Legacy Mania or its licensors.
                You may not reproduce, redistribute, or use any content without
                prior written permission.
              </p>
              <p className="mt-2">
                Card artwork and trademarks belong to their respective owners
                (The Pokémon Company, Bandai, Toei Animation, etc.). We are
                an independent reseller and not affiliated with these companies.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">
                6. Limitation of Liability
              </h2>
              <p>
                Legacy Mania is not liable for indirect, incidental, or
                consequential damages arising from use of the platform or
                products. Our maximum liability is limited to the purchase price
                of the items in question.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">
                7. Account Termination
              </h2>
              <p>
                We reserve the right to suspend or terminate accounts that
                violate these terms, engage in fraudulent activity, or abuse
                our return policy. Repeated fraudulent payment reports will
                result in permanent bans.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">
                8. Changes to Terms
              </h2>
              <p>
                We may update these Terms from time to time. Continued use of
                the platform after changes constitutes acceptance of the new
                terms. We will notify users of significant changes via email or
                a site notice.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">
                9. Governing Law
              </h2>
              <p>
                These Terms are governed by the laws of India. Any disputes
                shall be subject to the exclusive jurisdiction of courts in
                Mumbai, Maharashtra.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">
                10. Contact
              </h2>
              <p>
                For questions about these Terms, email{" "}
                <a
                  href="mailto:support@legacymania.in"
                  className="text-primary hover:underline"
                >
                  support@legacymania.in
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
