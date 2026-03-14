import {
  clampProgress,
  frameIndexToSequenceProgress,
  progressToFrameBoundaryIndex,
  type OverlayDefinition,
  type ProjectManifest,
} from "@motionroll/shared";

export type TimelineTrackType = "section" | "overlay" | "moment";

export type TimelineClipModel = {
  id: string;
  trackType: TimelineTrackType;
  label: string;
  start: number;
  end: number;
  tint?: "accent" | "muted";
  metadata?: {
    overlayId?: string;
    theme?: string;
    frameStrip?: string[];
    eyebrow?: string;
    body?: string;
    transitionPreset?: string;
    contentType?: string;
  };
};

export type TimelineSelection = {
  clipId: string;
  trackType: TimelineTrackType;
} | null;

export type TimelineDraftState = {
  playhead: number;
  clips: Record<string, Pick<TimelineClipModel, "start" | "end">>;
};

export type TimelineTrackModel = {
  id: string;
  label: string;
  type: TimelineTrackType;
  clips: TimelineClipModel[];
};

export const TIMELINE_SNAP_STEP = 0.025;
export const TIMELINE_MIN_WIDTH = 0.04;
export const TIMELINE_ZOOM_MIN = 0.65;
export const TIMELINE_ZOOM_MAX = 2.25;
export const TIMELINE_ZOOM_DEFAULT = 1.15;

export function clampTimelineValue(value: number) {
  return clampProgress(value);
}

export function getClipDuration(clip: Pick<TimelineClipModel, "start" | "end">) {
  return Math.max(TIMELINE_MIN_WIDTH, clip.end - clip.start);
}

export function collectSnapPoints(tracks: TimelineTrackModel[], activeClipId?: string) {
  const snapPoints = new Set<number>();
  for (const track of tracks) {
    for (const clip of track.clips) {
      if (clip.id === activeClipId) {
        continue;
      }
      snapPoints.add(clip.start);
      snapPoints.add(clip.end);
    }
  }

  for (let step = 0; step <= 40; step += 1) {
    snapPoints.add(step * TIMELINE_SNAP_STEP);
  }

  return Array.from(snapPoints).sort((left, right) => left - right);
}

export function snapTimelineValue(value: number, snapPoints: number[], threshold = 0.012) {
  let snapped = value;
  let distance = Number.POSITIVE_INFINITY;

  for (const point of snapPoints) {
    const nextDistance = Math.abs(point - value);
    if (nextDistance < threshold && nextDistance < distance) {
      snapped = point;
      distance = nextDistance;
    }
  }

  return clampTimelineValue(snapped);
}

export function moveTimelineClip(
  clip: Pick<TimelineClipModel, "start" | "end">,
  delta: number,
  snapPoints: number[],
) {
  const duration = getClipDuration(clip);
  let nextStart = clampTimelineValue(clip.start + delta);
  let nextEnd = clampTimelineValue(nextStart + duration);

  if (nextEnd >= 1) {
    nextEnd = 1;
    nextStart = Math.max(0, nextEnd - duration);
  }

  nextStart = snapTimelineValue(nextStart, snapPoints);
  nextEnd = clampTimelineValue(nextStart + duration);

  return { start: nextStart, end: nextEnd };
}

export function resizeTimelineClip(
  clip: Pick<TimelineClipModel, "start" | "end">,
  edge: "start" | "end",
  nextValue: number,
  snapPoints: number[],
) {
  const snappedValue = snapTimelineValue(nextValue, snapPoints);
  if (edge === "start") {
    return {
      start: Math.min(Math.max(0, snappedValue), clip.end - TIMELINE_MIN_WIDTH),
      end: clip.end,
    };
  }

  return {
    start: clip.start,
    end: Math.max(Math.min(1, snappedValue), clip.start + TIMELINE_MIN_WIDTH),
  };
}

