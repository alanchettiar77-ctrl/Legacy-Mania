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
            ? displayCategories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/catalog/${cat.slug}`}
                  className="group flex flex-col items-center p-4 rounded-2xl bg-card border border-border hover:border-primary/50 hover:bg-accent/50 transition-all duration-300 card-hover"
                >
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300 overflow-hidden">
                    {cat.image_url ? (
                      <Image
                        src={cat.image_url}
                        alt={cat.name}
                        width={64}
                        height={64}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <span className="text-3xl">
                        {categoryEmojis[cat.slug] || "🃏"}
                      </span>
                    )}
                  </div>
                  <span className="font-semibold text-sm text-foreground text-center group-hover:text-primary transition-colors">
                    {cat.name}
                  </span>
                </Link>
              ))
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
