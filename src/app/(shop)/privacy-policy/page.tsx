import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Legacy Mania's privacy policy — how we collect, use, and protect your data.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="section-padding">
      <div className="container-max px-4 md:px-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Privacy Policy
          </h1>
          <p className="text-muted-foreground mb-10">Last updated: June 2026</p>

          <div className="space-y-10 text-sm text-muted-foreground leading-relaxed">
            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">
                1. Information We Collect
              </h2>
              <p>When you use Legacy Mania, we may collect:</p>
              <ul className="list-disc pl-5 mt-3 space-y-1">
                <li>
                  <strong className="text-foreground">Account information</strong> — name, email,
                  phone number when you register
                </li>
                <li>
                  <strong className="text-foreground">Delivery addresses</strong> — to fulfil your
                  orders
                </li>
                <li>
                  <strong className="text-foreground">Order data</strong> — items purchased, order
                  history, payment screenshots
                </li>
                <li>
                  <strong className="text-foreground">Usage data</strong> — pages visited,
                  products viewed (via Google Analytics / GTM)
                </li>
                <li>
                  <strong className="text-foreground">Device data</strong> — browser type, IP
                  address, operating system
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">
                2. How We Use Your Information
              </h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>To process and fulfil your orders</li>
                <li>To send order confirmations and shipping updates</li>
                <li>To provide customer support</li>
                <li>
                  To improve our website and product catalog based on usage
                  patterns
                </li>
                <li>To prevent fraud and ensure platform security</li>
              </ul>
              <p className="mt-3">
                We do not sell, rent, or trade your personal information to
                third parties.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">
                3. Payment Information
              </h2>
              <p>
                We accept UPI payments only. We do not store your UPI ID,
                bank account number, or any financial credentials. Payment
                screenshots uploaded for verification are stored securely in
                our private storage and are only accessible to our admin team.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">
                4. Cookies and Analytics
              </h2>
              <p>
                We use cookies to maintain your session and personalise your
                experience. We use Google Analytics (GA4) and Google Tag
                Manager to understand how visitors use our site. This data is
                aggregated and anonymised. You can opt out of analytics tracking
                via your browser settings.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">
                5. Data Storage and Security
              </h2>
              <p>
                Your data is stored on Supabase (hosted in secure cloud
                infrastructure). We implement Row Level Security on all database
                tables so users can only access their own data. We use HTTPS
                for all data transmission.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">
                6. Data Retention
              </h2>
              <p>
                We retain your account and order data as long as your account
                is active. If you request account deletion, we will delete your
                personal data within 30 days, except where retention is required
                by law.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">
                7. Your Rights
              </h2>
              <p>You have the right to:</p>
              <ul className="list-disc pl-5 mt-3 space-y-1">
                <li>Access the personal data we hold about you</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your account and data</li>
                <li>Withdraw consent for marketing communications</li>
              </ul>
              <p className="mt-3">
                To exercise any of these rights, contact us via WhatsApp or
                email.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">
                8. Third-Party Services
              </h2>
              <p>
                We use the following third-party services, each with their own
                privacy policies:
              </p>
              <ul className="list-disc pl-5 mt-3 space-y-1">
                <li>Supabase — database and authentication</li>
                <li>Vercel — web hosting</li>
                <li>Google Analytics — usage analytics</li>
                <li>WhatsApp — customer communication</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">
                9. Contact
              </h2>
              <p>
                If you have questions about this privacy policy or your data,
                contact us at{" "}
                <a
                  href="mailto:support@legacymania.in"
                  className="text-primary hover:underline"
                >
                  support@legacymania.in
                </a>{" "}
                or via WhatsApp.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