export function getTimelineTimeLabel(progress: number, durationSeconds: number) {
  const totalSeconds = Math.max(0, Math.round(durationSeconds * clampTimelineValue(progress)));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function getTimelineProgressFromPointer(clientX: number, left: number, width: number) {
  if (width <= 0) {
    return 0;
  }

  return clampTimelineValue((clientX - left) / width);
}

export function clampTimelineZoom(value: number) {
  return Math.min(TIMELINE_ZOOM_MAX, Math.max(TIMELINE_ZOOM_MIN, value));
}

export function getTimelineZoomWidth(
  viewportWidth: number,
  durationSeconds: number,
  zoom = TIMELINE_ZOOM_DEFAULT,
) {
  const pxPerSecond = 86 + clampTimelineZoom(zoom) * 190;
  return Math.max(viewportWidth, Math.round(Math.max(durationSeconds, 6) * pxPerSecond));
}

export function getTimelineStepProgress(durationSeconds: number, frames = 12) {
  return clampTimelineValue(1 / Math.max(durationSeconds * frames, 1));
}

function getFrameStrip(section: ProjectManifest["sections"][number], sampleCount = 18) {
  const frameRangeLength = Math.max(
    section.progressMapping.frameRange.end - section.progressMapping.frameRange.start,
    1,
  );

  return Array.from({ length: sampleCount }, (_, index) => {
    const frameIndex =
      section.progressMapping.frameRange.start +
      Math.round((frameRangeLength * index) / Math.max(sampleCount - 1, 1));
    const frameAsset = section.frameAssets.find((frame) => frame.index === frameIndex);
    return (
      frameAsset?.variants.find((variant) => variant.kind === "desktop")?.url ??
      frameAsset?.variants[0]?.url
    );
  }).filter((url): url is string => Boolean(url));
}

function createOverlayClip(
  overlay: OverlayDefinition,
  index: number,
  trackType: "overlay" | "moment",
): TimelineClipModel {
  return {
    id: `${trackType}-${overlay.id}`,
    trackType,
    label:
      trackType === "moment"
        ? overlay.content.eyebrow || `Moment ${String(index + 1).padStart(2, "0")}`
        : overlay.content.headline,
    start: overlay.timing.start,
    end: overlay.timing.end,
    tint: trackType === "overlay" ? "accent" : "muted",
    metadata: {
      overlayId: overlay.id,
      theme: overlay.content.theme,
      eyebrow: overlay.content.eyebrow,
      body: overlay.content.body,
      transitionPreset: overlay.content.transition?.preset,
      contentType: overlay.content.type ?? "text",
    },
  };
}

export function getFrameRangeFromClip(
  clip: Pick<TimelineClipModel, "start" | "end">,
  frameCount: number,
) {
  return {
    start: progressToFrameBoundaryIndex(clip.start, frameCount),
    end: progressToFrameBoundaryIndex(clip.end, frameCount),
  };
}

export function deriveTimelineTracks(
  manifest: ProjectManifest,
  _durationSeconds: number,
): TimelineTrackModel[] {
  const section = manifest.sections[0];
  if (!section) {
    return [] as TimelineTrackModel[];
  }

  const frameCount = Math.max(section.frameCount, 1);
  const sequenceClip: TimelineClipModel = {
    id: "section-range",
    trackType: "section",
    label: section.title,
    start: frameIndexToSequenceProgress(section.progressMapping.frameRange.start, frameCount),
    end: frameIndexToSequenceProgress(section.progressMapping.frameRange.end, frameCount),
    tint: "muted",
    metadata: {
      frameStrip: getFrameStrip(section),
    },
  };

  const isMomentOverlay = (overlay: OverlayDefinition) => {
    const eyebrow = overlay.content.eyebrow?.trim().toLowerCase();
    return eyebrow === "moment" || eyebrow === "feature" || eyebrow === "highlight";
  };

  const contentOverlays = section.overlays.filter((overlay) => !isMomentOverlay(overlay));
  const momentOverlays = section.overlays.filter((overlay) => isMomentOverlay(overlay));

  return [
    {
      id: "track-sequence",
      label: "Sequence",
      type: "section",
      clips: [sequenceClip],
    },
    {
      id: "track-content",
      label: "Content",
      type: "overlay",
      clips: contentOverlays.map((overlay, index) => createOverlayClip(overlay, index, "overlay")),
    },
    {
      id: "track-moments",
      label: "Moments",
      type: "moment",
      clips: momentOverlays.map((overlay, index) => createOverlayClip(overlay, index, "moment")),
    },
  ];
}
