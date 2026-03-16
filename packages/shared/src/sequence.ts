import { clampProgress } from "./timing";

export const DEFAULT_SEQUENCE_SCROLL_DISTANCE = 7600;
export const DEFAULT_SEQUENCE_SETTLE_EPSILON = 0.0002;

export type SequenceProgressState = {
  targetProgress: number;
  currentProgress: number;
};

export function lerpProgress(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

export function getVelocityAwareSmoothing(delta: number) {
  const magnitude = Math.abs(delta);
  if (magnitude > 0.22) {
    return 0.18;
  }
  if (magnitude > 0.1) {
    return 0.14;
  }
  if (magnitude > 0.04) {
    return 0.11;
  }
  return 0.08;
}

export function stepSequenceProgress(
  state: SequenceProgressState,
  settleEpsilon = DEFAULT_SEQUENCE_SETTLE_EPSILON,
) {
  const delta = state.targetProgress - state.currentProgress;
  const nextProgress = lerpProgress(
    state.currentProgress,
    state.targetProgress,
    getVelocityAwareSmoothing(delta),
  );

  if (Math.abs(delta) < settleEpsilon) {
    return state.targetProgress;
  }

  return clampProgress(nextProgress);
}

export function wheelDeltaToProgressDelta(
  deltaY: number,
  scrollDistance = DEFAULT_SEQUENCE_SCROLL_DISTANCE,
) {
  if (scrollDistance <= 0) {
    return 0;
  }

  return deltaY / scrollDistance;
}
