"use client";

import { useEffect } from "react";
import type { ProjectManifest } from "@motionroll/shared";
import { Monitor, Smartphone } from "lucide-react";
import { RuntimePreview } from "./runtime-preview";

export function PreviewStage({
  manifest, mode, reducedMotion, playheadProgress, durationSeconds,
  isPlaying, selectedOverlayId, onModeChange, onReducedMotionChange,
  onPlayheadChange, onPlayToggle, onSelectOverlay,
  onOverlayLayoutChange, onInlineTextChange, onOverlayStyleChange, onDuplicateOverlay, onDeleteOverlay,
}: {
  manifest: ProjectManifest;
  mode: "desktop" | "mobile";
  reducedMotion: boolean;
  playheadProgress: number;
  durationSeconds: number;
  isPlaying: boolean;
  selectedOverlayId?: string;
  onModeChange: (mode: "desktop" | "mobile") => void;
  onReducedMotionChange: (value: boolean) => void;
  onPlayheadChange: (value: number) => void;
  onPlayToggle: () => void;
  onSelectOverlay: (overlayId: string) => void;
  onOverlayLayoutChange: (
    overlayId: string,
    layout: Partial<{ x: number; y: number; width: number; height: number }>,
  ) => void;
  onInlineTextChange: (
    overlayId: string,
    field: "eyebrow" | "headline" | "body",
    value: string,
    htmlValue?: string,
  ) => void;
  onOverlayStyleChange: (overlayId: string, changes: Record<string, unknown>) => void;
  onDuplicateOverlay: (overlayId: string) => void;
  onDeleteOverlay: (overlayId: string) => void;
}) {
  const section = manifest.sections[0];

  // Space key toggles play/pause when focused on the canvas
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && (e.target as HTMLElement).tagName !== "INPUT" && (e.target as HTMLElement).contentEditable !== "true") {
        e.preventDefault();
        onPlayToggle();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onPlayToggle]);

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      style={{ background: "var(--editor-shell)" }}
    >
      {/* Toolbar */}
      <div
        className="flex h-10 flex-shrink-0 items-center justify-between border-b px-4"
        style={{ background: "var(--editor-panel)", borderColor: "var(--editor-border)" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--editor-text-dim)" }}>
            {section?.title ?? "Preview Canvas"}
          </span>
          {isPlaying && (
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full"
              style={{ background: "var(--editor-accent)" }}
            />
          )}
        </div>

        {/* Device mode switcher */}
        <div
          className="flex items-center gap-0.5 rounded p-0.5"
          style={{ background: "var(--editor-panel-elevated)" }}
        >
          <button
            onClick={() => onModeChange("desktop")}
            className="interactive-soft flex h-7 items-center gap-1.5 rounded px-2.5 text-xs cursor-pointer"
            style={{
              background: mode === "desktop" ? "var(--editor-selected)" : "transparent",
              color: mode === "desktop" ? "var(--editor-accent)" : "var(--editor-text-dim)",
            }}
          >
            <Monitor className="h-3.5 w-3.5" />
            Desktop
          </button>
          <button
            onClick={() => onModeChange("mobile")}
            className="interactive-soft flex h-7 items-center gap-1.5 rounded px-2.5 text-xs cursor-pointer"
            style={{
              background: mode === "mobile" ? "var(--editor-selected)" : "transparent",
              color: mode === "mobile" ? "var(--editor-accent)" : "var(--editor-text-dim)",
            }}
          >
            <Smartphone className="h-3.5 w-3.5" />
            Mobile
          </button>
        </div>

        <span className="text-xs tabular-nums" style={{ color: "var(--editor-text-dim)" }}>
          {(playheadProgress * 100).toFixed(1)}%
        </span>
      </div>

      {/* Canvas area */}
      <div
        className="flex min-h-0 flex-1 items-center justify-center p-5"
        style={{ background: "var(--editor-shell)" }}
        onClick={(e) => {
          // Deselect on bg click
          if (e.target === e.currentTarget) {
            onSelectOverlay("");
          }
        }}
      >
        <div
          className="relative overflow-hidden rounded shadow-2xl"
          style={{
            width: mode === "desktop" ? "min(100%, 1280px)" : "min(100%, 420px)",
            aspectRatio: mode === "desktop" ? "16/9" : "9/16",
            border: "1px solid var(--editor-border)",
          }}
        >
          <RuntimePreview
            manifest={manifest}
            mode={mode}
            reducedMotion={reducedMotion}
            playheadProgress={playheadProgress}
            onPlayheadChange={onPlayheadChange}
            onModeChange={onModeChange}
            onReducedMotionChange={onReducedMotionChange}
            onPlayToggle={onPlayToggle}
            showControls={false}
            selectedOverlayId={selectedOverlayId}
            onSelectOverlay={onSelectOverlay}
            onOverlayLayoutChange={onOverlayLayoutChange}
            onInlineTextChange={onInlineTextChange}
            onOverlayStyleChange={onOverlayStyleChange}
            onDuplicateOverlay={onDuplicateOverlay}
            onDeleteOverlay={onDeleteOverlay}
          />
        </div>
      </div>
    </div>
  );
}
