"use client";

import React, { useEffect } from "react";
import type { ProjectManifest } from "@motionroll/shared";
import { RuntimePreview } from "./runtime-preview";
import type { EditorPlaybackController } from "./hooks/useEditorPlayback";

export function PreviewStage({
  manifest, mode, playback,
  isPlaying, selectedOverlayId, selectedOverlayIds, canGroupSelection, canUngroupSelection, onModeChange,
  onPlayheadChange, onPlayToggle, onSelectOverlay,
  onOverlayLayoutChange, onInlineTextChange, onOverlayStyleChange, onDuplicateOverlay, onDeleteOverlay,
  onGroupSelection, onUngroupSelection, onMoveSelection, onDuplicateSelection, onDeleteSelection,
}: {
  manifest: ProjectManifest;
  mode: "desktop" | "mobile";
  playback: EditorPlaybackController;
  isPlaying: boolean;
  selectedOverlayId?: string;
  selectedOverlayIds?: string[];
  canGroupSelection?: boolean;
  canUngroupSelection?: boolean;
  onModeChange: (mode: "desktop" | "mobile") => void;
  onPlayheadChange: (value: number) => void;
  onPlayToggle: () => void;
  onSelectOverlay: (overlayId: string, options?: { additive?: boolean }) => void;
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
    field: "text",
    value: string,
    htmlValue?: string,
  ) => void;
  onOverlayStyleChange: (overlayId: string, changes: Record<string, unknown>) => void;
  onDuplicateOverlay: (overlayId: string) => void;
  onDeleteOverlay: (overlayId: string) => void;
  onGroupSelection?: () => void;
  onUngroupSelection?: () => void;
  onMoveSelection?: (delta: { x: number; y: number }) => void;
  onDuplicateSelection?: () => void;
  onDeleteSelection?: () => void;
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
            isPlaying={isPlaying}
            playback={playback}
            onPlayheadChange={onPlayheadChange}
            onModeChange={onModeChange}
            onPlayToggle={onPlayToggle}
            showControls={false}
            selectedOverlayId={selectedOverlayId}
            selectedOverlayIds={selectedOverlayIds}
            canGroupSelection={canGroupSelection}
            canUngroupSelection={canUngroupSelection}
            onSelectOverlay={onSelectOverlay}
            onOverlayLayoutChange={onOverlayLayoutChange}
            onInlineTextChange={onInlineTextChange}
            onOverlayStyleChange={onOverlayStyleChange}
            onDuplicateOverlay={onDuplicateOverlay}
            onDeleteOverlay={onDeleteOverlay}
            onGroupSelection={onGroupSelection}
            onUngroupSelection={onUngroupSelection}
            onMoveSelection={onMoveSelection}
            onDuplicateSelection={onDuplicateSelection}
            onDeleteSelection={onDeleteSelection}
          />
        </div>
      </div>
    </div>
  );
}
