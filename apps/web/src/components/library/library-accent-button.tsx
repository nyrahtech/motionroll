"use client";

import type { CSSProperties } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LibraryAccentButton({
  className,
  style,
  ...props
}: ButtonProps) {
  const accentStyle: CSSProperties = {
    background: "var(--editor-accent)",
    color: "#0a0a0b",
    ...style,
  };

  return (
    <Button
      {...props}
      className={cn("border-transparent shadow-none hover:opacity-90", className)}
      style={accentStyle}
    />
  );
}
