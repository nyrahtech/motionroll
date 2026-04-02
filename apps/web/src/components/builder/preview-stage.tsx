"use client";

import React from "react";
import { RuntimePreview } from "./runtime-preview";
import { usePreviewStageHotkeys } from "./hooks/usePreviewStageHotkeys";
import type { PreviewStageProps } from "./preview-stage.types";

export function PreviewStage({
  manifest,
  mode,
  playback,
  isPlaying,
  selectedOverlayId,
  selectedOverlayIds,
  canGroupSelection,
  canUngroupSelection,
  onModeChange,
  onPlayheadChange,
  onPlayToggle,
  onSelectOverlay,
  onOverlayLayoutChange,
  onInlineTextChange,
  onOverlayStyleChange,
  onDuplicateOverlay,
  onDeleteOverlay,
  onOverlayStyleLiveChange,
  onGroupSelection,
  onUngroupSelection,
  onMoveSelection,
  onDuplicateSelection,
  onDeleteSelection,
}: PreviewStageProps) {
  usePreviewStageHotkeys(onPlayToggle);

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
            onOverlayStyleLiveChange={onOverlayStyleLiveChange}
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
