import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import { getBranding } from "@/lib/services/branding-service";

export default async function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Cached (5 min, tag-revalidated on admin edits) — one source of truth for the logo.
  const branding = await getBranding();

  return (
    <>
      <Navbar logoUrl={branding.logo_url || undefined} logoHidden={branding.logo_hidden} />
      <main className="min-h-screen pt-16">{children}</main>
      <Footer logoUrl={branding.logo_url || undefined} logoHidden={branding.logo_hidden} />
    </>
  );
}
