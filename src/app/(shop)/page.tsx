import type { Metadata } from "next";
import HeroSection from "@/components/home/hero-section";
import AnnouncementBar from "@/components/home/announcement-bar";
import FeaturedCollections from "@/components/home/featured-collections";
import LatestReleases from "@/components/home/latest-releases";
import PopularCategories from "@/components/home/popular-categories";
import Testimonials from "@/components/home/testimonials";
import WhatsAppCTA from "@/components/home/whatsapp-cta";
import Newsletter from "@/components/home/newsletter";
import { createClient } from "@/lib/supabase/server";
import { getHomepageNotifications } from "@/lib/services/notification-service";
import { getHomepageCategories } from "@/lib/services/branding-service";

export const metadata: Metadata = {
  title: "Legacy Mania — Collect The Stories That Shaped Generations",
  description:
    "India's premier collectible marketplace for Pokémon, Dragon Ball Z, Naruto, One Piece cards and nostalgic memorabilia.",
};

export default async function HomePage() {
  const supabase = await createClient();

  const [notifications, categories, { data: featured }, { data: latest }] =
    await Promise.all([
      getHomepageNotifications("both"),
      // Admin-managed: honors show_on_homepage + display_order, cached with tag revalidation
      getHomepageCategories(),
      supabase
        .from("products")
        .select("*")
        .eq("is_featured", true)
        .eq("is_active", true)
        .limit(8),
      supabase
        .from("products")
        .select("*, category:categories(*)")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

  return (
    <>
      <AnnouncementBar items={notifications.items} config={notifications.config} />
      <HeroSection />
      <FeaturedCollections products={featured ?? []} />
      <PopularCategories categories={categories} />
      <LatestReleases products={latest ?? []} />
      <Testimonials />
      <WhatsAppCTA />
      <Newsletter />
    </>
  );
}
