import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function formatRelativeDate(input: Date | string) {
  const value = typeof input === "string" ? new Date(input) : input;
  const diffMs = value.getTime() - Date.now();
  const absMs = Math.abs(diffMs);

  const ranges = [
    { unit: "day", ms: 1000 * 60 * 60 * 24 },
    { unit: "hour", ms: 1000 * 60 * 60 },
    { unit: "minute", ms: 1000 * 60 },
  ] as const;

  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  for (const range of ranges) {
    if (absMs >= range.ms || range.unit === "minute") {
      return formatter.format(Math.round(diffMs / range.ms), range.unit);
    }
  }

  return "just now";
}
