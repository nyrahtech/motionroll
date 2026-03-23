"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "focus-ring inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius-md)] border text-sm font-medium transition-all duration-[var(--motion-base)] ease-[var(--ease-standard)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-[rgba(220,243,255,0.2)] bg-[rgba(220,243,255,0.94)] text-[var(--accent-foreground)] hover:bg-[var(--accent-strong)]",
        secondary:
          "border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.05)] text-[var(--foreground)] hover:bg-[rgba(255,255,255,0.08)]",
        ghost:
          "border-transparent bg-transparent text-[var(--foreground-soft)] hover:bg-[rgba(255,255,255,0.05)] hover:text-[var(--foreground)]",
        outline:
          "border-[rgba(255,255,255,0.05)] bg-transparent text-[var(--foreground)] hover:bg-[rgba(255,255,255,0.05)]",
        quiet:
          "border-transparent bg-transparent text-[var(--foreground-muted)] hover:bg-[rgba(255,255,255,0.05)] hover:text-[var(--foreground)]",
      },
      size: {
        default: "h-8 px-3",
        sm: "h-7 px-2.5 text-xs",
        lg: "h-9 px-4 text-sm",
        icon: "h-7 w-7",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
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
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
