import { cn } from "@/lib/utils";

interface LogoProps {
  /** Hide the wordmark, show only the mark (used in the collapsed sidebar). */
  collapsed?: boolean;
  /** Visual scale. `md` is the default header/sidebar size; `lg` for auth screens. */
  size?: "md" | "lg";
  /** Accented second word of the wordmark (e.g. "Home Equity", "Trade"). */
  accentWord?: string;
  className?: string;
}

/**
 * Hamo brand lockup — a gradient chart mark (matching the PWA app icons) plus a
 * two-tone wordmark ("Hamo" + an accented product word). Single source of truth
 * for app branding across Hamo Home Equity and its sub-apps.
 */
export default function Logo({
  collapsed = false,
  size = "md",
  accentWord = "Home Equity",
  className,
}: LogoProps) {
  const mark = size === "lg" ? "w-10 h-10 rounded-xl" : "w-8 h-8 rounded-lg";
  const glyph = size === "lg" ? 24 : 20;
  const word = size === "lg" ? "text-lg" : "text-sm";

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "flex items-center justify-center shrink-0 shadow-sm",
          mark
        )}
        style={{
          background:
            "linear-gradient(135deg, #1E40AF 0%, #3B82F6 60%, #00D68F 100%)",
        }}
      >
        <svg
          width={glyph}
          height={glyph}
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </svg>
      </div>
      {!collapsed && (
        <span className={cn("font-semibold tracking-tight whitespace-nowrap", word)}>
          <span className="text-[var(--foreground)]">Hamo</span>{" "}
          <span className="text-accent-blue">{accentWord}</span>
        </span>
      )}
    </div>
  );
}
