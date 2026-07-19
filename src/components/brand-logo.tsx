import Image from "next/image";
import { Zap } from "lucide-react";

export interface BrandLogoProps {
  logoUrl?: string;
  hidden?: boolean;
  /** Pixel height of the logo image; width scales automatically. */
  height?: number;
  /** Show the "LegacyMania" text next to the fallback mark. */
  withText?: boolean;
  textClassName?: string;
}

/**
 * Single source of truth for the site logo. Renders the uploaded logo when a
 * URL is set (and not hidden); otherwise falls back to the built-in Zap mark +
 * wordmark. Fixed height in both branches — no layout shift when the logo
 * changes or fails to load.
 */
export default function BrandLogo({
  logoUrl,
  hidden = false,
  height = 32,
  withText = true,
  textClassName = "font-bold text-lg tracking-tight text-foreground",
}: BrandLogoProps) {
  if (hidden) return null;

  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt="Legacy Mania"
        width={height * 4}
        height={height}
        priority
        className="w-auto object-contain"
        style={{ height, maxWidth: height * 6 }}
      />
    );
  }

  return (
    <span className="flex items-center gap-2">
      <span
        className="rounded-lg bg-primary flex items-center justify-center shadow-lg"
        style={{ width: height, height }}
        aria-hidden="true"
      >
        <Zap className="w-4 h-4 text-white" />
      </span>
      {withText && (
        <span className={textClassName}>
          Legacy<span className="text-primary">Mania</span>
        </span>
      )}
    </span>
  );
}
