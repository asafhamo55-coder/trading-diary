import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Button — restyled to HomeownerHub's (packages/ui Button.tsx). One primary
 * per view; everything else is `secondary`/`outline` or `ghost`.
 * Sizes: sm 32px, default/md 36px, lg 44px; on touch pointers sm/md lift
 * to a 44px target. Existing variant names (`primary`, `danger`,
 * `danger-ghost`, …) are kept so current call sites keep working.
 */
const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium",
    "transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-standard",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg shadow-xs hover:bg-primary-hover",
        default: "bg-primary text-primary-fg shadow-xs hover:bg-primary-hover",
        secondary:
          "border border-border-strong bg-surface text-foreground shadow-xs hover:bg-subtle hover:border-input/60",
        outline:
          "border border-border-strong bg-surface text-foreground shadow-xs hover:bg-subtle hover:border-input/60",
        ghost: "bg-transparent text-foreground-secondary hover:bg-subtle hover:text-foreground",
        subtle: "bg-primary-subtle text-primary hover:bg-primary/15",
        danger: "bg-danger-solid text-on-solid shadow-xs hover:bg-danger-solid/90",
        destructive: "bg-danger-solid text-on-solid shadow-xs hover:bg-danger-solid/90",
        "danger-ghost": "bg-transparent text-danger hover:bg-danger-subtle",
        "destructive-ghost": "bg-transparent text-danger hover:bg-danger-subtle",
        link: "h-auto min-h-6 bg-transparent px-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        xs: "h-7 px-2.5 text-xs coarse:min-h-11 [&_svg]:size-3.5",
        sm: "h-8 px-3 text-sm coarse:min-h-11 [&_svg]:size-4",
        default: "h-9 px-3.5 text-sm coarse:min-h-11 [&_svg]:size-4",
        md: "h-9 px-3.5 text-sm coarse:min-h-11 [&_svg]:size-4",
        lg: "h-11 px-5 text-base [&_svg]:size-[18px]",
        icon: "size-9 coarse:size-11 [&_svg]:size-4",
        "icon-sm": "size-8 coarse:size-11 [&_svg]:size-4",
        "icon-xs": "size-7 coarse:size-11 [&_svg]:size-3.5",
      },
    },
    compoundVariants: [{ variant: "link", className: "h-auto px-0" }],
    defaultVariants: { variant: "primary", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Shows a spinner, disables the button and sets aria-busy. */
  loading?: boolean;
  /** Leading icon (a lucide element). Swapped for the spinner while loading. */
  icon?: React.ReactNode;
  /** Trailing icon, e.g. a chevron or arrow. */
  iconRight?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, disabled, icon, iconRight, children, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props}>
          {children}
        </Slot>
      );
    }
    const isIconOnly = size === "icon" || size === "icon-sm" || size === "icon-xs";
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <Loader2 className="animate-spin" aria-hidden /> : (icon ?? null)}
        {isIconOnly && loading ? null : children}
        {iconRight ?? null}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
