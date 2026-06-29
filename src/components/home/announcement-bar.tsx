const announcements = [
  "🎉 New Pokémon Scarlet & Violet sets now in stock!",
  "🚚 Free shipping on orders above ₹999",
  "⚡ 100% Authentic cards — every single one",
  "🐉 Dragon Ball Z Fusion World cards available",
  "🍃 Naruto Kayou cards back in stock",
  "🏴‍☠️ One Piece Card Game — latest sets in",
  "✨ Premium quality. Delivered across India.",
];

export default function AnnouncementBar() {
  const items = [...announcements, ...announcements];

  return (
    <div className="w-full bg-primary overflow-hidden py-2.5 select-none">
      <div className="flex animate-marquee hover:[animation-play-state:paused] whitespace-nowrap">
        {items.map((text, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 text-white text-sm font-medium px-8 shrink-0"
          >
            {text}
            <span className="mx-4 text-white/40">|</span>
          </span>
        ))}
      </div>
    </div>
  );
}
