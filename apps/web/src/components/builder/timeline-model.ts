import {
  clampProgress,
  frameIndexToSequenceProgress,
  progressToFrameIndex,
  progressToFrameBoundaryIndex,
  type OverlayDefinition,
  type ProjectManifest,
} from "@motionroll/shared";

export type TimelineTrackType = "section" | "layer";

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
    layerIndex?: number;
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
  };
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

const timelineVariantPreferenceMap: Record<"desktop" | "mobile", string[]> = {
  desktop: ["desktop", "tablet", "mobile", "original"],
  mobile: ["mobile", "tablet", "desktop", "original"],
};

function getNearestFrameAsset(
  frameAssets: ProjectManifest["sections"][number]["frameAssets"],
  desiredIndex: number,
) {
  if (frameAssets.length === 0) {
    return null;
  }

  const exact = frameAssets.find((frame) => frame.index === desiredIndex);
  if (exact) {
    return exact;
  }

  return [...frameAssets].sort(
    (left, right) =>
      Math.abs(left.index - desiredIndex) - Math.abs(right.index - desiredIndex) ||
      left.index - right.index,
  )[0] ?? null;
}

function getTimelineFrameUrl(
  frameAssets: ProjectManifest["sections"][number]["frameAssets"],
  desiredIndex: number,
  mode: "desktop" | "mobile",
) {
  const frameAsset = getNearestFrameAsset(frameAssets, desiredIndex);
  if (!frameAsset) {
    return null;
  }

  for (const kind of timelineVariantPreferenceMap[mode]) {
    const variant = frameAsset.variants.find((item) => item.kind === kind && item.url.length > 0);
    if (variant) {
      return variant.url;
    }
  }

  return (
    frameAsset.variants[0]?.url ??
    null
  );
}

function getFrameStrip(
  section: ProjectManifest["sections"][number],
  mode: "desktop" | "mobile",
  sampleCount = 18,
) {
  return Array.from({ length: sampleCount }, (_, index) => {
    const progress = sampleCount <= 1 ? 0 : index / Math.max(sampleCount - 1, 1);
    const frameIndex = progressToFrameIndex(progress, section.progressMapping.frameRange);
    return getTimelineFrameUrl(section.frameAssets, frameIndex, mode);
  }).filter((url): url is string => Boolean(url));
}

function createOverlayClip(
  overlay: OverlayDefinition,
  index: number,
  layerIndex: number,
): TimelineClipModel {
  return {
    id: `layer-${overlay.id}`,
    trackType: "layer",
    label: overlay.content.headline || overlay.content.eyebrow || `Layer ${String(index + 1).padStart(2, "0")}`,
    start: overlay.timing.start,
    end: overlay.timing.end,
    tint: "accent",
    metadata: {
      overlayId: overlay.id,
      theme: overlay.content.theme,
      eyebrow: overlay.content.eyebrow,
      body: overlay.content.body,
      transitionPreset: overlay.content.transition?.preset,
      contentType: overlay.content.type ?? "text",
      layerIndex,
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
  mode: "desktop" | "mobile" = "desktop",
  layerCount?: number,
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
      frameStrip: getFrameStrip(section, mode),
    },
  };

  const overlaysByLayer = new Map<number, OverlayDefinition[]>();
  for (const overlay of section.overlays) {
    const layerIndex = overlay.content.layer ?? 0;
    const existing = overlaysByLayer.get(layerIndex);
    if (existing) {
      existing.push(overlay);
    } else {
      overlaysByLayer.set(layerIndex, [overlay]);
    }
  }

  const totalLayers = Math.max(
    layerCount ?? 0,
    [...overlaysByLayer.keys()].reduce((maxLayer, currentLayer) => Math.max(maxLayer, currentLayer + 1), 0),
    1,
  );

  const layerTracks: TimelineTrackModel[] = Array.from({ length: totalLayers }, (_, offset) => totalLayers - offset - 1)
    .map((layerIndex) => ({
      id: `track-layer-${layerIndex}`,
      label: `Layer ${String(layerIndex + 1).padStart(2, "0")}`,
      type: "layer" as const,
      clips: (overlaysByLayer.get(layerIndex) ?? []).map((overlay, index) => createOverlayClip(overlay, index, layerIndex)),
      metadata: {
        layerIndex,
      },
    }));

  return [
    {
      id: "track-sequence",
      label: "Scene",
      type: "section",
      clips: [sequenceClip],
    },
    ...layerTracks,
  ];
}
