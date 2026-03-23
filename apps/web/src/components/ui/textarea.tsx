import * as React from "react";
import { cn } from "../../lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "focus-ring flex min-h-[96px] w-full rounded-[var(--radius-md)] border border-[rgba(255,255,255,0.04)] bg-[rgba(255,255,255,0.035)] px-3 py-2.5 text-sm leading-6 text-[var(--foreground)] placeholder:text-[var(--foreground-faint)] transition-colors duration-[var(--motion-fast)] ease-[var(--ease-standard)]",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
