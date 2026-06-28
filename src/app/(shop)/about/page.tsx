import type { Metadata } from "next";
import { Heart, Target, Eye, Zap, Users, Award } from "lucide-react";

export const metadata: Metadata = {
  title: "About Us — Legacy Mania",
  description:
    "Learn about Legacy Mania — India's premier collectible marketplace for anime cards and nostalgic memorabilia.",
};

const values = [
  {
    icon: Heart,
    title: "Passion for Nostalgia",
    description:
      "We understand what it feels like to hold a card that takes you back to childhood Saturday mornings.",
  },
  {
    icon: Award,
    title: "Authenticity First",
    description:
      "Every product in our catalog is carefully sourced and verified for authenticity.",
  },
  {
    icon: Users,
    title: "Community Driven",
    description:
      "We exist because of our collectors. Their stories, their passion, their feedback shapes everything we do.",
  },
];

const stats = [
  { value: "10,000+", label: "Happy Collectors" },
  { value: "50,000+", label: "Cards Delivered" },
  { value: "6", label: "Anime Series" },
  { value: "India", label: "Pan-India Delivery" },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative hero-gradient py-24 overflow-hidden">
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "50px 50px" }}
        />
        <div className="container-max px-4 md:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-semibold mb-6">
            <Zap className="w-3 h-3" />
            Our Story
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Born from a{" "}
            <span className="text-gradient">Love of Anime</span>
          </h1>
          <p className="text-white/70 text-xl max-w-2xl mx-auto">
            Legacy Mania exists because every collector deserves to hold a piece
            of the stories that shaped their childhood.
          </p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* Stats */}
      <section className="section-padding bg-accent/20">
        <div className="container-max px-4 md:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl md:text-4xl font-bold text-primary mb-1">{stat.value}</p>
                <p className="text-muted-foreground text-sm">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="section-padding bg-background">
        <div className="container-max px-4 md:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            <div className="bg-card border border-border rounded-2xl p-8">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Target className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-3">Our Mission</h2>
              <p className="text-muted-foreground leading-relaxed">
                To build India&apos;s most trusted and beloved collectible marketplace — where
                every anime fan, card collector, and nostalgia seeker can find authentic,
                premium collectibles delivered right to their doorstep.
              </p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-8">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Eye className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-3">Our Vision</h2>
              <p className="text-muted-foreground leading-relaxed">
                A world where the stories that shaped generations — from Ash&apos;s first
                Pikachu encounter to Goku&apos;s Super Saiyan transformation — are preserved,
                celebrated, and collected by millions of passionate fans across India.
              </p>
            </div>
          </div>

          {/* Founder Story */}
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <p className="text-primary text-sm font-semibold uppercase tracking-wide mb-2">
                Founder Story
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                Why Legacy Mania Exists
              </h2>
            </div>

            <div className="bg-card border border-border rounded-3xl p-8 md:p-12">
              <div className="prose prose-lg max-w-none text-muted-foreground space-y-4">
                <p>
                  It started with a single Pokémon card — a holographic Charizard that a
                  young collector found tucked inside a dusty magazine at a local bookstore.
                  That moment of discovery, that rush of nostalgia and excitement, never
                  truly fades.
                </p>
                <p>
                  As we grew older and tried to recapture those memories, we realized there
                  was no dedicated, trustworthy platform in India where anime collectors
                  could find authentic cards. The market was fragmented, unorganized, and
                  filled with counterfeits.
                </p>
                <p>
                  <strong className="text-foreground">That&apos;s why we built Legacy Mania.</strong>{" "}
                  Not just as a store — but as a home for every collector who still
                  remembers getting up early on Saturday mornings to watch Pokémon, Dragon
                  Ball Z, Naruto, and One Piece.
                </p>
                <p>
                  Our promise is simple: authentic products, fair prices, and a community
                  that shares your passion for the stories that shaped generations.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="section-padding bg-accent/10">
        <div className="container-max px-4 md:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-foreground">What We Stand For</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {values.map(({ icon: Icon, title, description }) => (
              <div key={title} className="bg-card border border-border rounded-2xl p-6">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-bold text-foreground mb-2">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
