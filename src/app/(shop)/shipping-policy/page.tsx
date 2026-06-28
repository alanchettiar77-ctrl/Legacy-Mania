import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shipping Policy",
  description:
    "Information about shipping, delivery timelines, and packaging at Legacy Mania.",
};

export default function ShippingPolicyPage() {
  return (
    <div className="section-padding">
      <div className="container-max px-4 md:px-8">
        <div className="max-w-3xl mx-auto prose prose-invert max-w-none">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Shipping Policy
          </h1>
          <p className="text-muted-foreground mb-10">
            Last updated: June 2026
          </p>

          <div className="space-y-10 text-sm text-muted-foreground leading-relaxed">
            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">
                1. Shipping Coverage
              </h2>
              <p>
                Legacy Mania ships Pan-India to all states and union territories.
                We use trusted courier partners including DTDC, Delhivery, Blue
                Dart, and India Post for remote locations. We do not ship
                internationally at this time.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">
                2. Processing Time
              </h2>
              <p>
                Orders are processed within <strong className="text-foreground">1–2 business days</strong> after
                payment is verified by our team. Payment verification typically
                takes 1–4 hours during business hours (10 AM – 6 PM, Mon–Sat).
                Orders placed on Sundays or public holidays are processed the
                next business day.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">
                3. Delivery Timeline
              </h2>
              <ul className="space-y-2 list-none pl-0">
                <li className="flex justify-between bg-accent rounded-xl px-4 py-3">
                  <span>Metro cities (Mumbai, Delhi, Bangalore, Chennai, Hyderabad, Kolkata)</span>
                  <strong className="text-foreground ml-4 flex-shrink-0">2–4 days</strong>
                </li>
                <li className="flex justify-between bg-accent rounded-xl px-4 py-3">
                  <span>Tier 2 & Tier 3 cities</span>
                  <strong className="text-foreground ml-4 flex-shrink-0">4–6 days</strong>
                </li>
                <li className="flex justify-between bg-accent rounded-xl px-4 py-3">
                  <span>Remote & rural areas</span>
                  <strong className="text-foreground ml-4 flex-shrink-0">6–9 days</strong>
                </li>
              </ul>
              <p className="mt-3">
                Delivery timelines are estimates and may vary due to courier
                delays, weather, or peak seasons (festival periods).
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">
                4. Shipping Charges
              </h2>
              <p>
                Shipping charges are calculated at checkout based on the order
                weight and destination. Orders above ₹1,500 qualify for free
                shipping. The exact shipping amount is displayed before you
                confirm your order.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">
                5. Packaging
              </h2>
              <p>
                We take card packaging very seriously. Every order is packed as
                follows:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Individual card sleeves for each card</li>
                <li>Hard top loaders for all cards</li>
                <li>Bubble wrap for cushioning</li>
                <li>Padded envelope or rigid box for transit protection</li>
                <li>Extra padding for rare, high-value, or graded cards</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">
                6. Order Tracking
              </h2>
              <p>
                Once your order is dispatched, you will receive a tracking
                number via WhatsApp. You can also check your order status under{" "}
                <strong className="text-foreground">My Account → My Orders</strong>. If you
                do not receive a tracking update within 3 business days of
                payment verification, please contact us.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">
                7. Lost or Damaged Shipments
              </h2>
              <p>
                If your order is lost in transit or arrives damaged, please
                contact us within <strong className="text-foreground">24 hours</strong> of
                delivery with photos. We will investigate with the courier and
                arrange a replacement or refund as applicable.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">
                8. Incorrect Address
              </h2>
              <p>
                Please double-check your delivery address before placing your
                order. Legacy Mania is not responsible for orders delivered to
                an incorrect address provided by the customer. If you notice an
                error immediately after placing the order, contact us on
                WhatsApp right away and we will try to update it before dispatch.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">
                9. Contact
              </h2>
              <p>
                For shipping queries, reach us on WhatsApp or at the Contact
                page. We typically respond within a few hours during business
                hours.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
