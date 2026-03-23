"use client";

import React, { type ReactNode } from "react";
import {
  AlignCenter, AlignLeft, AlignRight,
  Bold, Italic, Underline,
} from "lucide-react";
import { cn } from "../../lib/utils";

export const numberInputClassName = "h-9 rounded-[12px] text-sm tabular-nums";

export function formatPercent(value: number) {
  return `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--foreground-faint)]">
      {children}
    </p>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--foreground-faint)]">
        {label}
      </p>
      {children}
    </div>
  );
}

export function EmptyInspector() {
  return null;
}

export function ToolPanel({
  children,
  className,
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <div
      className={cn(
        "space-y-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--panel-bg)] p-3",
        className,
      )}
    >
      {title ? (
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--foreground-faint)]">
          {title}
        </p>
      ) : null}
      {children}
    </div>
  );
}

export function AlignmentGroup({
  value,
  onChange,
}: {
  value: "start" | "center" | "end";
  onChange: (value: "start" | "center" | "end") => void;
}) {
  return (
    <div className="flex gap-1">
      <button
        type="button"
        title="Align left"
        aria-label="Align left"
        aria-pressed={value === "start"}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-[10px] border transition-colors",
          value === "start"
            ? "border-[var(--editor-accent)] bg-[rgba(103,232,249,0.12)] text-[var(--editor-accent)]"
            : "border-[var(--border-subtle)] text-[var(--foreground-faint)] hover:bg-[var(--surface-1)]",
        )}
        onClick={() => onChange("start")}
      >
        <AlignLeft className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="Align center"
        aria-label="Align center"
        aria-pressed={value === "center"}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-[10px] border transition-colors",
          value === "center"
            ? "border-[var(--editor-accent)] bg-[rgba(103,232,249,0.12)] text-[var(--editor-accent)]"
            : "border-[var(--border-subtle)] text-[var(--foreground-faint)] hover:bg-[var(--surface-1)]",
        )}
        onClick={() => onChange("center")}
      >
        <AlignCenter className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="Align right"
        aria-label="Align right"
        aria-pressed={value === "end"}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-[10px] border transition-colors",
          value === "end"
            ? "border-[var(--editor-accent)] bg-[rgba(103,232,249,0.12)] text-[var(--editor-accent)]"
            : "border-[var(--border-subtle)] text-[var(--foreground-faint)] hover:bg-[var(--surface-1)]",
        )}
        onClick={() => onChange("end")}
      >
        <AlignRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function EmphasisGroup({
  fontWeight,
  italic,
  underline,
  onToggleBold,
  onToggleItalic,
  onToggleUnderline,
}: {
  fontWeight: number;
  italic: boolean;
  underline: boolean;
  onToggleBold: () => void;
  onToggleItalic: () => void;
  onToggleUnderline: () => void;
}) {
  const isBold = fontWeight >= 700;
  return (
    <div className="flex gap-1">
      <button
        type="button"
        title="Bold"
        aria-label="Bold"
        aria-pressed={isBold}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-[10px] border font-bold transition-colors",
          isBold
            ? "border-[var(--editor-accent)] bg-[rgba(103,232,249,0.12)] text-[var(--editor-accent)]"
            : "border-[var(--border-subtle)] text-[var(--foreground-faint)] hover:bg-[var(--surface-1)]",
        )}
        onClick={onToggleBold}
      >
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="Italic"
        aria-label="Italic"
        aria-pressed={italic}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-[10px] border transition-colors",
          italic
            ? "border-[var(--editor-accent)] bg-[rgba(103,232,249,0.12)] text-[var(--editor-accent)]"
            : "border-[var(--border-subtle)] text-[var(--foreground-faint)] hover:bg-[var(--surface-1)]",
        )}
        onClick={onToggleItalic}
      >
        <Italic className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="Underline"
        aria-label="Underline"
        aria-pressed={underline}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-[10px] border transition-colors",
          underline
            ? "border-[var(--editor-accent)] bg-[rgba(103,232,249,0.12)] text-[var(--editor-accent)]"
            : "border-[var(--border-subtle)] text-[var(--foreground-faint)] hover:bg-[var(--surface-1)]",
        )}
        onClick={onToggleUnderline}
      >
        <Underline className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ActionButton({
  icon,
  label,
  onClick,
  active = false,
  disabled = false,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-[10px] border px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "border-[var(--editor-accent)] bg-[rgba(103,232,249,0.08)] text-[var(--editor-accent)]"
          : "border-[var(--border-subtle)] text-[var(--foreground-muted)] hover:border-[var(--border-strong)] hover:text-white",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
