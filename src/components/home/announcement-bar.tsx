import Link from "next/link";

export interface AnnouncementItem {
  id: string;
  message: string;
  short_message: string | null;
  icon: string | null;
  cta_text: string | null;
  cta_url: string | null;
  device: string;
}

export interface AnnouncementConfig {
  marqueeSpeedSeconds?: number;
  direction?: "left" | "right";
  pauseOnHover?: boolean;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: "xs" | "sm" | "base" | "lg";
  fontWeight?: "normal" | "medium" | "semibold" | "bold";
  showOnMobile?: boolean;
  showOnDesktop?: boolean;
}

const FONT_SIZE: Record<string, string> = { xs: "text-xs", sm: "text-sm", base: "text-base", lg: "text-lg" };
const FONT_WEIGHT: Record<string, string> = {
  normal: "font-normal", medium: "font-medium", semibold: "font-semibold", bold: "font-bold",
};

/**
 * Server-rendered marquee bar. Renders nothing when there are no notifications, so it
 * never reserves empty space (no layout shift) and adds no SEO-relevant markup beyond
 * plain text in a div.
 */
export default function AnnouncementBar({
  items,
  config = {},
}: {
  items: AnnouncementItem[];
  config?: AnnouncementConfig;
}) {
  if (items.length === 0) return null;
  if (config.showOnMobile === false && config.showOnDesktop === false) return null;

  const doubled = [...items, ...items];
  const visibility =
    config.showOnMobile === false ? "hidden md:block"
    : config.showOnDesktop === false ? "md:hidden"
    : "";

  return (
    <div
      className={`w-full bg-primary overflow-hidden py-2.5 select-none ${visibility}`}
      style={config.backgroundColor ? { backgroundColor: config.backgroundColor } : undefined}
      aria-label="Store announcements"
    >
      <div
        className={`flex animate-marquee whitespace-nowrap ${
          config.pauseOnHover === false ? "" : "hover:[animation-play-state:paused]"
        }`}
        style={{
          animationDuration: `${config.marqueeSpeedSeconds ?? 30}s`,
          animationDirection: config.direction === "right" ? "reverse" : undefined,
        }}
      >
        {doubled.map((item, i) => (
          <span
            key={`${item.id}-${i}`}
            className={`inline-flex items-center gap-1 text-white px-8 shrink-0 ${
              FONT_SIZE[config.fontSize ?? "sm"]
            } ${FONT_WEIGHT[config.fontWeight ?? "medium"]}`}
            style={config.textColor ? { color: config.textColor } : undefined}
          >
            {item.icon ? `${item.icon} ` : ""}
            {item.message}
            {item.cta_text && item.cta_url && (
              <Link href={item.cta_url} className="underline underline-offset-2 ml-1 hover:opacity-80">
                {item.cta_text}
              </Link>
            )}
            <span className="mx-4 text-white/40">|</span>
          </span>
        ))}
      </div>
    </div>
  );
}
