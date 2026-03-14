"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ColorInputProps = Omit<React.ComponentProps<"input">, "type">;

export const ColorInput = React.forwardRef<HTMLInputElement, ColorInputProps>(
  ({ className, value = "#ffffff", disabled, ...props }, ref) => {
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
      setMounted(true);
    }, []);

    const baseClassName = cn(
      "focus-ring flex h-8 w-full rounded-[var(--radius-sm)] border border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.035)] px-1.5 py-1 text-sm text-[var(--foreground)] transition-colors duration-[var(--motion-fast)] ease-[var(--ease-standard)]",
      disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      className,
    );

    if (!mounted) {
      return (
        <div
          aria-hidden="true"
          className={baseClassName}
          style={{ backgroundColor: String(value) }}
        />
      );
    }

    return (
      <input
        ref={ref}
        type="color"
        disabled={disabled}
        value={value}
        className={baseClassName}
        {...props}
      />
    );
  },
);

ColorInput.displayName = "ColorInput";
