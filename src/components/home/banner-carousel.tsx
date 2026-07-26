"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { BannerRow } from "@/lib/services/banner-service";

const AUTOPLAY_MS = 6000;

export default function BannerCarousel({ banners }: { banners: BannerRow[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (banners.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % banners.length), AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [banners.length]);

  if (banners.length === 0) return null;

  return (
    <section className="relative w-full overflow-hidden" aria-label="Homepage banners">
      <div className="relative aspect-[8/3] w-full">
        <AnimatePresence mode="wait">
          {banners.map((banner, i) => {
            const href = banner.cta_url ?? (banner.category_id ? `/catalog?category=${banner.category_id}` : "/catalog");
            return (
              <motion.div
                key={banner.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: i === index ? 1 : 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="absolute inset-0"
                style={{ pointerEvents: i === index ? "auto" : "none" }}
              >
                <Image
                  src={banner.desktop_image_url}
                  alt={banner.alt_text}
                  title={banner.image_title ?? undefined}
                  aria-label={banner.aria_label ?? undefined}
                  fill
                  priority={index === 0}
                  className="object-cover"
                  sizes="100vw"
                />
                {banner.overlay_enabled && (
                  <div className="absolute inset-0 bg-black" style={{ opacity: banner.overlay_opacity }} />
                )}
                <BannerCopy banner={banner} href={href} />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {banners.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {banners.map((b, i) => (
            <button
              key={b.id}
              type="button"
              aria-label={`Show banner ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full transition-all ${
                i === index ? "w-6 bg-white" : "w-2 bg-white/50"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function BannerCopy({ banner, href }: { banner: BannerRow; href: string }) {
  if (!banner.title && !banner.subtitle && !banner.cta_text) return null;
  return (
    <div className="absolute inset-0 flex flex-col items-start justify-center gap-3 px-6 md:px-16 z-10">
      {banner.title && (
        <h2 className="text-2xl md:text-4xl font-bold text-white drop-shadow-lg">{banner.title}</h2>
      )}
      {banner.subtitle && <p className="text-sm md:text-lg text-white/90 max-w-md">{banner.subtitle}</p>}
      {banner.cta_text && (
        <Link
          href={href}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold px-6 py-3 rounded-xl transition-all"
        >
          {banner.cta_text}
        </Link>
      )}
    </div>
  );
}
