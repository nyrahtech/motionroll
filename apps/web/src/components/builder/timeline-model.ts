import {
  clampProgress,
  progressToFrameBoundaryIndex,
  progressToFrameIndex,
  type ProjectManifest,
} from "@motionroll/shared";

export type TimelineTrackType = "section" | "layer";

export type TimelineFrameStripSource = {
  frames: Array<{
    index: number;
    url: string;
  }>;
  frameCount: number;
  fallbackUrl?: string;
};

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
    frameStripSource?: TimelineFrameStripSource;
    text?: string;
    contentType?: string;
    enterAnimationType?: string;
    exitAnimationType?: string;
    layerIndex?: number;
    isGroup?: boolean;
    childCount?: number;
    bookmarkId?: string;
    bookmarkIndex?: number;
    isSelectedBookmark?: boolean;
    sectionHeightVh?: number;
    bookmarkStartProgress?: number;
    bookmarkEndProgress?: number;
    bookmarkDurationSeconds?: number;
    backgroundMediaUrl?: string;
    backgroundMediaDurationMs?: number;
    backgroundMediaPosterUrl?: string;
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
  metadata?: {
    overlayId?: string;
    layerIndex?: number;
    bookmarkAddStart?: number;
    bookmarkAddEnd?: number;
  };
};

export const TIMELINE_SNAP_STEP = 0.025;
export const TIMELINE_MIN_WIDTH = 0.04;
export const TIMELINE_ZOOM_MIN = 0.65;
export const TIMELINE_ZOOM_MAX = 2.25;
export const TIMELINE_ZOOM_DEFAULT = 1.15;
const TIMELINE_TRACK_MIN_WIDTH = 960;
const TIMELINE_TRACK_PX_PER_SECOND = 118;
export const TIMELINE_ADD_BLOCK_PX = 148;

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

export function getTimelineTrackWidth(durationSeconds: number) {
  return Math.max(TIMELINE_TRACK_MIN_WIDTH, Math.round(durationSeconds * TIMELINE_TRACK_PX_PER_SECOND));
}

const timelineVariantPreferenceMap: Record<"desktop" | "mobile", string[]> = {
  desktop: ["desktop", "tablet", "mobile", "original"],
  mobile: ["mobile", "tablet", "desktop", "original"],
};

function getTimelineFrameAssetUrl(
  frameAsset: ProjectManifest["sections"][number]["frameAssets"][number],
  mode: "desktop" | "mobile",
) {
  for (const kind of timelineVariantPreferenceMap[mode]) {
    const variant = frameAsset.variants.find((item) => item.kind === kind && item.url.length > 0);
    if (variant) {
      return variant.url;
    }
  }

  return frameAsset.variants[0]?.url ?? null;
}

export function getTimelineFrameStripSource(
  section: ProjectManifest["sections"][number],
  mode: "desktop" | "mobile",
): TimelineFrameStripSource {
  const frames = section.frameAssets.flatMap((frameAsset) => {
    const url = getTimelineFrameAssetUrl(frameAsset, mode);
    return url ? [{ index: frameAsset.index, url }] : [];
  });
  const fallbackUrl =
    section.fallback.posterUrl ??
    section.fallback.firstFrameUrl ??
    frames[0]?.url;

  return {
    frames,
    frameCount: Math.max(section.frameCount, 1),
    fallbackUrl,
  };
}

function getTimelineFrameUrl(
  frameSource: TimelineFrameStripSource,
  desiredIndex: number,
) {
  if (frameSource.frames.length === 0) {
    return null;
  }

  const exact = frameSource.frames.find((frame) => frame.index === desiredIndex);
  if (exact) {
    return exact.url;
  }

  const sorted = [...frameSource.frames].sort((left, right) => left.index - right.index);
  return (
    sorted.find((frame) => frame.index > desiredIndex)?.url ??
    [...sorted].reverse().find((frame) => frame.index < desiredIndex)?.url ??
    sorted[0]?.url ??
    null
  );
}

function getFrameRangeForProgressRange(
  startProgress: number,
  endProgress: number,
  frameCount: number,
) {
  return {
    start: progressToFrameBoundaryIndex(startProgress, frameCount),
    end: progressToFrameBoundaryIndex(endProgress, frameCount),
  };
}

export function getTimelineFrameStripForProgressRange(
  frameSource: TimelineFrameStripSource,
  startProgress: number,
  endProgress: number,
  sampleCount = 8,
) {
  const frameRange = getFrameRangeForProgressRange(startProgress, endProgress, frameSource.frameCount);
  return Array.from({ length: sampleCount }, (_, index) => {
    const progress = sampleCount <= 1 ? 0 : index / (sampleCount - 1);
    const frameIndex = progressToFrameIndex(progress, frameRange);
    return getTimelineFrameUrl(frameSource, frameIndex);
  }).filter((url): url is string => Boolean(url));
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
