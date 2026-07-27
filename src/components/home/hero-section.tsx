"use client";

import Link from "next/link";
import { ArrowRight, Sparkles, Shield, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { resolveHeroTileHref, type HeroTileLinkFields } from "@/lib/utils/hero-tile-link";

const features = [
  { icon: Shield, label: "100% Authentic" },
  { icon: Zap, label: "Fast Delivery" },
  { icon: Sparkles, label: "Premium Quality" },
];

// Tailwind's JIT compiler only includes class names it finds as literal strings in
// source — a class string built dynamically from DB data would silently not render.
// color_theme is stored as a key; this is the only place that maps it to real classes.
const COLOR_THEME_CLASSES: Record<string, string> = {
  sunrise: "from-yellow-400 to-orange-500",
  ember: "from-orange-400 to-red-500",
  citrus: "from-orange-500 to-yellow-600",
  blossom: "from-red-500 to-pink-600",
  ocean: "from-blue-400 to-cyan-500",
  violet: "from-purple-400 to-indigo-500",
};

export interface HeroTileDisplay extends HeroTileLinkFields {
  id: string;
  label: string;
  icon_emoji: string;
  color_theme: string;
  display_order: number;
  is_active: boolean;
}

// Rendered when no admin-managed tiles exist yet (fresh deploy, migration not applied,
// or the admin hasn't added any) — same "never leave the homepage broken" precedent as
// getHomepageBanners/getHomepageNotifications, but these still resolve to real category
// links rather than being decorative dead ends.
const DEFAULT_TILES: HeroTileDisplay[] = [
  { id: "default-pikachu", label: "Pikachu", icon_emoji: "⚡", color_theme: "sunrise", link_type: "category", link_value: "pokemon", display_order: 0, is_active: true },
  { id: "default-goku", label: "Goku", icon_emoji: "🐉", color_theme: "ember", link_type: "category", link_value: "dragon-ball-z", display_order: 1, is_active: true },
  { id: "default-naruto", label: "Naruto", icon_emoji: "🍃", color_theme: "citrus", link_type: "category", link_value: "naruto", display_order: 2, is_active: true },
  { id: "default-luffy", label: "Luffy", icon_emoji: "⚓", color_theme: "blossom", link_type: "category", link_value: "one-piece", display_order: 3, is_active: true },
];

export default function HeroSection({ tiles }: { tiles: HeroTileDisplay[] }) {
  const activeTiles = (tiles.length > 0 ? tiles : DEFAULT_TILES)
    .filter((t) => t.is_active)
    .slice(0, 4);

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden hero-gradient">
      {/* Background glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange-500/5 rounded-full blur-3xl" />
      </div>

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "50px 50px",
        }}
      />

      <div className="container-max px-4 md:px-8 w-full relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center py-20">
          {/* Left content */}
          <div className="text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-semibold mb-6">
                <Sparkles className="w-3 h-3" />
                India&apos;s #1 Collectible Marketplace
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-4"
            >
              Collect The{" "}
              <span className="text-gradient">Stories</span>
              {" "}That{" "}
              <span className="text-gradient">Shaped</span>
              {" "}Generations.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg text-white/70 mb-8 max-w-lg mx-auto lg:mx-0"
            >
              Pokémon, Dragon Ball Z, Naruto, One Piece — your favourite anime
              card collections, delivered across India.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-10"
            >
              <Link
                href="/catalog"
                className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold px-8 py-4 rounded-xl transition-all duration-200 active:scale-95 text-base shadow-lg shadow-primary/30"
              >
                Shop Now
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/about"
                className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-4 rounded-xl transition-all duration-200 border border-white/20 text-base"
              >
                Our Story
              </Link>
            </motion.div>

            {/* Feature badges */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-wrap gap-4 justify-center lg:justify-start"
            >
              {features.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 text-white/60 text-sm"
                >
                  <Icon className="w-4 h-4 text-primary" />
                  {label}
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right — floating card grid */}
          <div className="relative hidden lg:block">
            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
              {activeTiles.map((tile, i) => (
                <motion.div
                  key={tile.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.3 + i * 0.2 }}
                  className="animate-float"
                  style={{ animationDelay: `${i * 0.2}s` }}
                >
                  <Link
                    href={resolveHeroTileHref(tile)}
                    className={`block bg-gradient-to-br ${COLOR_THEME_CLASSES[tile.color_theme] ?? COLOR_THEME_CLASSES.sunrise} rounded-2xl p-6 flex flex-col items-center justify-center aspect-square shadow-2xl border border-white/20 transition-transform hover:scale-105`}
                  >
                    <span className="text-4xl mb-2">{tile.icon_emoji}</span>
                    <span className="text-white font-bold text-sm">{tile.label}</span>
                  </Link>
                </motion.div>
              ))}
            </div>

            {/* Stats overlay */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="absolute -bottom-4 -left-4 bg-background/90 backdrop-blur-sm border border-border rounded-2xl p-4 shadow-xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Happy Collectors</p>
                  <p className="font-bold text-foreground">10,000+</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}
