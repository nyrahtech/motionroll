/**
 * TimelineLayerLabel — sticky left-side label column for a single layer track row.
 *
 * Extracted from the layerRows useMemo inside timeline-panel.tsx.
 * Memoized so it only re-renders when its own props change.
 */
"use client";

import React from "react";
import { GripVertical, Trash2 } from "lucide-react";

export type TimelineLayerLabelProps = {
  track: { id: string; label: string };
  originalIndex: number;
  labelW: number;
  // Drag/drop state
  isDraggingRow: boolean;
  isLayerReorderDrag: boolean;
  isDropTarget: boolean;
  showInsertionCue: boolean;
  // Move preview
  movePreviewForTrack: {
    isCrossLayerMove: boolean;
    targetStart: number;
    draggedClipId: string;
  } | null;
  previewTimeLabel: string | null;
  draggedClipLabel?: string | null;
  // Callbacks
  beginTrackReorder: (e: React.MouseEvent, fromIndex: number) => void;
  onDeleteLayer: (index: number) => void;
};

function TimelineLayerLabelInner({
  track,
  originalIndex,
  labelW,
  isDraggingRow,
  isLayerReorderDrag,
  isDropTarget,
  showInsertionCue,
  movePreviewForTrack,
  previewTimeLabel,
  draggedClipLabel,
  beginTrackReorder,
  onDeleteLayer,
}: TimelineLayerLabelProps) {
  return (
    <div
      className="flex h-14 w-full select-none items-center gap-2 px-3"
      style={{
        background:
          isLayerReorderDrag && isDraggingRow
            ? "rgba(103,232,249,0.12)"
            : isDropTarget
              ? "rgba(103,232,249,0.08)"
              : "var(--editor-panel)",
        borderColor: "var(--editor-border)",
      }}
    >
      {/* Reorder handle */}
      <button
        type="button"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-white focus:outline-none focus:ring-1 focus:ring-[var(--editor-accent)]"
        title="Drag to reorder layer"
        aria-label={`Drag to reorder ${track.label}`}
        onMouseDown={(ev) => beginTrackReorder(ev, originalIndex)}
        style={{
          color:
            isLayerReorderDrag && isDraggingRow
              ? "var(--editor-accent)"
              : "var(--editor-text-dim)",
          background:
            isLayerReorderDrag && isDraggingRow
              ? "rgba(103,232,249,0.12)"
              : undefined,
          cursor: "ns-resize",
        }}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Delete button */}
      <button
        type="button"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--editor-text-dim)] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-white focus:outline-none focus:ring-1 focus:ring-[var(--editor-accent)]"
        title={`Delete ${track.label}`}
        aria-label={`Delete ${track.label}`}
        onClick={(ev) => {
          ev.stopPropagation();
          onDeleteLayer(originalIndex);
        }}
      >
        <Trash2 className="h-4 w-4" />
      </button>

      {/* Label text */}
      <div className="min-w-0 flex-1">
        <span
          className="block truncate text-xs font-medium tracking-[0.03em]"
          style={{
            color:
              isLayerReorderDrag && isDraggingRow
                ? "var(--editor-accent)"
                : "var(--editor-text)",
          }}
        >
          {track.label}
        </span>
        <span
          className="block text-[10px] uppercase tracking-[0.12em]"
          style={{
            color:
              (isLayerReorderDrag && isDraggingRow) || isDropTarget
                ? "var(--editor-accent)"
                : "var(--editor-text-dim)",
          }}
        >
          {isLayerReorderDrag && isDraggingRow
            ? "Dragging layer"
            : showInsertionCue
              ? "Drop here"
              : movePreviewForTrack
                ? movePreviewForTrack.isCrossLayerMove
                  ? `Drop at ${previewTimeLabel}`
                  : `Preview at ${previewTimeLabel}`
                : `Layer ${originalIndex + 1}`}
        </span>
      </div>
    </div>
  );
}

export const TimelineLayerLabel = React.memo(TimelineLayerLabelInner);
TimelineLayerLabel.displayName = "TimelineLayerLabel";
