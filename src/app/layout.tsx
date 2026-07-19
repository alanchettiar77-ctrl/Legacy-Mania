import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "sonner";
import WhatsAppButton from "@/components/layout/whatsapp-button";
import { CartProvider } from "@/components/providers/cart-provider";
import AnalyticsProvider from "@/components/providers/analytics-provider";
import { getBranding } from "@/lib/services/branding-service";

const baseMetadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://legacymania.in"
  ),
  title: {
    default: "Legacy Mania — Collect The Stories That Shaped Generations",
    template: "%s | Legacy Mania",
  },
  description:
    "India's premier collectible marketplace for anime cards, trading cards, Pokémon, Dragon Ball Z, Naruto, One Piece and nostalgic memorabilia.",
  keywords: [
    "pokemon cards india",
    "anime collectibles",
    "trading cards",
    "dragon ball z cards",
    "naruto cards",
    "one piece cards",
    "collectible marketplace",
    "nostalgia",
    "legacy mania",
  ],
  authors: [{ name: "Legacy Mania" }],
  creator: "Legacy Mania",
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "/",
    siteName: "Legacy Mania",
    title: "Legacy Mania — Collect The Stories That Shaped Generations",
    description:
      "India's premier collectible marketplace for anime cards, trading cards and nostalgic memorabilia.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Legacy Mania",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Legacy Mania",
    description:
      "Collect The Stories That Shaped Generations. India's premier anime collectible marketplace.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "t8s3BFcnydu1pfYODHIBsNR9W0YwwfhbesweFXfzqr0",
  },
};

/**
 * Merges admin-managed branding assets (favicon, apple touch icon, OG/Twitter
 * images, PWA icon) over the static base metadata. Empty slots keep the defaults.
 */
export async function generateMetadata(): Promise<Metadata> {
  const branding = await getBranding();

  const icons: Metadata["icons"] | undefined =
    branding.favicon_url || branding.apple_touch_icon_url || branding.pwa_icon_url
      ? {
          ...(branding.favicon_url ? { icon: branding.favicon_url } : {}),
          ...(branding.apple_touch_icon_url ? { apple: branding.apple_touch_icon_url } : {}),
          ...(branding.pwa_icon_url
            ? { other: [{ rel: "icon", url: branding.pwa_icon_url, sizes: "512x512" }] }
            : {}),
        }
      : undefined;

  return {
    ...baseMetadata,
    ...(icons ? { icons } : {}),
    openGraph: {
      ...baseMetadata.openGraph,
      ...(branding.og_image_url
        ? { images: [{ url: branding.og_image_url, width: 1200, height: 630, alt: "Legacy Mania" }] }
        : {}),
    },
    twitter: {
      ...baseMetadata.twitter,
      ...(branding.twitter_card_url ? { images: [branding.twitter_card_url] } : {}),
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f23" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased min-h-screen bg-background font-sans" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <CartProvider>
            <AnalyticsProvider>
              {children}
              <WhatsAppButton />
              <Toaster position="top-center" richColors />
            </AnalyticsProvider>
          </CartProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
