import Link from "next/link";
import Image from "next/image";
import type { Category } from "@/types";
import { ArrowRight } from "lucide-react";

const categoryEmojis: Record<string, string> = {
  pokemon: "⚡",
  "dragon-ball-z": "🐉",
  naruto: "🍃",
  "one-piece": "⚓",
  digimon: "🦊",
  "yu-gi-oh": "🃏",
};

interface PopularCategoriesProps {
  categories: Category[];
}

const RADIUS: Record<string, string> = {
  none: "rounded-none", sm: "rounded-sm", md: "rounded-md", lg: "rounded-lg",
  xl: "rounded-xl", "2xl": "rounded-2xl", full: "rounded-full",
};
const SHADOW: Record<string, string> = {
  none: "", sm: "shadow-sm", md: "shadow-md", lg: "shadow-lg",
};

export default function PopularCategories({ categories }: PopularCategoriesProps) {
  const displayCategories = categories.slice(0, 6);

  return (
    <section className="section-padding bg-background">
      <div className="container-max">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <p className="text-primary text-sm font-semibold uppercase tracking-wide mb-1">
              Collections
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Browse by Series
            </h2>
          </div>
          <Link
            href="/catalog"
            className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            View All
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {displayCategories.length > 0
            ? displayCategories.map((cat) => {
                const a = (cat.appearance ?? {}) as Record<string, string | boolean>;
                const radius = RADIUS[String(a.borderRadius ?? "2xl")] ?? "rounded-2xl";
                const shadow = SHADOW[String(a.shadow ?? "none")] ?? "";
                const animate = a.animationEnabled === false ? "" : "card-hover group-hover:scale-110";
                const iconSrc = cat.icon_url || cat.image_url;
                return (
                  <Link
                    key={cat.id}
                    href={`/catalog/${cat.slug}`}
                    className={`group relative flex flex-col items-center p-4 ${radius} ${shadow} bg-card border border-border hover:border-primary/50 hover:bg-accent/50 transition-all duration-300 ${a.animationEnabled === false ? "" : "card-hover"}`}
                    style={{
                      ...(typeof a.backgroundColor === "string" && a.backgroundColor
                        ? { backgroundColor: a.backgroundColor }
                        : {}),
                      ...(typeof a.gradient === "string" && a.gradient
                        ? { backgroundImage: a.gradient }
                        : {}),
                      ...(typeof a.borderColor === "string" && a.borderColor
                        ? { borderColor: a.borderColor }
                        : {}),
                    }}
                  >
                    {typeof a.badge === "string" && a.badge && (
                      <span className="absolute -top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-white">
                        {a.badge}
                      </span>
                    )}
                    <div
                      className={`w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mb-3 transition-transform duration-300 overflow-hidden ${animate}`}
                    >
                      {iconSrc ? (
                        <Image
                          src={iconSrc}
                          alt={`${cat.name} icon`}
                          width={64}
                          height={64}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <span className="text-3xl" aria-hidden="true">
                          {categoryEmojis[cat.slug] || "🃏"}
                        </span>
                      )}
                    </div>
                    <span
                      className="font-semibold text-sm text-foreground text-center group-hover:text-primary transition-colors"
                      style={
                        typeof a.textColor === "string" && a.textColor
                          ? { color: a.textColor }
                          : undefined
                      }
                    >
                      {cat.name}
                    </span>
                  </Link>
                );
              })
            : // Fallback placeholders
              [
                { slug: "pokemon", name: "Pokémon", emoji: "⚡" },
                { slug: "dragon-ball-z", name: "Dragon Ball Z", emoji: "🐉" },
                { slug: "naruto", name: "Naruto", emoji: "🍃" },
                { slug: "one-piece", name: "One Piece", emoji: "⚓" },
                { slug: "digimon", name: "Digimon", emoji: "🦊" },
                { slug: "yu-gi-oh", name: "Yu-Gi-Oh!", emoji: "🃏" },
              ].map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/catalog/${cat.slug}`}
                  className="group flex flex-col items-center p-4 rounded-2xl bg-card border border-border hover:border-primary/50 hover:bg-accent/50 transition-all duration-300 card-hover"
                >
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                    <span className="text-3xl">{cat.emoji}</span>
                  </div>
                  <span className="font-semibold text-sm text-foreground text-center group-hover:text-primary transition-colors">
                    {cat.name}
                  </span>
                </Link>
              ))}
        </div>
      </div>
    </section>
  );
}
