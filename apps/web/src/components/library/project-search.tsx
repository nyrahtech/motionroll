"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export function ProjectSearch({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label
      className={cn("relative block w-full max-w-sm", className)}
      aria-label="Search projects"
    >
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
        style={{ color: "var(--editor-text-dim)" }}
      />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search projects"
        className="h-10 pl-10 pr-4"
      />
    </label>
  );
}
