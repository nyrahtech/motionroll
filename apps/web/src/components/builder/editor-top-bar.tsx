"use client";

import { Eye, Monitor, RotateCcw, RotateCw, Share2, Smartphone } from "lucide-react";
import { ProjectSwitcher } from "./project-switcher";

interface TopBarProps {
  projectId: string;
  projectName: string;
  sectionTitle: string; // displayed as scene name
  frameRangeStart: number;
  frameRangeEnd: number;
  scrubStrength: number;
  sectionHeightVh: number;
  previewMode: "desktop" | "mobile";
  reducedMotion: boolean;
  isPlaying: boolean;
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
  saveStatus: {
    local: "saving" | "saved" | "error";
    remote: "idle" | "syncing" | "synced" | "error";
    hasUnsyncedChanges: boolean;
    hasUnpublishedChanges: boolean;
  };
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onProjectTitleChange: (value: string) => void;
  onSectionTitleChange: (value: string) => void;
  onFrameRangeChange: (field: "start" | "end", value: number) => void;
  onSectionFieldChange: (field: "scrubStrength" | "sectionHeightVh", value: number) => void;
  onPreviewModeChange: (mode: "desktop" | "mobile") => void;
  onReducedMotionChange: (value: boolean) => void;
  onPreview: () => void | Promise<void>;
  onPublish: () => void | Promise<void>;
  onRetrySync?: () => void | Promise<void>;
}

function SaveIndicator({
  saveStatus,
  onRetrySync,
}: {
  saveStatus: TopBarProps["saveStatus"];
  onRetrySync?: TopBarProps["onRetrySync"];
}) {
  const tone =
    saveStatus.local === "error" || saveStatus.remote === "error"
      ? { color: "#f87171", label: "Sync failed", detail: "Saved locally" }
      : saveStatus.local === "saving"
        ? { color: "#facc15", label: "Saving locally...", detail: "Browser draft" }
        : saveStatus.remote === "syncing"
          ? { color: "#facc15", label: "Syncing...", detail: "Postgres draft" }
          : saveStatus.hasUnsyncedChanges
            ? { color: "var(--editor-text-dim)", label: "Saved locally", detail: "Waiting to sync" }
            : saveStatus.hasUnpublishedChanges
              ? { color: "var(--editor-accent)", label: "Synced", detail: "Unpublished changes" }
              : { color: "var(--editor-accent)", label: "Synced", detail: "Postgres is current" };

  return (
    <span className="flex items-center gap-2 text-xs">
      <span className="flex items-center gap-2" style={{ color: tone.color }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone.color }} />
        <span className="flex flex-col leading-[1rem]">
          <span>{tone.label}</span>
          <span className="text-[10px] opacity-80">{tone.detail}</span>
        </span>
      </span>
      {onRetrySync && (saveStatus.local === "error" || saveStatus.remote === "error") ? (
        <button
          type="button"
          onClick={() => void onRetrySync()}
          className="rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors hover:bg-[var(--editor-hover)]"
          style={{
            borderColor: "var(--editor-border)",
            color: "var(--editor-text)",
          }}
        >
          Retry sync
        </button>
      ) : null}
      {onRetrySync &&
      saveStatus.hasUnsyncedChanges &&
      saveStatus.remote !== "syncing" &&
      saveStatus.remote !== "error" &&
      saveStatus.local !== "error" ? (
        <button
          type="button"
          onClick={() => void onRetrySync()}
          className="rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors hover:bg-[var(--editor-hover)]"
          style={{
            borderColor: "var(--editor-border)",
            color: "var(--editor-text-dim)",
          }}
        >
          Sync now
        </button>
      ) : null}
    </span>
  );
}

