import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-[999px] border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] transition-colors duration-[var(--motion-fast)] ease-[var(--ease-standard)]",
  {
    variants: {
      variant: {
        default:
          "border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.05)] text-[var(--foreground-soft)]",
        accent:
          "border-[rgba(205,239,255,0.38)] bg-[rgba(199,241,251,0.16)] text-[var(--accent)]",
        warning:
          "border-[rgba(241,202,119,0.2)] bg-[rgba(241,202,119,0.1)] text-[var(--warning)]",
        danger:
          "border-[rgba(255,143,154,0.18)] bg-[rgba(255,143,154,0.1)] text-[var(--danger)]",
        quiet: "border-transparent bg-[rgba(255,255,255,0.04)] text-[var(--foreground-muted)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export function Badge({
  className,
  children,
  variant,
}: {
  className?: string;
  children: React.ReactNode;
} & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant, className }))}>{children}</span>;
}
