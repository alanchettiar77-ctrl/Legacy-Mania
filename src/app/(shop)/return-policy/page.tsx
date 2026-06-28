import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Return & Refund Policy",
  description:
    "Legacy Mania's return and refund policy for collectible cards and memorabilia.",
};

export default function ReturnPolicyPage() {
  return (
    <div className="section-padding">
      <div className="container-max px-4 md:px-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Return &amp; Refund Policy
          </h1>
          <p className="text-muted-foreground mb-10">Last updated: June 2026</p>

          <div className="space-y-10 text-sm text-muted-foreground leading-relaxed">
            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">
                1. Return Eligibility
              </h2>
              <p>
                We accept returns within <strong className="text-foreground">7 days</strong> of
                delivery in the following cases:
              </p>
              <ul className="list-disc pl-5 mt-3 space-y-1">
                <li>
                  The card received is significantly different from the listing
                  description (wrong card, wrong set, or misrepresented
                  condition)
                </li>
                <li>The card arrived physically damaged due to transit</li>
                <li>
                  You received an incorrect item that was not part of your order
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">
                2. Non-Returnable Items
              </h2>
              <p>We cannot accept returns for:</p>
              <ul className="list-disc pl-5 mt-3 space-y-1">
                <li>
                  Change of mind after purchase (collectibles are final sale
                  items)
                </li>
                <li>
                  Damage caused after delivery (handling damage, storage damage)
                </li>
                <li>Items returned without prior approval from our team</li>
                <li>Cards that have been graded, slabbed, or altered</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">
                3. How to Initiate a Return
              </h2>
              <ol className="list-decimal pl-5 space-y-2">
                <li>
                  Contact us on WhatsApp within 24 hours of receiving the order
                </li>
                <li>
                  Share your order number and clear photos of the item(s) and
                  packaging
                </li>
                <li>
                  Our team will review your request within 1–2 business days
                </li>
                <li>
                  If approved, we will provide a return shipping address. Please
                  ship the item back in the original packaging
                </li>
                <li>
                  Once we receive and inspect the return, we will process your
                  refund
                </li>
              </ol>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">
                4. Refunds
              </h2>
              <p>
                Approved refunds are processed within{" "}
                <strong className="text-foreground">5–7 business days</strong>. Since we
                accept UPI payments only, refunds will be made to the same UPI
                ID used for the original payment. You will be asked to share
                your UPI ID on WhatsApp.
              </p>
              <p className="mt-2">
                Original shipping charges are non-refundable unless the return
                is due to our error.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">
                5. Exchanges
              </h2>
              <p>
                We currently do not support direct exchanges. If you need a
                different item, please initiate a return (if eligible) and place
                a new order.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">
                6. Contact
              </h2>
              <p>
                For all return and refund queries, reach out to us on WhatsApp.
                Our support team operates Monday to Saturday, 10 AM – 6 PM IST.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