export function TopBar({
  projectId,
  projectName,
  sectionTitle,
  frameRangeStart,
  frameRangeEnd,
  scrubStrength,
  sectionHeightVh,
  previewMode,
  reducedMotion,
  isPlaying,
  projects,
  saveStatus,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onProjectTitleChange,
  onSectionTitleChange,
  onFrameRangeChange,
  onSectionFieldChange,
  onPreviewModeChange,
  onReducedMotionChange,
  onPreview,
  onPublish,
  onRetrySync,
}: TopBarProps) {
  return (
    <header
      className="flex h-14 items-center justify-between border-b px-4"
      style={{ background: "var(--editor-panel)", borderColor: "var(--editor-border)" }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="flex-shrink-0 text-sm font-semibold tracking-wide"
          style={{ color: "var(--editor-accent)" }}
        >
          MotionRoll
        </span>
        <div className="h-4 w-px flex-shrink-0" style={{ background: "var(--editor-border)" }} />
        <ProjectSwitcher
          currentProjectId={projectId}
          currentProjectTitle={projectName}
          sectionTitle={sectionTitle}
          frameRangeStart={frameRangeStart}
          frameRangeEnd={frameRangeEnd}
          scrubStrength={scrubStrength}
          sectionHeightVh={sectionHeightVh}
          projects={projects}
          onProjectTitleChange={onProjectTitleChange}
          onSectionTitleChange={onSectionTitleChange}
          onFrameRangeChange={onFrameRangeChange}
          onSectionFieldChange={onSectionFieldChange}
        />
        <SaveIndicator saveStatus={saveStatus} onRetrySync={onRetrySync} />
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded transition-colors hover:bg-[var(--editor-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          style={{ color: "var(--editor-text-dim)" }}
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded transition-colors hover:bg-[var(--editor-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          style={{ color: "var(--editor-text-dim)" }}
        >
          <RotateCw className="h-4 w-4" />
        </button>
        <div
          className="ml-2 flex items-center gap-0.5 rounded p-0.5"
          style={{ background: "var(--editor-panel-elevated)" }}
        >
          <button
            type="button"
            onClick={() => onPreviewModeChange("desktop")}
            className="interactive-soft flex h-7 items-center gap-1.5 rounded px-2.5 text-xs"
            style={{
              background:
                previewMode === "desktop" ? "var(--editor-selected)" : "transparent",
              color:
                previewMode === "desktop"
                  ? "var(--editor-accent)"
                  : "var(--editor-text-dim)",
            }}
          >
            <Monitor className="h-3.5 w-3.5" />
            Desktop
          </button>
          <button
            type="button"
            onClick={() => onPreviewModeChange("mobile")}
            className="interactive-soft flex h-7 items-center gap-1.5 rounded px-2.5 text-xs"
            style={{
              background:
                previewMode === "mobile" ? "var(--editor-selected)" : "transparent",
              color:
                previewMode === "mobile"
                  ? "var(--editor-accent)"
                  : "var(--editor-text-dim)",
            }}
          >
            <Smartphone className="h-3.5 w-3.5" />
            Mobile
          </button>
        </div>
        <button
          type="button"
          onClick={() => onReducedMotionChange(!reducedMotion)}
          className="flex h-8 items-center rounded px-3 text-xs transition-colors hover:bg-[var(--editor-hover)]"
          style={{ color: reducedMotion ? "var(--editor-accent)" : "var(--editor-text-dim)" }}
        >
          Reduced motion
        </button>
        {isPlaying ? (
          <span
            className="h-1.5 w-1.5 rounded-full animate-pulse"
            style={{ background: "var(--editor-accent)" }}
          />
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => void onPreview()}
          className="flex h-8 cursor-pointer items-center gap-1.5 rounded px-3 text-sm transition-colors hover:bg-[var(--editor-hover)]"
          style={{ color: "var(--editor-text)" }}
        >
          <Eye className="h-3.5 w-3.5" />
          Preview
        </button>
        <button
          onClick={() => void onPublish()}
          className="flex h-8 cursor-pointer items-center gap-1.5 rounded px-4 text-sm font-medium transition-opacity hover:opacity-90"
          style={{ background: "var(--editor-accent)", color: "#0a0a0b" }}
        >
          <Share2 className="h-3.5 w-3.5" />
          Publish
        </button>
      </div>
    </header>
  );
}
