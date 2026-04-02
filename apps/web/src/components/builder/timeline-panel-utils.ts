"use client";

import { progressToFrameBoundaryIndex } from "@motionroll/shared";
import { TIMELINE_START_OFFSET } from "./timeline-layout";
import { getTimelineTimeLabel, type TimelineTrackModel } from "./timeline-model";
import type { LayerRowDescriptor } from "./timeline-panel.types";
import type {
  ClipMovePreviewState,
  DragGhostState,
} from "./timeline-types";

export const LABEL_W = 168;
export const FRAME_STRIP_TARGET_TILE_WIDTH = 72;
export const FRAME_STRIP_MIN_SAMPLES = 4;
export const FRAME_STRIP_MAX_SAMPLES = 18;
export const PLAYHEAD_SCROLL_PADDING = 96;

export function getFrameStripSampleCount(
  width: number,
  frameCount?: number,
  clipStart?: number,
  clipEnd?: number,
) {
  if (width < 180) {
    return 0;
  }
  const derivedSampleCount = Math.ceil(width / FRAME_STRIP_TARGET_TILE_WIDTH);
  const visibleFrameCount =
    typeof frameCount === "number" &&
    typeof clipStart === "number" &&
    typeof clipEnd === "number"
      ? Math.abs(
          progressToFrameBoundaryIndex(clipEnd, frameCount) -
            progressToFrameBoundaryIndex(clipStart, frameCount),
        ) + 1
      : 0;
  return Math.max(
    FRAME_STRIP_MIN_SAMPLES,
    Math.min(FRAME_STRIP_MAX_SAMPLES, Math.max(derivedSampleCount, visibleFrameCount)),
  );
}

export function getLayerRowDescriptors(input: {
  layerTracks: TimelineTrackModel[];
  dropTrackIndex: number | null;
  draggingTrackIndex: number | null;
  dragGhost: DragGhostState;
  draggingClipMode: "move" | "resize-start" | "resize-end" | null;
  draggingClipId: string | null;
  clipMovePreview: ClipMovePreviewState;
  recentlyAddedTrackId: string | null;
  deletingTrackId: string | null;
  durationSeconds: number;
  totalW: number;
}): LayerRowDescriptor[] {
  const {
    layerTracks,
    dropTrackIndex,
    draggingTrackIndex,
    dragGhost,
    draggingClipMode,
    draggingClipId,
    clipMovePreview,
    recentlyAddedTrackId,
    deletingTrackId,
    durationSeconds,
    totalW,
  } = input;

  return layerTracks.map((track, originalIndex) => {
    const isDropTarget = dropTrackIndex === originalIndex;
    const isDraggingRow = draggingTrackIndex === originalIndex;
    const isLayerReorderDrag = dragGhost !== null;
    const isBlockMoveDrag = draggingClipMode === "move" && draggingClipId !== null && !isLayerReorderDrag;
    const isRecentlyAdded = recentlyAddedTrackId === track.id;
    const isDeleting = deletingTrackId === track.id;
    const movePreviewForTrack =
      isBlockMoveDrag && clipMovePreview?.targetTrackIndex === originalIndex
        ? clipMovePreview
        : null;
    const previewLeft = movePreviewForTrack
      ? TIMELINE_START_OFFSET + movePreviewForTrack.targetStart * totalW
      : 0;
    const previewWidth = movePreviewForTrack
      ? Math.max(18, (movePreviewForTrack.targetEnd - movePreviewForTrack.targetStart) * totalW)
      : 0;
    const previewTimeLabel = movePreviewForTrack
      ? getTimelineTimeLabel(movePreviewForTrack.targetStart, durationSeconds)
      : null;
    const showInsertionCue =
      isLayerReorderDrag &&
      draggingTrackIndex != null &&
      dropTrackIndex != null &&
      draggingTrackIndex !== dropTrackIndex &&
      isDropTarget;
    const showDropZone =
      isDropTarget &&
      isLayerReorderDrag &&
      draggingTrackIndex !== originalIndex;

    return {
      track,
      originalIndex,
      isDropTarget,
      isDraggingRow,
      isLayerReorderDrag,
      isBlockMoveDrag,
      isRecentlyAdded,
      isDeleting,
      movePreviewForTrack,
      previewLeft,
      previewWidth,
      previewTimeLabel,
      showInsertionCue,
      showDropZone,
    };
  });
}
