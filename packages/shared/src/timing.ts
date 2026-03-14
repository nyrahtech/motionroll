export type NormalizedRange = {
  start: number;
  end: number;
};

export function clampProgress(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function getFrameRangeLength(frameRange: NormalizedRange) {
  return Math.max(frameRange.end - frameRange.start, 1);
}

export function progressToFrameIndex(progress: number, frameRange: NormalizedRange) {
  const normalized = clampProgress(progress);
  const usableFrameCount = getFrameRangeLength(frameRange);
  return Math.min(
    frameRange.end,
    Math.max(frameRange.start, frameRange.start + Math.round(normalized * usableFrameCount)),
  );
}

export function frameIndexToSequenceProgress(frameIndex: number, frameCount: number) {
  const maxIndex = Math.max(frameCount - 1, 1);
  return clampProgress(frameIndex / maxIndex);
}

export function progressToFrameBoundaryIndex(progress: number, frameCount: number) {
  const maxIndex = Math.max(frameCount - 1, 1);
  return Math.round(clampProgress(progress) * maxIndex);
}

export function normalizeTimingRange(
  range: NormalizedRange,
  minimumWidth = 0,
): NormalizedRange {
  const start = clampProgress(Math.min(range.start, range.end));
  const end = clampProgress(Math.max(range.end, range.start));

  if (end - start >= minimumWidth) {
    return { start, end };
  }

  return {
    start,
    end: clampProgress(start + minimumWidth),
  };
}

export function secondsToProgress(seconds: number, durationSeconds: number) {
  if (durationSeconds <= 0) {
    return 0;
  }

  return clampProgress(seconds / durationSeconds);
}

export function progressToSeconds(progress: number, durationSeconds: number) {
  return clampProgress(progress) * Math.max(durationSeconds, 0);
}
