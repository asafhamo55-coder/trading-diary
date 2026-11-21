import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Info,
  Sparkles,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Badge — a small pill label (HomeownerHub port). Status tones use the
 * token pairs that keep text ≥4.5:1 on their subtle background in light
 * and dark. For STATUS prefer `StatusPill`, which adds an icon so state is
 * never carried by colour alone.
 */
const badgeVariants = cva(
  "inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full border font-medium leading-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary-subtle text-primary",
        solid: "border-transparent bg-primary text-primary-fg",
        success: "border-success/20 bg-success-subtle text-success",
        warning: "border-warning/25 bg-warning-subtle text-warning",
        danger: "border-danger/20 bg-danger-subtle text-danger",
        destructive: "border-danger/20 bg-danger-subtle text-danger",
        info: "border-info/20 bg-info-subtle text-info",
        neutral: "border-border bg-subtle text-foreground-secondary",
        secondary: "border-border bg-subtle text-foreground-secondary",
        /** AI-generated content (amber). */
        ai: "border-accent/30 bg-accent-subtle text-accent-fg",
        outline: "border-border-strong bg-transparent text-foreground-secondary",
      },
      size: {
        sm: "h-5 px-2 text-xs [&_svg]:size-3",
        md: "h-6 px-2.5 text-sm [&_svg]:size-3.5",
      },
    },
    defaultVariants: { variant: "default", size: "sm" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Leading icon element. */
  icon?: React.ReactNode;
}

function Badge({ className, variant, size, icon, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {icon}
      {children}
    </span>
  );
}

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral" | "ai" | "brand";

const TONE_TO_VARIANT: Record<StatusTone, NonNullable<BadgeProps["variant"]>> = {
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "info",
  neutral: "neutral",
  ai: "ai",
  brand: "default",
};

/** Default glyph per tone — the non-colour cue. */
export const STATUS_ICONS: Record<StatusTone, LucideIcon> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  info: Info,
  neutral: CircleDashed,
  ai: Sparkles,
  brand: Info,
};

export interface StatusPillProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  tone: StatusTone;
  /** Visible text. Required: a status is never colour-only. */
  label: React.ReactNode;
  /** Override the default icon for the tone (pass `null` for a dot). */
  icon?: React.ReactNode | null;
  size?: BadgeProps["size"];
}

/** Icon + text status pill. */
function StatusPill({ tone, label, icon, size, className, ...props }: StatusPillProps) {
  const Icon = STATUS_ICONS[tone];
  const glyph =
    icon === null ? (
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
    ) : (
      icon ?? <Icon aria-hidden />
    );
  return (
    <Badge variant={TONE_TO_VARIANT[tone]} size={size} icon={glyph} className={className} {...props}>
      {label}
    </Badge>
  );
}

export { Badge, StatusPill, badgeVariants };
