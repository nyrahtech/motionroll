import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const surfaceItemVariants = cva(
  "rounded-[var(--radius-md)] border px-3.5 py-3.5 transition-all duration-[var(--motion-base)] ease-[var(--ease-standard)]",
  {
    variants: {
      variant: {
        default:
          "border-[var(--border-subtle)] bg-[var(--panel-bg)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-1)]",
        accent:
          "border-[var(--border-accent)] bg-[rgba(199,241,251,0.1)] hover:border-[var(--timeline-selected-border)]",
        quiet:
          "border-[var(--border-subtle)] bg-[var(--panel-bg-muted)] hover:bg-[var(--surface-1)]",
        selected:
          "border-[var(--timeline-selected-border)] bg-[rgba(199,241,251,0.12)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export function PageHero({
  eyebrow,
  title,
  description,
  meta,
  actions,
  aside,
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  description: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <Card variant="hero" className={cn("overflow-hidden", className)}>
      <CardContent className="grid gap-5 pt-4 xl:grid-cols-[1.1fr,0.9fr]">
        <div className="space-y-4">
          <div className="space-y-3">
            <p className="eyebrow">{eyebrow}</p>
            <div className="space-y-2">
              <h1 className="text-balance text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl">
                {title}
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-[var(--foreground-soft)]">
                {description}
              </p>
            </div>
            {meta ? <div className="flex flex-wrap gap-2">{meta}</div> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
        </div>
        {aside ? <div className="space-y-4">{aside}</div> : null}
      </CardContent>
    </Card>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-1.5">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="text-balance text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">
          {title}
        </h2>
        {description ? (
          <p className="max-w-3xl text-sm leading-6 text-[var(--foreground-muted)]">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-3">{action}</div> : null}
    </div>
  );
}

export function SurfaceHeader({
  eyebrow,
  title,
  description,
  badge,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h3 className="text-base font-semibold tracking-[-0.03em] text-white">{title}</h3>
        </div>
        {badge}
      </div>
      {description ? (
        <p className="text-sm leading-6 text-[var(--foreground-muted)]">{description}</p>
      ) : null}
    </div>
  );
}

export function FeatureCard({
  title,
  description,
  children,
  badge,
  variant,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  badge?: ReactNode;
  className?: string;
} & VariantProps<typeof surfaceItemVariants>) {
  return (
    <div className={cn(surfaceItemVariants({ variant }), className)}>
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-white">{title}</p>
            {description ? (
              <p className="mt-1.5 text-sm leading-6 text-[var(--foreground-muted)]">{description}</p>
            ) : null}
          </div>
          {badge}
        </div>
        {children}
      </div>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "success" | "warning";
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--panel-bg)] p-3.5">
      <p className="eyebrow">{label}</p>
      <p
        className={cn(
          "mt-2 text-xl font-semibold tracking-[-0.04em] text-white",
          tone === "success" && "text-[var(--success)]",
          tone === "warning" && "text-[var(--warning)]",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function CodeCard({
  title,
  description,
  badge,
  code,
  action,
}: {
  title: ReactNode;
  description: ReactNode;
  badge?: ReactNode;
  code: string;
  action?: ReactNode;
}) {
  return (
    <Card variant="elevated">
      <CardHeader className="gap-2.5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <CardTitle className="text-xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {badge}
            {action}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <pre className="surface-code overflow-x-auto p-4 text-xs leading-6 text-[var(--foreground-soft)]">
          <code>{code}</code>
        </pre>
      </CardContent>
    </Card>
  );
}

export function PublishSnippetCard({
  title,
  description,
  badge,
  code,
  action,
}: {
  title: ReactNode;
  description: ReactNode;
  badge?: ReactNode;
  code: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--panel-bg)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-base font-semibold tracking-[-0.03em] text-white">{title}</p>
          <p className="text-sm leading-6 text-[var(--foreground-muted)]">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          {badge}
          {action}
        </div>
      </div>
      <pre className="surface-code mt-4 overflow-x-auto p-4 text-xs leading-6 text-[var(--foreground-soft)]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function InspectorSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--panel-bg)] p-3.5">
      <div className="space-y-1">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <p className="text-sm font-medium text-white">{title}</p>
        {description ? <p className="helper-text">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function StatusRow({
  label,
  value,
}: {
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[rgba(255,255,255,0.05)] py-3 last:border-b-0 last:pb-0 first:pt-0">
      <span className="text-sm text-[var(--foreground-muted)]">{label}</span>
      <span className="text-sm font-medium text-white">{value}</span>
    </div>
  );
}

export const StatusInline = StatusRow;

export function OutputCard({
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card variant="elevated">
      <CardHeader className="gap-2.5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <CardTitle className="text-xl">{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function StatusPill({
  label,
  tone,
}: {
  label: ReactNode;
  tone?: "default" | "accent" | "warning" | "danger";
}) {
  const variant =
    tone === "accent"
      ? "accent"
      : tone === "warning"
        ? "warning"
        : tone === "danger"
          ? "danger"
          : "quiet";

  return <Badge variant={variant}>{label}</Badge>;
}
