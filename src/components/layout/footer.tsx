import Link from "next/link";
import { Instagram, Twitter, Youtube } from "lucide-react";
import BrandLogo from "@/components/brand-logo";

const footerLinks = {
  shop: [
    { href: "/catalog", label: "Browse Catalog" },
    { href: "/catalog/pokemon", label: "Pokémon Cards" },
    { href: "/catalog/dragon-ball-z", label: "Dragon Ball Z" },
    { href: "/catalog/naruto", label: "Naruto" },
    { href: "/catalog/one-piece", label: "One Piece" },
  ],
  account: [
    { href: "/account", label: "My Account" },
    { href: "/account/orders", label: "My Orders" },
    { href: "/account/wishlist", label: "Wishlist" },
    { href: "/login", label: "Login" },
    { href: "/register", label: "Register" },
  ],
  info: [
    { href: "/about", label: "About Us" },
    { href: "/contact", label: "Contact" },
    { href: "/faq", label: "FAQ" },
    { href: "/shipping-policy", label: "Shipping Policy" },
    { href: "/return-policy", label: "Return Policy" },
    { href: "/privacy-policy", label: "Privacy Policy" },
    { href: "/terms", label: "Terms & Conditions" },
  ],
};

export default function Footer({
  logoUrl,
  logoHidden,
}: {
  logoUrl?: string;
  logoHidden?: boolean;
}) {
  return (
    <footer className="bg-background border-t border-border">
      <div className="container-max px-4 md:px-8 py-12 md:py-16">
        {/* Top section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-10">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4" aria-label="Legacy Mania home">
              <BrandLogo logoUrl={logoUrl} hidden={logoHidden} textClassName="font-bold text-xl" />
            </Link>
            <p className="text-muted-foreground text-sm leading-relaxed mb-4 max-w-xs">
              India&apos;s premier collectible marketplace for anime cards,
              trading cards, and nostalgic memorabilia. Collect the stories that
              shaped generations.
            </p>
            <div className="flex items-center gap-3">
              <a
                href="#"
                className="p-2 rounded-lg bg-accent hover:bg-primary hover:text-white transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href="#"
                className="p-2 rounded-lg bg-accent hover:bg-primary hover:text-white transition-colors"
                aria-label="Twitter"
              >
                <Twitter className="w-4 h-4" />
              </a>
              <a
                href="#"
                className="p-2 rounded-lg bg-accent hover:bg-primary hover:text-white transition-colors"
                aria-label="YouTube"
              >
                <Youtube className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Shop */}
          <div>
            <h3 className="font-semibold text-sm text-foreground mb-3 uppercase tracking-wide">
              Shop
            </h3>
            <ul className="space-y-2">
              {footerLinks.shop.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Account */}
          <div>
            <h3 className="font-semibold text-sm text-foreground mb-3 uppercase tracking-wide">
              Account
            </h3>
            <ul className="space-y-2">
              {footerLinks.account.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Info */}
          <div>
            <h3 className="font-semibold text-sm text-foreground mb-3 uppercase tracking-wide">
              Info
            </h3>
            <ul className="space-y-2">
              {footerLinks.info.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-border pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Legacy Mania. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Made with ❤️ for collectors across India
          </p>
        </div>
      </div>
    </footer>
  );
}
