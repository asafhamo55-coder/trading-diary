import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium " +
    "transition-all duration-150 active:scale-[0.98] " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] " +
    "focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] " +
    "disabled:pointer-events-none disabled:opacity-60 disabled:active:scale-100 " +
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-accent-amber text-[#0C0F14] shadow-sm hover:bg-accent-amber/90 active:bg-accent-amber/80",
        secondary:
          "bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--border)] active:bg-[var(--border)]",
        outline:
          "border border-[var(--border)] bg-transparent text-[var(--foreground)] hover:border-accent-amber/50 hover:bg-[var(--muted)] active:bg-[var(--border)]",
        ghost:
          "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] active:bg-[var(--border)]",
        danger:
          "bg-loss text-white shadow-sm hover:bg-loss/90 active:bg-loss/80",
        "danger-ghost": "text-loss hover:bg-loss/10 active:bg-loss/15",
        link: "text-accent-blue underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-5",
        icon: "h-9 w-9 p-0",
        "icon-sm": "h-7 w-7 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
