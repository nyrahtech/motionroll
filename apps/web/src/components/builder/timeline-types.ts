/**
 * timeline-types.ts — internal drag and state types shared between
 * timeline-panel.tsx and useTimelineDrag.ts.
 */
import type { TimelineTrackType } from "./timeline-model";

export type ClipDragState =
  | {
      type: "move" | "resize-start" | "resize-end";
      clipId: string;
      trackType: TimelineTrackType;
      startX: number;
      startY: number;
      startScrollLeft: number;
      initialStart: number;
      initialEnd: number;
      layerTrackIndex?: number;
    }
  | null;

export type TrackReorderState =
  | {
      fromIndex: number;
      pointerOffsetX: number;
      pointerOffsetY: number;
      startX: number;
      startY: number;
    }
  | null;

export type DragGhostState =
  | {
      kind: "layer";
      label: string;
      top: number;
      left: number;
      width: number;
      height: number;
    }
  | null;

export type ClipGhostState =
  | {
      label: string;
      top: number;
      left: number;
      width: number;
      contentType?: string;
      transitionLabel?: string | null;
    }
  | null;

export type ClipMovePreviewState =
  | {
      draggedClipId: string;
      sourceTrackIndex: number;
      sourceLayerId: number | null;
      targetTrackIndex: number;
      targetLayerId: number | null;
      targetStart: number;
      targetEnd: number;
      targetIndex: number;
      isCrossLayerMove: boolean;
      isSnapped: boolean;
    }
  | null;

export type ClipTimingPreviewState =
  | {
      clipId: string;
      start: number;
      end: number;
    }
  | null;

export type ClipDragMode = "move" | "resize-start" | "resize-end" | null;
