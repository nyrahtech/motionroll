"use client";

import { useEffect } from "react";
import type { ProjectManifest } from "@motionroll/shared";
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
    options?: {
      intent?: "move" | "resize";
      scaleX?: number;
      scaleY?: number;
      styleChanges?: Record<string, unknown>;
      backgroundChanges?: Record<string, unknown>;
    },
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
      {/* Canvas area */}
      <div
        className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-5"
        style={{ background: "var(--editor-shell)" }}
        onClick={(e) => {
          // Deselect only when clicking the bare background, and only when
          // not actively editing inline text (contentEditable).
          if (e.target === e.currentTarget) {
            const editing = document.activeElement && (document.activeElement as HTMLElement).contentEditable === "true";
            if (!editing) onSelectOverlay("");
          }
        }}
      >
        <div
          className="relative h-full max-h-full overflow-hidden rounded-none shadow-2xl"
          style={{
            width: mode === "desktop" ? "min(100%, 1280px)" : "min(100%, 420px)",
            aspectRatio: mode === "desktop" ? "16/9" : "9/16",
            maxHeight: "100%",
            border: "1px solid var(--editor-border)",
          }}
        >
          <RuntimePreview
            manifest={manifest}
            mode={mode}
            reducedMotion={reducedMotion}
            isPlaying={isPlaying}
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
