import { cn } from "../../lib/utils";

export function Separator({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-px w-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)]",
        className,
      )}
    />
  );
}
