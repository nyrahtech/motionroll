import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function EditorShell({
  rail,
  browser,
  browserOpen,
  toolbar,
  stage,
  timeline,
}: {
  rail: ReactNode;
  browser: ReactNode;
  browserOpen: boolean;
  toolbar: ReactNode;
  stage: ReactNode;
  timeline: ReactNode;
}) {
  return (
    <section className="surface-editor h-screen overflow-hidden">
      <div
        className="grid h-full min-h-0 bg-[#07090d] lg:grid-rows-[40px_minmax(0,1fr)_286px]"
        style={{
          gridTemplateColumns: browserOpen ? "58px 248px minmax(0,1fr)" : "58px minmax(0,1fr)",
        }}
      >
        <div className="row-span-3 bg-[#06080c]">{rail}</div>
        {browserOpen ? <div className="row-span-3 bg-[#0a0d12]">{browser}</div> : null}
        <div className="bg-[#090b10]">{toolbar}</div>
        <div className="min-h-0 bg-[#090b10]">{stage}</div>
        <div className="min-h-0 border-t border-[rgba(255,255,255,0.04)] bg-[#06080c]">{timeline}</div>
      </div>
    </section>
  );
}

export function LeftIconRail({ children }: { children: ReactNode }) {
  return <aside className="flex h-full flex-col items-center gap-1.5 px-1 py-2">{children}</aside>;
}

export function RailButton({
  active,
  label,
  children,
  onClick,
}: {
  active?: boolean;
  label: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        "focus-ring flex w-full flex-col items-center gap-1 rounded-[8px] px-0 py-1.5 text-[10px] text-[var(--foreground-faint)] transition-colors",
        active && "bg-[rgba(255,255,255,0.06)] text-white",
      )}
    >
      <span
        className={cn(
          "grid h-8 w-8 place-items-center rounded-[7px] bg-[#0b0e13] text-[var(--foreground-soft)]",
          active && "bg-[rgba(205,239,255,0.14)] text-white",
        )}
      >
        {children}
      </span>
      <span className="editor-rail-label">{label}</span>
    </button>
  );
}

export function BrowserPanel({
  title,
  searchValue,
  onSearchChange,
  children,
}: {
  title: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <aside className="flex h-full min-h-0 flex-col">
      <div className="px-3 py-2">
        <p className="text-sm font-semibold text-white">{title}</p>
        <BrowserSearch value={searchValue} onChange={onSearchChange} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2.5">{children}</div>
    </aside>
  );
}

export function BrowserSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="focus-ring mt-2 flex items-center gap-2 rounded-[7px] bg-[#07090d] px-3 py-1.5">
      <Search className="h-3.5 w-3.5 text-[var(--foreground-faint)]" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search"
        className="w-full border-0 bg-transparent p-0 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--foreground-faint)]"
      />
    </label>
  );
}

export function BrowserSection({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2 rounded-[7px] bg-[#0d1015] p-2.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--foreground-faint)]">
          {title}
        </p>
        {meta}
      </div>
      {children}
    </section>
  );
}

export function BrowserCard({
  active,
  title,
  subtitle,
  meta,
  leading,
  onClick,
}: {
  active?: boolean;
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  leading?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "focus-ring flex w-full items-start gap-2 rounded-[7px] px-2.5 py-2 text-left transition-colors",
        active ? "bg-[rgba(205,239,255,0.12)]" : "hover:bg-[rgba(255,255,255,0.05)]",
      )}
    >
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{title}</p>
            {subtitle ? (
              <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-[var(--foreground-muted)]">
                {subtitle}
              </p>
            ) : null}
          </div>
          {meta}
        </div>
      </div>
    </button>
  );
}

export function EditorStage({ children }: { children: ReactNode }) {
  return <div className="flex h-full min-h-0 flex-col px-2 py-2">{children}</div>;
}

export function EditorTimelineDock({ children }: { children: ReactNode }) {
  return <div className="h-full">{children}</div>;
}

export function EditorInspector({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <aside className="flex h-full min-h-0 flex-col">
      <div className="px-3 py-2">
        <p className="text-sm font-semibold text-white">{title}</p>
        {subtitle ? <p className="mt-1 text-xs leading-5 text-[var(--foreground-muted)]">{subtitle}</p> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2.5">{children}</div>
    </aside>
  );
}

export function InspectorGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <BrowserSection title={title}>
      {description ? <p className="text-xs leading-5 text-[var(--foreground-muted)]">{description}</p> : null}
      {children}
    </BrowserSection>
  );
}

export function EditorSectionTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly T[];
  active: T;
  onChange: (tab: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          className={cn(
            "rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] transition-colors",
            active === tab
              ? "bg-[rgba(205,239,255,0.14)] text-white"
              : "text-[var(--foreground-faint)] hover:bg-[rgba(255,255,255,0.05)] hover:text-white",
          )}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

export function EditorPanel({
  title,
  description,
  badge,
  children,
}: {
  title: string;
  description?: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <BrowserSection title={title} meta={badge}>
      {description ? <p className="text-xs leading-5 text-[var(--foreground-muted)]">{description}</p> : null}
      {children}
    </BrowserSection>
  );
}
