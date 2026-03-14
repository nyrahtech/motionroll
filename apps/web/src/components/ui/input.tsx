import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-8 w-full rounded-[var(--radius-sm)] border px-3 py-2 text-sm transition-colors duration-[var(--motion-fast)] ease-[var(--ease-standard)] outline-none",
        "border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.035)] text-[var(--foreground)] placeholder:text-[var(--foreground-faint)]",
        "hover:border-[rgba(255,255,255,0.1)]",
        "focus:border-[rgba(205,239,255,0.45)] focus:ring-1 focus:ring-[rgba(205,239,255,0.18)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
