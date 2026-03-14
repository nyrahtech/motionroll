import { clampProgress } from "./timing";

export const DEFAULT_SEQUENCE_SCROLL_DISTANCE = 6400;
export const DEFAULT_SEQUENCE_SETTLE_EPSILON = 0.00035;

export type SequenceProgressState = {
  targetProgress: number;
  currentProgress: number;
};

export function lerpProgress(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

export function getVelocityAwareSmoothing(delta: number) {
  const magnitude = Math.abs(delta);
  if (magnitude > 0.18) {
    return 0.25;
  }
  if (magnitude > 0.08) {
    return 0.19;
  }
  if (magnitude > 0.03) {
    return 0.14;
  }
  return 0.1;
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
