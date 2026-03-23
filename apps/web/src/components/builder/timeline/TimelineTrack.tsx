/**
 * TimelineTrack — a single horizontal track row.
 *
 * React.memo'd with a comparator that ignores playheadProgress so
 * track rows don't re-render while the playhead is moving.
 */
import React from "react";
import type { TimelineTrackModel } from "../timeline-model";
import { TimelineClip } from "./TimelineClip";

type TimelineTrackProps = {
  track: TimelineTrackModel | undefined;
  totalW: number;
  selectedClipId?: string;
  selectedClipIds?: string[];
  isDraggable?: boolean;
  tint?: string;
  showFrameStrip?: boolean;
  frameStripCache?: Map<string, string[]>;
  /** clipId → { start, end } preview timing overrides */
  timingPreviews?: Map<string, { start: number; end: number }>;
  layerTrackIndex?: number;
  onClipPointerDown?: (
    e: React.PointerEvent,
    clip: import("../timeline-model").TimelineClipModel,
    mode: "move" | "resize-start" | "resize-end",
  ) => void;
  onClipClick?: (
    e: React.MouseEvent,
    clip: import("../timeline-model").TimelineClipModel,
  ) => void;
  onClipContextMenu?: (
    e: React.MouseEvent,
    clip: import("../timeline-model").TimelineClipModel,
  ) => void;
  onFrameClick?: (progress: number) => void;
};

function TimelineTrackInner({
  track,
  totalW,
  selectedClipId,
  selectedClipIds,
  isDraggable = true,
  tint,
  showFrameStrip = false,
  frameStripCache,
  timingPreviews,
  onClipPointerDown,
  onClipClick,
  onClipContextMenu,
  onFrameClick,
}: TimelineTrackProps) {
  if (!track) {
    return <div className="relative h-14" style={{ width: totalW }} />;
  }

  return (
    <div className="relative h-14" style={{ width: totalW }}>
      {track.clips.map((clip, clipIndex) => {
        const preview = timingPreviews?.get(clip.id);
        const frameStrip = showFrameStrip ? frameStripCache?.get(clip.id) : undefined;
        const isSelected = selectedClipId === clip.id;
        const isMultiSelected = selectedClipIds?.includes(clip.id) ?? false;
        const stackZIndex =
          track.type === "section" ? 2 : isSelected ? 30 : 10 + clipIndex;

        return (
          <TimelineClip
            key={clip.id}
            clip={clip}
            trackType={track.type}
            totalW={totalW}
            isSelected={isSelected}
            isMultiSelected={isMultiSelected}
            isDraggable={isDraggable}
            frameStrip={frameStrip}
            previewStart={preview?.start}
            previewEnd={preview?.end}
            tint={tint}
            stackZIndex={stackZIndex}
            onFrameClick={onFrameClick}
            onPointerDown={onClipPointerDown}
            onClick={onClipClick}
            onContextMenu={onClipContextMenu}
          />
        );
      })}
    </div>
  );
}

export const TimelineTrack = React.memo(TimelineTrackInner, (prev, next) => {
  return (
    prev.track === next.track &&
    prev.totalW === next.totalW &&
    prev.selectedClipId === next.selectedClipId &&
    prev.selectedClipIds === next.selectedClipIds &&
    prev.isDraggable === next.isDraggable &&
    prev.tint === next.tint &&
    prev.showFrameStrip === next.showFrameStrip &&
    prev.frameStripCache === next.frameStripCache &&
    prev.timingPreviews === next.timingPreviews &&
    prev.onClipPointerDown === next.onClipPointerDown &&
    prev.onClipClick === next.onClipClick &&
    prev.onClipContextMenu === next.onClipContextMenu &&
    prev.onFrameClick === next.onFrameClick
  );
});
TimelineTrack.displayName = "TimelineTrack";
