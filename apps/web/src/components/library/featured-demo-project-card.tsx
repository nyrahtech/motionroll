"use client";

import Image from "next/image";
import type { DemoProjectDefinition } from "@/lib/demo-projects";
import { LibraryAccentButton } from "./library-accent-button";

export function FeaturedDemoProjectCard({
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
      className="relative overflow-hidden rounded-[var(--radius-lg)] border"
      style={{
        borderColor: "color-mix(in srgb, var(--editor-border) 72%, transparent)",
        background: "var(--editor-shell)",
      }}
    >
      <div className="relative min-h-[360px] overflow-hidden md:min-h-[440px]">
        <Image
          src={project.thumbnailUrl}
          alt={project.title}
          fill
          className="object-cover"
          priority
          unoptimized
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(110deg, color-mix(in srgb, var(--editor-shell) 94%, transparent) 0%, color-mix(in srgb, var(--editor-shell) 80%, transparent) 34%, color-mix(in srgb, var(--editor-shell) 34%, transparent) 66%, transparent 100%), linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--editor-shell) 18%, transparent) 48%, color-mix(in srgb, var(--editor-shell) 82%, transparent) 100%)",
          }}
        />
        <div className="absolute inset-x-0 bottom-0 px-6 py-7 md:px-10 md:py-10">
          <div className="max-w-xl">
            <p className="text-xs font-medium uppercase tracking-[0.18em]" style={{ color: "var(--editor-text-dim)" }}>
              Featured example
            </p>
            <h3 className="mt-3 text-4xl font-semibold leading-tight md:text-5xl" style={{ color: "var(--editor-text)" }}>
              {project.title}
            </h3>
            <p className="mt-3 max-w-lg text-base leading-7" style={{ color: "var(--editor-text-dim)" }}>
              {project.description}
            </p>
            <LibraryAccentButton
              type="button"
              onClick={() => onStartEditing(project)}
              disabled={isStarting}
              className="mt-6"
            >
              {isStarting ? "Opening..." : "Open Demo"}
            </LibraryAccentButton>
          </div>
        </div>
      </div>
    </article>
  );
}
