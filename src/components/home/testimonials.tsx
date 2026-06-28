const testimonials = [
  {
    name: "Arjun Sharma",
    location: "Mumbai",
    avatar: "AS",
    text: "Finally found a place in India where I can get authentic Pokémon cards! The quality is incredible and delivery was super fast.",
    rating: 5,
    series: "Pokémon Fan",
  },
  {
    name: "Priya Krishnan",
    location: "Bangalore",
    avatar: "PK",
    text: "I've been looking for Dragon Ball Z cards for years. Legacy Mania had exactly what I needed. Amazing collection!",
    rating: 5,
    series: "DBZ Collector",
  },
  {
    name: "Rahul Mehta",
    location: "Delhi",
    avatar: "RM",
    text: "The Naruto card collection is absolutely fire! Great packaging, no damage. Will definitely order again.",
    rating: 5,
    series: "Naruto Fan",
  },
  {
    name: "Sneha Patel",
    location: "Pune",
    avatar: "SP",
    text: "Best anime collectible store in India. The customer service via WhatsApp was very helpful and responsive.",
    rating: 5,
    series: "One Piece Fan",
  },
];

export default function Testimonials() {
  return (
    <section className="section-padding bg-accent/20">
      <div className="container-max">
        <div className="text-center mb-12">
          <p className="text-primary text-sm font-semibold uppercase tracking-wide mb-1">
            Community
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            What Collectors Say
          </h2>
          <p className="text-muted-foreground mt-2 max-w-lg mx-auto">
            Join thousands of happy collectors across India
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-4 hover:border-primary/30 transition-colors"
            >
              <div className="flex">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <span key={i} className="text-yellow-400 text-sm">★</span>
                ))}
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed flex-1">
                &ldquo;{t.text}&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center flex-shrink-0">
                  {t.avatar}
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.location} · {t.series}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
