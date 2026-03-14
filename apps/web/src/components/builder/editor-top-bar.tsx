"use client";

import { Eye, RotateCcw, RotateCw, Share2 } from "lucide-react";
import { ProjectSwitcher } from "./project-switcher";

interface TopBarProps {
  projectId: string;
  projectName: string;
  projects: Array<{
    id: string;
    title: string;
    slug: string;
    status: string;
    lastOpenedAt?: Date | string | null;
    lastPublishedAt?: Date | string | null;
    publishTargets?: Array<{
      targetType: string;
      slug: string;
      isReady: boolean;
      version: number;
      publishedAt: Date | null;
    }>;
  }>;
  saveState: "saved" | "dirty" | "saving" | "error";
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onPreview: () => void;
  onPublish: () => void;
}

function SaveIndicator({ saveState }: { saveState: TopBarProps["saveState"] }) {
  const colors = { saved: "var(--editor-accent)", dirty: "var(--editor-text-dim)", saving: "#facc15", error: "#f87171" };
  const labels = { saved: "Saved", dirty: "Unsaved changes", saving: "Saving…", error: "Save failed" };
  return (
    <span className="flex items-center gap-1.5 text-xs" style={{ color: colors[saveState] }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: colors[saveState] }} />
      {labels[saveState]}
    </span>
  );
}

export function TopBar({
  projectId, projectName, projects, saveState, canUndo, canRedo,
  onUndo, onRedo, onPreview, onPublish,
}: TopBarProps) {
  return (
    <header
      className="flex h-14 items-center justify-between border-b px-4"
      style={{ background: "var(--editor-panel)", borderColor: "var(--editor-border)" }}
    >
      {/* Left */}
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-sm font-semibold tracking-wide flex-shrink-0" style={{ color: "var(--editor-accent)" }}>MotionRoll</span>
        <div className="h-4 w-px flex-shrink-0" style={{ background: "var(--editor-border)" }} />
        <ProjectSwitcher
          currentProjectId={projectId}
          currentProjectTitle={projectName}
          projects={projects}
        />
        <SaveIndicator saveState={saveState} />
      </div>

      {/* Center */}
      <div className="flex items-center gap-1">
        <button onClick={onUndo} disabled={!canUndo} title="Undo"
          className="flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-[var(--editor-hover)] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          style={{ color: "var(--editor-text-dim)" }}>
          <RotateCcw className="h-4 w-4" />
        </button>
        <button onClick={onRedo} disabled={!canRedo} title="Redo"
          className="flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-[var(--editor-hover)] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          style={{ color: "var(--editor-text-dim)" }}>
          <RotateCw className="h-4 w-4" />
        </button>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <button onClick={onPreview}
          className="flex h-8 items-center gap-1.5 rounded px-3 text-sm transition-colors hover:bg-[var(--editor-hover)] cursor-pointer"
          style={{ color: "var(--editor-text)" }}>
          <Eye className="h-3.5 w-3.5" />
          Preview
        </button>
        <button onClick={onPublish}
          className="flex h-8 items-center gap-1.5 rounded px-4 text-sm font-medium transition-opacity hover:opacity-90 cursor-pointer"
          style={{ background: "var(--editor-accent)", color: "#0a0a0b" }}>
          <Share2 className="h-3.5 w-3.5" />
          Publish
        </button>
      </div>
    </header>
  );
}
