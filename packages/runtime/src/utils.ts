import type { FrameAsset, OverlayDefinition } from "../../shared/src/index";
import { clampProgress, progressToFrameIndex as mapProgressToFrameIndex } from "../../shared/src/timing";

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function progressToFrameIndex(
  progress: number,
  frameRange: { start: number; end: number },
) {
  return mapProgressToFrameIndex(progress, frameRange);
}

export function getFrameByIndex(frameAssets: FrameAsset[], desiredIndex: number) {
  if (frameAssets.length === 0) {
    return undefined;
  }

  const exact = frameAssets.find((frame) => frame.index === desiredIndex);
  if (exact) {
    return exact;
  }

  const sorted = [...frameAssets].sort((a, b) => a.index - b.index);
  return (
    sorted.find((frame) => frame.index > desiredIndex) ??
    [...sorted].reverse().find((frame) => frame.index < desiredIndex) ??
    sorted[0]
  );
}

export function getOverlaysInStackOrder(overlays: OverlayDefinition[]) {
  return [...overlays].sort((left, right) => (left.content.layer ?? 0) - (right.content.layer ?? 0));
}

export function getActiveOverlayId(
  overlays: OverlayDefinition[],
  progress: number,
) {
  const normalizedProgress = clampProgress(progress);
  return [...getOverlaysInStackOrder(overlays)]
    .reverse()
    .find(
      (overlay) =>
        normalizedProgress >= overlay.timing.start && normalizedProgress <= overlay.timing.end,
    )?.id;
}
