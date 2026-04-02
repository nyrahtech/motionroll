"use client";

import { ArrowRight, Plus } from "lucide-react";

export function NewProjectCard({
  isCreating,
  onCreate,
}: {
  isCreating: boolean;
  onCreate: () => void;
}) {
  return (
    <article
      className="relative overflow-hidden rounded-[var(--radius-lg)] border"
      style={{
        background: "color-mix(in srgb, var(--editor-panel) 32%, var(--editor-shell))",
        borderColor: "color-mix(in srgb, var(--editor-border) 70%, transparent)",
      }}
    >
      <button
        type="button"
        onClick={onCreate}
        disabled={isCreating}
        className="flex aspect-[4/3] w-full items-start justify-start px-6 py-6 text-left transition-colors hover:bg-[var(--editor-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--editor-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--editor-panel)]"
      >
        <div className="flex h-full w-full flex-col">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-full border"
            style={{
              borderColor: "color-mix(in srgb, var(--editor-border) 78%, transparent)",
              background: "color-mix(in srgb, var(--editor-panel-elevated) 56%, var(--editor-shell))",
              color: "var(--editor-accent)",
            }}
          >
            <Plus className="h-5 w-5" />
          </span>
          <div className="mt-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em]" style={{ color: "var(--editor-text-dim)" }}>
              Start from scratch
            </p>
            <h3 className="mt-2 text-lg font-semibold" style={{ color: "var(--editor-text)" }}>
              {isCreating ? "Creating your blank project..." : "New Project"}
            </h3>
            <p className="mt-2 text-sm leading-6" style={{ color: "var(--editor-text-dim)" }}>
              Begin with a blank canvas.
            </p>
          </div>
          <span
            className="mt-auto inline-flex items-center gap-2 pt-6 text-sm font-medium"
            style={{ color: "var(--editor-accent)" }}
          >
            {isCreating ? "Opening workspace" : "Create blank project"}
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </button>
    </article>
  );
}
