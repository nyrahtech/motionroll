"use client";

import Image from "next/image";
import type { DemoProjectDefinition } from "@/lib/demo-projects";
import { LibraryAccentButton } from "./library-accent-button";

export function DemoProjectCard({
  project,
  isStarting,
  onStartEditing,
}: {
  project: DemoProjectDefinition;
  isStarting: boolean;
  onStartEditing: (project: DemoProjectDefinition) => void;
}) {
  return (
    <article
      className="relative h-full overflow-hidden rounded-[var(--radius-lg)] border"
      style={{
        background: "color-mix(in srgb, var(--editor-panel) 46%, var(--editor-shell))",
        borderColor: "color-mix(in srgb, var(--editor-border) 68%, transparent)",
      }}
    >
      <div className="grid h-full gap-4 p-3 sm:grid-cols-[148px_minmax(0,1fr)] sm:items-stretch sm:p-4">
        <div className="relative min-h-[168px] overflow-hidden rounded-[calc(var(--radius-lg)-6px)] sm:min-h-full">
          <Image
            src={project.thumbnailUrl}
            alt={project.title}
            fill
            className="object-cover"
            unoptimized
          />
        </div>
        <div className="flex min-w-0 flex-col justify-between py-1 pr-1">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em]" style={{ color: "var(--editor-text-dim)" }}>
              Example
            </p>
            <h3 className="mt-2 text-base font-medium" style={{ color: "var(--editor-text)" }}>
              {project.title}
            </h3>
            <p className="mt-3 text-sm leading-6" style={{ color: "var(--editor-text-dim)" }}>
              {project.description}
            </p>
          </div>
          <div className="mt-5">
            <LibraryAccentButton
              type="button"
              onClick={() => onStartEditing(project)}
              disabled={isStarting}
            >
              {isStarting ? "Opening..." : "Open Demo"}
            </LibraryAccentButton>
          </div>
        </div>
      </div>
    </article>
  );
}
